import { registerMap } from 'echarts/core';
import sourceUrl from '@/assets/maps/china.json?url';

export const CHINA_MAP_NAME = 'china-provinces';
export const CHINA_CITY_MAP_NAME = 'china-cities';
export const DIRECT_CITIES = new Set([110000, 120000, 310000, 500000, 810000, 820000]);
type Coordinate = [number, number];
type MapBounds = [Coordinate, Coordinate];
type Ring = number[][];
interface MapFeature {
  type: 'Feature';
  properties: {
    name?: string;
    adcode?: number | string;
    centroid?: number[];
    center?: number[];
    childrenNum?: number;
    level?: string;
    provinceCode?: number;
    provinceName?: string;
  };
  geometry:
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'MultiPolygon'; coordinates: Ring[][] };
}
interface MapSource {
  type: 'FeatureCollection';
  features: MapFeature[];
}
export interface MapRegion {
  name: string;
  adcode: number;
  center: Coordinate | null;
  level: string;
  childrenNum: number;
  provinceCode?: number;
  provinceName?: string;
}
export interface LoadedMap {
  name: string;
  regions: MapRegion[];
  source: MapSource;
  province: MapRegion | null;
  hasSubregions: boolean;
  bounds: MapBounds;
}
const provinceUrls = import.meta.glob('../../assets/maps/provinces/[0-9]*.json', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const pending = new Map<number, Promise<LoadedMap>>();
let cityTask: Promise<LoadedMap> | undefined;
const validCoordinate = (value: unknown): value is Coordinate =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

function register(
  source: MapSource,
  province: MapRegion | null,
  hasSubregions: boolean,
  mapName?: string,
  fixedBounds?: MapBounds,
): LoadedMap {
  if (
    source.type !== 'FeatureCollection' ||
    !Array.isArray(source.features) ||
    !source.features.length
  )
    throw new Error('Invalid map data');
  const regions = source.features.flatMap(({ properties }) => {
    if (typeof properties.adcode !== 'number' || !properties.name) return [];
    return [
      {
        name: properties.name,
        adcode: properties.adcode,
        center: validCoordinate(properties.centroid)
          ? properties.centroid
          : validCoordinate(properties.center)
            ? properties.center
            : null,
        level: properties.level || 'province',
        childrenNum: properties.childrenNum || 0,
        provinceCode: properties.provinceCode,
        provinceName: properties.provinceName,
      },
    ];
  });
  const name = mapName || (province ? `china-${province.adcode}` : CHINA_MAP_NAME);
  // Keep source geometry intact, including islands and the maritime boundary feature.
  registerMap(name, source as Parameters<typeof registerMap>[1]);
  return {
    name,
    regions,
    source,
    province,
    hasSubregions,
    bounds: fixedBounds || sourceBounds(source),
  };
}
function sourceBounds(source: MapSource): MapBounds {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const visit = (coordinates: unknown[]) => {
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      minX = Math.min(minX, coordinates[0]);
      maxX = Math.max(maxX, coordinates[0]);
      minY = Math.min(minY, coordinates[1]);
      maxY = Math.max(maxY, coordinates[1]);
    } else for (const child of coordinates) if (Array.isArray(child)) visit(child);
  };
  for (const feature of source.features) visit(feature.geometry.coordinates);
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
async function fetchSource(url: string): Promise<MapSource> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Map data failed to load');
  return response.json();
}
export function loadChinaMap(province: MapRegion | null = null): Promise<LoadedMap> {
  const code = province?.adcode || 100000;
  const cached = pending.get(code);
  if (cached) return cached;
  const promise = (async () => {
    if (!province) {
      const map = register(await fetchSource(sourceUrl), null, true);
      if (map.regions.length !== 34) throw new Error('Incomplete China map data');
      return map;
    }
    const url = provinceUrls[`../../assets/maps/provinces/${code}.json`];
    if (url) return register(await fetchSource(url), province, true);
    const country = await loadChinaMap();
    const feature = country.source.features.find((item) => item.properties.adcode === code);
    if (!feature) throw new Error('Unknown province');
    return register({ type: 'FeatureCollection', features: [feature] }, province, false);
  })().catch((error: unknown) => {
    pending.delete(code);
    throw error;
  });
  pending.set(code, promise);
  return promise;
}
// Both detail levels use the same national extent so changing boundaries never reframes the map.
// Subdivision files are requested only when first zooming to city level, with bounded concurrency.
export function loadChinaCityMap(): Promise<LoadedMap> {
  if (cityTask) return cityTask;
  cityTask = (async () => {
    const country = await loadChinaMap();
    const queue = country.regions.filter(
      (region) => region.childrenNum > 0 && !DIRECT_CITIES.has(region.adcode),
    );
    const sources = new Map<number, LoadedMap>();
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let province = queue.shift(); province; province = queue.shift())
          sources.set(province.adcode, await loadChinaMap(province));
      }),
    );
    const features = country.source.features.flatMap((feature) => {
      const code = Number(feature.properties.adcode),
        name = feature.properties.name;
      if (!name) return [feature];
      const cities = sources.get(code)?.source.features || [feature];
      return cities.map((city) => ({
        ...city,
        properties: {
          ...city.properties,
          provinceCode: code,
          provinceName: name,
          ...(DIRECT_CITIES.has(code) ? { level: 'city' } : {}),
        },
      }));
    });
    return register(
      { type: 'FeatureCollection', features },
      null,
      true,
      CHINA_CITY_MAP_NAME,
      country.bounds,
    );
  })().catch((error: unknown) => {
    cityTask = undefined;
    throw error;
  });
  return cityTask;
}
function inRing([x, y]: Coordinate, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(point: Coordinate, rings: Ring[]): boolean {
  return (
    rings.length > 0 &&
    inRing(point, rings[0]) &&
    !rings.slice(1).some((ring) => inRing(point, ring))
  );
}
export function regionAt(map: LoadedMap, point: Coordinate): MapRegion | undefined {
  const feature = map.source.features.find((item) =>
    item.geometry.type === 'Polygon'
      ? inPolygon(point, item.geometry.coordinates)
      : item.geometry.coordinates.some((polygon) => inPolygon(point, polygon)),
  );
  return map.regions.find((region) => region.adcode === feature?.properties.adcode);
}

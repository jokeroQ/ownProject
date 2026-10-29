<template>
  <div
    class="map-page app-page"
    :data-map-level="cityLevel ? 'city' : 'province'"
    data-map-code="100000"
    :data-map-zoom="currentZoom"
    :data-city-loading="detailLoading"
    :data-map-ready="ready && !loading"
  >
    <div class="map-workspace" :class="{ 'is-loading': loading, 'is-marking': marking }">
      <div
        ref="mapElement"
        class="map-container"
        data-map-canvas
        role="region"
        aria-label="中国地图，连续缩放至市级，可添加标记并编辑地点信息"
        :aria-busy="loading"
      ></div>
    </div>
    <header class="map-header app-page__header">
      <PageBackButton @click="goBack" />
      <div class="map-heading app-page__heading">
        <h1 class="app-page__title">可视化地图</h1>
        <p class="app-page__description">缩放显示城市 · 点击标记编辑</p>
      </div>
    </header>
    <div class="map-header-actions">
      <el-tooltip
        :content="marking ? '结束标点' : '添加标记：点击地图连续标点'"
        :show-after="250"
        :trigger-keys="[]"
        ><span
          ><el-button
            class="map-icon-button app-icon-button"
            :class="{ 'is-marking': marking }"
            :icon="Location"
            :aria-label="marking ? '结束标点' : '添加标记'"
            :aria-pressed="marking"
            :disabled="!ready || loading"
            @click="marking = !marking" /></span
      ></el-tooltip>
      <el-tooltip content="标记点列表" :show-after="250" :trigger-keys="[]"
        ><span class="marker-list-trigger"
          ><el-button
            class="map-icon-button app-icon-button"
            :icon="List"
            aria-label="标记点列表"
            @click="markerDialogs?.openList()"
          /><span v-if="markers.length" class="marker-count">{{ markers.length }}</span></span
        ></el-tooltip
      >
    </div>
    <div class="map-search" :class="{ 'has-cities': searchCities.length > 0 }">
      <el-select
        class="province-select"
        popper-class="map-province-options"
        :model-value="searchProvince"
        aria-label="选择省份"
        placeholder="定位省份"
        filterable
        clearable
        :disabled="!ready || loading"
        @change="chooseProvince"
        ><el-option
          v-for="province in provinces"
          :key="province.adcode"
          :label="province.name"
          :value="province.name"
      /></el-select>
      <el-select
        v-if="searchCities.length > 0"
        class="city-select"
        popper-class="map-city-options"
        :model-value="searchCities.some((city) => city.name === selectedName) ? selectedName : ''"
        aria-label="选择城市"
        placeholder="定位城市"
        filterable
        clearable
        :disabled="searchLoading"
        @change="chooseCity"
        ><el-option
          v-for="region in searchCities"
          :key="region.adcode"
          :label="region.name"
          :value="region.name"
      /></el-select>
    </div>
    <section v-if="selectedRegion" class="region-details" data-map-region aria-live="polite">
      <div class="region-title">
        <h2>{{ selectedRegion.name }}</h2>
        <el-tooltip content="清除选择" :show-after="250" :trigger-keys="[]"
          ><el-button
            class="map-icon-button app-icon-button"
            :icon="Close"
            aria-label="清除选择"
            @click="selectRegion('')"
        /></el-tooltip>
      </div>
      <span
        >行政区代码 <strong data-region-code>{{ selectedRegion.adcode }}</strong></span
      >
    </section>
    <div v-if="loading" class="map-empty" role="status">{{ loadingText }}</div>
    <div v-if="detailLoading && currentZoom >= CITY_ZOOM" class="map-detail-loading" role="status">
      正在加载市级边界，可继续缩放和平移…
    </div>
    <div v-if="displayError" class="map-load-error" role="alert">
      <span>{{ displayError }}</span
      ><el-button link @click="retryMap">重试</el-button>
    </div>
    <div v-if="marking" class="marking-hint" role="status">
      点击地图添加，点击已有标记编辑 · Esc 结束<el-button
        class="app-icon-button"
        :icon="Close"
        aria-label="结束连续标点"
        @click="marking = false"
      />
    </div>
    <nav class="map-actions" aria-label="地图缩放工具">
      <el-tooltip content="缩小" :show-after="250" :trigger-keys="[]"
        ><span class="icon-tooltip-target"
          ><el-button
            class="map-icon-button app-icon-button"
            :icon="Minus"
            aria-label="缩小"
            :disabled="!ready || loading || currentZoom <= MIN_ZOOM"
            @click="zoomBy(0.8)" /></span
      ></el-tooltip>
      <span class="zoom-level" aria-live="polite">{{ Math.round(currentZoom * 100) }}%</span>
      <el-tooltip content="放大" :show-after="250" :trigger-keys="[]"
        ><span class="icon-tooltip-target"
          ><el-button
            class="map-icon-button app-icon-button"
            :icon="Plus"
            aria-label="放大"
            :disabled="!ready || loading || currentZoom >= MAX_ZOOM"
            @click="zoomBy(1.25)" /></span
      ></el-tooltip>
      <el-tooltip content="适配当前地图" :show-after="250" :trigger-keys="[]"
        ><span class="icon-tooltip-target"
          ><el-button
            class="map-icon-button app-icon-button"
            :icon="FullScreen"
            aria-label="适配当前地图"
            :disabled="!ready || loading"
            @click="resetView" /></span
      ></el-tooltip>
    </nav>
    <footer class="map-footer">
      <span>{{ cityLevel ? '中国 · 市级边界' : '中国 · 放大显示市级边界' }}</span
      ><a
        href="https://datav.aliyun.com/portal/school/atlas/area_selector"
        target="_blank"
        rel="noopener noreferrer"
        >地图数据：DataV GeoAtlas</a
      >
    </footer>
    <MapMarkerDialogs
      ref="markerDialogs"
      :markers="markers"
      :save-marker="saveMarker"
      :remove-marker="remove"
      @focus="focusMarker"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElMessage, ElOption, ElSelect, ElTooltip } from 'element-plus';
import { Close, FullScreen, List, Location, Minus, Plus } from '@element-plus/icons-vue';
import PageBackButton from '@/components/navigation/PageBackButton.vue';
import { init, use, type ComposeOption, type EChartsType } from 'echarts/core';
import { GeoComponent, type GeoComponentOption } from 'echarts/components';
import { ScatterChart, type ScatterSeriesOption } from 'echarts/charts';
import { SVGRenderer } from 'echarts/renderers';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/select/style/css';
import 'element-plus/es/components/tooltip/style/css';
import {
  DIRECT_CITIES,
  loadChinaCityMap,
  loadChinaMap,
  regionAt,
  type LoadedMap,
  type MapRegion,
} from './chinaMap';
import { useMapMarkers, type MapMarker, type MarkerEdit } from './useMapMarkers';
import MapMarkerDialogs from './MapMarkerDialogs.vue';
import { themeState } from '@/utils/theme';

defineOptions({ name: 'VisualMapPage' });
use([GeoComponent, ScatterChart, SVGRenderer]);
const MIN_ZOOM = 0.75,
  MAX_ZOOM = 24,
  CITY_ZOOM = 3;
const router = useRouter(),
  route = useRoute();
const mapElement = ref<HTMLDivElement | null>(null);
const markerDialogs = ref<InstanceType<typeof MapMarkerDialogs>>();
const ready = ref(false),
  loading = ref(true),
  detailLoading = ref(false);
const mapError = ref(''),
  detailError = ref(''),
  loadingText = ref('正在加载中国地图…');
const currentZoom = ref(1),
  selectedName = ref(''),
  marking = ref(false);
const country = shallowRef<LoadedMap | null>(null),
  detailed = shallowRef<LoadedMap | null>(null),
  currentMap = shallowRef<LoadedMap | null>(null);
const searchProvince = ref(''),
  searchCities = shallowRef<MapRegion[]>([]),
  searchLoading = ref(false);
const provinces = computed(() => country.value?.regions || []);
const cityLevel = computed(() => currentMap.value !== null && currentMap.value === detailed.value);
const displayError = computed(
  () => mapError.value || (currentZoom.value >= CITY_ZOOM ? detailError.value : ''),
);
const selectedRegion = computed(
  () =>
    currentMap.value?.regions.find((region) => region.name === selectedName.value) ||
    searchCities.value.find((region) => region.name === selectedName.value) ||
    provinces.value.find((region) => region.name === selectedName.value),
);
const { markers, add, update, remove } = useMapMarkers();
function markerData() {
  const placed: { x: number; y: number; width: number }[] = [];
  const positioned = Boolean(geoOption());
  return markers.value.map((marker) => {
    const point = positioned && chart?.convertToPixel({ geoId: 'china' }, [marker.lng, marker.lat]);
    const width = marker.name.length * 11 + 12;
    let offset = 0;
    if (Array.isArray(point)) {
      while (
        placed.some(
          (other) =>
            Math.abs(other.y - point[1] - offset) < 22 &&
            Math.abs(other.x - point[0]) < (other.width + width) / 2,
        )
      )
        offset -= 22;
      placed.push({ x: point[0], y: point[1] + offset, width });
    }
    return {
      id: marker.id,
      name: marker.name,
      value: [marker.lng, marker.lat],
      label: { offset: [0, offset] },
    };
  });
}
let chart: EChartsType | null = null,
  observer: ResizeObserver | null = null;
let resizeFrame = 0,
  refreshFrame = 0,
  labelTimer = 0,
  disposed = false,
  generation = 0,
  searchRevision = 0,
  labelsVisible = false;
let pressed = false,
  dragged = false,
  pointerStart = [0, 0];
const shortName = (name: string) =>
  name.replace(/壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市/g, '');
const color = (variable: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
const geoOption = () => (chart?.getOption()?.geo as GeoComponentOption[] | undefined)?.[0];
const canShowLabels = () =>
  cityLevel.value
    ? currentZoom.value >= ((mapElement.value?.clientWidth || 0) < 600 ? 6 : 4.5)
    : ((mapElement.value?.clientWidth || 0) >= 600 &&
        (mapElement.value?.clientHeight || 0) >= 400) ||
      currentZoom.value >= 3;

function labelOverrides(): NonNullable<GeoComponentOption['regions']> {
  const overrides: NonNullable<GeoComponentOption['regions']> = [];
  if (cityLevel.value && labelsVisible && chart && mapElement.value) {
    const occupied: { x: number; y: number; width: number }[] = [];
    const regions = [...(currentMap.value?.regions || [])].sort(
      (a, b) => Number(b.name === selectedName.value) - Number(a.name === selectedName.value),
    );
    for (const region of regions) {
      const point = region.center && chart.convertToPixel({ geoId: 'china' }, region.center);
      const width = region.name.length * 11 + 8;
      const show =
        Array.isArray(point) &&
        point[0] >= width / 2 &&
        point[0] <= mapElement.value.clientWidth - width / 2 &&
        point[1] >= 12 &&
        point[1] <= mapElement.value.clientHeight - 12 &&
        !occupied.some(
          (other) =>
            Math.abs(other.y - point[1]) < 22 &&
            Math.abs(other.x - point[0]) < (other.width + width) / 2,
        );
      if (show) occupied.push({ x: point[0], y: point[1], width });
      overrides.push({ name: region.name, label: { show: Boolean(show) } });
    }
  } else if (!cityLevel.value) {
    overrides.push(
      ...['北京市', '天津市', '上海市', '香港特别行政区', '澳门特别行政区'].map((name) => ({
        name,
        label: { show: false },
      })),
    );
  }
  overrides.push({
    name: '',
    silent: true,
    label: { show: false },
    emphasis: { disabled: true },
    select: { disabled: true },
  });
  return overrides;
}
function updateAppearance(reset = false) {
  if (!chart || !currentMap.value || !country.value) return;
  labelsVisible = canShowLabels();
  const previous = geoOption();
  const option: ComposeOption<GeoComponentOption | ScatterSeriesOption> = {
    animation: false,
    geo: {
      id: 'china',
      map: currentMap.value.name,
      roam: true,
      boundingCoords: country.value.bounds,
      layoutCenter: ['50%', '50%'],
      layoutSize: '94%',
      scaleLimit: { min: MIN_ZOOM, max: MAX_ZOOM },
      zoom: reset ? 1 : currentZoom.value,
      ...(!reset && previous?.center ? { center: previous.center } : {}),
      selectedMode: marking.value ? false : 'single',
      selectedMap: Object.fromEntries(
        currentMap.value.regions.map((region) => [region.name, region.name === selectedName.value]),
      ),
      itemStyle: {
        areaColor: color('--el-color-primary-light-8'),
        borderColor: color('--el-color-primary-light-3'),
        borderWidth: cityLevel.value ? 0.7 : 1,
      },
      label: {
        show: labelsVisible,
        color: color('--theme-muted'),
        fontSize: cityLevel.value ? 11 : 10,
        formatter: (params) => (cityLevel.value ? params.name : shortName(params.name)),
      },
      emphasis: {
        label: { show: true, color: color('--theme-text'), fontWeight: 600 },
        itemStyle: {
          areaColor: color('--el-color-primary-light-7'),
          borderColor: color('--el-color-primary'),
          borderWidth: 1.5,
        },
      },
      select: {
        label: { show: true, color: '#fff', fontWeight: 600 },
        itemStyle: {
          areaColor: color('--el-color-primary'),
          borderColor: color('--el-color-primary-dark-2'),
          borderWidth: 1.5,
        },
      },
      regions: labelOverrides(),
    },
    series: [
      {
        id: 'markers',
        type: 'scatter',
        coordinateSystem: 'geo',
        geoId: 'china',
        symbol: 'pin',
        symbolSize: 26,
        z: 10,
        clip: true,
        itemStyle: {
          color: '#f59e0b',
          borderColor: color('--el-bg-color-overlay'),
          borderWidth: 1.5,
          opacity: 1,
        },
        label: {
          show: true,
          position: 'top',
          distance: 7,
          formatter: '{b}',
          color: color('--theme-text'),
          fontSize: 11,
          backgroundColor: color('--el-bg-color-overlay'),
          borderRadius: 4,
          padding: [3, 5],
        },
        emphasis: { scale: 1.2 },
        data: markerData(),
      },
    ],
  };
  chart.setOption(option, { notMerge: reset });
}
function refreshLevel() {
  refreshFrame = 0;
  const target = currentZoom.value >= CITY_ZOOM && detailed.value ? detailed.value : country.value;
  if (!target || !chart) return;
  if (currentMap.value !== target) {
    currentMap.value = target;
    updateAppearance();
  } else if (labelsVisible !== canShowLabels()) updateAppearance();
}
function scheduleRefresh() {
  if (!refreshFrame && !disposed) refreshFrame = requestAnimationFrame(refreshLevel);
}
function settleLabels() {
  clearTimeout(labelTimer);
  labelTimer = window.setTimeout(() => {
    if (!disposed) updateAppearance();
  }, 160);
}
async function ensureCityDetails() {
  if (!country.value || detailed.value || detailLoading.value) return;
  const revision = generation;
  detailLoading.value = true;
  detailError.value = '';
  try {
    const map = await loadChinaCityMap();
    if (disposed || revision !== generation) return;
    detailed.value = map;
    scheduleRefresh();
  } catch {
    if (!disposed && revision === generation)
      detailError.value = '市级边界加载失败，已保留当前地图';
  } finally {
    if (!disposed && revision === generation) detailLoading.value = false;
  }
}
function selectRegion(name: string) {
  const previous = selectedName.value;
  selectedName.value = name || '';
  if (previous) chart?.dispatchAction({ type: 'geoUnSelect', geoId: 'china', name: previous });
  if (currentMap.value?.regions.some((region) => region.name === name))
    chart?.dispatchAction({ type: 'geoSelect', geoId: 'china', name });
}
function setView(center: [number, number], zoom: number) {
  currentZoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  chart?.setOption({ geo: { id: 'china', center, zoom: currentZoom.value } });
  scheduleRefresh();
  settleLabels();
}
async function chooseProvince(name: string) {
  const revision = ++searchRevision;
  searchProvince.value = name || '';
  searchCities.value = [];
  searchLoading.value = false;
  const province = provinces.value.find((region) => region.name === name);
  if (!province) {
    selectRegion('');
    return;
  }
  selectRegion(province.name);
  if (province.center) setView(province.center, 4);
  if (DIRECT_CITIES.has(province.adcode) || !province.childrenNum) return;
  searchLoading.value = true;
  try {
    const map = await loadChinaMap(province);
    if (!disposed && revision === searchRevision) searchCities.value = map.regions;
  } catch {
    if (!disposed && revision === searchRevision)
      ElMessage.warning('城市列表加载失败，请重新选择省份');
  } finally {
    if (revision === searchRevision) searchLoading.value = false;
  }
}
function chooseCity(name: string) {
  selectRegion(name);
  const city = searchCities.value.find((region) => region.name === name);
  if (city?.center) setView(city.center, 12);
}
function zoomBy(factor: number) {
  currentZoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom.value * factor));
  chart?.setOption({ geo: { id: 'china', zoom: currentZoom.value } });
  scheduleRefresh();
  settleLabels();
}
function resetView() {
  currentZoom.value = 1;
  chart?.setOption({ geo: { id: 'china', center: null, zoom: 1 } });
  selectRegion('');
  scheduleRefresh();
  settleLabels();
}
function geographicInfo(point: [number, number]) {
  const region =
    (detailed.value && regionAt(detailed.value, point)) ||
    (country.value && regionAt(country.value, point));
  const province =
    provinces.value.find((item) => item.adcode === region?.provinceCode) ||
    (country.value && regionAt(country.value, point));
  return { region, province };
}
function createChart() {
  if (!mapElement.value || chart) return;
  chart = init(mapElement.value, undefined, { renderer: 'svg' });
  chart.getZr().on('mousedown', (event) => {
    pressed = true;
    dragged = false;
    pointerStart = [event.offsetX, event.offsetY];
  });
  chart.getZr().on('mousemove', (event) => {
    if (pressed && Math.hypot(event.offsetX - pointerStart[0], event.offsetY - pointerStart[1]) > 5)
      dragged = true;
  });
  chart.getZr().on('mouseup', () => {
    pressed = false;
  });
  chart.on('click', (params) => {
    if (loading.value || dragged || !currentMap.value) return;
    if (params.componentType === 'series' && params.seriesId === 'markers') {
      const data = params.data;
      if (data && typeof data === 'object' && 'id' in data) {
        const marker = markers.value.find((item) => item.id === data.id);
        if (marker) markerDialogs.value?.openEditor(marker);
      }
      return;
    }
    if (params.componentType !== 'geo') return;
    if (marking.value) {
      const x = params.event?.offsetX,
        y = params.event?.offsetY;
      if (typeof x !== 'number' || typeof y !== 'number') return;
      const point = chart?.convertFromPixel({ geoId: 'china' }, [x, y]);
      if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) return;
      const { region, province } = geographicInfo([point[0], point[1]]);
      if (province)
        add({
          lng: Number(point[0].toFixed(6)),
          lat: Number(point[1].toFixed(6)),
          provinceCode: province.adcode,
          provinceName: province.name,
          regionName: region?.name || province.name,
        });
    } else if (currentMap.value.regions.some((region) => region.name === params.name))
      selectRegion(params.name);
  });
  chart.on('georoam', () => {
    const zoom = geoOption()?.zoom;
    currentZoom.value = typeof zoom === 'number' ? zoom : 1;
    scheduleRefresh();
    settleLabels();
  });
}
async function initMap() {
  const revision = ++generation;
  loading.value = true;
  mapError.value = '';
  try {
    const map = await loadChinaMap();
    if (disposed || revision !== generation || !mapElement.value) return;
    country.value = map;
    currentMap.value = map;
    currentZoom.value = 1;
    createChart();
    updateAppearance(true);
    chart?.getZr().flush();
    if (!mapElement.value.querySelector('svg path'))
      throw new Error('Map geometry was not rendered');
    ready.value = true;
    settleLabels();
  } catch (error) {
    if (!disposed && revision === generation) {
      mapError.value = '地图暂时无法展示';
      console.error('地图渲染失败', error);
    }
  } finally {
    if (!disposed && revision === generation) loading.value = false;
  }
}
function retryMap() {
  if (country.value && currentZoom.value >= CITY_ZOOM) void ensureCityDetails();
  else void initMap();
}
function saveMarker(draft: MarkerEdit) {
  const existing = markers.value.find((marker) => marker.id === draft.id);
  if (!existing || !country.value) {
    ElMessage.warning('该标记已不存在');
    return false;
  }
  const { region, province } = geographicInfo([draft.lng, draft.lat]);
  if (!province) {
    ElMessage.warning('坐标需要位于中国地图区域内');
    return false;
  }
  update({
    ...existing,
    ...draft,
    provinceCode: province.adcode,
    provinceName: province.name,
    regionName: region?.name || province.name,
  });
  ElMessage.success('标记已保存');
  return true;
}
function focusMarker(marker: MapMarker) {
  marking.value = false;
  const { region } = geographicInfo([marker.lng, marker.lat]);
  selectRegion(region?.name || '');
  setView([marker.lng, marker.lat], Math.max(8, currentZoom.value));
}
function goBack() {
  void router.push({
    name: 'home',
    query:
      typeof route.query.fromCategory === 'string' ? { category: route.query.fromCategory } : {},
  });
}
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') marking.value = false;
};
watch(
  () => [
    themeState.settings.mode,
    themeState.settings.primaryColor,
    themeState.settings.colorCards,
  ],
  () => updateAppearance(),
  { flush: 'post' },
);
watch(markers, () => updateAppearance());
watch(marking, () => {
  selectRegion('');
  updateAppearance();
});
watch(
  currentZoom,
  () => {
    if (
      currentZoom.value >= CITY_ZOOM &&
      !detailed.value &&
      !detailLoading.value &&
      !detailError.value
    )
      void ensureCityDetails();
    scheduleRefresh();
  },
  { flush: 'post' },
);
onMounted(() => {
  void initMap();
  window.addEventListener('keydown', onKeydown);
  observer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      chart?.resize();
      updateAppearance();
    });
  });
  if (mapElement.value) observer.observe(mapElement.value);
});
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  searchRevision++;
  observer?.disconnect();
  cancelAnimationFrame(resizeFrame);
  cancelAnimationFrame(refreshFrame);
  clearTimeout(labelTimer);
  window.removeEventListener('keydown', onKeydown);
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.map-page {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: transparent;
  padding: 0;
}
.map-workspace {
  position: absolute;
  inset: 120px 24px 80px;
  min-width: 0;
  min-height: 0;
  border: 0;
  background: transparent;
  overflow: hidden;
}
.map-workspace.is-loading {
  pointer-events: none;
  opacity: 0.45;
}
.map-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  touch-action: none;
}
.map-workspace.is-marking :deep(svg),
.map-workspace.is-marking :deep(svg path) {
  cursor: crosshair !important;
}
.map-header {
  position: absolute;
  top: max(var(--app-page-gutter-y), env(safe-area-inset-top));
  left: max(var(--app-page-gutter-x), env(safe-area-inset-left));
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  right: calc(var(--app-page-gutter-x) + 88px);
}
.map-icon-button.is-marking {
  color: var(--ui-accent-text);
}
.map-header-actions {
  position: absolute;
  top: max(var(--app-page-gutter-y), env(safe-area-inset-top));
  right: max(var(--app-page-gutter-x), env(safe-area-inset-right));
  display: flex;
  gap: 10px;
  align-items: center;
}
.map-header-actions > span {
  display: inline-flex;
}
.marker-list-trigger {
  position: relative;
}
.marker-count {
  position: absolute;
  right: -3px;
  top: -2px;
  min-width: 20px;
  padding: 0 4px;
  border-radius: 10px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: var(--app-font-caption-size);
  line-height: 20px;
  text-align: center;
  pointer-events: none;
}
.map-search {
  position: absolute;
  top: 78px;
  right: max(28px, env(safe-area-inset-right));
  display: flex;
  gap: 10px;
}
.province-select,
.city-select {
  width: 160px;
}
.region-details {
  position: absolute;
  bottom: 82px;
  left: max(28px, env(safe-area-inset-left));
  max-width: calc(100% - 56px);
}
.region-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.region-title h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.region-details > span {
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
}
.region-details strong {
  margin-left: 8px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.map-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: calc(100% - 32px);
  color: var(--theme-muted);
  font-size: 13px;
  text-align: center;
}
.map-load-error {
  position: absolute;
  top: 120px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--theme-muted);
  font-size: 12px;
}
.map-detail-loading {
  position: absolute;
  top: 118px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  font-size: var(--app-font-caption-size);
  color: var(--theme-muted);
  text-align: center;
  pointer-events: none;
}
.map-actions {
  position: absolute;
  bottom: max(34px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-tooltip-target {
  display: inline-flex;
}
.zoom-level {
  min-width: 46px;
  color: var(--theme-muted);
  font-size: 12px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.marking-hint {
  position: absolute;
  bottom: 78px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  width: max-content;
  max-width: calc(100% - 24px);
  color: var(--ui-accent-text);
  font-size: 12px;
}
.map-footer {
  position: absolute;
  right: max(24px, env(safe-area-inset-right));
  bottom: max(12px, env(safe-area-inset-bottom));
  left: max(24px, env(safe-area-inset-left));
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--theme-muted);
  font-size: var(--app-font-caption-size);
  pointer-events: none;
  flex-wrap: wrap;
}
.map-footer a {
  color: inherit;
  text-decoration: none;
  pointer-events: auto;
}
.map-footer a:hover {
  color: var(--ui-accent-text);
}
@media (max-width: 600px) {
  .map-header {
    top: max(16px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    gap: 8px;
  }
  .map-header-actions {
    top: max(16px, env(safe-area-inset-top));
    right: 16px;
    gap: 8px;
  }
  .map-search {
    top: 78px;
    right: 16px;
    left: 16px;
    justify-content: flex-end;
    gap: 8px;
  }
  .province-select {
    width: 140px;
  }
  .map-search.has-cities .el-select {
    flex: 1;
    width: 0;
    min-width: 0;
  }
  .map-workspace {
    inset: 120px 8px 116px;
  }
  .region-details {
    bottom: 76px;
    left: 16px;
  }
  .region-title {
    gap: 0;
  }
  .region-title h2 {
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .region-details > span {
    font-size: var(--app-font-caption-size);
  }
  .region-details strong {
    margin-left: 4px;
  }
  .map-footer {
    right: 12px;
    left: 12px;
    font-size: var(--app-font-caption-size);
    flex-wrap: wrap;
  }
  .map-actions {
    bottom: 28px;
    gap: 6px;
  }
  .marking-hint {
    bottom: 78px;
    font-size: var(--app-font-caption-size);
  }
  .map-page:has(.marking-hint) .region-details {
    display: none;
  }
}
@media (max-height: 450px) and (min-width: 601px) {
  .map-header {
    top: 10px;
    left: 12px;
  }
  .map-heading p {
    display: none;
  }
  .map-header-actions {
    top: 10px;
    right: 16px;
  }
  .map-search {
    top: 54px;
    right: 16px;
  }
  .map-workspace {
    inset: 92px 12px 58px;
  }
  .region-details {
    bottom: 60px;
    left: 16px;
  }
  .region-title h2 {
    font-size: 14px;
  }
  .map-actions {
    bottom: 24px;
  }
  .map-footer {
    right: 12px;
    bottom: 8px;
    left: 12px;
    font-size: var(--app-font-caption-size);
    flex-wrap: wrap;
  }
  .marking-hint {
    bottom: 60px;
  }
}
@media (max-width: 600px), (max-height: 450px) {
  .map-heading p {
    display: none;
  }
}
</style>

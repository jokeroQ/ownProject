import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getCurrentUser } from '@/utils/auth';

export interface MapMarker {
  id: string;
  name: string;
  lng: number;
  lat: number;
  provinceCode: number;
  provinceName: string;
  regionName: string;
  address: string;
  description: string;
}
export type MarkerEdit = Pick<MapMarker, 'id' | 'name' | 'lng' | 'lat' | 'address' | 'description'>;
export function useMapMarkers() {
  const markers = ref<MapMarker[]>([]);
  let key = '',
    warned = false;
  const warn = () => {
    if (!warned) ElMessage.warning('浏览器无法保存标记，本次会话仍可使用');
    warned = true;
  };
  function load() {
    key = getCurrentUser() ? `ownproject:map-markers:v1:${getCurrentUser()!.id}` : '';
    if (!key) {
      markers.value = [];
      return;
    }
    try {
      const data: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(data)) throw new Error('Invalid markers');
      const ids = new Set<string>();
      markers.value = data
        .filter((item): item is MapMarker => {
          if (
            !item ||
            typeof item !== 'object' ||
            typeof item.id !== 'string' ||
            ids.has(item.id) ||
            typeof item.name !== 'string' ||
            item.name.length > 40 ||
            !item.name.trim() ||
            !Number.isFinite(item.lng) ||
            !Number.isFinite(item.lat) ||
            Math.abs(item.lng) > 180 ||
            Math.abs(item.lat) > 90 ||
            !Number.isInteger(item.provinceCode) ||
            typeof item.provinceName !== 'string' ||
            typeof item.regionName !== 'string' ||
            (item.address !== undefined &&
              (typeof item.address !== 'string' || item.address.length > 120)) ||
            (item.description !== undefined &&
              (typeof item.description !== 'string' || item.description.length > 500))
          )
            return false;
          ids.add(item.id);
          return true;
        })
        .slice(0, 300)
        .map((item) => ({
          ...item,
          address: item.address || '',
          description: item.description || '',
        }));
    } catch {
      markers.value = [];
      ElMessage.warning('本机标记数据无法读取，可以重新添加标记');
    }
  }
  function persist(next: MapMarker[]) {
    markers.value = next;
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      warn();
    }
  }
  function add(marker: Omit<MapMarker, 'id' | 'name' | 'address' | 'description'>) {
    if (markers.value.length >= 300) {
      ElMessage.warning('最多保存 300 个标记，请先删除不需要的标记');
      return;
    }
    let number = 1;
    while (markers.value.some((item) => item.name === `标记 ${number}`)) number++;
    const id =
      crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    persist([
      ...markers.value,
      { ...marker, id, name: `标记 ${number}`, address: '', description: '' },
    ]);
  }
  function update(marker: MapMarker) {
    persist(markers.value.map((item) => (item.id === marker.id ? marker : item)));
  }
  function remove(id: string) {
    persist(markers.value.filter((item) => item.id !== id));
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === 'user' || event.key === null) load();
  };
  onMounted(() => {
    load();
    window.addEventListener('storage', onStorage);
    window.addEventListener('user-changed', load);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('user-changed', load);
  });
  return { markers, add, update, remove };
}

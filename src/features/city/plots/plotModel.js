import { mapDimensions } from '../core/mapDimensions.js';
import { ROAD_TYPES } from '../presets/catalog.js';
import { footprint, containingPlot } from '../placement/footprint.js';
import { terrainHeight } from '../terrain/terrainModel.js';

export const PLOT_ELEVATION = 0.3;

export const PLOT_SURFACES = [
  { id: 'grass', name: '잔디', color: '#648b49' },
  { id: 'asphalt', name: '아스팔트', color: '#454e52' },
  { id: 'concrete', name: '콘크리트', color: '#aaa99c' },
  { id: 'soil', name: '흙', color: '#a47a50' },
];

export const plotSurface = id => PLOT_SURFACES.find(surface => surface.id === id) || PLOT_SURFACES[0];

export function plotTopHeight(city, plot) {
  return terrainHeight(city.heights, plot.x, plot.z) + PLOT_ELEVATION;
}

export function objectBaseHeight(city, object) {
  const plot = containingPlot(city, object.asset, object.x, object.z, object.rotation);
  return plot ? plotTopHeight(city, plot) : terrainHeight(city.heights, object.x, object.z);
}

export function plotFromCorners(start, end, city) {
  const { half } = mapDimensions(city);
  const snap = value => Math.max(-half, Math.min(half, Math.sign(value) * Math.round(Math.abs(value) / 2) * 2));
  const a = { x: snap(start.x), z: snap(start.z) };
  const bounded = {
    x: Math.max(a.x - 80, Math.min(a.x + 80, snap(end.x))),
    z: Math.max(a.z - 80, Math.min(a.z + 80, snap(end.z))),
  };
  for (const axis of ['x', 'z']) {
    if (Math.abs(bounded[axis] - a[axis]) < 4) {
      const direction = bounded[axis] < a[axis] ? -1 : 1;
      const candidate = a[axis] + direction * 4;
      bounded[axis] = candidate < -half || candidate > half ? a[axis] - direction * 4 : candidate;
    }
  }
  return { x: (a.x + bounded.x) / 2, z: (a.z + bounded.z) / 2, width: Math.abs(bounded.x - a.x), depth: Math.abs(bounded.z - a.z) };
}

export function plotProblem(city, plot) {
  const { half } = mapDimensions(city);
  if (Math.abs(plot.x) + plot.width / 2 > half || Math.abs(plot.z) + plot.depth / 2 > half) return '부지를 지도 경계 안에 배치해 주세요.';
  if (city.plots.some(p => Math.abs(p.x - plot.x) < (p.width + plot.width) / 2 && Math.abs(p.z - plot.z) < (p.depth + plot.depth) / 2)) return '기존 부지와 겹칩니다. 빈 격자로 옮겨 주세요.';
  if (city.objects.some(o => { const size = footprint(o.asset, o.rotation); return Math.abs(o.x - plot.x) < (size.width + plot.width) / 2 && Math.abs(o.z - plot.z) < (size.depth + plot.depth) / 2; })) return '시설 또는 나무가 있습니다. 철거 도구로 정리한 뒤 부지를 놓아 주세요.';
  for (let x = plot.x - plot.width / 2; x <= plot.x + plot.width / 2; x += 2) for (let z = plot.z - plot.depth / 2; z <= plot.z + plot.depth / 2; z += 2) {
    if (terrainHeight(city.heights, x, z) < 0.4) return '수면 위에는 부지를 조성할 수 없습니다. 지형을 높여 육지를 만들어 주세요.';
  }
  for (const road of city.roads) {
    const length = Math.hypot(road.b.x - road.a.x, road.b.z - road.a.z), steps = Math.max(1, Math.ceil(length));
    const half = ROAD_TYPES.find(r => r.id === road.type).width / 2;
    for (let i = 0; i <= steps; i++) if (Math.abs(road.a.x + (road.b.x - road.a.x) * i / steps - plot.x) < plot.width / 2 + half && Math.abs(road.a.z + (road.b.z - road.a.z) * i / steps - plot.z) < plot.depth / 2 + half) return '도로와 겹칩니다. 도로 옆에 부지를 배치해 주세요.';
  }
  return null;
}

export function plotEditProblem(city, plotId, candidate) {
  const original = city.plots.find(plot => plot.id === plotId);
  if (!original) return '편집할 부지를 찾을 수 없습니다.';
  const owned = city.objects.filter(object => Math.abs(object.x - original.x) < original.width / 2 && Math.abs(object.z - original.z) < original.depth / 2);
  for (const object of owned) {
    const size = footprint(object.asset, object.rotation);
    if (Math.abs(object.x - candidate.x) + size.width / 2 > candidate.width / 2 + 0.001 ||
        Math.abs(object.z - candidate.z) + size.depth / 2 > candidate.depth / 2 + 0.001) return '기존 시설이 부지 밖으로 나갑니다. 시설을 포함하도록 크기를 조절해 주세요.';
  }
  const withoutOriginal = { ...city, plots: city.plots.filter(plot => plot.id !== plotId), objects: city.objects.filter(object => !owned.includes(object)) };
  return plotProblem(withoutOriginal, candidate);
}

export function roadTouchesPlot(road, plot, extra = 2) {
  const width = ROAD_TYPES.find(type => type.id === road.type)?.width || 4;
  const left = plot.x - plot.width / 2 - width / 2 - extra, right = plot.x + plot.width / 2 + width / 2 + extra;
  if (road.bridge) return [road.a, road.b].some(point => point.x >= left && point.x <= right && Math.abs(point.z - plot.z) <= plot.depth / 2 + width / 2 + extra);
  const bottom = plot.z - plot.depth / 2 - width / 2 - extra, top = plot.z + plot.depth / 2 + width / 2 + extra;
  const dx = road.b.x - road.a.x, dz = road.b.z - road.a.z;
  let enter = 0, leave = 1;
  for (const [p, q] of [[-dx, road.a.x - left], [dx, right - road.a.x], [-dz, road.a.z - bottom], [dz, top - road.a.z]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t); else leave = Math.min(leave, t);
    if (enter > leave) return false;
  }
  return true;
}

export function plotHasRoadAccess(city, plot) {
  return city.roads.some(road => road.type !== 'path' && roadTouchesPlot(road, plot, 5));
}

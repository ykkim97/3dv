import { bridgeById } from './bridgePresets.js';

export const WORLD_SIZE = 240;
export const RESOLUTION = 120;
// Legacy saves default to 240 m. Keep a fixed 2 m terrain cell size.
export const MAP_SIZES = [240, 480];
export function mapDimensions(city) {
  const resolution = city?.map?.resolution ?? (city?.heights ? Math.sqrt(city.heights.length) - 1 : RESOLUTION);
  const size = city?.map?.size ?? resolution * 2;
  return { size, resolution, half: size / 2, cellSize: 2, cameraLimit: size * 390 / WORLD_SIZE };
}
export function expandCity(city, size = 480) {
  validateCity(city);
  const old = mapDimensions(city);
  if (!MAP_SIZES.includes(size) || size <= old.size) throw new Error('현재보다 큰 지도 크기를 선택해 주세요.');
  const next = structuredClone(city), resolution = size / 2, offset = (resolution - old.resolution) / 2;
  next.map = { size, resolution, cellSize: 2 };
  next.heights = [];
  if (city.terrainPaint) next.terrainPaint = [];
  for (let r = 0; r <= resolution; r++) for (let c = 0; c <= resolution; c++) {
    const oldR = Math.max(0, Math.min(old.resolution, r - offset));
    const oldC = Math.max(0, Math.min(old.resolution, c - offset));
    const index = oldR * (old.resolution + 1) + oldC;
    const distance = Math.hypot(r - offset - oldR, c - offset - oldC) * 2;
    // Retain every original vertex; blend the new edge into flat land over 16 m.
    const blend = Math.min(1, distance / 16);
    next.heights.push(city.heights[index] * (1 - blend) + 1.5 * blend);
    if (next.terrainPaint) next.terrainPaint.push(distance === 0 ? city.terrainPaint[index] : null);
  }
  if (next.waterSettings?.regions) next.waterSettings.regions = next.waterSettings.regions.map(region => ({
    ...region, anchor: (Math.floor(region.anchor / old.resolution) + offset) * resolution + region.anchor % old.resolution + offset,
  }));
  return validateCity(next);
}
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
export const PRESETS = [
  { id: 'river', name: '리버사이드', subtitle: '강을 따라 자라는 도시', tag: 'RIVER VALLEY', color: '#7dbba7' },
  { id: 'coast', name: '코스트 베이', subtitle: '해안과 도심이 만나는 곳', tag: 'COASTAL CITY', color: '#77bed0' },
  { id: 'alpine', name: '알파인 빌리지', subtitle: '숲과 산으로 둘러싸인 마을', tag: 'MOUNTAIN TOWN', color: '#9eaf8a' },
  { id: 'blank', name: '새로운 시작', subtitle: '빈 평지에서 자유롭게 설계', tag: 'OPEN SANDBOX', color: '#c2bc91' },
];
export const CATEGORIES = [
  { id: 'plot', name: '부지', icon: 'plot', color: '#d9cca0' },
  { id: 'residential', name: '주거', icon: 'home', color: '#83bd96' },
  { id: 'commercial', name: '상업', icon: 'building', color: '#77b7d6' },
  { id: 'landmark', name: '공공시설', icon: 'civic', color: '#c5acd7' },
  { id: 'power', name: '전력시설', icon: 'power', color: '#e6c77e' },
  { id: 'water', name: '수도시설', icon: 'water', color: '#83c9d5' },
  { id: 'nature', name: '공원 · 자연', icon: 'tree', color: '#a7bf76' },
  { id: 'road', name: '도로', icon: 'road', color: '#b4c2cf' },
  { id: 'terrain', name: '지형', icon: 'terrain', color: '#d0b58b' },
];
export const ASSETS = [
  { id: 'house', category: 'residential', name: '가든 하우스', detail: '저밀도 주거 · 2층', width: 5, depth: 5, height: 4, color: '#e6dfcd', roof: '#a56850', people: 8 },
  { id: 'townhouses', category: 'residential', name: '연립주택', detail: '저층 주거 · 세 가구', width: 9, depth: 6, height: 5, color: '#d9cfb9', people: 24 },
  { id: 'apartment', category: 'residential', name: '테라스 아파트', detail: '중밀도 주거 · 6층', width: 7, depth: 6, height: 11, color: '#d7dfd8', people: 48 },
  { id: 'tower', category: 'residential', name: '스카이 레지던스', detail: '고밀도 주거 · 14층', width: 7, depth: 7, height: 23, color: '#d8e4e4', people: 120 },
  { id: 'shop', category: 'commercial', name: '로컬 마켓', detail: '근린 상업 · 2층', width: 6, depth: 5, height: 4, color: '#e0c7a3', people: 0 },
  { id: 'cafe', category: 'commercial', name: '거리 카페', detail: '근린 상업 · 테라스 좌석', width: 7, depth: 6, height: 4, color: '#d8b994', people: 0 },
  { id: 'office', category: 'commercial', name: '글라스 오피스', detail: '업무 시설 · 18층', width: 8, depth: 7, height: 29, color: '#80a6af', people: 0 },
  { id: 'hotel', category: 'commercial', name: '리버프런트 호텔', detail: '관광 시설 · 10층', width: 10, depth: 6, height: 17, color: '#e2d9c7', people: 0 },
  { id: 'hall', category: 'landmark', name: '시청', detail: '도시 행정 · 공공시설', width: 10, depth: 8, height: 7, color: '#e5ded0', people: 0 },
  { id: 'school', category: 'landmark', name: '초등학교', detail: '교육 · 공공시설', width: 12, depth: 7, height: 5, color: '#dbb896', people: 0 },
  { id: 'hospital', category: 'landmark', name: '메디컬 센터', detail: '의료 · 공공시설', width: 9, depth: 8, height: 10, color: '#e7ece5', people: 0 },
  { id: 'fire-station', category: 'landmark', name: '소방서', detail: '안전 · 차고와 출동 관제탑', width: 11, depth: 8, height: 6, color: '#d5d4c6', people: 0 },
  { id: 'power-plant', category: 'power', name: '발전소', detail: '발전 · 터빈동과 배기탑', width: 12, depth: 10, height: 8, color: '#b6b9aa', people: 0 },
  { id: 'solar-farm', category: 'power', name: '태양광 발전소', detail: '재생에너지 · 태양광 패널', width: 10, depth: 8, height: 2, color: '#426a7b', people: 0 },
  { id: 'ess', category: 'power', name: 'ESS 저장시설', detail: '에너지 저장 · 배터리 모듈', width: 8, depth: 6, height: 3, color: '#c7d5c8', people: 0 },
  { id: 'substation', category: 'power', name: '송전 변전소', detail: '송전 · 변압기와 철구조물', width: 10, depth: 8, height: 7, color: '#9caeaf', people: 0 },
  { id: 'distribution', category: 'power', name: '배전시설', detail: '배전 · 지역 전력 공급', width: 6, depth: 5, height: 4, color: '#b7c5b6', people: 0 },
  { id: 'wind-turbine', category: 'power', name: '풍력발전기', detail: '재생에너지 · 회전 날개와 타워', width: 10, depth: 10, height: 18, color: '#dce5df', people: 0 },
  { id: 'transmission-tower', category: 'power', name: '송전탑', detail: '송전 · 철탑과 애자', width: 8, depth: 8, height: 15, color: '#aebdc0', people: 0 },
  { id: 'water-treatment', category: 'water', name: '정수장', detail: '상수도 · 여과와 정수', width: 12, depth: 10, height: 5, color: '#a9c5c6', people: 0 },
  { id: 'reservoir', category: 'water', name: '배수지', detail: '상수도 · 물 저장 탱크', width: 10, depth: 10, height: 5, color: '#b9d4d2', people: 0 },
  { id: 'pump-station', category: 'water', name: '가압 펌프장', detail: '상수도 · 수압 유지', width: 7, depth: 6, height: 4, color: '#a7c9c4', people: 0 },
  { id: 'wastewater', category: 'water', name: '하수처리장', detail: '하수도 · 침전과 처리', width: 12, depth: 10, height: 4, color: '#9eb8ad', people: 0 },
  { id: 'intake-station', category: 'water', name: '취수장', detail: '상수도 · 취수관과 스크린', width: 10, depth: 8, height: 5, color: '#aec9c4', people: 0 },
  { id: 'water-tower', category: 'water', name: '급수탑', detail: '상수도 · 고가 물탱크', width: 8, depth: 8, height: 12, color: '#c6d9d5', people: 0 },
  { id: 'park', category: 'nature', name: '포켓 파크', detail: '녹지 · 산책로와 수목', width: 10, depth: 10, height: 1, color: '#8daa72', people: 0 },
  { id: 'playground', category: 'nature', name: '어린이 놀이터', detail: '놀이 · 미끄럼틀과 그네', width: 10, depth: 8, height: 3, color: '#a4bd82', people: 0 },
  { id: 'tree', category: 'nature', name: '활엽수', detail: '조경 · 단일 수목', width: 3, depth: 3, height: 5, color: '#699b68', people: 0 },
  { id: 'pine', category: 'nature', name: '침엽수', detail: '조경 · 단일 수목', width: 3, depth: 3, height: 7, color: '#4f826b', people: 0 },
];
export const assetById = Object.fromEntries(ASSETS.map(asset => [asset.id, asset]));
export const BRUSHES = [
  { id: 'paint', name: '색칠', detail: '선택한 색으로 지형을 칠합니다', icon: 'paint' },
  { id: 'raise', name: '높이기', detail: '지형을 부드럽게 높입니다', icon: 'raise' },
  { id: 'lower', name: '낮추기', detail: '지형을 낮춰 수로를 만듭니다', icon: 'lower' },
  { id: 'flatten', name: '평탄화', detail: '첫 지점의 높이로 맞춥니다', icon: 'flatten' },
  { id: 'smooth', name: '부드럽게', detail: '급격한 경사를 완화합니다', icon: 'terrain' },
];
export const ROAD_TYPES = [
  { id: 'street', name: '2차선 도로', detail: '주거 지역의 작은 연결', width: 4 },
  { id: 'avenue', name: '4차선 대로', detail: '도시를 잇는 주요 도로', width: 7 },
  { id: 'path', name: '산책로', detail: '사람을 위한 느린 길', width: 2 },
];
export const PLOT_TYPES = [
  { id: 'small', name: '소형 부지', detail: '단독주택 · 작은 상점', width: 12, depth: 12 },
  { id: 'medium', name: '중형 부지', detail: '아파트 · 공원 · 공공시설', width: 24, depth: 24 },
  { id: 'large', name: '대형 부지', detail: '여러 시설을 함께 배치', width: 36, depth: 24 },
];
export function closestRoadPoint(road, point) {
  const dx = road.b.x - road.a.x, dz = road.b.z - road.a.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - road.a.x) * dx + (point.z - road.a.z) * dz) / lengthSquared)) : 0;
  return { x: road.a.x + dx * t, z: road.a.z + dz * t, t };
}
export function snapRoadPoint(roads, point, city) {
  const { half } = mapDimensions(city);
  let nearest = null, distance = 6;
  for (const road of roads) for (const end of [road.a, road.b]) {
    const next = Math.hypot(point.x - end.x, point.z - end.z);
    if (next < distance) { nearest = end; distance = next; }
  }
  if (nearest) return { x: nearest.x, z: nearest.z, kind: 'endpoint' };
  distance = Infinity;
  for (const road of roads) {
    if (road.bridge) continue; // Bridge decks connect at their land approaches only.
    const candidate = closestRoadPoint(road, point);
    const next = Math.hypot(point.x - candidate.x, point.z - candidate.z);
    const reach = (ROAD_TYPES.find(type => type.id === road.type)?.width || 4) / 2 + 2;
    if (next <= reach && next < distance) { nearest = candidate; distance = next; }
  }
  if (nearest) return { x: Math.round(nearest.x * 100) / 100, z: Math.round(nearest.z * 100) / 100, kind: 'junction' };
  return { x: Math.max(-half, Math.min(half, Math.round(point.x / 2) * 2)), z: Math.max(-half, Math.min(half, Math.round(point.z / 2) * 2)), kind: 'grid' };
}
export function segmentIntersection(a, b, c, d) {
  const rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z;
  const cross = rx * sz - rz * sx;
  if (Math.abs(cross) < 1e-7) return null;
  const qx = c.x - a.x, qz = c.z - a.z;
  const t = (qx * sz - qz * sx) / cross, u = (qx * rz - qz * rx) / cross;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
  return { x: a.x + t * rx, z: a.z + t * rz };
}
export function roadIntersections(roads) {
  const junctions = new Map();
  for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
    let point = segmentIntersection(roads[i].a, roads[i].b, roads[j].a, roads[j].b);
    // Collinear roads meeting at an endpoint also need a seamless width transition.
    if (!point) point = [roads[i].a, roads[i].b].find(end => [roads[j].a, roads[j].b].some(other => Math.hypot(end.x - other.x, end.z - other.z) < 0.02));
    if (!point) continue;
    if (!roadConnectsAt(roads[i], point) || !roadConnectsAt(roads[j], point)) continue;
    const key = `${Math.round(point.x * 100) / 100}:${Math.round(point.z * 100) / 100}`;
    const width = Math.max(ROAD_TYPES.find(type => type.id === roads[i].type)?.width || 4, ROAD_TYPES.find(type => type.id === roads[j].type)?.width || 4);
    junctions.set(key, { x: point.x, z: point.z, width: Math.max(width, junctions.get(key)?.width || 0) });
  }
  return [...junctions.values()];
}
export function roadConnectsAt(road, point) {
  return !road.bridge || [road.a, road.b].some(end => Math.hypot(end.x - point.x, end.z - point.z) < 0.03);
}
export function roadProblem(city, road) {
  const { half } = mapDimensions(city);
  const length = Math.hypot(road.b.x - road.a.x, road.b.z - road.a.z);
  if (length < 2) return '도로는 2 m 이상 이어 주세요.';
  if ([road.a, road.b].some(p => Math.abs(p.x) > half || Math.abs(p.z) > half)) return '도로를 지도 경계 안에 배치해 주세요.';
  if (road.bridge) {
    const preset = bridgeById[road.bridge];
    if (!preset || road.type !== preset.type) return '교량 프리셋과 도로 종류가 맞지 않습니다.';
    if (length < preset.min || length > preset.max) return `${preset.name} 길이는 ${preset.min}~${preset.max} m로 조절하세요.`;
    if ([road.a, road.b].some(point => terrainHeight(city.heights, point.x, point.z) < 0.4)) return '다리 양쪽 끝을 육지나 기존 도로의 육지 접속부에 놓아 주세요.';
  }
  const width = ROAD_TYPES.find(type => type.id === road.type)?.width || 4;
  for (let i = 0; i <= Math.ceil(length); i++) {
    const t = i / Math.ceil(length), x = road.a.x + (road.b.x - road.a.x) * t, z = road.a.z + (road.b.z - road.a.z) * t;
    if (city.plots.some(plot => Math.abs(x - plot.x) < plot.width / 2 + width / 2 && Math.abs(z - plot.z) < plot.depth / 2 + width / 2)) return '도로가 부지와 겹칩니다. 부지 바깥으로 연결해 주세요.';
  }
  for (const other of city.roads) {
    if (road.id && other.id === road.id) continue;
    const ox = other.b.x - other.a.x, oz = other.b.z - other.a.z;
    const cross = (road.b.x - road.a.x) * oz - (road.b.z - road.a.z) * ox;
    if (Math.abs(cross) > length * Math.hypot(ox, oz) * 0.02) continue;
    if (Math.hypot(closestRoadPoint(other, road.a).x - road.a.x, closestRoadPoint(other, road.a).z - road.a.z) > 1.5 &&
        Math.hypot(closestRoadPoint(other, road.b).x - road.b.x, closestRoadPoint(other, road.b).z - road.b.z) > 1.5) continue;
    const denominator = ox * ox + oz * oz;
    if (!denominator) continue;
    const start = ((road.a.x - other.a.x) * ox + (road.a.z - other.a.z) * oz) / denominator;
    const end = ((road.b.x - other.a.x) * ox + (road.b.z - other.a.z) * oz) / denominator;
    if (Math.min(1, Math.max(start, end)) - Math.max(0, Math.min(start, end)) > 0.02) return '기존 도로와 겹칩니다. 다른 경로를 선택해 주세요.';
  }
  return null;
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
export function footprint(asset, rotation = 0) {
  const a = assetById[asset];
  return { width: Math.abs(Math.cos(rotation)) * a.width + Math.abs(Math.sin(rotation)) * a.depth, depth: Math.abs(Math.sin(rotation)) * a.width + Math.abs(Math.cos(rotation)) * a.depth };
}
export function containingPlot(city, asset, x, z, rotation = 0) {
  const { width, depth } = footprint(asset, rotation);
  return city.plots.find(p => Math.abs(x - p.x) + width / 2 <= p.width / 2 + 0.001 && Math.abs(z - p.z) + depth / 2 <= p.depth / 2 + 0.001);
}
export function placementProblem(city, asset, x, z, rotation = 0, ignoreId = null) {
  const { width, depth } = footprint(asset, rotation);
  if (!containingPlot(city, asset, x, z, rotation)) return '먼저 부지를 조성한 다음, 부지 안에 시설을 배치해 주세요.';
  if (city.objects.some(o => {
    if (o.id === ignoreId) return false;
    const other = footprint(o.asset, o.rotation);
    return Math.abs(o.x - x) < (other.width + width) / 2 - 0.01 && Math.abs(o.z - z) < (other.depth + depth) / 2 - 0.01;
  })) return '이미 시설이 있는 위치입니다. 빈 격자로 옮겨 주세요.';
  return null;
}
// Return the same placement for the ghost and the final click.
export function snapBuildingPlacement(city, asset, point, rotation = 0, align = true, gap = 1, ignoreId = null) {
  const grid = { x: Math.round(point.x / 2) * 2, z: Math.round(point.z / 2) * 2 };
  const unsnapped = { ...grid, guides: null };
  if (!align) return unsnapped;
  const plot = city.plots.find(p => Math.abs(point.x - p.x) <= p.width / 2 && Math.abs(point.z - p.z) <= p.depth / 2);
  if (!plot) return unsnapped;
  const size = footprint(asset, rotation);
  const occupants = city.objects.filter(o => o.id !== ignoreId && Math.abs(o.x - plot.x) < plot.width / 2 && Math.abs(o.z - plot.z) < plot.depth / 2);
  const candidates = axis => {
    const extent = axis === 'x' ? 'width' : 'depth';
    const half = plot[extent] / 2 - size[extent] / 2 - gap;
    const targets = [{ value: plot[axis], label: '부지 중심' }];
    if (half > 0) for (const sign of [-1, 1]) targets.push({ value: plot[axis] + sign * half, label: '부지 경계' });
    for (const object of occupants) {
      targets.push({ value: object[axis], label: '건물 중심' });
      const other = footprint(object.asset, object.rotation);
      for (const sign of [-1, 1]) targets.push({ value: object[axis] + sign * (other[extent] / 2 + size[extent] / 2 + gap), label: '건물 간격' });
    }
    const near = targets.filter(target => Math.abs(target.value - point[axis]) <= 1.25);
    near.sort((a, b) => Math.abs(a.value - point[axis]) - Math.abs(b.value - point[axis]));
    return [...near, { value: grid[axis], label: null }];
  };
  const xs = candidates('x'), zs = candidates('z');
  const pairs = [];
  for (const x of xs) for (const z of zs) {
    const smart = Number(Boolean(x.label)) + Number(Boolean(z.label));
    pairs.push({ x, z, smart, distance: Math.abs(x.value - point.x) + Math.abs(z.value - point.z) });
  }
  pairs.sort((a, b) => b.smart - a.smart || a.distance - b.distance);
  for (const pair of pairs) {
    if (placementProblem(city, asset, pair.x.value, pair.z.value, rotation, ignoreId)) continue;
    const guides = pair.smart ? { plot, x: pair.x.label ? pair.x.value : null, z: pair.z.label ? pair.z.value : null, label: [...new Set([pair.x.label, pair.z.label].filter(Boolean))].join(' · ') } : null;
    return { x: pair.x.value, z: pair.z.value, guides };
  }
  return unsnapped;
}
export function placementDistances(city, asset, x, z, rotation = 0, ignoreId = null) {
  const size = footprint(asset, rotation);
  const plot = containingPlot(city, asset, x, z, rotation);
  if (!plot) return null;
  const boundary = Math.min(
    x - size.width / 2 - (plot.x - plot.width / 2),
    plot.x + plot.width / 2 - (x + size.width / 2),
    z - size.depth / 2 - (plot.z - plot.depth / 2),
    plot.z + plot.depth / 2 - (z + size.depth / 2),
  );
  let neighbor = Infinity;
  for (const object of city.objects) {
    if (object.id === ignoreId) continue;
    const other = footprint(object.asset, object.rotation);
    const dx = Math.max(0, Math.abs(x - object.x) - (size.width + other.width) / 2);
    const dz = Math.max(0, Math.abs(z - object.z) - (size.depth + other.depth) / 2);
    neighbor = Math.min(neighbor, Math.hypot(dx, dz));
  }
  return { boundary, neighbor: Number.isFinite(neighbor) ? neighbor : null };
}
export function planBuildingCopies(city, source, count, gap, direction) {
  if (!source || !Number.isInteger(count) || count < 1 || count > 12 || !Number.isFinite(gap) || gap < 0 || gap > 10 || !['x+', 'x-', 'z+', 'z-'].includes(direction)) return { copies: [], problem: '복제 개수, 간격 또는 방향을 확인해 주세요.' };
  const size = footprint(source.asset, source.rotation);
  const axis = direction[0], sign = direction[1] === '+' ? 1 : -1;
  const draft = { ...city, objects: [...city.objects] };
  const copies = [];
  for (let i = 1; i <= count; i++) {
    const candidate = { asset: source.asset, x: source.x + (axis === 'x' ? sign * (size.width + gap) * i : 0), z: source.z + (axis === 'z' ? sign * (size.depth + gap) * i : 0), rotation: source.rotation };
    const problem = placementProblem(draft, candidate.asset, candidate.x, candidate.z, candidate.rotation);
    if (problem) return { copies: [], problem: `${i}번째 건물을 놓을 수 없습니다. ${problem}` };
    copies.push(candidate);
    draft.objects.push({ ...candidate, id: `__copy-${i}` });
  }
  return { copies, problem: null };
}
export function planGroupTransform(city, ids, action, offsetX = 0, offsetZ = 0) {
  const unique = [...new Set(ids)];
  const selected = city.objects.filter(object => unique.includes(object.id));
  if (selected.some(object => object.locked)) return { objects: [], problem: '잠긴 시설은 먼저 잠금을 해제하세요.' };
  if (selected.length < 2 || selected.length !== unique.length || !['move', 'copy', 'rotate'].includes(action)) return { objects: [], problem: '시설을 두 개 이상 선택해 주세요.' };
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetZ) || Math.abs(offsetX) > 80 || Math.abs(offsetZ) > 80) return { objects: [], problem: '이동 거리는 -80~80 m 범위로 입력해 주세요.' };
  if (action !== 'rotate' && offsetX === 0 && offsetZ === 0) return { objects: [], problem: '이동 거리를 입력해 주세요.' };
  const centerX = selected.reduce((sum, object) => sum + object.x, 0) / selected.length;
  const centerZ = selected.reduce((sum, object) => sum + object.z, 0) / selected.length;
  const draft = { ...city, objects: action === 'copy' ? [...city.objects] : city.objects.filter(object => !unique.includes(object.id)) };
  const objects = [];
  for (const object of selected) {
    const next = action === 'rotate'
      ? { ...object, x: centerX - (object.z - centerZ), z: centerZ + (object.x - centerX), rotation: object.rotation + Math.PI / 2 }
      : { ...object, x: object.x + offsetX, z: object.z + offsetZ };
    const problem = placementProblem(draft, next.asset, next.x, next.z, next.rotation);
    if (problem) return { objects: [], problem: `${assetById[object.asset].name}: ${problem}` };
    objects.push(next);
    draft.objects.push(next);
  }
  return { objects, problem: null };
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
export function unbuildableCells(city, size = 12) {
  const { half } = mapDimensions(city);
  const cells = [];
  for (let x = -half + size / 2; x < half; x += size) for (let z = -half + size / 2; z < half; z += size) {
    const problem = plotProblem(city, { id: 'info-cell', x, z, width: size, depth: size });
    if (problem) cells.push({ x, z, reason: problem.includes('수면') ? 'water' : problem.includes('도로') ? 'road' : 'occupied' });
  }
  return cells;
}
export function levelPlot(city, plot) {
  const { resolution, half } = mapDimensions(city);
  const height = terrainHeight(city.heights, plot.x, plot.z);
  for (let row = 0; row <= resolution; row++) for (let col = 0; col <= resolution; col++) {
    const dx = Math.max(0, Math.abs(col * 2 - half - plot.x) - plot.width / 2);
    const dz = Math.max(0, Math.abs(half - row * 2 - plot.z) - plot.depth / 2);
    const weight = Math.max(0, 1 - Math.hypot(dx, dz) / 4);
    const index = row * (resolution + 1) + col;
    city.heights[index] += (height - city.heights[index]) * weight;
  }
}
export function terrainHeight(heights, x, z) {
  const resolution = Math.sqrt(heights.length) - 1, half = resolution;
  const u = Math.max(0, Math.min(resolution, (x + half) / 2));
  const v = Math.max(0, Math.min(resolution, (half - z) / 2));
  const a = Math.floor(u), b = Math.floor(v), c = Math.min(a + 1, resolution), d = Math.min(b + 1, resolution);
  const t = u - a, s = v - b, row = resolution + 1;
  return (heights[b * row + a] * (1 - t) + heights[b * row + c] * t) * (1 - s)
    + (heights[d * row + a] * (1 - t) + heights[d * row + c] * t) * s;
}
export function createCity(preset = 'river', size = WORLD_SIZE) {
  if (!MAP_SIZES.includes(size)) throw new Error('지원하지 않는 지도 크기입니다.');
  const resolution = size / 2, half = size / 2;
  let seed = 2187;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const heights = [];
  for (let row = 0; row <= resolution; row++) for (let col = 0; col <= resolution; col++) {
    const x = col * 2 - half, z = half - row * 2;
    let y = 1.5;
    if (preset === 'river') {
      const river = 49 + 12 * Math.sin(z / 42);
      y -= 7 * Math.exp(-(((x - river) / 13) ** 2));
      y += Math.max(0, -x - 70) * (0.13 + 0.1 * Math.sin(z / 23));
    }
    if (preset === 'coast') y = 1.5 - 8 / (1 + Math.exp(-(x - 45 - 9 * Math.sin(z / 25)) / 5));
    if (preset === 'alpine') y += 26 * Math.exp(-((x + 83) ** 2 + (z - 65) ** 2) / 1700) + 20 * Math.exp(-((x - 82) ** 2 + (z + 62) ** 2) / 1700);
    heights.push(Math.max(-30, Math.min(60, y)));
  }
  const city = { version: 1, name: PRESETS.find(p => p.id === preset)?.name || '나의 도시', preset, map: { size, resolution, cellSize: 2 }, heights, objects: [], roads: [], plots: [] };
  if (preset === 'blank') return city;
  const add = (asset, x, z, rotation = 0) => city.objects.push({ id: `seed-${city.objects.length}`, asset, x, z, rotation });
  for (const x of [-66, -42, -18, 6, 30]) city.roads.push({ id: `vx${x}`, type: 'street', a: { x, z: -67 }, b: { x, z: 67 } });
  for (const z of [-66, -42, -18, 6, 30, 54]) city.roads.push({ id: `hz${z}`, type: z === 6 ? 'avenue' : 'street', a: { x: -76, z }, b: { x: 33, z } });
  for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 5; iz++) {
    const cx = -54 + ix * 24, cz = -54 + iz * 24;
    city.plots.push({ id: `plot-${ix}-${iz}`, x: cx, z: cz, width: 19, depth: iz === 2 || iz === 3 ? 16 : 19 });
    if (ix === 1 && iz === 2) { add('park', cx, cz); continue; }
    if (ix === 2 && iz === 2) continue;
    for (const dx of [-5, 5]) for (const dz of (iz === 2 || iz === 3 ? [-4, 4] : [-5, 5])) {
      const central = ix >= 2 && iz >= 2;
      const asset = preset === 'alpine' ? (random() > 0.85 ? 'apartment' : 'house') : central ? (random() > 0.45 ? 'office' : 'tower') : (random() > 0.5 ? 'apartment' : 'house');
      add(asset, cx + dx, cz + dz, random() > 0.5 ? 0 : Math.PI);
    }
  }
  add('hall', -54, 66); add('school', -29, 66); add('hospital', -5, 66);
  for (const x of [-54, -29, -5]) city.plots.push({ id: `civic-plot-${x}`, x, z: 66, width: 18, depth: 16 });
  // Two clear development sites make the first placement possible immediately.
  city.plots.push({ id: 'starter-plot-a', x: -53, z: -87, width: 24, depth: 16 }, { id: 'starter-plot-b', x: -23, z: -87, width: 24, depth: 16 });
  city.plots.forEach(p => levelPlot(city, p));
  for (let i = 0; i < 180; i++) {
    const x = random() * 214 - 107, z = random() * 214 - 107;
    if (terrainHeight(heights, x, z) < 0.7 || (x > -79 && x < 36 && z > -73 && z < 76)) continue;
    if (city.plots.some(p => Math.abs(x - p.x) < p.width / 2 + 4 && Math.abs(z - p.z) < p.depth / 2 + 4)) continue;
    add(preset === 'alpine' || random() > 0.7 ? 'pine' : 'tree', x, z);
  }
  return city;
}
export function validateCity(value) {
  if (!value || value.version !== 1 || typeof value.name !== 'string' || value.name.length > 80 || !PRESETS.some(p => p.id === value.preset)) throw new Error('지원하지 않는 도시 파일입니다.');
  if (value.map !== undefined && (!value.map || !MAP_SIZES.includes(value.map.size) || value.map.resolution !== value.map.size / 2 || value.map.cellSize !== 2)) throw new Error('지도 크기 데이터가 올바르지 않습니다.');
  const { resolution, half, cameraLimit } = value.map ? mapDimensions(value) : mapDimensions();
  if (!Array.isArray(value.heights) || value.heights.length !== (resolution + 1) ** 2 || value.heights.some(h => !Number.isFinite(h) || h < -30 || h > 60)) throw new Error('지형 데이터가 올바르지 않습니다.');
  if (value.terrainPaint !== undefined && (!Array.isArray(value.terrainPaint) || value.terrainPaint.length !== value.heights.length || value.terrainPaint.some(color => color !== null && (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))))) throw new Error('지형 색상 데이터가 올바르지 않습니다.');
  if (value.waterSettings !== undefined) {
    const validWater = settings => settings && typeof settings === 'object' && !Array.isArray(settings) && ['enabled', 'flowing'].every(key => settings[key] === undefined || typeof settings[key] === 'boolean') && (settings.color === undefined || typeof settings.color === 'string' && /^#[0-9a-f]{6}$/i.test(settings.color)) && (settings.opacity === undefined || Number.isFinite(settings.opacity) && settings.opacity >= 0.3 && settings.opacity <= 1);
    if (!validWater(value.waterSettings) || value.waterSettings.regions !== undefined && (!Array.isArray(value.waterSettings.regions) || value.waterSettings.regions.length > resolution ** 2 || value.waterSettings.regions.some(region => !validWater(region) || !Number.isInteger(region.anchor) || region.anchor < 0 || region.anchor >= resolution ** 2))) throw new Error('수면 설정 데이터가 올바르지 않습니다.');
  }
  const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) <= half && Math.abs(p.z) <= half;
  if (!Array.isArray(value.objects) || value.objects.length > 5000 || value.objects.some(o => !validPoint(o) || !assetById[o.asset] || typeof o.id !== 'string' || !Number.isFinite(o.rotation))) throw new Error('시설 데이터가 올바르지 않습니다.');
  if (!Array.isArray(value.roads) || value.roads.length > 2000 || value.roads.some(r => typeof r.id !== 'string' || !ROAD_TYPES.some(t => t.id === r.type) || !validPoint(r.a) || !validPoint(r.b))) throw new Error('도로 데이터가 올바르지 않습니다.');
  if (!Array.isArray(value.plots) || value.plots.length > 1000 || value.plots.some(p => !validPoint(p) || typeof p.id !== 'string' || (p.surface !== undefined && !PLOT_SURFACES.some(surface => surface.id === p.surface)) || !Number.isFinite(p.width) || !Number.isFinite(p.depth) || p.width < 4 || p.width > 80 || p.depth < 4 || p.depth > 80 || Math.abs(p.x) + p.width / 2 > half || Math.abs(p.z) + p.depth / 2 > half)) throw new Error('부지 데이터가 올바르지 않습니다.');
  const all = [...value.objects, ...value.roads, ...value.plots];
  if (value.roads.some(road => road.bridge !== undefined && (!bridgeById[road.bridge] || bridgeById[road.bridge].type !== road.type))) throw new Error('교량 프리셋 데이터가 올바르지 않습니다.');
  if (all.some(item => item.locked !== undefined && typeof item.locked !== 'boolean') || value.roads.some(road => road.chainId !== undefined && (typeof road.chainId !== 'string' || road.chainId.length > 100))) throw new Error('선택 잠금 또는 도로 그룹 데이터가 올바르지 않습니다.');
  if (value.districts !== undefined) {
    const assigned = new Set();
    if (!Array.isArray(value.districts) || value.districts.length > 100 || value.districts.some(district => !district || typeof district.id !== 'string' || typeof district.name !== 'string' || district.name.length > 40 || !/^#[0-9a-f]{6}$/i.test(district.color) || !Array.isArray(district.plotIds) || district.plotIds.some(id => { if (!value.plots.some(plot => plot.id === id) || assigned.has(id)) return true; assigned.add(id); return false; })) || new Set(value.districts.map(item => item.id)).size !== value.districts.length) throw new Error('구역 데이터가 올바르지 않습니다.');
  }
  if (value.lifeSettings !== undefined && (!value.lifeSettings || typeof value.lifeSettings !== 'object' || Array.isArray(value.lifeSettings) || ['enabled', 'cars', 'people'].some(key => value.lifeSettings[key] !== undefined && typeof value.lifeSettings[key] !== 'boolean'))) throw new Error('도시 생활 연출 설정이 올바르지 않습니다.');
  if (value.cameraViews !== undefined && (!Array.isArray(value.cameraViews) || value.cameraViews.length > 30 || value.cameraViews.some(view => !view || typeof view.id !== 'string' || typeof view.name !== 'string' || view.name.length > 40 || !Number.isFinite(view.alpha) || !Number.isFinite(view.beta) || view.beta < 0 || view.beta > Math.PI / 2 || !Number.isFinite(view.radius) || view.radius < 25 || view.radius > cameraLimit || !view.target || [view.target.x, view.target.y, view.target.z].some(axis => !Number.isFinite(axis) || Math.abs(axis) > 10000)) || new Set(value.cameraViews.map(view => view.id)).size !== value.cameraViews.length)) throw new Error('카메라 시점 데이터가 올바르지 않습니다.');
  if (new Set(all.map(o => o.id)).size !== all.length) throw new Error('중복된 시설 ID가 있습니다.');
  return value;
}

import { mapDimensions } from '../core/mapDimensions.js';
import { ROAD_TYPES } from '../presets/catalog.js';
import { terrainHeight } from '../terrain/terrainModel.js';
import { bridgeById } from '../presets/bridgePresets.js';

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

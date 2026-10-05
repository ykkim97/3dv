import { assetById } from '../presets/catalog.js';
import { objectBaseHeight } from '../plots/plotModel.js';
import { terrainHeight } from '../terrain/terrainModel.js';

export const CONNECTION_TYPES = [
  { id: 'power', name: '전력', color: '#f4c95d' },
  { id: 'water', name: '수도', color: '#46c9ff' },
  { id: 'general', name: '일반 연결', color: '#38df87' },
];
export const FLOW_EFFECTS = [
  { id: 'bands', name: '흐르는 띠' },
  { id: 'arrows', name: '방향 화살표' },
  { id: 'pulse', name: '빛 펄스' },
  { id: 'dots', name: '흐르는 점' },
  { id: 'wave', name: '파동 효과' },
];
export const DEFAULT_CONNECTION = { type: 'general', color: '#38df87', radius: 0.45, clearance: 2, speed: 4, direction: 'forward', route: 'elbow', effect: 'bands', animated: true, visible: true };

export function cleanConnections(city) {
  const ids = new Set(city.objects.map(o => o.id));
  return { ...city, connections: (city.connections || []).filter(c => ids.has(c.from) && ids.has(c.to)) };
}

export function validateConnections(city) {
  if (city.connections === undefined) return;
  const ids = new Set(city.objects.map(o => o.id));
  if (!Array.isArray(city.connections) || city.connections.length > 2000 || city.connections.some(c => !c
    || typeof c.id !== 'string' || c.id.length > 100 || !ids.has(c.from) || !ids.has(c.to) || c.from === c.to
    || !CONNECTION_TYPES.some(t => t.id === c.type) || !/^#[0-9a-f]{6}$/i.test(c.color)
    || !Number.isFinite(c.radius) || c.radius < 0.1 || c.radius > 2
    || !Number.isFinite(c.clearance) || c.clearance < 0.5 || c.clearance > 30
    || !Number.isFinite(c.speed) || c.speed < 0 || c.speed > 20
    || !['forward', 'reverse', 'both'].includes(c.direction) || !['straight', 'elbow'].includes(c.route)
    || (c.effect !== undefined && !FLOW_EFFECTS.some(effect => effect.id === c.effect))
    || typeof c.animated !== 'boolean' || typeof c.visible !== 'boolean')
    || new Set(city.connections.map(c => c.id)).size !== city.connections.length
    || city.connections.some(c => [...city.objects, ...city.roads, ...city.plots].some(o => o.id === c.id))) {
    throw new Error('흐름 연결선 데이터가 올바르지 않습니다.');
  }
}

// Elevated paths avoid terrain; rounded corners use a bounded quadratic curve.
export function connectionPath(city, connection, objects = new Map(city.objects.map(o => [o.id, o]))) {
  const from = objects.get(connection.from), to = objects.get(connection.to);
  if (!from || !to) return [];
  const top = o => objectBaseHeight(city, o) + assetById[o.asset].height;
  const a = { x: from.x, y: top(from), z: from.z }, b = { x: to.x, y: top(to), z: to.z };
  const corner = { x: b.x, y: 0, z: a.z };
  let height = Math.max(a.y, b.y) + connection.clearance;
  const route = connection.route === 'elbow' ? [a, corner, b] : [a, b];
  for (let i = 1; i < route.length; i++) {
    const p = route[i - 1], q = route[i], steps = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 2));
    for (let j = 0; j <= steps; j++) height = Math.max(height, terrainHeight(city.heights, p.x + (q.x - p.x) * j / steps, p.z + (q.z - p.z) * j / steps) + connection.clearance + connection.radius);
  }
  const controls = [a, { ...a, y: height }, ...(connection.route === 'elbow' ? [{ ...corner, y: height }] : []), { ...b, y: height }, b];
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  const points = controls.filter((p, i) => !i || distance(p, controls[i - 1]) > 0.001);
  const mix = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t });
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], previous = points[i - 1], next = points[i + 1];
    const radius = Math.min(3, distance(previous, p) / 3, distance(p, next) / 3);
    const enter = mix(p, previous, radius / distance(previous, p)), leave = mix(p, next, radius / distance(p, next));
    result.push(enter);
    for (let j = 1; j <= 6; j++) { const t = j / 6; result.push(mix(mix(enter, p, t), mix(p, leave, t), t)); }
  }
  result.push(points.at(-1));
  return result;
}

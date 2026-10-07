import { assetById } from '../presets/catalog.js';
import { objectBaseHeight } from '../plots/plotModel.js';
import { terrainHeight } from '../terrain/terrainModel.js';
import { mapDimensions } from '../core/mapDimensions.js';

export const MAX_WAYPOINTS = 32;
export function validWaypoints(city, points) {
  const { half } = mapDimensions(city);
  return Array.isArray(points) && points.length <= MAX_WAYPOINTS && points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) <= half && Math.abs(p.z) <= half);
}

export function editWaypoint(city, id, action, index, point) {
  const line = city.connections?.find(c => c.id === id);
  if (!line) return city;
  const points = (line.waypoints || []).map(p => ({ ...p }));
  if (action === 'insert' && index >= 0 && index <= points.length) points.splice(index, 0, point);
  else if (action === 'move' && index >= 0 && index < points.length) points[index] = point;
  else if (action === 'remove' && index >= 0 && index < points.length) points.splice(index, 1);
  else if (action === 'up' && index > 0 && index < points.length) [points[index - 1], points[index]] = [points[index], points[index - 1]];
  else if (action === 'down' && index >= 0 && index < points.length - 1) [points[index + 1], points[index]] = [points[index], points[index + 1]];
  else if (action === 'clear') points.length = 0;
  else return city;
  if (!validWaypoints(city, points)) throw new Error('경유점은 지도 안에 최대 32개까지 지정할 수 있습니다.');
  return { ...city, connections: city.connections.map(c => c.id === id ? { ...c, waypoints: points } : c) };
}

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
    || (c.enabled !== undefined && typeof c.enabled !== 'boolean')
    || (c.waypoints !== undefined && !validWaypoints(city, c.waypoints))
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
  const intermediate = connection.waypoints?.length ? connection.waypoints : connection.route === 'elbow' ? [corner] : [];
  const route = [a, ...intermediate, b];
  for (let i = 1; i < route.length; i++) {
    const p = route[i - 1], q = route[i], steps = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 2));
    for (let j = 0; j <= steps; j++) height = Math.max(height, terrainHeight(city.heights, p.x + (q.x - p.x) * j / steps, p.z + (q.z - p.z) * j / steps) + connection.clearance + connection.radius);
  }
  const controls = [a, { ...a, y: height }, ...intermediate.map(p => ({ x: p.x, z: p.z, y: height })), { ...b, y: height }, b];
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

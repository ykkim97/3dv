import { roadProblem } from '../roads/roadModel.js';
import { plotProblem } from '../plots/plotModel.js';
import { placementProblem } from './placementRules.js';
import { levelPlot } from '../terrain/terrainModel.js';

export function roadDraft(start, end, shape = 'straight', control = null) {
  if (shape === 'straight') return [start, end];
  if (shape === 'roundabout') {
    const radius = Math.max(8, Math.min(40, Math.hypot(end.x - start.x, end.z - start.z)));
    const count = Math.max(12, Math.floor(Math.PI * 2 * radius / 4));
    return Array.from({ length: count + 1 }, (_, i) => ({ x: start.x + Math.cos(i * Math.PI * 2 / count) * radius, z: start.z + Math.sin(i * Math.PI * 2 / count) * radius }));
  }
  if (!control) return [start, end];
  const count = Math.max(2, Math.ceil((Math.hypot(control.x - start.x, control.z - start.z) + Math.hypot(end.x - control.x, end.z - control.z)) / 4));
  const points = [start];
  for (let i = 1; i < count; i++) {
    const t = i / count, s = 1 - t;
    const point = { x: s * s * start.x + 2 * s * t * control.x + t * t * end.x, z: s * s * start.z + 2 * s * t * control.z + t * t * end.z };
    if (Math.hypot(point.x - points.at(-1).x, point.z - points.at(-1).z) >= 2.5) points.push(point);
  }
  if (points.length > 1 && Math.hypot(end.x - points.at(-1).x, end.z - points.at(-1).z) < 2) points.pop();
  points.push(end);
  return points;
}
export function planRoadDraft(city, points, type, chainId = 'draft', bridge = undefined) {
  if (bridge && points.length !== 2) return { problem: '교량은 직선으로 양쪽 접속부를 이어 주세요.' };
  const roads = points.slice(1).map((b, i) => ({ id: `${chainId}:${i}`, chainId, type, ...(bridge ? { bridge } : {}), a: { x: points[i].x, z: points[i].z }, b: { x: b.x, z: b.z } }));
  if (city.roads.length + roads.length > 2000) return { problem: '도로 구간은 최대 2,000개까지 지원합니다.' };
  const working = { ...city, roads: [...city.roads] };
  for (const road of roads) {
    const problem = roadProblem(working, road);
    if (problem) return { problem };
    working.roads.push(road);
  }
  return { roads, problem: null };
}
const inside = (object, plot) => Math.abs(object.x - plot.x) < plot.width / 2 && Math.abs(object.z - plot.z) < plot.depth / 2;
export function expandSelection(city, ids) {
  const chosen = new Set(ids);
  const chains = new Set(city.roads.filter(road => chosen.has(road.id) && road.chainId).map(road => road.chainId));
  for (const road of city.roads) if (chains.has(road.chainId)) chosen.add(road.id);
  for (const plot of city.plots) if (chosen.has(plot.id)) for (const object of city.objects) if (inside(object, plot)) chosen.add(object.id);
  return chosen;
}
export function planBatch(city, ids, action, dx = 0, dz = 0) {
  if (!['move', 'copy', 'delete'].includes(action)) return { problem: '지원하지 않는 일괄 편집입니다.' };
  if (action !== 'delete' && (!Number.isFinite(dx) || !Number.isFinite(dz) || Math.abs(dx) > 80 || Math.abs(dz) > 80)) return { problem: '이동 거리를 -80~80 m 사이로 입력하세요.' };
  if (action === 'move' && dx === 0 && dz === 0) return { problem: '이동할 거리를 입력하세요.' };
  const chosen = expandSelection(city, ids);
  const entries = ['objects', 'plots', 'roads'].flatMap(key => city[key].filter(item => chosen.has(item.id)));
  if (!entries.length) return { problem: '대상을 먼저 선택하세요.' };
  if (entries.some(item => item.locked)) return { problem: '잠긴 대상이 포함되어 있습니다. 먼저 잠금을 해제하세요.' };
  const next = structuredClone(city);
  if (action !== 'copy') for (const key of ['objects', 'plots', 'roads']) next[key] = next[key].filter(item => !chosen.has(item.id));
  if (action === 'delete') {
    next.districts = (next.districts || []).map(district => ({ ...district, plotIds: district.plotIds.filter(id => next.plots.some(plot => plot.id === id)) }));
    return { city: next, count: entries.length };
  }
  const remap = new Map(entries.map(item => [item.id, action === 'copy' ? crypto.randomUUID() : item.id]));
  const chains = new Map();
  const translate = item => {
    const result = { ...item, id: remap.get(item.id) };
    if (item.a) {
      result.a = { x: item.a.x + dx, z: item.a.z + dz }; result.b = { x: item.b.x + dx, z: item.b.z + dz };
      if (action === 'copy' && item.chainId) { if (!chains.has(item.chainId)) chains.set(item.chainId, crypto.randomUUID()); result.chainId = chains.get(item.chainId); }
    } else { result.x += dx; result.z += dz; }
    return result;
  };
  const plots = city.plots.filter(item => chosen.has(item.id)).map(translate);
  for (const plot of plots) {
    const problem = plotProblem(next, plot); if (problem) return { problem };
    next.plots.push(plot);
  }
  for (const road of city.roads.filter(item => chosen.has(item.id)).map(translate)) {
    const problem = roadProblem(next, road); if (problem) return { problem }; next.roads.push(road);
  }
  for (const object of city.objects.filter(item => chosen.has(item.id)).map(translate)) {
    const problem = placementProblem(next, object.asset, object.x, object.z, object.rotation);
    if (problem) return { problem }; next.objects.push(object);
  }
  if (next.objects.length > 5000 || next.plots.length > 1000 || next.roads.length > 2000) return { problem: '도시의 배치 가능 개수를 초과합니다.' };
  for (const plot of plots) levelPlot(next, plot);
  if (action === 'copy') next.districts = (next.districts || []).map(district => ({ ...district, plotIds: [...district.plotIds, ...district.plotIds.filter(id => remap.has(id)).map(id => remap.get(id))] }));
  return { city: next, count: entries.length };
}
export function setLocked(city, ids, locked) {
  const chosen = expandSelection(city, ids);
  return { ...city, ...Object.fromEntries(['objects', 'plots', 'roads'].map(key => [key, city[key].map(item => chosen.has(item.id) ? { ...item, locked } : item)])) };
}
export function cleanDistricts(city) {
  return { ...city, districts: city.districts?.map(district => ({ ...district, plotIds: district.plotIds.filter(id => city.plots.some(plot => plot.id === id)) })) };
}
export function districtSummary(city, district, service) {
  const plots = city.plots.filter(plot => district.plotIds.includes(plot.id));
  const objects = city.objects.filter(object => plots.some(plot => inside(object, plot)));
  const consumers = objects.filter(object => service.consumers.has(object.id));
  return { plots, objects, consumers: consumers.length, power: consumers.filter(object => service.consumers.get(object.id).power).length, water: consumers.filter(object => service.consumers.get(object.id).water).length };
}

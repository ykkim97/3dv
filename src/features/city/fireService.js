import { assetById, closestRoadPoint, containingPlot, roadTouchesPlot, segmentIntersection, roadConnectsAt } from './cityModel.js';

export const FIRE_ROUTE_LIMIT = 140;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const keyFor = point => `${Math.round(point.x * 1000) / 1000}:${Math.round(point.z * 1000) / 1000}`;

function push(heap, item) {
  heap.push(item);
  for (let i = heap.length - 1; i > 0;) {
    const parent = Math.floor((i - 1) / 2);
    if (heap[parent].distance <= heap[i].distance) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}

function pop(heap) {
  const first = heap[0], last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    for (let i = 0; ;) {
      const left = i * 2 + 1, right = left + 1;
      if (left >= heap.length) break;
      const smaller = right < heap.length && heap[right].distance < heap[left].distance ? right : left;
      if (heap[i].distance <= heap[smaller].distance) break;
      [heap[i], heap[smaller]] = [heap[smaller], heap[i]];
      i = smaller;
    }
  }
  return first;
}

function roadGraph(city, objects) {
  const records = city.roads.filter(road => road.type !== 'path').map(road => ({ road, points: [road.a, road.b] }));
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const a = records[i], b = records[j];
    const crossing = segmentIntersection(a.road.a, a.road.b, b.road.a, b.road.b);
    if (crossing && roadConnectsAt(a.road, crossing) && roadConnectsAt(b.road, crossing)) { a.points.push(crossing); b.points.push(crossing); }
    for (const endpoint of [a.road.a, a.road.b]) if (distance(endpoint, closestRoadPoint(b.road, endpoint)) < 0.01 && roadConnectsAt(b.road, endpoint)) b.points.push(endpoint);
    for (const endpoint of [b.road.a, b.road.b]) if (distance(endpoint, closestRoadPoint(a.road, endpoint)) < 0.01 && roadConnectsAt(a.road, endpoint)) a.points.push(endpoint);
  }
  const access = new Map();
  for (const object of objects) {
    const plot = containingPlot(city, object.asset, object.x, object.z, object.rotation);
    const entries = [];
    if (plot) for (const record of records) {
      if (!roadTouchesPlot(record.road, plot, 5)) continue;
      const point = closestRoadPoint(record.road, object);
      record.points.push(point);
      entries.push({ key: keyFor(point), leg: distance(object, point) });
    }
    access.set(object.id, entries);
  }
  const graph = new Map(), edges = [];
  for (const { road, points } of records) {
    const unique = [...new Map(points.map(point => [keyFor(point), point])).entries()]
      .sort((a, b) => closestRoadPoint(road, a[1]).t - closestRoadPoint(road, b[1]).t);
    for (let i = 1; i < unique.length; i++) {
      const [aKey, a] = unique[i - 1], [bKey, b] = unique[i];
      const length = distance(a, b);
      if (length < 0.001) continue;
      if (!graph.has(aKey)) graph.set(aKey, []);
      if (!graph.has(bKey)) graph.set(bKey, []);
      graph.get(aKey).push({ key: bKey, length });
      graph.get(bKey).push({ key: aKey, length });
      edges.push({ a, b, aKey, bKey, length });
    }
  }
  return { access, graph, edges };
}

export function calculateFireService(city, onlyStationId = null) {
  const stations = city.objects.filter(object => object.asset === 'fire-station');
  const targets = city.objects.filter(object => object.asset !== 'fire-station' && ['residential', 'commercial', 'landmark'].includes(assetById[object.asset]?.category));
  const { access, graph, edges } = roadGraph(city, [...stations, ...targets]);
  const stationInfo = new Map(stations.map(station => [station.id, { ...station, roadConnected: access.get(station.id).length > 0, served: 0 }]));
  const distances = new Map(), heap = [];
  for (const station of stations) {
    if (onlyStationId && station.id !== onlyStationId) continue;
    for (const entry of access.get(station.id)) {
      const previous = distances.get(entry.key);
      if (!previous || entry.leg < previous.distance) {
        const route = { key: entry.key, distance: entry.leg, stationId: station.id };
        distances.set(entry.key, route);
        push(heap, route);
      }
    }
  }
  while (heap.length) {
    const current = pop(heap);
    if (distances.get(current.key) !== current) continue;
    for (const neighbor of graph.get(current.key) || []) {
      const length = current.distance + neighbor.length;
      if (length >= (distances.get(neighbor.key)?.distance ?? Infinity)) continue;
      const route = { key: neighbor.key, distance: length, stationId: current.stationId };
      distances.set(neighbor.key, route);
      push(heap, route);
    }
  }
  const buildings = new Map();
  let covered = 0;
  for (const target of targets) {
    const entries = access.get(target.id);
    let nearest = null;
    for (const entry of entries) {
      const route = distances.get(entry.key);
      if (!route) continue;
      const length = route.distance + entry.leg;
      if (!nearest || length < nearest.routeMeters) nearest = { stationId: route.stationId, routeMeters: length };
    }
    const reached = nearest && nearest.routeMeters <= FIRE_ROUTE_LIMIT;
    buildings.set(target.id, { roadAccess: entries.length > 0, stationId: reached ? nearest.stationId : null, routeMeters: reached ? nearest.routeMeters : null, nearestRouteMeters: nearest?.routeMeters ?? null });
    if (reached) { covered++; stationInfo.get(nearest.stationId).served++; }
  }
  const routes = [];
  for (const edge of edges) {
    const aReach = Math.max(0, FIRE_ROUTE_LIMIT - (distances.get(edge.aKey)?.distance ?? Infinity));
    const bReach = Math.max(0, FIRE_ROUTE_LIMIT - (distances.get(edge.bKey)?.distance ?? Infinity));
    if (aReach + bReach >= edge.length) { routes.push({ a: edge.a, b: edge.b }); continue; }
    if (aReach > 0) routes.push({ a: edge.a, b: { x: edge.a.x + (edge.b.x - edge.a.x) * aReach / edge.length, z: edge.a.z + (edge.b.z - edge.a.z) * aReach / edge.length } });
    if (bReach > 0) routes.push({ a: { x: edge.b.x + (edge.a.x - edge.b.x) * bReach / edge.length, z: edge.b.z + (edge.a.z - edge.b.z) * bReach / edge.length }, b: edge.b });
  }
  return { stations: stationInfo, buildings, routes, totals: { buildings: targets.length, covered } };
}

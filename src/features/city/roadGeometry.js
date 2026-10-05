import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { terrainHeight, ROAD_TYPES, roadIntersections, closestRoadPoint, roadConnectsAt } from './cityModel.js';
import { bridgeById } from './bridgePresets.js';

const roadWidth = road => ROAD_TYPES.find(type => type.id === road.type)?.width || 4;
function convexHull(points) {
  const sorted = points.sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const half = list => {
    const result = [];
    for (const point of list) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 1e-7) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

function junctionBoundary(point, arms, corners, radius) {
  // Include the pavement at the actual endpoint, not just the distant mouths.
  // At an elbow the mouths alone leave the connection outside their hull.
  const footprint = arms.flatMap(arm => [-1, 1].map(side => ({
    x: point.x - arm.tz * arm.width / 2 * side,
    z: point.z + arm.tx * arm.width / 2 * side,
  })));
  const ordered = [...arms].sort((a, b) => Math.atan2(a.tz, a.tx) - Math.atan2(b.tz, b.tx));
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i], b = ordered[(i + 1) % ordered.length];
    const gap = (Math.atan2(b.tz, b.tx) - Math.atan2(a.tz, a.tx) + Math.PI * 2) % (Math.PI * 2);
    const cross = a.tx * b.tz - a.tz * b.tx;
    if (gap <= Math.PI + 1e-6 || Math.abs(cross) < 1e-6) continue;
    const ax = -a.tz * a.width / 2, az = a.tx * a.width / 2;
    const bx = b.tz * b.width / 2, bz = -b.tx * b.width / 2;
    const t = ((bx - ax) * b.tz - (bz - az) * b.tx) / cross;
    const x = ax + a.tx * t, z = az + a.tz * t;
    if (Math.hypot(x, z) <= radius * 2) footprint.push({ x: point.x + x, z: point.z + z });
  }
  const hull = convexHull([...corners, ...footprint]);
  return hull.flatMap((vertex, i) => {
    if (vertex.mouth !== undefined) return [vertex];
    const before = hull[(i + hull.length - 1) % hull.length], after = hull[(i + 1) % hull.length];
    const trim = Math.min(0.65, Math.hypot(before.x - vertex.x, before.z - vertex.z) * 0.25,
      Math.hypot(after.x - vertex.x, after.z - vertex.z) * 0.25);
    const towards = target => {
      const distance = Math.hypot(target.x - vertex.x, target.z - vertex.z);
      return { x: vertex.x + (target.x - vertex.x) * trim / distance, z: vertex.z + (target.z - vertex.z) * trim / distance };
    };
    const start = towards(before), end = towards(after);
    return Array.from({ length: 5 }, (_, step) => {
      const t = step / 4;
      return { x: (1 - t) ** 2 * start.x + 2 * t * (1 - t) * vertex.x + t ** 2 * end.x,
        z: (1 - t) ** 2 * start.z + 2 * t * (1 - t) * vertex.z + t ** 2 * end.z,
        mouth: `corner-${i}-${step}` };
    });
  });
}

export function roadJunctions(city) {
  return roadIntersections(city.roads).map(point => {
    const roads = city.roads.filter(road => {
      const closest = closestRoadPoint(road, point);
      return Math.hypot(closest.x - point.x, closest.z - point.z) < 0.03 && roadConnectsAt(road, point);
    });
    const radius = point.width / 2 + 1;
    const arms = roads.flatMap(road => [road.a, road.b].flatMap(end => {
      const length = Math.hypot(end.x - point.x, end.z - point.z);
      if (length < 0.03) return [];
      return [{ roadId: road.id, tx: (end.x - point.x) / length, tz: (end.z - point.z) / length, reach: Math.min(radius, length), width: roadWidth(road) }];
    }));
    const corners = arms.flatMap((arm, mouth) => [-1, 1].map(side => ({
      x: point.x + arm.tx * arm.reach - arm.tz * arm.width / 2 * side,
      z: point.z + arm.tz * arm.reach + arm.tx * arm.width / 2 * side, mouth,
    })));
    const boundary = junctionBoundary(point, arms, corners, radius);
    let height = Math.max(0.25, terrainHeight(city.heights, point.x, point.z), ...corners.map(p => terrainHeight(city.heights, p.x, p.z)));
    // Use one elevation for all entering roads, including terrain beneath their curbs.
    const extent = radius + point.width / 2 + 0.35;
    for (let x = -extent; x <= extent; x++) for (let z = -extent; z <= extent; z++) height = Math.max(height, terrainHeight(city.heights, point.x + x, point.z + z));
    return { ...point, radius, height, boundary, roadIds: roads.map(road => road.id) };
  }).filter(junction => junction.boundary.length >= 3);
}

export function roadProfile(city, road, junctions = roadJunctions(city)) {
  const dx = road.b.x - road.a.x, dz = road.b.z - road.a.z, length = Math.hypot(dx, dz);
  const width = ROAD_TYPES.find(type => type.id === road.type)?.width || 4;
  const nx = length ? -dz / length : 1, nz = length ? dx / length : 0;
  const ground = point => Math.max(0.25, ...[-0.5, -0.25, 0, 0.25, 0.5].map(offset => terrainHeight(city.heights, point.x + nx * (width + 0.7) * offset, point.z + nz * (width + 0.7) * offset)));
  const approach = point => Math.max(ground(point), ...junctions.filter(connection => connection.roadIds.includes(road.id) && Math.hypot(connection.x - point.x, connection.z - point.z) < 0.03).map(connection => connection.height));
  const banks = [approach(road.a), approach(road.b)], bridge = bridgeById[road.bridge];
  const bridgeRise = bridge ? Math.min(bridge.rise, length * (road.type === 'avenue' ? 0.08 : 0.12) / Math.PI) : 0;
  const steps = Math.max(1, Math.ceil(length));
  const distances = new Set(Array.from({ length: steps + 1 }, (_, index) => length * index / steps));
  for (const connection of junctions) if (connection.roadIds.includes(road.id) && length) {
    const along = ((connection.x - road.a.x) * dx + (connection.z - road.a.z) * dz) / length;
    for (const offset of [-connection.radius, connection.radius]) distances.add(Math.max(0, Math.min(length, along + offset)));
  }
  const samples = [...distances].sort((a, b) => a - b).filter((distance, i, list) => !i || distance - list[i - 1] > 1e-6).map(distance => {
    const t = length ? distance / length : 0, x = road.a.x + dx * t, z = road.a.z + dz * t;
    // Keep the full paved width above the terrain, including on cross slopes.
    let height = ground({ x, z });
    if (bridge) height = Math.max(height, banks[0] * (1 - t) + banks[1] * t + bridgeRise * Math.sin(Math.PI * t) ** 2);
    let junction = false;
    for (const connection of junctions) {
      if (!connection.roadIds.includes(road.id)) continue;
      const distance = Math.hypot(x - connection.x, z - connection.z);
      if (distance > connection.radius + 3) continue;
      const weight = Math.max(0, Math.min(1, (connection.radius + 3 - distance) / 3));
      height = Math.max(height, connection.height * weight + height * (1 - weight));
      if (distance < connection.radius - 1e-6) junction = true;
    }
    return { x, z, height, distance, junction };
  });
  return { samples, nx, nz, length, width };
}

export function roadTerrainWarning(city, road, junctions = undefined) {
  const candidate = { ...road, id: road.id || '__road-grade' };
  const network = { ...city, roads: [...city.roads.filter(item => item.id !== candidate.id), candidate] };
  const { samples, length } = roadProfile(network, candidate, junctions);
  if (length < 2) return null;
  let grade = 0;
  for (let i = 1; i < samples.length; i++) grade = Math.max(grade, Math.abs(samples[i].height - samples[i - 1].height) / (samples[i].distance - samples[i - 1].distance));
  const limit = road.type === 'avenue' ? 0.1 : road.type === 'path' ? 0.35 : 0.15;
  return grade > limit ? `급경사 ${Math.round(grade * 100)}% · 권장 ${Math.round(limit * 100)}% 이하 · 지형을 완만하게 다듬어 주세요.` : null;
}

export function createRoadStrip(scene, name, profile, width, offset = 0, lift = 0.15, thickness = 0.12, first = 0, last = profile.samples.length - 1) {
  const positions = [], indices = [], normals = [], uvs = [];
  for (let i = first; i <= last; i++) {
    const point = profile.samples[i];
    for (const y of [point.height + lift, point.height + lift - thickness]) for (const side of [-1, 1]) {
      const lateral = offset + side * width / 2;
      positions.push(point.x + profile.nx * lateral, y, point.z + profile.nz * lateral);
      uvs.push((point.x + profile.nx * lateral) / 8, (point.z + profile.nz * lateral) / 8);
    }
  }
  const quad = (a, b, c, d) => indices.push(a, c, b, a, d, c);
  for (let i = 0; i < last - first; i++) {
    const a = i * 4, b = a + 4;
    quad(a, a + 1, b + 1, b);
    quad(a + 2, b + 2, b + 3, a + 3);
    quad(a, b, b + 2, a + 2);
    quad(a + 1, a + 3, b + 3, b + 1);
  }
  const end = (last - first) * 4;
  quad(0, 2, 3, 1); quad(end, end + 1, end + 3, end + 2);
  VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new Mesh(name, scene), data = new VertexData();
  data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs;
  data.applyToMesh(mesh);
  return mesh;
}

export function createJunctionSurface(scene, junction) {
  // The vertex average always lies inside this convex outline, including elbows
  // and unequal-width transitions; the road connection itself may not.
  const center = junction.boundary.reduce((sum, point) => ({ x: sum.x + point.x / junction.boundary.length,
    z: sum.z + point.z / junction.boundary.length }), { x: 0, z: 0 });
  const positions = [center.x, junction.height + 0.22, center.z], indices = [], normals = [], uvs = [center.x / 8, center.z / 8];
  for (const point of junction.boundary) {
    positions.push(point.x, junction.height + 0.22, point.z);
    uvs.push(point.x / 8, point.z / 8);
  }
  for (let i = 0; i < junction.boundary.length; i++) indices.push(0, i + 1, (i + 1) % junction.boundary.length + 1);
  VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new Mesh('road-junction', scene), data = new VertexData();
  data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs; data.applyToMesh(mesh);
  return mesh;
}

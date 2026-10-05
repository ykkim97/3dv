import { mapDimensions } from '../core/mapDimensions.js';

export const WATER_LEVEL = -0.1;
export const DEFAULT_WATER = { enabled: true, flowing: true, color: '#438f9f', opacity: 0.85 };
export function waterSettings(city, region) {
  const local = city.waterSettings?.regions?.find(item => region.cells.includes(item.anchor));
  return { ...DEFAULT_WATER, ...city.waterSettings, ...local, regions: undefined };
}
export function waterRegions(city) {
  const { resolution: size, half } = mapDimensions(city);
  const row = size + 1, active = new Uint8Array(size * size), visited = new Uint8Array(size * size);
  const corners = index => {
    const r = Math.floor(index / size), c = index % size, a = r * row + c;
    return [a, a + 1, a + row, a + row + 1];
  };
  for (let i = 0; i < active.length; i++) active[i] = corners(i).some(index => city.heights[index] < WATER_LEVEL) ? 1 : 0;
  const regions = [];
  for (let first = 0; first < active.length; first++) {
    if (!active[first] || visited[first]) continue;
    const cells = [first]; visited[first] = 1;
    for (let cursor = 0; cursor < cells.length; cursor++) {
      const index = cells[cursor], r = Math.floor(index / size), c = index % size;
      const [a, b, d, e] = corners(index);
      const neighbors = [[r > 0 ? index - size : -1, a, b], [c < size - 1 ? index + 1 : -1, b, e], [r < size - 1 ? index + size : -1, d, e], [c > 0 ? index - 1 : -1, a, d]];
      for (const [next, edgeA, edgeB] of neighbors) if (next >= 0 && active[next] && !visited[next] && Math.min(city.heights[edgeA], city.heights[edgeB]) < WATER_LEVEL) { visited[next] = 1; cells.push(next); }
    }
    const saved = city.waterSettings?.regions?.find(item => cells.includes(item.anchor));
    const anchor = saved?.anchor ?? first;
    const x = cells.reduce((sum, index) => sum + (index % size) * 2 - half + 1, 0) / cells.length;
    const z = cells.reduce((sum, index) => sum + half - 1 - Math.floor(index / size) * 2, 0) / cells.length;
    regions.push({ id: `water:${anchor}`, anchor, cells, x, z });
  }
  return regions;
}

export function waterGeometry(city, region) {
  const positions = [], indices = [], depths = [];
  const { resolution, half } = mapDimensions(city);
  const row = resolution + 1;
  const vertex = index => ({ x: (index % row) * 2 - half, z: half - Math.floor(index / row) * 2, h: city.heights[index] });
  const clip = triangle => {
    const polygon = [];
    for (let i = 0; i < triangle.length; i++) {
      const a = triangle[i], b = triangle[(i + 1) % triangle.length];
      if (a.h < WATER_LEVEL) polygon.push(a);
      if ((a.h < WATER_LEVEL) !== (b.h < WATER_LEVEL)) {
        const t = (WATER_LEVEL - a.h) / (b.h - a.h);
        polygon.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, h: WATER_LEVEL });
      }
    }
    if (polygon.length < 3) return;
    const start = positions.length / 3;
    for (const point of polygon) { positions.push(point.x, WATER_LEVEL + 0.015, point.z); depths.push(Math.max(0, WATER_LEVEL - point.h)); }
    for (let i = 1; i < polygon.length - 1; i++) indices.push(start, start + i, start + i + 1);
  };
  for (const cell of region.cells) {
    const index = Math.floor(cell / resolution) * row + cell % resolution;
    const a = vertex(index), b = vertex(index + 1), c = vertex(index + row), d = vertex(index + row + 1);
    // Match Babylon CreateGround's diagonal so water follows the actual shoreline.
    clip([d, b, a]); clip([c, d, a]);
  }
  return { positions, indices, depths };
}

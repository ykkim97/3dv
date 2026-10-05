import { mapDimensions } from '../core/mapDimensions.js';

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

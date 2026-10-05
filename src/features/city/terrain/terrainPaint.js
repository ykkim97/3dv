import { mapDimensions } from '../core/mapDimensions.js';

export const validTerrainColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function terrainBaseColor(height) {
  const tint = height < 0.8 ? [0.88, 0.85, 0.68] : height > 14 ? [0.77, 0.79, 0.67] : [1, 1, 0.94];
  return [145, 172, 123].map((value, index) => Math.round(value * tint[index]));
}
export function terrainVertexColor(city, index) {
  const hex = city.terrainPaint?.[index];
  return validTerrainColor(hex) ? [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)) : terrainBaseColor(city.heights[index]);
}
export function paintTerrain(city, point, radius, strength, color) {
  if (!validTerrainColor(color) || radius <= 0 || strength <= 0) return false;
  const selected = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
  const { resolution, size } = mapDimensions(city);
  const spacing = 2;
  let changed = false;
  for (let row = 0; row <= resolution; row++) for (let col = 0; col <= resolution; col++) {
    const x = col * spacing - size / 2, z = size / 2 - row * spacing;
    const distance = Math.hypot(x - point.x, z - point.z);
    if (distance >= radius || city.plots.some(plot => Math.abs(x - plot.x) <= plot.width / 2 + 1 && Math.abs(z - plot.z) <= plot.depth / 2 + 1)) continue;
    const index = row * (resolution + 1) + col;
    const weight = (1 - distance / radius) ** 2 * Math.min(1, strength);
    const rgb = terrainVertexColor(city, index).map((value, channel) => Math.round(value + (selected[channel] - value) * weight));
    const next = `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('')}`;
    if (next === city.terrainPaint?.[index]) continue;
    if (!city.terrainPaint) city.terrainPaint = Array(city.heights.length).fill(null);
    city.terrainPaint[index] = next;
    changed = true;
  }
  return changed;
}

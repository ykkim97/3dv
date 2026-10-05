import { MAP_SIZES, mapDimensions } from './mapDimensions.js';
import { validateCity } from './cityValidation.js';

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

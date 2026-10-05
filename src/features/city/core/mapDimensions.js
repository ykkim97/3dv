
export const WORLD_SIZE = 240;

export const RESOLUTION = 120;
// Legacy saves default to 240 m. Keep a fixed 2 m terrain cell size.

export const MAP_SIZES = [240, 480];

export function mapDimensions(city) {
  const resolution = city?.map?.resolution ?? (city?.heights ? Math.sqrt(city.heights.length) - 1 : RESOLUTION);
  const size = city?.map?.size ?? resolution * 2;
  return { size, resolution, half: size / 2, cellSize: 2, cameraLimit: size * 390 / WORLD_SIZE };
}

import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';

export const PLOT_TEXTURE_METERS = 8;
const SIZE = 512;
const hash = (x, y) => {
  let n = Math.imul(x + 137, 374761393) ^ Math.imul(y + 719, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
// Periodic noise keeps the texture seamless; UVs are measured in world meters.
function noise(u, v, cells) {
  const x = u * cells, y = v * cells;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix % cells, iy % cells), b = hash((ix + 1) % cells, iy % cells);
  const c = hash(ix % cells, (iy + 1) % cells), d = hash((ix + 1) % cells, (iy + 1) % cells);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

export function createPlotTextures(scene, kind) {
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const heights = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE;
    const fine = hash(x, y), broad = noise(u, v, 8), medium = noise(u, v, 32);
    let shade, height;
    if (kind === 'grass') {
      const mowing = Math.cos(u * Math.PI * 4) * 0.045;
      const blade = hash(x, Math.floor(y / 3));
      shade = 0.67 + broad * 0.17 + medium * 0.07 + blade * 0.12 + mowing;
      height = blade * 0.55 + fine * 0.15;
    } else if (kind === 'asphalt') {
      const aggregate = fine > 0.86 ? 0.14 : fine < 0.1 ? -0.12 : 0;
      shade = 0.65 + broad * 0.09 + medium * 0.08 + fine * 0.13 + aggregate;
      height = fine * 0.5 + medium * 0.12;
    } else if (kind === 'concrete') {
      const joint = x % (SIZE / 2) < 2 || y % (SIZE / 2) < 2;
      const panel = hash(Math.floor(u * 2), Math.floor(v * 2)) * 0.06;
      shade = joint ? 0.44 : 0.74 + broad * 0.07 + fine * 0.05 + panel;
      height = joint ? 0.05 : 0.45 + fine * 0.05;
    } else {
      const stone = fine > 0.975 ? 0.14 : 0;
      shade = 0.56 + broad * 0.24 + medium * 0.13 + fine * 0.1 + stone;
      height = medium * 0.25 + fine * 0.3 + stone;
    }
    const i = y * SIZE + x;
    const value = Math.round(Math.min(1, Math.max(0, shade)) * 255);
    pixels.set([value, value, value, 255], i * 4);
    heights[i] = height;
  }
  const normals = new Uint8Array(pixels.length);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const dx = (heights[y * SIZE + (x + 1) % SIZE] - heights[y * SIZE + (x + SIZE - 1) % SIZE]) * 0.7;
    const dy = (heights[((y + 1) % SIZE) * SIZE + x] - heights[((y + SIZE - 1) % SIZE) * SIZE + x]) * 0.7;
    const length = Math.hypot(dx, dy, 1);
    normals.set([Math.round((0.5 - dx / length / 2) * 255), Math.round((0.5 - dy / length / 2) * 255), Math.round((0.5 + 1 / length / 2) * 255), 255], (y * SIZE + x) * 4);
  }
  const make = (data, name) => {
    const texture = RawTexture.CreateRGBATexture(data, SIZE, SIZE, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    texture.name = `plot-${kind}-${name}`;
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
    return texture;
  };
  return { diffuse: make(pixels, 'color'), normal: make(normals, 'normal') };
}

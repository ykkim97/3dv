import { WORLD_SIZE, MAP_SIZES } from './mapDimensions.js';
import { PRESETS } from '../presets/catalog.js';
import { levelPlot, terrainHeight } from '../terrain/terrainModel.js';

export function createCity(preset = 'river', size = WORLD_SIZE) {
  if (!MAP_SIZES.includes(size)) throw new Error('지원하지 않는 지도 크기입니다.');
  const resolution = size / 2, half = size / 2;
  let seed = 2187;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const heights = [];
  for (let row = 0; row <= resolution; row++) for (let col = 0; col <= resolution; col++) {
    const x = col * 2 - half, z = half - row * 2;
    let y = 1.5;
    if (preset === 'river') {
      const river = 49 + 12 * Math.sin(z / 42);
      y -= 7 * Math.exp(-(((x - river) / 13) ** 2));
      y += Math.max(0, -x - 70) * (0.13 + 0.1 * Math.sin(z / 23));
    }
    if (preset === 'coast') y = 1.5 - 8 / (1 + Math.exp(-(x - 45 - 9 * Math.sin(z / 25)) / 5));
    if (preset === 'alpine') y += 26 * Math.exp(-((x + 83) ** 2 + (z - 65) ** 2) / 1700) + 20 * Math.exp(-((x - 82) ** 2 + (z + 62) ** 2) / 1700);
    heights.push(Math.max(-30, Math.min(60, y)));
  }
  const city = { version: 1, name: PRESETS.find(p => p.id === preset)?.name || '나의 도시', preset, map: { size, resolution, cellSize: 2 }, heights, objects: [], roads: [], plots: [] };
  if (preset === 'blank') return city;
  const add = (asset, x, z, rotation = 0) => city.objects.push({ id: `seed-${city.objects.length}`, asset, x, z, rotation });
  for (const x of [-66, -42, -18, 6, 30]) city.roads.push({ id: `vx${x}`, type: 'street', a: { x, z: -67 }, b: { x, z: 67 } });
  for (const z of [-66, -42, -18, 6, 30, 54]) city.roads.push({ id: `hz${z}`, type: z === 6 ? 'avenue' : 'street', a: { x: -76, z }, b: { x: 33, z } });
  for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 5; iz++) {
    const cx = -54 + ix * 24, cz = -54 + iz * 24;
    city.plots.push({ id: `plot-${ix}-${iz}`, x: cx, z: cz, width: 19, depth: iz === 2 || iz === 3 ? 16 : 19 });
    if (ix === 1 && iz === 2) { add('park', cx, cz); continue; }
    if (ix === 2 && iz === 2) continue;
    for (const dx of [-5, 5]) for (const dz of (iz === 2 || iz === 3 ? [-4, 4] : [-5, 5])) {
      const central = ix >= 2 && iz >= 2;
      const asset = preset === 'alpine' ? (random() > 0.85 ? 'apartment' : 'house') : central ? (random() > 0.45 ? 'office' : 'tower') : (random() > 0.5 ? 'apartment' : 'house');
      add(asset, cx + dx, cz + dz, random() > 0.5 ? 0 : Math.PI);
    }
  }
  add('hall', -54, 66); add('school', -29, 66); add('hospital', -5, 66);
  for (const x of [-54, -29, -5]) city.plots.push({ id: `civic-plot-${x}`, x, z: 66, width: 18, depth: 16 });
  // Two clear development sites make the first placement possible immediately.
  city.plots.push({ id: 'starter-plot-a', x: -53, z: -87, width: 24, depth: 16 }, { id: 'starter-plot-b', x: -23, z: -87, width: 24, depth: 16 });
  city.plots.forEach(p => levelPlot(city, p));
  for (let i = 0; i < 180; i++) {
    const x = random() * 214 - 107, z = random() * 214 - 107;
    if (terrainHeight(heights, x, z) < 0.7 || (x > -79 && x < 36 && z > -73 && z < 76)) continue;
    if (city.plots.some(p => Math.abs(x - p.x) < p.width / 2 + 4 && Math.abs(z - p.z) < p.depth / 2 + 4)) continue;
    add(preset === 'alpine' || random() > 0.7 ? 'pine' : 'tree', x, z);
  }
  return city;
}

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { validateCity } from '../src/features/city/core/cityValidation.js';
import { assetById } from '../src/features/city/presets/catalog.js';
import { terrainHeight } from '../src/features/city/terrain/terrainModel.js';
import { containingPlot, footprint } from '../src/features/city/placement/footprint.js';
import { plotProblem, plotHasRoadAccess } from '../src/features/city/plots/plotModel.js';
import { placementProblem } from '../src/features/city/placement/placementRules.js';
import { roadProblem } from '../src/features/city/roads/roadModel.js';
import { calculateUtilityService } from '../src/features/city/simulation/utilityService.js';

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/create-smart-grid-demo.mjs input.city.json [output-directory]');
const original = validateCity(JSON.parse(fs.readFileSync(input, 'utf8')));
assert.equal(original.map?.size, 480, 'This layout uses the 480 m medium map.');
const city = structuredClone(original);
city.name = 'Electric Smart Grid · 리버 에너지 시티';
city.environment = { hour: 16, autoCycle: false, cycleMinutes: 10 };
city.lifeSettings = { enabled: true, cars: true, people: true };
city.waterSettings = { ...city.waterSettings, enabled: true, flowing: true, color: '#438e9c', opacity: .78 };
city.districts ||= [];
let serial = 0;
const uid = label => `grid-${label}-${++serial}`;
const addedPlots = [], addedRoads = [], addedObjects = [];
const height = (x, z) => terrainHeight(city.heights, x, z);
// Restrict landscaping to new campuses and approaches; keep the reference city's river.
function platform(x, z, width, depth) {
  for (let row = 0; row <= 240; row++) for (let col = 0; col <= 240; col++) {
    const dx = Math.max(0, Math.abs(col * 2 - 240 - x) - width / 2);
    const dz = Math.max(0, Math.abs(240 - row * 2 - z) - depth / 2);
    const weight = Math.max(0, 1 - Math.hypot(dx, dz) / 4);
    const i = row * 241 + col;
    city.heights[i] += (1.5 - city.heights[i]) * weight;
  }
}
function clearTrees(x, z, width, depth) {
  city.objects = city.objects.filter(o => !['tree', 'pine'].includes(o.asset)
    || Math.abs(o.x - x) >= width / 2 + 5 || Math.abs(o.z - z) >= depth / 2 + 5);
}
function campus(name, x, z, width, depth, surface = 'concrete', color = '#8fc9bb') {
  clearTrees(x, z, width, depth); platform(x, z, width, depth);
  const plot = { id: uid('plot'), x, z, width, depth, surface };
  assert.equal(plotProblem(city, plot), null, `${name}: ${x}, ${z}`);
  city.plots.push(plot); addedPlots.push(plot);
  city.districts.push({ id: uid('district'), name, color, plotIds: [plot.id] });
  return plot;
}
function place(asset, x, z, rotation = 0) {
  assert.equal(placementProblem(city, asset, x, z, rotation), null, `${asset} at ${x},${z}`);
  const object = { id: uid(asset), asset, x, z, rotation };
  city.objects.push(object); addedObjects.push(object); return object;
}
function road(name, a, b, type = 'avenue', bridge) {
  const record = { id: uid(name), type, a: { x: a[0], z: a[1] }, b: { x: b[0], z: b[1] }, ...(bridge ? { bridge } : {}) };
  assert.equal(roadProblem(city, record), null, name);
  if (!bridge) {
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let i = 0; i <= steps; i++) {
      const x = a[0] + (b[0] - a[0]) * i / steps, z = a[1] + (b[1] - a[1]) * i / steps;
      assert.ok(height(x, z) >= .4, `${name}: use a bridge over water`);
      clearTrees(x, z, 10, 10);
    }
  }
  city.roads.push(record); addedRoads.push(record); return record;
}

campus('01 원자력 · 기저전원', -200, -195, 60, 60, 'concrete', '#abc6dc');
place('nuclear-plant', -204, -198);
place('substation', -185, -173); place('ess', -211, -174);
campus('02 풍력 · 재생에너지', -190, 190, 68, 60, 'grass', '#9ac5ae');
for (const x of [-208, -184, -166]) for (const z of [176, 200]) place('wind-turbine', x, z);
place('ess', -194, 216); place('substation', -174, 216);
campus('03 태양광 · 북부 발전단지', -116, 190, 56, 60, 'grass', '#dfc683');
for (const x of [-134, -120, -106]) for (const z of [174, 188, 202]) place('solar-farm', x, z);
place('substation', -134, 214); place('ess', -116, 214);
campus('04 태양광 · 남부 마이크로그리드', 4, -195, 76, 54, 'grass', '#dec280');
for (const x of [-22, -8, 6, 20]) for (const z of [-204, -190]) place('solar-farm', x, z);
place('substation', 30, -214); place('ess', 12, -214);
campus('05 스마트그리드 · ESS 관제 허브', 180, 130, 72, 60, 'concrete', '#85c4cb');
for (const x of [158, 172, 186, 200]) for (const z of [114, 126]) place('ess', x, z);
place('substation', 158, 144); place('substation', 176, 144);
place('office', 199, 147); place('distribution', 190, 139);
campus('06 스마트 팩토리 · 산업 수요', 180, 38, 72, 72, 'asphalt', '#a9b8cf');
for (const x of [161, 191]) for (const z of [20, 48]) place('smart-factory', x, z);
place('substation', 154, 68); place('ess', 173, 68); place('distribution', 190, 68);
campus('07 에너지 효율 · 신도시', 180, -55, 72, 72, 'grass', '#9cc9ac');
for (const x of [159, 179, 199]) for (const z of [-76, -56]) place(z === -76 ? 'tower' : 'apartment', x, z);
place('park', 158, -33); place('school', 179, -33); place('distribution', 199, -33);
campus('08 첨단 제조 · 물류', 180, -140, 72, 58, 'asphalt', '#a2b7c4');
place('smart-factory', 161, -143); place('smart-factory', 191, -143);
place('ess', 157, -121); place('distribution', 173, -121); place('fire-station', 199, -121);

road('west-energy-spine', [-236, -230], [-236, 230]);
road('east-energy-spine', [140, -230], [140, 230]);
road('north-west-link', [-236, 154], [-44, 154]);
road('north-energy-bridge', [-44, 154], [24, 154], 'avenue', 'cable');
road('north-east-link', [24, 154], [140, 154]);
road('solar-access', [-148, 154], [-148, 224], 'street');
road('north-campus-top', [-236, 224], [-90, 224], 'street');
road('south-west-link', [-236, -163], [-94, -163], 'street');
road('south-energy-link', [-94, -163], [-34, -163], 'street');
road('south-east-link', [-34, -163], [140, -163], 'street');
road('south-campus-bottom', [-236, -230], [140, -230]);
road('south-city-link', [8, -163], [8, -112], 'street');
road('east-city-link', [124, 140], [140, 140], 'street');
for (const z of [166, 78, -8, -98, -176]) road('east-campus-street', [140, z], [228, z], 'street');
road('east-campus-loop', [228, -176], [228, 166], 'street');

// Transmission corridor: every tower is a real preset on a small maintained site.
// Avoid the river and bridge deck; the utility service uses conceptual relay links.
function relay(asset, x, z) {
  const spec = assetById[asset];
  if (!containingPlot(city, asset, x, z, 0)) campus('송배전 연결 노드', x, z, spec.width + 2, spec.depth + 2, 'concrete', '#d7bd80');
  return place(asset, x, z);
}
for (const z of [-190, -150, -110, -70, -30, 10, 50, 84, 130, 174]) relay('transmission-tower', 131.5, z);
for (const x of [62, 104]) relay('transmission-tower', x, -218);
for (const z of [-140, -90, -40, 10, 60, 110]) relay('transmission-tower', -218, z);

// Supply the new east campus through the southern solar corridor.
// Local distribution at existing city sites covers the dense reference neighborhoods.
for (const plot of original.plots) {
  const candidates = [];
  for (let x = plot.x - plot.width / 2 + 4; x <= plot.x + plot.width / 2 - 4; x += 8)
    for (let z = plot.z - plot.depth / 2 + 4; z <= plot.z + plot.depth / 2 - 4; z += 8) candidates.push({ x, z });
  const point = candidates.find(p => !placementProblem(city, 'distribution', p.x, p.z));
  if (point) place('distribution', point.x, point.z);
}

// Fill relay gaps using legal land parcels, then put local feeders near consumers.
// This is the editor's range-based network, not a power-flow or capacity simulation.
function legalSite(asset, x, z) {
  if (!placementProblem(city, asset, x, z)) return { existing: true };
  if (!placementProblem({ ...city, objects: city.objects.filter(o => !['tree', 'pine'].includes(o.asset)) }, asset, x, z)) return { existing: true, clearTrees: true };
  const spec = assetById[asset];
  const plot = { id: 'candidate', x, z, width: spec.width + 2, depth: spec.depth + 2 };
  if (plotProblem(city, plot)) return null;
  return { existing: false };
}
const positions = [];
for (let x = -220; x <= 220; x += 12) for (let z = -220; z <= 220; z += 12) positions.push({ x, z });
for (const plot of city.plots) for (let x = plot.x - plot.width / 2 + 4; x <= plot.x + plot.width / 2 - 4; x += 2)
  for (let z = plot.z - plot.depth / 2 + 4; z <= plot.z + plot.depth / 2 - 4; z += 2) positions.push({ x, z });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function addAt(asset, point, site) {
  if (site.clearTrees) clearTrees(point.x, point.z, assetById[asset].width, assetById[asset].depth);
  if (!site.existing) campus('스마트 송배전 · 연결 노드', point.x, point.z, assetById[asset].width + 2, assetById[asset].depth + 2, 'concrete', '#d7bd80');
  return place(asset, point.x, point.z);
}
for (let pass = 0; pass < 60; pass++) {
  const service = calculateUtilityService(city);
  const connected = [...service.facilities.values()].filter(f => f.network === 'power' && f.connected);
  const targets = [...service.facilities.values()].filter(f => f.network === 'power' && !f.connected);
  if (!targets.length) break;
  let best = null;
  for (const target of targets) {
    const currentGap = Math.min(...connected.map(f => distance(f, target)));
    for (const point of positions) {
      const gap = distance(point, target), progress = currentGap - gap;
      if (progress < 6 || best && progress <= best.progress || !connected.some(f => distance(f, point) <= 54)) continue;
      const site = legalSite('transmission-tower', point.x, point.z);
      if (site) best = { point, site, progress };
    }
  }
  if (!best) break;
  addAt('transmission-tower', best.point, best.site);
}
for (let pass = 0; pass < 70; pass++) {
  const service = calculateUtilityService(city);
  const missing = city.objects.filter(o => service.consumers.has(o.id) && !service.consumers.get(o.id).power);
  if (!missing.length) break;
  const connected = [...service.facilities.values()].filter(f => f.network === 'power' && f.connected);
  let best = null;
  for (const point of positions) {
    const served = missing.filter(o => distance(o, point) <= 23).length;
    if (!served || best && served <= best.served || !connected.some(f => distance(f, point) <= 35)) continue;
    const site = legalSite('distribution', point.x, point.z);
    if (site) best = { point, site, served };
  }
  if (!best) break;
  addAt('distribution', best.point, best.site);
}

// Street props reuse the editor's instanced templates; no light per pole is created.
for (const r of addedRoads.filter(r => !r.bridge)) {
  const length = Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z);
  const nx = -(r.b.z - r.a.z) / length, nz = (r.b.x - r.a.x) / length;
  for (let m = 12; m < length - 8; m += 22) {
    const x = r.a.x + (r.b.x - r.a.x) * m / length + nx * 4.8;
    const z = r.a.z + (r.b.z - r.a.z) * m / length + nz * 4.8;
    if (!placementProblem(city, 'street-lamp', x, z)) place('street-lamp', x, z);
  }
}
for (const plot of addedPlots.filter(p => p.width > 30)) {
  for (const x of [plot.x - plot.width / 2 + 3, plot.x + plot.width / 2 - 3])
    for (let z = plot.z - plot.depth / 2 + 5; z < plot.z + plot.depth / 2; z += 12)
      if (!placementProblem(city, 'pine', x, z)) place('pine', x, z);
}

city.cameraViews = [
  ['전체 전경 · 발전에서 도시까지', 0, 0, 610],
  ['원자력 발전 · 기저전원', -200, -195, 110],
  ['풍력 · 태양광 발전단지', -156, 188, 200],
  ['ESS · 에너지 관제 허브', 178, 130, 120],
  ['스마트 팩토리 · 산업 수요', 180, 38, 145],
  ['전기 도시 · 주거와 업무', 70, 15, 260],
].map(([name, x, z, radius], i) => ({ id: `grid-camera-${i}`, name, alpha: -Math.PI / 2.8, beta: .82, radius, target: { x, y: 0, z } }));
validateCity(city);
const service = calculateUtilityService(city);
assert.equal(service.totals.power, service.totals.consumers, 'Every demo consumer must have power.');
assert.ok([...service.facilities.values()].filter(f => f.network === 'power').every(f => f.connected), 'All power facilities must connect to a source.');
for (const object of addedObjects.filter(o => city.objects.includes(o))) assert.equal(placementProblem(city, object.asset, object.x, object.z, object.rotation, object.id), null, object.id);
const directory = process.argv[3] || 'artifacts/smart-grid-demo';
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'Electric_Smart_Grid.city.json'), JSON.stringify(city, null, 2));
const report = {
  source: path.basename(input), map: city.map, objects: city.objects.length,
  plots: city.plots.length, roads: city.roads.length,
  added: { objects: addedObjects.filter(o => city.objects.includes(o)).length, plots: addedPlots.length, roads: addedRoads.length },
  assets: city.objects.reduce((counts, o) => ({ ...counts, [o.asset]: (counts[o.asset] || 0) + 1 }), {}),
  service: service.totals,
  disconnectedPower: [...service.facilities.values()].filter(f => f.network === 'power' && !f.connected).map(f => ({ id: f.id, asset: f.asset, x: f.x, z: f.z })),
  newPlotsWithoutRoadAccess: addedPlots.filter(p => p.width > 30 && !plotHasRoadAccess(city, p)).map(p => p.id),
};
fs.writeFileSync(path.join(directory, 'validation.json'), JSON.stringify(report, null, 2));
const px = x => 50 + (x + 240) * 2, py = z => 120 + (240 - z) * 2;
const svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1060" height="1160" viewBox="0 0 1060 1160"><rect width="1060" height="1160" fill="#142b2b"/><g font-family="Segoe UI, sans-serif"><text x="50" y="49" fill="#c2f2d7" font-size="26" font-weight="700">ELECTRIC SMART GRID</text><text x="50" y="80" fill="#a0b9b3" font-size="15">480 × 480 m · 리버 에너지 시티 · 발전 / 송전 / 저장 / 도시 수요</text>'];
for (let x = -240; x < 240; x += 8) for (let z = -240; z < 240; z += 8) svg.push(`<rect x="${px(x)}" y="${py(z + 8)}" width="16.2" height="16.2" fill="${height(x + 4, z + 4) < .25 ? '#3e8291' : '#648862'}"/>`);
for (const p of city.plots) svg.push(`<rect x="${px(p.x - p.width / 2)}" y="${py(p.z + p.depth / 2)}" width="${p.width * 2}" height="${p.depth * 2}" fill="${p.surface === 'grass' ? '#8aa86e' : p.surface === 'asphalt' ? '#66797e' : '#a3b0a4'}" stroke="#d2e1bf" stroke-width="1"/>`);
for (const r of city.roads) svg.push(`<path d="M ${px(r.a.x)} ${py(r.a.z)} L ${px(r.b.x)} ${py(r.b.z)}" stroke="${r.bridge ? '#e9c27c' : '#cad4c4'}" stroke-width="${r.type === 'avenue' ? 14 : r.type === 'street' ? 8 : 4}" stroke-linecap="round"/>`);
for (const o of city.objects) {
  const a = assetById[o.asset], f = footprint(o.asset, o.rotation);
  if (['tree', 'pine'].includes(o.asset)) svg.push(`<circle cx="${px(o.x)}" cy="${py(o.z)}" r="3" fill="#345e45"/>`);
  else svg.push(`<rect x="${px(o.x - f.width / 2)}" y="${py(o.z + f.depth / 2)}" width="${f.width * 2}" height="${f.depth * 2}" rx="1" fill="${a.category === 'power' ? '#e7b75f' : o.asset === 'smart-factory' ? '#92cdd8' : a.color}" stroke="#365951" stroke-width=".8"><title>${a.name}</title></rect>`);
}
for (const district of city.districts.filter(d => /^0[1-8] /.test(d.name))) {
  const p = city.plots.find(p => p.id === district.plotIds[0]);
  svg.push(`<text x="${px(p.x - p.width / 2)}" y="${py(p.z + p.depth / 2) - 8}" fill="#f3f3d7" font-size="13" font-weight="700" stroke="#254435" stroke-width="3" paint-order="stroke">${district.name}</text>`);
}
svg.push(`<text x="50" y="1110" fill="#c2f2d7" font-size="15">원자력 1 · 태양광 19 · 풍력 9 · ESS 16 · 공장 6 · 전력 공급 83 / 83</text><text x="50" y="1140" fill="#96b3aa" font-size="13">배치 안내용 평면도 · 실제 3D 화면은 도시 파일을 불러와 확인하세요.</text></g></svg>`);
fs.writeFileSync(path.join(directory, 'city-layout.svg'), svg.join(''));
console.log(JSON.stringify(report, null, 2));

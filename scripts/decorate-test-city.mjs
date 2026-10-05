import fs from 'node:fs';
import path from 'node:path';
import { assetById } from '../src/features/city/presets/catalog.js';
import { validateCity } from '../src/features/city/core/cityValidation.js';
import { terrainHeight, levelPlot } from '../src/features/city/terrain/terrainModel.js';
import { mapDimensions } from '../src/features/city/core/mapDimensions.js';
import { footprint, containingPlot } from '../src/features/city/placement/footprint.js';
import { plotProblem, plotHasRoadAccess } from '../src/features/city/plots/plotModel.js';
import { placementProblem } from '../src/features/city/placement/placementRules.js';
import { roadProblem, closestRoadPoint } from '../src/features/city/roads/roadModel.js';
import { roadTerrainWarning } from '../src/features/city/roads/roadGeometry.js';
import { waterRegions } from '../src/features/city/water/waterModel.js';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/decorate-test-city.mjs input.city.json [output-directory]');
const original = validateCity(JSON.parse(fs.readFileSync(source, 'utf8')));
const city = structuredClone(original);
const directory = process.argv[3] || 'artifacts/decorated-city';
const { half, resolution } = mapDimensions(city), rowSize = resolution + 1;
const height = (x, z) => terrainHeight(city.heights, x, z);
let serial = 0, randomSeed = 1927;
const uid = label => `decor-${label}-${++serial}`;
const random = () => { randomSeed = randomSeed * 16807 % 2147483647; return randomSeed / 2147483647; };
const roadDistance = (road, x, z) => { const p = closestRoadPoint(road, { x, z }); return Math.hypot(p.x - x, p.z - z); };
const roadWidth = road => road.type === 'avenue' ? 7 : road.type === 'street' ? 4 : 2;
const originalProtected = (x, z) => original.plots.some(p => Math.abs(p.x - x) <= p.width / 2 + 4 && Math.abs(p.z - z) <= p.depth / 2 + 4)
  || original.roads.some(road => roadDistance(road, x, z) < roadWidth(road) / 2 + 4);

// Remove brush-sized bumps without changing existing developed sites or road approaches.
for (let pass = 0; pass < 4; pass++) {
  const sourceHeights = city.heights.slice();
  for (let r = 1; r < resolution; r++) for (let c = 1; c < resolution; c++) {
    const x = c * 2 - half, z = half - r * 2, i = r * rowSize + c;
    if (originalProtected(x, z)) continue;
    const average = (sourceHeights[i - 1] + sourceHeights[i + 1] + sourceHeights[i - rowSize] + sourceHeights[i + rowSize]) / 4;
    city.heights[i] = sourceHeights[i] * .45 + average * .55;
  }
}

// Stabilize the narrow bridge landings so access roads meet dry, gently raised banks.
for (const bridge of original.roads.filter(r => r.bridge)) for (const end of [bridge.a, bridge.b]) {
  for (let r = 0; r <= resolution; r++) for (let c = 0; c <= resolution; c++) {
    const distance = Math.hypot(c * 2 - half - end.x, half - r * 2 - end.z);
    if (distance >= 12) continue;
    const weight = Math.min(1, (12 - distance) / 6), i = r * rowSize + c;
    city.heights[i] += Math.max(0, 1.5 - city.heights[i]) * weight;
  }
}

const addedRoads = [], addedPlots = [], addedObjects = [];
function road(label, a, b, type = 'street') {
  const record = { id: uid(label), type, a: { x: a[0], z: a[1] }, b: { x: b[0], z: b[1] } };
  const problem = roadProblem(city, record);
  if (problem) throw new Error(`${label}: ${problem}`);
  const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (let step = 0; step <= Math.ceil(length); step++) {
    const t = step / Math.ceil(length), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    if (height(x, z) < .4) throw new Error(`${label}: water at ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
  city.roads.push(record); addedRoads.push(record); return record;
}

road('west-spine', [-136, 108], [-136, -132]);
road('west-gateway', [-136, 108], [-120, 108], 'avenue');
for (const z of [72, 26, -26, -58]) road('west-neighborhood', [-136, z], [z === -26 ? -106 : -94, z]);
road('arch-west-approach', [-106, -26], [-98, -20]);
road('arch-east-approach', [-36, -28], [-28, -28]);
road('riverfront-access', [-28, -28], [-28, -4]);
road('riverfront-link', [-28, -4], [-20, -4]);
road('south-west-link', [-136, -132], [-76, -132]);
road('small-bridge-west', [-76, -132], [-76, -112]);
road('small-bridge-east', [-10, -112], [8, -112]);
road('south-entry', [8, -112], [8, -64]);
road('relay-yard-access', [8, -88], [-12, -88]);
road('relay-yard-drive', [-12, -88], [-12, -68]);
road('north-entry', [44, 84], [44, 96], 'avenue');
road('north-bridge-entry', [28, 108], [28, 96], 'avenue');
road('north-boulevard', [28, 96], [124, 96], 'avenue');
road('east-boulevard', [84, -4], [84, 140]);
road('east-center-link', [44, -4], [84, -4]);
road('east-local-link', [76, 42], [84, 42]);
road('north-loop', [44, 140], [124, 140]);
road('north-west-loop', [44, 140], [44, 96]);
road('north-east-loop', [124, 140], [124, 96]);
road('west-promenade', [-74, 54], [-94, 54], 'path');
road('promenade-access', [-94, 54], [-94, 72], 'path');

const groups = new Map();
function plot(label, x, z, width, depth, surface, group) {
  const record = { id: uid(label), x, z, width, depth, surface };
  const problem = plotProblem(city, record);
  if (problem) throw new Error(`${label}: ${problem}`);
  // New developed terraces meet the street elevation; hills remain beyond the urban edge.
  const centerR = Math.floor((half - z) / 2), centerC = Math.floor((x + half) / 2);
  for (const r of [centerR, centerR + 1]) for (const c of [centerC, centerC + 1]) city.heights[r * rowSize + c] = 1.5;
  levelPlot(city, record); city.plots.push(record); addedPlots.push(record);
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(record.id); return record;
}
function object(asset, x, z, rotation = 0) {
  if (placementProblem(city, asset, x, z, rotation)) return false;
  const record = { id: uid(asset), asset, x, z, rotation };
  city.objects.push(record); addedObjects.push(record); return true;
}
function garden(plot, spacing = 7) {
  for (let x = plot.x - plot.width / 2 + 3; x <= plot.x + plot.width / 2 - 3; x += spacing)
    for (const z of [plot.z - plot.depth / 2 + 3, plot.z + plot.depth / 2 - 3]) object('tree', x, z);
  for (let z = plot.z - plot.depth / 2 + 8; z < plot.z + plot.depth / 2 - 5; z += spacing)
    for (const x of [plot.x - plot.width / 2 + 3, plot.x + plot.width / 2 - 3]) object('tree', x, z);
}

// Materials distinguish housing gardens, civic squares and utility yards.
for (const p of city.plots) {
  if (p.x === 26 && p.z === 20) p.surface = 'grass';
  if (p.surface === 'asphalt' && p.width > 8) p.surface = 'concrete';
}
for (const p of original.plots) {
  if (p.x === 26 && p.z === 20) { object('playground', 26, 3); object('distribution', 37, 36); }
  if (p.x === 62 && p.z === 64) { object('office', 54, 52); object('shop', 66, 65); object('tree', 50, 68); }
  if (p.x === 30 && p.z === 64) { object('office', 27, 68); object('shop', 27, 52); object('tree', 36, 67); }
  if (p.x === -6 && p.z === 20) { object('park', -5, 23); object('distribution', -11, 35); }
  if (p.x === 26 && p.z === -32) { object('park', 29, -24); object('pump-station', 34, -38); }
  if (p.x === -6 && p.z === -32) { object('shop', -2, -41); object('cafe', -2, -24); }
}

const westNorth = plot('west-village-north', -114, 86, 32, 20, 'grass', '서안 주거마을');
for (const x of [-123, -113, -103]) object('house', x, 85, Math.PI);
garden(westNorth);
const westHomes = plot('west-garden-homes', -114, 50, 32, 32, 'grass', '서안 주거마을');
for (const x of [-124, -114, -104]) for (const z of [41, 52, 60]) object('house', x, z, Math.PI / 2);
garden(westHomes);
const westApartments = plot('west-apartments', -114, 2, 32, 36, 'grass', '서안 주거마을');
for (const x of [-123, -106]) for (const z of [-8, 9]) object('apartment', x, z, Math.PI / 2);
object('playground', -115, 1); garden(westApartments);
const civic = plot('west-civic-square', -114, -42, 32, 20, 'concrete', '서안 생활중심');
object('school', -119, -40); object('fire-station', -105, -40, Math.PI / 2); garden(civic);
const greenBelt = plot('west-linear-park', -156, 12, 28, 68, 'grass', '강변 녹지');
for (const z of [-8, 12, 32]) object('park', -156, z);
object('playground', -157, 1); garden(greenBelt);
const westServices = plot('west-commercial', -154, 68, 24, 24, 'concrete', '서안 생활중심');
object('shop', -158, 72); object('cafe', -148, 72); object('hospital', -155, 61); garden(westServices);
const power = plot('power-yard', -154, -88, 24, 56, 'concrete', '에너지·수도 지구');
object('power-plant', -154, -70); object('ess', -154, -84); object('substation', -154, -100); garden(power);
const water = plot('water-campus', -112, -148, 36, 24, 'concrete', '에너지·수도 지구');
object('water-treatment', -122, -148); object('reservoir', -108, -149); object('pump-station', -96, -148); garden(water);
const waterSouth = plot('wastewater-campus', -154, -148, 24, 24, 'concrete', '에너지·수도 지구');
object('wastewater', -155, -148); object('water-tower', -147, -140); garden(waterSouth);

const northBusiness = plot('north-business', 62, 116, 32, 32, 'concrete', '북부 상업중심');
object('office', 54, 124); object('office', 69, 124); object('hotel', 54, 110); object('cafe', 69, 109); garden(northBusiness);
const northHomes = plot('north-residences', 104, 116, 32, 32, 'grass', '북부 주거지');
object('tower', 96, 124); object('tower', 111, 124); object('apartment', 96, 109); object('apartment', 111, 109); garden(northHomes);
const hillside = plot('east-garden-residences', 104, 64, 28, 40, 'grass', '북부 주거지');
for (const x of [97, 109]) for (const z of [52, 64, 76]) object('townhouses', x, z);
garden(hillside);

// Cut gentle road benches through brush bumps and terrace edges. Preserve plot interiors.
for (let r = 0; r <= resolution; r++) for (let c = 0; c <= resolution; c++) {
  const x = c * 2 - half, z = half - r * 2, i = r * rowSize + c;
  if (city.plots.some(p => Math.abs(x - p.x) <= p.width / 2 + 1 && Math.abs(z - p.z) <= p.depth / 2 + 1)) continue;
  let influence = 0;
  for (const record of addedRoads) {
    const distance = roadDistance(record, x, z), width = roadWidth(record) / 2 + 9;
    influence = Math.max(influence, Math.min(1, Math.max(0, (width + 7 - distance) / 7)));
  }
  city.heights[i] += (1.5 - city.heights[i]) * influence;
}

// Plant sparse natural belts off developed plots, reserving clear road verges.
function naturalTree(x, z, asset = 'tree') {
  if (height(x, z) < .8 || city.plots.some(p => Math.abs(x - p.x) < p.width / 2 + 3 && Math.abs(z - p.z) < p.depth / 2 + 3)) return false;
  if (city.roads.some(r => roadDistance(r, x, z) < roadWidth(r) / 2 + 3)) return false;
  if (city.objects.some(o => { const size = footprint(o.asset, o.rotation); return Math.abs(x - o.x) < size.width / 2 + 2 && Math.abs(z - o.z) < size.depth / 2 + 2; })) return false;
  const record = { id: uid(asset), asset, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, rotation: random() * Math.PI * 2 };
  city.objects.push(record); addedObjects.push(record); return true;
}
for (let i = 0; i < 500; i++) {
  const x = 85 + random() * 64, z = -173 + random() * 197;
  if (height(x, z) < 3) continue;
  naturalTree(x, z, random() > .3 ? 'pine' : 'tree');
}
for (let i = 0; i < 170; i++) naturalTree(-96 + random() * 76, -135 + random() * 279);
for (let i = 0; i < 90; i++) naturalTree(-174 + random() * 24, -124 + random() * 258, random() > .55 ? 'pine' : 'tree');

// Blend terrain colors at the shoreline and use subdued forest colors on hills.
city.terrainPaint ||= Array(city.heights.length).fill(null);
for (let r = 0; r <= resolution; r++) for (let c = 0; c <= resolution; c++) {
  const x = c * 2 - half, z = half - r * 2, i = r * rowSize + c, h = city.heights[i];
  if (city.plots.some(p => Math.abs(x - p.x) <= p.width / 2 + 1 && Math.abs(z - p.z) <= p.depth / 2 + 1)) continue;
  if (x < -178 || x > 160 || z < -184 || z > 150) continue;
  const variation = Math.sin(x * .073) * Math.cos(z * .091) * 3;
  const color = h < .55 ? [169, 166, 121] : h > 19 ? [113, 134, 97] : h > 7 ? [91, 129, 77] : [105, 146, 82];
  city.terrainPaint[i] = `#${color.map(channel => Math.round(channel + variation).toString(16).padStart(2, '0')).join('')}`;
}
city.name = '리버가든 시티';
city.lifeSettings = { enabled: true, cars: true, people: true };
city.waterSettings = { ...city.waterSettings, color: '#387f8d', opacity: .88, flowing: true };
city.districts ||= [];
const existingAssigned = new Set(city.districts.flatMap(d => d.plotIds));
groups.set('기존 도심·행정', original.plots.filter(p => p.x > -60 && !existingAssigned.has(p.id)).map(p => p.id));
groups.set('기존 재생에너지', original.plots.filter(p => p.x < -60 && !existingAssigned.has(p.id)).map(p => p.id));
const colors = ['#83bd96', '#d9bd81', '#8eae73', '#85b5ca', '#7cc4b1', '#a6b4dd', '#c2b990', '#dfc482'];
for (const [name, plotIds] of groups) if (plotIds.length) city.districts.push({ id: uid('district'), name, color: colors[city.districts.length % colors.length], plotIds });
city.cameraViews ||= [];
city.cameraViews.push(
  { id: uid('view'), name: '강과 도시 전경', alpha: -1.08, beta: .72, radius: 350, target: { x: -26, y: 0, z: 2 } },
  { id: uid('view'), name: '북부 중심가', alpha: -1.12, beta: .82, radius: 150, target: { x: 77, y: 0, z: 102 } },
  { id: uid('view'), name: '서안 주거와 녹지', alpha: -.82, beta: .76, radius: 185, target: { x: -129, y: 0, z: 24 } },
);
validateCity(city);
for (const record of addedRoads) { const problem = roadProblem(city, record); if (problem) throw new Error(`Final road ${record.id}: ${problem}`); }
for (const record of addedObjects.filter(o => !['tree', 'pine'].includes(o.asset))) {
  if (!containingPlot(city, record.asset, record.x, record.z, record.rotation)) throw new Error(`Outside plot: ${record.id}`);
  const problem = placementProblem(city, record.asset, record.x, record.z, record.rotation, record.id);
  if (problem) throw new Error(`Final object ${record.id}: ${problem}`);
}
for (const record of original.objects) if (JSON.stringify(city.objects.find(o => o.id === record.id)) !== JSON.stringify(record)) throw new Error('An original facility was changed.');
const report = { name: city.name, addedFacilities: addedObjects.filter(o => !['tree', 'pine'].includes(o.asset)).length, addedTrees: addedObjects.filter(o => ['tree', 'pine'].includes(o.asset)).length,
  addedRoads: addedRoads.length, addedPlots: addedPlots.length, districts: city.districts.length,
  original: { objects: original.objects.length, roads: original.roads.length, plots: original.plots.length },
  total: { objects: city.objects.length, roads: city.roads.length, plots: city.plots.length },
  unconnectedNewPlots: addedPlots.filter(p => !plotHasRoadAccess(city, p)).map(p => p.id),
  slopeWarnings: addedRoads.map(r => ({ id: r.id, warning: roadTerrainWarning(city, r) })).filter(r => r.warning),
  waterRegions: waterRegions(city).length,
};
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'TEST_1_decorated.city.json'), JSON.stringify(city, null, 2));
fs.writeFileSync(path.join(directory, 'decoration-report.json'), JSON.stringify(report, null, 2));

const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function mapSvg(model, title) {
  const scale = 2.7, x = value => 38 + (value + 186) * scale, y = value => 94 + (158 - value) * scale;
  const pieces = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1060 1150" role="img" aria-label="${escapeXml(title)} 도시 배치도"><rect width="1060" height="1150" fill="#132b25"/><style>text{font-family:'Malgun Gothic',sans-serif}</style><text x="38" y="42" fill="#e5f0e7" font-size="25" font-weight="bold">${escapeXml(title)}</text><text x="38" y="68" fill="#a6c7b3" font-size="12">480 × 480 m · 북쪽 ↑ · 강변 주거 / 생활 중심 / 녹지 / 에너지·수도</text>`];
  pieces.push(`<rect x="38" y="94" width="972" height="940" fill="#6a9055"/>`);
  for (let z = -188; z < 158; z += 4) for (let worldX = -186; worldX < 174; worldX += 4) {
    const h = terrainHeight(model.heights, worldX, z);
    const color = h < -.1 ? '#397b86' : h < .55 ? '#a9a679' : h > 19 ? '#718661' : h > 7 ? '#5b814d' : '#699252';
    pieces.push(`<rect x="${x(worldX)}" y="${y(z + 4)}" width="10.9" height="10.9" fill="${color}"/>`);
  }
  for (const p of model.plots) pieces.push(`<rect x="${x(p.x - p.width / 2)}" y="${y(p.z + p.depth / 2)}" width="${p.width * scale}" height="${p.depth * scale}" rx="2" fill="${p.surface === 'grass' ? '#7faa67' : p.surface === 'asphalt' ? '#798586' : '#bac5b7'}" stroke="#e1e4bc" stroke-width="1"/>`);
  for (const r of model.roads) {
    const shape = `<path d="M${x(r.a.x)} ${y(r.a.z)}L${x(r.b.x)} ${y(r.b.z)}"`;
    pieces.push(`${shape} fill="none" stroke="${r.bridge ? '#e4ca83' : '#d1d9c9'}" stroke-width="${(roadWidth(r) + .8) * scale}" stroke-linecap="round"/>`);
    pieces.push(`${shape} fill="none" stroke="${r.type === 'path' ? '#b4a78d' : '#65767b'}" stroke-width="${roadWidth(r) * scale}" stroke-linecap="round"/>`);
    if (r.type !== 'path') pieces.push(`${shape} fill="none" stroke="${r.type === 'avenue' ? '#e2d2a2' : '#d6e0d7'}" stroke-width="1" stroke-dasharray="5 5"/>`);
  }
  const colors = { residential: '#e5ddd0', commercial: '#9fbfc5', landmark: '#dbcfaa', power: '#d6b67e', water: '#9bd4db', nature: '#59865b' };
  for (const o of model.objects) {
    if (['tree', 'pine'].includes(o.asset)) {
      pieces.push(`<circle cx="${x(o.x) + 1.5}" cy="${y(o.z) + 2}" r="${o.asset === 'pine' ? 3.5 : 4}" fill="#345640" opacity=".35"/><circle cx="${x(o.x)}" cy="${y(o.z)}" r="${o.asset === 'pine' ? 3.5 : 4}" fill="${o.asset === 'pine' ? '#3c7055' : '#558a55'}"/>`);
      continue;
    }
    const size = footprint(o.asset, o.rotation), category = assetById[o.asset].category;
    const px = x(o.x - size.width / 2), py = y(o.z + size.depth / 2);
    pieces.push(`<rect x="${px + 2}" y="${py + 3}" width="${size.width * scale}" height="${size.depth * scale}" rx="1" fill="#183a30" opacity=".3"/><rect x="${px}" y="${py}" width="${size.width * scale}" height="${size.depth * scale}" rx="1" fill="${colors[category]}" stroke="#526e60" stroke-width=".8"/><title>${escapeXml(assetById[o.asset].name)}</title>`);
    if (assetById[o.asset].height > 10) pieces.push(`<path d="M${px + 3} ${py + 3}h${Math.max(2, size.width * scale - 6)}" stroke="#e9f4ec" stroke-width="2"/>`);
  }
  const labels = [['서안 주거마을', -124, 102], ['수변 녹지', -173, 53], ['생활 중심', -125, -22], ['에너지 지구', -175, -125], ['상수도·처리 시설', -140, -174], ['북부 중심가', 42, 149], ['기존 도심', 8, 89], ['언덕 숲', 108, -29]];
  for (const [label, px, pz] of labels) pieces.push(`<text x="${x(px)}" y="${y(pz)}" fill="#f0f5d9" font-size="12" font-weight="bold" stroke="#2b4d3c" stroke-width="3" paint-order="stroke">${label}</text>`);
  pieces.push(`<text x="38" y="1070" fill="#bfd5c5" font-size="12">주거: 크림색 · 상업: 청회색 · 공공시설: 베이지 · 전력: 황토색 · 수도: 청록색</text><text x="38" y="1095" fill="#bfd5c5" font-size="12">건물·조경 ${model.objects.length}개 · 도로·교량 ${model.roads.length}구간 · 부지 ${model.plots.length}곳</text><text x="38" y="1122" fill="#829f8e" font-size="11">배치 확인용 평면도입니다. 실제 3D 외형은 도시 파일을 불러와 확인하세요.</text></svg>`);
  return pieces.join('');
}
fs.writeFileSync(path.join(directory, 'city-layout.svg'), mapSvg(city, city.name));
const before = mapSvg(original, '꾸미기 전'), after = mapSvg(city, city.name);
fs.writeFileSync(path.join(directory, 'preview.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>리버가든 시티 · 전후 비교</title><style>body{margin:0;background:#10221d;color:#e6efe8;font-family:system-ui}nav{position:sticky;top:0;padding:12px;background:#19352dee;display:flex;gap:10px;align-items:center;flex-wrap:wrap}button,a{padding:9px 15px;border:1px solid #759c82;border-radius:6px;background:#2a4d3c;color:inherit;text-decoration:none;cursor:pointer}button[aria-pressed=true]{background:#8cbe9b;color:#10221d}main{max-width:1000px;margin:auto}svg{display:block;width:100%;height:auto}</style><nav><b>도시 꾸미기 · 전후 비교</b><button aria-pressed="false" onclick="show(false)">원본</button><button aria-pressed="true" onclick="show(true)">꾸민 도시</button><a href="TEST_1_decorated.city.json" download>도시 파일 다운로드</a></nav><main><div id="before" hidden>${before}</div><div id="after">${after}</div></main><script>function show(after){document.getElementById('before').hidden=after;document.getElementById('after').hidden=!after;document.querySelectorAll('button').forEach((button,index)=>button.setAttribute('aria-pressed',String(index===(after?1:0))))}</script></html>`);
console.log(JSON.stringify(report, null, 2));

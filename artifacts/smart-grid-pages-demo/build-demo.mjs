import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCity } from '../../src/features/city/core/cityState.js';
import { validateCity } from '../../src/features/city/core/cityValidation.js';
import { assetById } from '../../src/features/city/presets/catalog.js';
import { DEFAULT_CONNECTION as CONNECTION } from '../../src/features/city/connections/connectionModel.js';
import { objectBaseHeight } from '../../src/features/city/plots/plotModel.js';
import { levelPlot, terrainHeight } from '../../src/features/city/terrain/terrainModel.js';
import { footprint } from '../../src/features/city/placement/footprint.js';
import { portalAnchor, portalPosition } from '../../src/features/city/pages/portalModel.js';
import { validateSceneProject } from '../../src/features/city/pages/projectModel.js';
import { calculateUtilityService } from '../../src/features/city/simulation/utilityService.js';

const output = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Pass the main city JSON path.');
const originalBytes = fs.readFileSync(sourcePath);
const main = validateCity(JSON.parse(originalBytes.toString('utf8')));
const sourceHash = createHash('sha256').update(originalBytes).digest('hex');
const pageIds = ['demo-main', 'demo-renewables', 'demo-control', 'demo-water'];
const cameras = [main.cameraViews[0], { alpha: -1.05, beta: .82, radius: 245, target: { x: -8, y: 3, z: 0 } }, { alpha: -1.05, beta: .84, radius: 245, target: { x: 0, y: 4, z: 0 } }, { alpha: -1.1, beta: .8, radius: 250, target: { x: 5, y: 2, z: 0 } }];

function campus(name, hour) {
  const city = createCity('blank', 240);
  city.name = name; city.connections = []; city.districts = [];
  city.environment = { hour, autoCycle: false, cycleMinutes: 10 };
  city.lifeSettings = { enabled: true, cars: true, people: true, birds: true, garden: true, steam: true };
  city.powerSupplyMode = 'network'; city.waterSupplyMode = 'network';
  return city;
}
function road(city, x1, z1, x2, z2, type = 'street', bridge) {
  city.roads.push({ id: `road-${city.roads.length}`, type, a: { x: x1, z: z1 }, b: { x: x2, z: z2 }, ...(bridge ? { bridge } : {}) });
}
function plot(city, key, x, z, width, depth, surface, color) {
  const p = { id: `plot-${key}`, x, z, width, depth, surface }; city.plots.push(p); levelPlot(city, p);
  city.districts.push({ id: `district-${key}`, name: key, color, plotIds: [p.id] });
}
function add(city, asset, x, z, name, properties = {}, rotation = 0) {
  assert.ok(assetById[asset], asset);
  const o = { id: `facility-${city.objects.length}`, asset, x, z, rotation, ...(name ? { properties: { name, status: 'running', ...properties } } : {}) };
  city.objects.push(o); return o;
}
function link(city, from, to, type = 'power', effect = 'arrows', waypoints) {
  city.connections.push({ ...CONNECTION, id: `flow-${city.connections.length}`, from: from.id, to: to.id, type, color: type === 'power' ? '#f4c95d' : type === 'water' ? '#46c9ff' : '#ab8cce', radius: .26, clearance: 1.8, speed: 3, effect, route: 'elbow', name: `${from.properties?.name || assetById[from.asset].name} → ${to.properties?.name || assetById[to.asset].name}`, ...(waypoints ? { waypoints } : {}) });
}
function frame(city) {
  road(city, -84, -80, 84, -80); road(city, -84, 80, 84, 80);
  road(city, -84, -80, -84, 80); road(city, 84, -80, 84, 80);
  road(city, -84, 0, 84, 0, 'avenue'); road(city, 0, -80, 0, 80, 'avenue');
  for (const x of [-44, 44]) { road(city, x, 0, x, 16); road(city, x, 0, x, -16); }
  for (const x of [-76, -52, -28, 28, 52, 76]) { add(city, 'street-lamp', x, -5); add(city, 'street-lamp', x, 5); }
  for (const z of [-68, -44, -20, 20, 44, 68]) { add(city, 'street-lamp', -5, z); add(city, 'street-lamp', 5, z); }
}
function landscaping(city) {
  for (let x = -100; x <= 100; x += 16) for (const z of [-96, 96]) if (terrainHeight(city.heights, x, z) > .5) add(city, x < 0 ? 'pine' : 'tree', x, z);
  for (let z = -76; z <= 76; z += 19) for (const x of [-100, 100]) if (terrainHeight(city.heights, x, z) > .5) add(city, 'tree', x, z);
}
function utilities(city, powerHub, treatment, reservoir, consumers) {
  link(city, treatment, reservoir, 'water', 'dots');
  for (const consumer of consumers) { if (consumer !== powerHub) link(city, powerHub, consumer, 'power', 'bands'); if (consumer !== treatment && consumer !== reservoir) link(city, reservoir, consumer, 'water', 'dots'); }
  link(city, powerHub, treatment); link(city, powerHub, reservoir);
}

// 01: western wind plateau, eastern solar arrays, storage and an EV visitor court.
const renewables = campus('바람과 햇빛 · 재생에너지 캠퍼스', 16.5);
for (let row = 0; row <= 120; row++) for (let col = 0; col <= 120; col++) {
  const x = col * 2 - 120, z = 120 - row * 2;
  renewables.heights[row * 121 + col] = 1.5 + (x < -86 ? 7 * Math.exp(-((x + 105) ** 2 + (z - 44) ** 2) / 1900) : 0) - 7 / (1 + Math.exp(-(x - 110) / 3));
}
plot(renewables, '풍력 발전 구역', -44, 46, 72, 60, 'grass', '#a7bf76');
plot(renewables, '태양광 발전 구역', 44, 46, 72, 60, 'concrete', '#e6c77e');
plot(renewables, '저장·운영 구역', -44, -46, 72, 60, 'concrete', '#77b7d6');
plot(renewables, '전기차·방문 구역', 44, -46, 72, 60, 'asphalt', '#83bd96'); frame(renewables);
const winds = [], solar = [];
for (const x of [-68, -44, -20]) for (const z of [34, 60]) winds.push(add(renewables, 'wind-turbine', x, z, `풍력 발전기 ${winds.length + 1}`, { generationKW: 150, capacityKW: 180 }));
for (const x of [22, 44, 66]) for (const z of [30, 48, 66]) solar.push(add(renewables, 'solar-farm', x, z, `태양광 어레이 ${solar.length + 1}`, { generationKW: 65, capacityKW: 80 }));
const renewableHub = add(renewables, 'substation', -20, -52, '재생에너지 통합 변전소', { capacityKW: 2000 });
for (const x of [-66, -50, -34]) { const ess = add(renewables, 'ess', x, -28, '캠퍼스 ESS', { capacityKW: 200, storageKWh: 800, chargePercent: 75 }); link(renewables, renewableHub, ess, 'power', 'pulse'); }
const visitor = add(renewables, 'hall', 24, -58, '재생에너지 방문센터', { demandKW: 40 });
const cafe = add(renewables, 'cafe', 45, -58, '솔라 테라스 카페', { demandKW: 12 });
const office = add(renewables, 'office', -64, -58, '에너지 운영센터', { demandKW: 55 });
const carport = add(renewables, 'solar-carport', 66, -58, '태양광 방문객 주차장', { generationKW: 40, capacityKW: 50 });
const chargers = [add(renewables, 'fast-charger', 26, -30, '급속 충전소 A', { demandKW: 100 }), add(renewables, 'fast-charger', 46, -30, '급속 충전소 B', { demandKW: 100 })];
add(renewables, 'park', 67, -28, '충전 대기 정원');
const rt = add(renewables, 'water-treatment', -44, -58, '캠퍼스 소형 정수장', { flowM3h: 120, capacityM3h: 150, demandKW: 20 });
const rr = add(renewables, 'reservoir', -20, -70, '캠퍼스 배수지', { flowM3h: 100, capacityM3h: 150, demandKW: 5 });
for (const generator of [...winds, ...solar, carport]) link(renewables, generator, renewableHub);
utilities(renewables, renewableHub, rt, rr, [visitor, cafe, office, ...chargers]); landscaping(renewables);

// 02: a landmark power station and a compact control/switching campus at dusk.
const control = campus('안정적인 전력 · 발전·관제 단지', 18.5);
plot(control, '기저전원 발전 구역', -44, 46, 72, 60, 'concrete', '#e6c77e');
plot(control, '변전·저장 구역', 44, 46, 72, 60, 'asphalt', '#77b7d6');
plot(control, '운영·안전 구역', -44, -46, 72, 60, 'concrete', '#c5acd7');
plot(control, '산업 전력 수요 구역', 44, -46, 72, 60, 'asphalt', '#a4b6ba'); frame(control);
const nuclear = add(control, 'nuclear-plant', -49, 51, '기저전원 원자력 발전소', { generationKW: 2500, capacityKW: 3000, notes: '데모용 입력 수치입니다. 실제 발전소 성능을 나타내지 않습니다.' });
const backup = add(control, 'power-plant', -22, 28, '비상 예비 발전소', { generationKW: 450, capacityKW: 600 });
const centralHub = add(control, 'substation', 24, 30, '중앙 변전소', { capacityKW: 3200 });
const tower1 = add(control, 'transmission-tower', 22, 62, '송전 철탑 1', { capacityKW: 3200 });
const tower2 = add(control, 'transmission-tower', 66, 62, '송전 철탑 2', { capacityKW: 3200 });
link(control, nuclear, centralHub, 'power', 'arrows', [{ x: -18, z: 8 }, { x: 24, z: 8 }]); link(control, backup, centralHub); link(control, centralHub, tower1); link(control, tower1, tower2);
for (const x of [46, 66]) { const ess = add(control, 'ess', x, 30, '피크 대응 ESS', { storageKWh: 1800, chargePercent: 82, capacityKW: 500 }); link(control, centralHub, ess, 'power', 'pulse'); }
const ops = add(control, 'office', -62, -36, '전력 계통 관제센터', { demandKW: 80 });
const safety = add(control, 'fire-station', -40, -36, '발전단지 소방서', { demandKW: 25 });
const publicHall = add(control, 'hall', -64, -60, '에너지 홍보관', { demandKW: 25 });
add(control, 'park', -42, -60, '관제센터 휴게정원');
const factory1 = add(control, 'smart-factory', 28, -34, '스마트 제조동 A', { demandKW: 300 });
const factory2 = add(control, 'smart-factory', 60, -34, '스마트 제조동 B', { demandKW: 300 });
const charge = add(control, 'fast-charger', 26, -62, '산업단지 급속 충전소', { demandKW: 100 });
const ct = add(control, 'water-treatment', -20, -58, '운영단지 정수장', { demandKW: 20, flowM3h: 200, capacityM3h: 250 });
const cr = add(control, 'reservoir', 62, -64, '산업 급수 배수지', { demandKW: 5, flowM3h: 180, capacityM3h: 220 });
utilities(control, centralHub, ct, cr, [ops, safety, publicHall, factory1, factory2, charge]); landscaping(control);

// 03: river channel, pedestrian bridge, clean-water campus and separated wastewater site.
const water = campus('도시의 물길 · 강변 물순환 센터', 10.5);
for (let row = 0; row <= 120; row++) for (let col = 0; col <= 120; col++) {
  const x = col * 2 - 120, z = 120 - row * 2, riverX = 6 * Math.sin(z / 45);
  water.heights[row * 121 + col] = 1.5 - 7 * Math.exp(-(((x - riverX) / 12) ** 4));
}
water.waterSettings = { enabled: true, flowing: true, color: '#58bfc7', opacity: .85 };
plot(water, '취수·정수 구역', -58, 46, 64, 60, 'concrete', '#83c9d5');
plot(water, '배수·공급 구역', 58, 46, 64, 60, 'concrete', '#77b7d6');
plot(water, '하수처리 구역', -58, -46, 64, 60, 'asphalt', '#a4b6ba');
plot(water, '물문화·생태 구역', 58, -46, 64, 60, 'grass', '#a7bf76');
for (const x of [-94, 94]) road(water, x, -82, x, 82);
for (const z of [-82, 82]) { road(water, -94, z, -22, z); road(water, 22, z, 94, z); road(water, -22, z, 22, z, 'street', 'arch'); }
road(water, -94, 0, -22, 0); road(water, 22, 0, 94, 0); road(water, -22, 0, 22, 0, 'path', 'footbridge');
for (const x of [-58, 58]) for (const z of [-16, 16]) road(water, x, 0, x, z);
road(water, -22, -70, -22, 70, 'path'); road(water, 22, -70, 22, 70, 'path');
const intake = add(water, 'intake-station', -34, 58, '강변 원수 취수장', { demandKW: 25, flowM3h: 450, capacityM3h: 500 });
const wt1 = add(water, 'water-treatment', -62, 58, '상수도 정수장 1', { demandKW: 40, flowM3h: 400, capacityM3h: 450 });
const wt2 = add(water, 'water-treatment', -62, 30, '상수도 정수장 2', { demandKW: 40, flowM3h: 300, capacityM3h: 350 });
const pump = add(water, 'pump-station', -34, 30, '송수 가압장', { demandKW: 25, flowM3h: 650, capacityM3h: 700 });
const reservoir1 = add(water, 'reservoir', 42, 56, '생활용수 배수지', { demandKW: 10, flowM3h: 450, capacityM3h: 500 });
const reservoir2 = add(water, 'reservoir', 64, 56, '비상 급수 배수지', { demandKW: 10, flowM3h: 250, capacityM3h: 300 });
const waterTower = add(water, 'water-tower', 78, 28, '강변 급수탑', { demandKW: 10, flowM3h: 400, capacityM3h: 450 });
const waterHub = add(water, 'substation', 42, 28, '물순환 전력 변전소', { capacityKW: 800 });
const waterSolar = add(water, 'solar-farm', 62, 28, '정수장 태양광', { generationKW: 650, capacityKW: 800 });
link(water, waterSolar, waterHub);
link(water, intake, wt1, 'water'); link(water, wt1, pump, 'water'); link(water, wt2, pump, 'water');
link(water, pump, reservoir1, 'water', 'arrows', [{ x: -20, z: 8 }, { x: 20, z: 8 }, { x: 42, z: 8 }]); link(water, reservoir1, reservoir2, 'water', 'dots'); link(water, reservoir1, waterTower, 'water');
const sewage1 = add(water, 'wastewater', -66, -34, '하수처리장 1', { demandKW: 35, flowM3h: 250, capacityM3h: 300 });
const sewage2 = add(water, 'wastewater', -42, -34, '하수처리장 2', { demandKW: 35, flowM3h: 250, capacityM3h: 300 });
const waterOps = add(water, 'office', -68, -62, '수질·환경 운영센터', { demandKW: 35 });
add(water, 'ess', -44, -62, '수처리 비상 ESS', { storageKWh: 450, chargePercent: 90, capacityKW: 200 });
const museum = add(water, 'hall', 42, -34, '물문화 방문센터', { demandKW: 25 });
const waterCafe = add(water, 'cafe', 64, -34, '물길 전망 카페', { demandKW: 15 });
add(water, 'park', 42, -62, '강변 생태정원'); add(water, 'playground', 64, -62, '물문화 어린이 공원');
for (const o of [...water.objects]) if (o.properties?.demandKW !== undefined) link(water, waterHub, o, 'power', 'bands');
for (const o of [museum, waterCafe, waterOps]) link(water, waterTower, o, 'water', 'dots');
link(water, museum, sewage1, 'general', 'wave'); link(water, waterCafe, sewage2, 'general', 'wave');
// General links represent wastewater routing only; they do not count as drinking-water supply.
for (const x of [-22, 22]) for (const z of [-60, -30, 30, 60]) { add(water, 'bench', x + (x < 0 ? -3 : 3), z); add(water, 'street-lamp', x + (x < 0 ? -3 : 3), z + 7); }
landscaping(water);

const cities = [main, renewables, control, water];
const filenames = ['00_Smart_Grid_Main.city.json', '01_Renewable_Energy_Campus.city.json', '02_Power_Control_Campus.city.json', '03_River_Water_Campus.city.json'];
const connected = cities.map(c => structuredClone(c));
function portal(city, object, name, target) {
  city.portals ||= [];
  city.portals.push({ id: `portal-${city.portals.length}`, name, targetPageId: target, ...portalAnchor(city, { x: object.x, y: objectBaseHeight(city, object) + assetById[object.asset].height + .8, z: object.z }, object.id) });
}
const anchors = ['grid-wind-turbine-10', 'grid-nuclear-plant-3', 'decor-water-treatment-165'];
const names = ['재생에너지 캠퍼스로 이동', '발전·관제 단지로 이동', '강변 물순환 센터로 이동'];
for (let i = 0; i < 3; i++) { const o = main.objects.find(o => o.id === anchors[i]); assert.ok(o); portal(connected[0], o, names[i], pageIds[i + 1]); }
for (let i = 1; i <= 3; i++) {
  const city = connected[i], host = [null, visitor, publicHall, museum][i];
  portal(city, host, '메인 스마트그리드 도시로 돌아가기', pageIds[0]);
  const next = i === 3 ? 1 : i + 1;
  const secondHost = [null, office, ops, waterOps][i];
  portal(city, secondHost, `${cities[next].name.split(' · ')[1]} 둘러보기`, pageIds[next]);
}
const project = { version: 1, type: 'lumatrix-pages', name: 'Smart Grid · 연결된 도시 탐험', entryPageId: pageIds[0], activePageId: pageIds[0], pages: connected.map((city, i) => ({ id: pageIds[i], name: city.name, type: '3d', city, camera: { alpha: cameras[i].alpha, beta: cameras[i].beta, radius: cameras[i].radius, target: cameras[i].target } })) };
validateSceneProject(project);
for (const [i, city] of cities.entries()) {
  validateCity(city);
  if (i > 0) {
    const service = calculateUtilityService(city);
    assert.equal(service.totals.power, service.totals.consumers, `${city.name}: power supply`);
    assert.equal(service.totals.water, service.totals.consumers, `${city.name}: water supply`);
    assert.ok(service.powerBalance.complete, `${city.name}: all power parameters are set`);
    assert.equal(service.powerBalance.shortage, 0, `${city.name}: power capacity is sufficient`);
    for (const charger of city.objects.filter(o => o.asset === 'fast-charger')) assert.ok(service.powerNetwork.results.get(charger.id).connected);
    for (let a = 0; a < city.objects.length; a++) for (let b = a + 1; b < city.objects.length; b++) {
      const one = city.objects[a], two = city.objects[b], f = footprint(one.asset, one.rotation), g = footprint(two.asset, two.rotation);
      assert.ok(!(Math.abs(one.x - two.x) < (f.width + g.width) / 2 - .01 && Math.abs(one.z - two.z) < (f.depth + g.depth) / 2 - .01), `${city.name}: overlapping ${one.asset} ${one.id} / ${two.asset} ${two.id}`);
    }
    city.cameraViews = [{ id: 'overview', name: '데모 전체 전경', ...project.pages[i].camera }];
    connected[i].cameraViews = city.cameraViews;
  }
  // Standalone cities intentionally omit external page references for normal city import.
  const standalone = structuredClone(city); delete standalone.portals;
  fs.writeFileSync(path.join(output, filenames[i]), JSON.stringify(standalone, null, 2));
}
assert.equal(createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'), sourceHash);
assert.deepEqual(connected[0].objects, main.objects); assert.deepEqual(connected[0].connections, main.connections); assert.deepEqual(connected[0].heights, main.heights);
validateSceneProject(project);
const projectFilename = 'Smart_Grid_Connected_Demo.project.json';
fs.writeFileSync(path.join(output, projectFilename), JSON.stringify(project, null, 2));
const report = { source: path.basename(sourcePath), sourceSha256: sourceHash, checks: ['All city and project schemas valid', 'Main objects, terrain and connections unchanged', 'No facility footprint overlaps in sub-scenes', 'All public and commercial consumers have power and water paths', 'Charger power paths valid', 'Sub-scene power parameters complete with no shortage', 'All portal targets and building anchors valid', 'Source file unchanged'], project: projectFilename, pages: project.pages.map((p, i) => ({ id: p.id, name: p.name, file: filenames[i], objects: p.city.objects.length, plots: p.city.plots.length, roads: p.city.roads.length, connections: p.city.connections?.length || 0, ...(i ? { supply: calculateUtilityService(p.city).totals } : {}), portals: p.city.portals.map(portal => ({ name: portal.name, targetPageId: portal.targetPageId, position: portalPosition(p.city, portal) })) })) };
fs.writeFileSync(path.join(output, 'validation-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

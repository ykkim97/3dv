import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateCity } from '../src/features/city/core/cityValidation.js';
import { assetById } from '../src/features/city/presets/catalog.js';
import { DEFAULT_CONNECTION, connectionPath } from '../src/features/city/connections/connectionModel.js';

// Conceptual single-line network: no voltage, capacity or load-flow calculations.
const file = process.argv[2] || 'artifacts/smart-grid-demo/Electric_Smart_Grid.city.json';
const city = validateCity(JSON.parse(fs.readFileSync(file, 'utf8')));
const before = JSON.stringify({ ...city, connections: undefined });
const objects = new Map(city.objects.map(o => [o.id, o]));
const byAsset = asset => city.objects.filter(o => o.asset === asset);
const stations = byAsset('substation'), towers = byAsset('transmission-tower');
const batteries = byAsset('ess'), distributors = byAsset('distribution');
const sources = city.objects.filter(o => ['nuclear-plant', 'power-plant', 'solar-farm', 'wind-turbine'].includes(o.asset));
const consumers = city.objects.filter(o => ['residential', 'commercial', 'landmark'].includes(assetById[o.asset].category));
assert.ok(stations.length && distributors.length && sources.length, 'Scene needs generation, substations and distribution nodes.');
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const nearest = (object, candidates) => candidates.reduce((best, candidate) => !best || distance(object, candidate) < distance(object, best) ? candidate : best, null);
const styles = {
  generation: { color: '#f4c95d', radius: 0.45, clearance: 3, speed: 5, route: 'straight', effect: 'pulse' },
  transmission: { color: '#ff9654', radius: 0.65, clearance: 6, speed: 7, route: 'straight', effect: 'arrows' },
  distribution: { color: '#46c9ff', radius: 0.3, clearance: 2.5, speed: 4, route: 'elbow', effect: 'bands' },
  consumption: { color: '#38df87', radius: 0.15, clearance: 1.5, speed: 2, route: 'elbow', effect: 'dots' },
  charging: { color: '#5aaaff', radius: 0.25, clearance: 3, speed: 3, route: 'elbow', effect: 'wave' },
  discharging: { color: '#c28aff', radius: 0.3, clearance: 5, speed: 4, route: 'straight', effect: 'arrows', visible: false },
};
// Re-running replaces only this generated overlay, preserving manually added links.
const links = (city.connections || []).filter(c => !c.id.startsWith('smart-grid-flow-'));
const generated = [];
function connect(from, to, stage, name) {
  assert.ok(from && to && from.id !== to.id);
  const key = createHash('sha256').update(`${stage}:${from.id}:${to.id}`).digest('hex').slice(0, 20);
  const line = { ...DEFAULT_CONNECTION, ...styles[stage], id: `smart-grid-flow-${key}`, type: 'power', from: from.id, to: to.id, name, stage };
  assert.ok(connectionPath(city, line, objects).every(p => Object.values(p).every(Number.isFinite)));
  generated.push(line);
}

// Prim's tree follows the existing tower corridors and ties every substation to
// the backbone; arrows illustrate the main supply scenario from the nuclear bus.
function tree(root, members, stage, name) {
  const reached = [root], remaining = members.filter(o => o.id !== root.id);
  while (remaining.length) {
    let best;
    for (const from of reached) for (const to of remaining) {
      const meters = distance(from, to);
      if (!best || meters < best.meters) best = { from, to, meters };
    }
    connect(best.from, best.to, stage, name);
    reached.push(best.to); remaining.splice(remaining.findIndex(o => o.id === best.to.id), 1);
  }
}
for (const source of sources) connect(source, nearest(source, stations), 'generation', `${assetById[source.asset].name} · 발전 전력 집전`);
const nuclear = byAsset('nuclear-plant')[0] || sources[0];
tree(nearest(nuclear, stations), [...stations, ...towers], 'transmission', '송전 회랑 · 변전소 연계');

// Local radial feeders originate at a substation, with downstream distribution
// nodes connected through short feeder branches rather than long star spokes.
for (const station of stations) {
  const local = distributors.filter(d => nearest(d, stations).id === station.id);
  tree(station, local, 'distribution', '지역 배전 피더');
}
for (const consumer of consumers) connect(nearest(consumer, distributors), consumer, 'consumption', `${assetById[consumer.asset].name} · 수요 공급`);
for (const battery of batteries) {
  const bus = nearest(battery, [...stations, ...distributors]);
  connect(bus, battery, 'charging', 'ESS 충전 · 잉여 발전 흡수');
  connect(battery, bus, 'discharging', 'ESS 방전 · 피크 수요 지원');
}
city.connections = [...links, ...generated];
validateCity(city);
assert.equal(JSON.stringify({ ...city, connections: undefined }), before, 'Only the connections overlay may change.');
assert.equal(new Set(generated.map(c => `${c.stage}:${c.from}:${c.to}`)).size, generated.length);
const incoming = id => generated.filter(c => c.to === id);
assert.ok(sources.every(o => generated.some(c => c.stage === 'generation' && c.from === o.id)));
assert.ok(consumers.every(o => incoming(o.id).some(c => c.stage === 'consumption')));
assert.ok(batteries.every(o => incoming(o.id).some(c => c.stage === 'charging') && generated.some(c => c.from === o.id && c.stage === 'discharging')));
const reached = new Set([nuclear.id]);
let changed;
do {
  changed = false;
  for (const line of generated.filter(c => c.visible)) if (reached.has(line.from) && !reached.has(line.to)) { reached.add(line.to); changed = true; }
} while (changed);
assert.ok([...stations, ...towers, ...distributors, ...batteries, ...consumers].every(o => reached.has(o.id)), 'Every demand/storage/network node needs a visible path from the main supply.');

const report = {
  connections: city.connections.length, generated: generated.length, visible: generated.filter(c => c.visible).length,
  stages: Object.fromEntries(Object.keys(styles).map(stage => [stage, { count: generated.filter(c => c.stage === stage).length, ...styles[stage] }])),
  generators: sources.length, substations: stations.length, transmissionTowers: towers.length,
  distributionNodes: distributors.length, batteries: batteries.length, consumers: consumers.length,
  factoriesConnected: consumers.filter(o => o.asset === 'smart-factory').length,
  checks: { validCityJson: true, existingScenePreserved: true, allConsumersReachable: true, allGeneratorsConnected: true, storageChargeAndDischarge: true },
  scenario: 'Main supply and renewable injection; ESS charging visible, discharge links available but hidden to avoid simultaneous opposite flows.',
  model: 'Conceptual topology only; not a physical power-flow/voltage/capacity simulation.',
};
fs.writeFileSync(file, JSON.stringify(city, null, 2));
fs.writeFileSync(path.join(path.dirname(file), 'power-network-validation.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

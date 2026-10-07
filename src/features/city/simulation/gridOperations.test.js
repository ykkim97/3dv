import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from '../core/cityState.js';
import { validateCity } from '../core/cityValidation.js';
import { DEFAULT_CONNECTION } from '../connections/connectionModel.js';
import { calculateUtilityService } from './utilityService.js';
import { serviceBadgeRecords } from './serviceBadges.js';
import { applyGridFailure, restoreGridFailure, changedGridConsumers } from '../management/gridOperations.js';

const node = (id, asset, properties = {}) => ({ id, asset, x: 0, z: 0, rotation: 0, properties });
const edge = (id, from, to, type = 'power') => ({ ...DEFAULT_CONNECTION, id, from, to, type, direction: 'forward' });
const grid = () => ({ ...createCity('blank'), powerSupplyMode: 'network', objects: [node('plant', 'power-plant', { generationKW: 100 }), node('relay', 'substation', { capacityKW: 80 }), node('a', 'house', { demandKW: 60 }), node('b', 'office', { demandKW: 60 })], connections: [edge('p-r', 'plant', 'relay'), edge('r-a', 'relay', 'a'), edge('r-b', 'relay', 'b')] });

test('relay capacity caps aggregate delivery and conserves generation, demand and deficit', () => {
  const city = grid(), balance = calculateUtilityService(city).powerBalance;
  assert.equal(balance.complete, true);
  assert.equal(balance.generation, 100);
  assert.equal(balance.demand, 120);
  assert.equal(balance.delivered, 80);
  assert.equal(balance.shortage, 40);
  assert.equal(balance.results.get('a').supplied, 60);
  assert.equal(balance.results.get('b').supplied, 20);
  assert.equal(balance.results.get('b').status, 'shortage');
  const badges = serviceBadgeRecords(calculateUtilityService(city), { power: true });
  assert.equal(badges.find(b => b.id === 'b').status, 'shortage');
  city.objects[0].properties.generationKW = 0;
  assert.equal(calculateUtilityService(city).powerBalance.delivered, 0);
  city.objects[0].properties.generationKW = 200;
  city.objects[1].properties.capacityKW = 200;
  assert.equal(calculateUtilityService(city).powerBalance.results.get('b').status, 'normal');
});

test('missing values invalidate only their grid and explicit zero demand stays valid', () => {
  const city = grid();
  delete city.objects[1].properties.capacityKW;
  city.objects.push(node('other-source', 'solar-farm', { generationKW: 50 }), node('other-load', 'house', { demandKW: 10 }));
  city.connections.push(edge('other-line', 'other-source', 'other-load'));
  let balance = calculateUtilityService(city).powerBalance;
  assert.equal(balance.results.get('a').status, 'unset');
  assert.equal(balance.results.get('a').supplied, null);
  assert.equal(balance.results.get('other-load').supplied, 10);
  assert.equal(balance.complete, false);
  assert.deepEqual(balance.missing.get('relay'), ['capacityKW']);
  city.objects[1].properties.capacityKW = 100;
  city.objects[2].properties.demandKW = 0;
  balance = calculateUtilityService(city).powerBalance;
  assert.equal(balance.results.get('a').status, 'normal');
  assert.equal(balance.results.get('a').supplied, 0);
  assert.equal(balance.delivered, 70);
});

test('alternative generators and residual rerouting recover constrained supply', () => {
  const city = grid();
  city.objects[1].properties.capacityKW = 200;
  city.objects.push(node('backup', 'wind-turbine', { generationKW: 50 }));
  city.connections.push(edge('backup-r', 'backup', 'relay'), edge('cycle', 'relay', 'backup'));
  assert.equal(calculateUtilityService(city).powerBalance.delivered, 120);
  city.objects[0].properties.status = 'fault';
  let balance = calculateUtilityService(city).powerBalance;
  assert.equal(balance.delivered, 50);
  assert.equal(balance.shortage, 70);
  city.connections.find(c => c.id === 'backup-r').enabled = false;
  balance = calculateUtilityService(city).powerBalance;
  assert.equal(balance.delivered, 0);
  assert.equal(balance.results.get('a').status, 'disconnected');
});

test('network allocations reroute previous flow when another load needs a constrained branch', () => {
  const city = { ...grid(), objects: [node('s', 'solar-farm', { generationKW: 20 }), node('r1', 'distribution', { capacityKW: 10 }), node('r2', 'distribution', { capacityKW: 10 }), node('a', 'house', { demandKW: 10 }), node('b', 'house', { demandKW: 10 })], connections: [edge('e1', 's', 'r1'), edge('e2', 's', 'r2'), edge('e3', 'r1', 'a'), edge('e4', 'r1', 'b'), edge('e5', 'r2', 'a')] };
  assert.equal(calculateUtilityService(city).powerBalance.delivered, 20);
});

test('water paths respect direction, operation and disabled lines without water quantity simulation', () => {
  const city = { ...createCity('blank'), waterSupplyMode: 'network', objects: [node('source', 'water-treatment'), node('pump', 'pump-station'), node('home', 'house'), node('intake', 'intake-station')], connections: [edge('w1', 'source', 'pump', 'water'), edge('w2', 'pump', 'home', 'water'), edge('intake-home', 'intake', 'home', 'water')] };
  assert.equal(calculateUtilityService(city).totals.water, 1);
  city.connections[0].direction = 'reverse';
  assert.equal(calculateUtilityService(city).totals.water, 0);
  city.connections[0].direction = 'both';
  assert.equal(calculateUtilityService(city).totals.water, 1);
  city.objects[1].properties.status = 'maintenance';
  assert.match(calculateUtilityService(city).waterNetwork.results.get('home').reason, /점검/);
  city.objects[1].properties.status = 'running';
  city.connections[1].enabled = false;
  assert.equal(calculateUtilityService(city).totals.water, 0);
  validateCity(JSON.parse(JSON.stringify(city)));
  assert.throws(() => validateCity({ ...city, waterSupplyMode: 'invalid' }), /수도 공급/);
  assert.throws(() => validateCity({ ...city, connections: city.connections.map(c => ({ ...c, enabled: 'no' })) }), /연결선/);
});

test('failure and restore preserve original statuses, independent edits and saved line state', () => {
  const city = grid(); city.objects[1].properties.status = 'maintenance';
  const failure = applyGridFailure(city, { kind: 'facility', id: 'relay' });
  failure.city.objects[2].properties.name = 'updated';
  const restored = restoreGridFailure(failure.city, failure.restore);
  assert.equal(restored.objects[1].properties.status, 'maintenance');
  assert.equal(restored.objects[2].properties.name, 'updated');
  const original = grid(), before = calculateUtilityService(original);
  const broken = applyGridFailure(original, { kind: 'line', id: 'p-r' });
  assert.deepEqual(changedGridConsumers(before, calculateUtilityService(broken.city)), ['a', 'b']);
  const recovered = restoreGridFailure(broken.city, broken.restore);
  assert.equal(recovered.connections[0].enabled, undefined);
  assert.equal(calculateUtilityService(recovered).powerBalance.delivered, 80);
  assert.equal(original.connections[0].enabled, undefined);
  assert.equal(validateCity(JSON.parse(JSON.stringify(broken.city))).connections[0].enabled, false);
  assert.doesNotThrow(() => restoreGridFailure({ ...broken.city, connections: [] }, broken.restore));
});

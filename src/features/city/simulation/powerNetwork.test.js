import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from '../core/cityState.js';
import { validateCity } from '../core/cityValidation.js';
import { calculateUtilityService } from './utilityService.js';
import { powerPathNames } from './powerNetwork.js';
import { serviceBadgeRecords } from './serviceBadges.js';
import { facilityNumberFields } from '../management/facilityProperties.js';
import { DEFAULT_CONNECTION } from '../connections/connectionModel.js';

const object = (id, asset, status = 'running') => ({ id, asset, x: 0, z: 0, rotation: 0, properties: { status } });
const line = (from, to, direction = 'forward', type = 'power') => ({ id: `${from}-${to}`, from, to, direction, type });
const fixture = () => ({ ...createCity('blank'), powerSupplyMode: 'network', objects: [object('source', 'solar-farm'), object('relay', 'substation'), object('home', 'house')], connections: [line('source', 'relay'), line('relay', 'home')] });

test('solar carport supplies chargers as power-only sinks and survives saved JSON', () => {
  const city = { ...createCity('blank'), powerSupplyMode: 'network', waterSupplyMode: 'network', objects: [object('solar', 'solar-carport'), object('fast', 'fast-charger'), object('slow', 'slow-charger')], connections: [line('solar', 'fast'), line('solar', 'slow')] };
  Object.assign(city.objects[0].properties, { generationKW: 30 });
  Object.assign(city.objects[1].properties, { demandKW: 20 });
  Object.assign(city.objects[2].properties, { demandKW: 7 });
  city.connections = city.connections.map(connection => ({ ...DEFAULT_CONNECTION, ...connection }));
  let service = calculateUtilityService(validateCity(JSON.parse(JSON.stringify(city))));
  assert.equal(service.powerBalance.demand, 27);
  assert.equal(service.powerBalance.delivered, 27);
  assert.equal(service.powerBalance.results.get('fast').status, 'normal');
  assert.equal(service.facilities.get('slow').connected, true);
  assert.equal(service.waterNetwork.nodes.has('fast'), false);
  assert.deepEqual(facilityNumberFields(city.objects[1]), ['demandKW']);
  assert.ok(facilityNumberFields(city.objects[0]).includes('generationKW'));
  assert.equal(serviceBadgeRecords(service, { power: true, water: true }).filter(record => record.id === 'fast').length, 1);
  city.objects[0].properties.generationKW = 10;
  service = calculateUtilityService(city);
  assert.equal(service.powerBalance.shortage, 17);
  city.objects[0].properties.status = 'stopped';
  assert.equal(calculateUtilityService(city).facilities.get('fast').connected, false);
});

test('chargers never relay power and reversed lines cannot supply them', () => {
  const city = { ...createCity('blank'), powerSupplyMode: 'network', objects: [object('solar', 'solar-carport'), object('fast', 'fast-charger'), object('slow', 'slow-charger')], connections: [line('solar', 'fast'), line('fast', 'slow')] };
  let service = calculateUtilityService(city);
  assert.equal(service.facilities.get('fast').connected, true);
  assert.equal(service.facilities.get('slow').connected, false);
  assert.equal(service.powerBalance.results.get('fast').status, 'unset');
  city.connections[0].direction = 'reverse';
  service = calculateUtilityService(city);
  assert.equal(service.facilities.get('fast').connected, false);
});

test('legacy range mode covers chargers without making them supply hubs', () => {
  const city = { ...createCity('blank'), objects: [object('solar', 'solar-carport'), object('fast', 'fast-charger'), { ...object('slow', 'slow-charger'), x: 30 }] };
  const service = calculateUtilityService(city);
  assert.equal(service.facilities.get('fast').connected, true);
  assert.equal(service.facilities.get('slow').connected, false);
  assert.equal(service.facilities.get('fast').radius, 0);
});

test('network uses explicit directed paths, not proximity; water stays range based', () => {
  const city = fixture();
  city.objects.push(object('water', 'water-treatment'));
  let service = calculateUtilityService(city);
  assert.equal(service.consumers.get('home').power, 'relay');
  assert.equal(service.consumers.get('home').water, 'water');
  assert.deepEqual(powerPathNames(service.powerNetwork, 'home'), ['태양광 발전소', '변전소', '단독주택']);
  assert.equal(service.facilities.get('relay').radius, 0);
  assert.equal(service.facilities.get('relay').served, 1);
  city.connections.pop();
  service = calculateUtilityService(city);
  assert.equal(service.totals.power, 0);
  assert.match(service.powerNetwork.results.get('home').reason, /경로 없음/);
});

test('stopped, maintenance and faulty equipment block paths, running restores supply', () => {
  for (const id of ['source', 'relay', 'home']) for (const status of ['stopped', 'maintenance', 'fault']) {
    const city = fixture();
    city.objects.find(o => o.id === id).properties.status = status;
    assert.equal(calculateUtilityService(city).totals.power, 0);
    assert.ok(calculateUtilityService(city).powerNetwork.results.get('home').reason);
    city.objects.find(o => o.id === id).properties.status = 'running';
    assert.equal(calculateUtilityService(city).totals.power, 1);
  }
});

test('reverse and bidirectional links work; wrong types and orphan links cannot supply', () => {
  const city = fixture();
  city.connections[0].direction = 'reverse';
  assert.equal(calculateUtilityService(city).totals.power, 0);
  city.connections[0] = line('relay', 'source', 'reverse');
  assert.equal(calculateUtilityService(city).totals.power, 1);
  city.connections[0] = line('relay', 'source', 'both');
  assert.equal(calculateUtilityService(city).totals.power, 1);
  for (const type of ['water', 'general']) {
    city.connections[0].type = type;
    assert.equal(calculateUtilityService(city).totals.power, 0);
  }
  city.connections = [line('missing', 'home')];
  assert.equal(calculateUtilityService(city).totals.power, 0);
});

test('cycles terminate and a healthy alternative generator bypasses a failed path', () => {
  const city = fixture();
  city.objects.push(object('backup', 'wind-turbine'), object('battery', 'ess'));
  city.objects[0].properties.status = 'fault';
  city.connections.push(line('backup', 'battery'), line('battery', 'relay'), line('relay', 'battery'));
  const service = calculateUtilityService(city);
  assert.equal(service.totals.power, 1);
  assert.equal(service.powerNetwork.results.get('home').reason, null);
  city.objects = city.objects.filter(o => !['backup', 'source'].includes(o.id));
  assert.equal(calculateUtilityService(city).totals.power, 0);
});

test('consumers cannot relay; hidden or paused lines still conduct', () => {
  const city = fixture();
  city.objects.push(object('other', 'office'));
  city.connections.push(line('home', 'other'));
  city.connections.forEach(c => { c.visible = false; c.animated = false; c.speed = 0; });
  const service = calculateUtilityService(city);
  assert.equal(service.consumers.get('home').power, 'relay');
  assert.equal(service.consumers.get('other').power, null);
});

test('legacy default remains range based and mode validates and survives JSON', () => {
  const city = fixture();
  city.connections = [];
  assert.equal(validateCity(JSON.parse(JSON.stringify(city))).powerSupplyMode, 'network');
  delete city.powerSupplyMode;
  assert.equal(calculateUtilityService(city).totals.power, 1);
  city.powerSupplyMode = 'invalid';
  assert.throws(() => validateCity(city), /전력 공급/);
});

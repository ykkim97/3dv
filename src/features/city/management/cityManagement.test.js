import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from '../core/cityState.js';
import { calculateUtilityService } from '../simulation/utilityService.js';
import { calculateFireService } from '../simulation/fireService.js';
import { analyzeCity } from './cityDiagnostics.js';
import { managementMetrics, compareManagementMetrics } from './cityManagement.js';

const metrics = city => {
  const utility = calculateUtilityService(city), fire = calculateFireService(city);
  return managementMetrics(analyzeCity(city, utility, fire), utility, fire);
};

test('edit comparison reports service gains, extra demand and reversed edits', () => {
  const city = createCity('blank');
  city.objects = [{ id: 'home', asset: 'house', x: 0, z: 0, rotation: 0 }];
  const before = metrics(city);
  city.objects.push({ id: 'plant', asset: 'power-plant', x: 20, z: 0, rotation: 0 });
  const supplied = metrics(city);
  const improvement = compareManagementMetrics(before, supplied).find(change => change.id === 'power');
  assert.equal(improvement.before, 1);
  assert.equal(improvement.value, 0);
  assert.equal(improvement.improved, true);
  assert.equal(compareManagementMetrics(supplied, before).find(change => change.id === 'power').improved, false);
  assert.deepEqual(compareManagementMetrics(before, before), []);
  assert.deepEqual(compareManagementMetrics(null, before), []);
  city.objects.push({ id: 'remote-home', asset: 'house', x: 100, z: 0, rotation: 0 });
  assert.equal(compareManagementMetrics(supplied, metrics(city)).find(change => change.id === 'power').value, 1);
});

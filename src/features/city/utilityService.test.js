import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from './cityModel.js';
import { calculateUtilityService } from './utilityService.js';

const placed = (id, asset, x, z = 0) => ({ id, asset, x, z, rotation: 0 });

test('sources cover nearby buildings and relays require a chain back to a source', () => {
  const city = createCity('blank');
  city.objects = [
    placed('near', 'house', 8), placed('far', 'house', 90),
    placed('plant', 'power-plant', 0), placed('treatment', 'water-treatment', 0),
    placed('distribution', 'distribution', 75), placed('pump', 'pump-station', 73),
  ];
  let service = calculateUtilityService(city);
  assert.deepEqual(service.consumers.get('near'), { power: 'plant', water: 'treatment' });
  assert.deepEqual(service.consumers.get('far'), { power: null, water: null });
  assert.equal(service.facilities.get('distribution').connected, false);
  assert.equal(service.facilities.get('pump').connected, false);
  city.objects.push(placed('tower', 'transmission-tower', 40));
  city.objects.push(placed('reservoir', 'reservoir', 38));
  service = calculateUtilityService(city);
  assert.equal(service.facilities.get('distribution').connected, true);
  assert.equal(service.facilities.get('pump').connected, true);
  assert.deepEqual(service.consumers.get('far'), { power: 'distribution', water: 'pump' });
  assert.deepEqual(service.totals, { consumers: 2, power: 2, water: 2, both: 2 });
  city.objects = city.objects.filter(object => object.id !== 'plant');
  service = calculateUtilityService(city);
  assert.equal(service.facilities.get('tower').connected, false);
  assert.equal(service.consumers.get('far').power, null);
  assert.equal(service.consumers.get('far').water, 'pump');
});

test('storage and intake facilities do not create power or drinking water on their own', () => {
  const city = createCity('blank');
  city.objects = [
    placed('home', 'house', 0), placed('battery', 'ess', 3),
    placed('intake', 'intake-station', 3), placed('waste', 'wastewater', 4),
  ];
  const service = calculateUtilityService(city);
  assert.deepEqual(service.consumers.get('home'), { power: null, water: null });
  assert.equal(service.facilities.get('battery').connected, false);
  assert.equal(service.facilities.get('intake').connected, false);
  assert.equal(service.facilities.get('waste').radius, 0);
});

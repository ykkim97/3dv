import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from './cityModel.js';
import { calculateFireService, FIRE_ROUTE_LIMIT } from './fireService.js';

const placed = (id, asset, x, z) => ({ id, asset, x, z, rotation: 0 });
const site = (id, x, z, width = 12, depth = 12) => ({ id, x, z, width, depth });
const road = (id, ax, az, bx, bz, type = 'street') => ({ id, type, a: { x: ax, z: az }, b: { x: bx, z: bz } });

test('fire coverage follows connected drivable roads and respects route distance', () => {
  const city = createCity('blank');
  city.plots = [site('fire-site', 0, 0), site('near-site', 80, 0), site('branch-site', 80, 30), site('far-site', 115, 30, 10)];
  city.objects = [placed('fire', 'fire-station', 0, 0), placed('near', 'house', 80, 0), placed('branch', 'house', 80, 30), placed('far', 'house', 115, 30)];
  city.roads = [road('main', -10, -10, 100, -10), road('branch-road', 60, 20, 120, 20)];
  let result = calculateFireService(city);
  assert.equal(result.stations.get('fire').roadConnected, true);
  assert.equal(result.buildings.get('near').stationId, 'fire');
  assert.equal(result.buildings.get('branch').roadAccess, true);
  assert.equal(result.buildings.get('branch').stationId, null, 'a nearby disconnected road is not a route');
  city.roads.push(road('connector', 60, -10, 60, 20));
  result = calculateFireService(city);
  assert.equal(result.buildings.get('branch').stationId, 'fire', 'a T junction joins the road components');
  assert.ok(result.buildings.get('branch').routeMeters <= FIRE_ROUTE_LIMIT);
  assert.equal(result.buildings.get('far').stationId, null, 'connected roads still have a response-distance limit');
  assert.deepEqual(result.totals, { buildings: 3, covered: 2 });
  assert.ok(result.routes.length > 0, 'reachable road portions can be shown on the map');
});

test('walking paths do not give a fire station vehicle access', () => {
  const city = createCity('blank');
  city.plots = [site('fire-site', 0, 0), site('home-site', 30, 0)];
  city.objects = [placed('fire', 'fire-station', 0, 0), placed('home', 'house', 30, 0)];
  city.roads = [road('walk', -10, -10, 40, -10, 'path')];
  const result = calculateFireService(city);
  assert.equal(result.stations.get('fire').roadConnected, false);
  assert.equal(result.buildings.get('home').roadAccess, false);
  assert.equal(result.totals.covered, 0);
});

test('road segments joined end to end remain traversable', () => {
  const city = createCity('blank');
  city.plots = [site('fire-site', 0, 0), site('home-site', 60, 0)];
  city.objects = [placed('fire', 'fire-station', 0, 0), placed('home', 'house', 60, 0)];
  city.roads = [road('first', -10, -10, 30, -10), road('second', 30, -10, 75, -10)];
  assert.equal(calculateFireService(city).buildings.get('home').stationId, 'fire');
});

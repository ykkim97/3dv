import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from '../core/cityState.js';
import { calculateUtilityService } from '../simulation/utilityService.js';
import { calculateFireService } from '../simulation/fireService.js';
import { analyzeCity } from './cityDiagnostics.js';

const object = (id, asset, x, z) => ({ id, asset, x, z, rotation: 0 });
const site = (id, x, z, width = 24) => ({ id, x, z, width, depth: 24 });
const analyze = city => analyzeCity(city, calculateUtilityService(city), calculateFireService(city));

test('empty city starts with a site action and does not invent service deficits', () => {
  const city = createCity('blank');
  city.plots = [];
  city.roads = [];
  city.objects = [];
  city.heights.fill(0);
  city.heights[0] = 10;
  const result = analyze(city);
  assert.equal(result.issues[0].id, 'plots');
  assert.equal(result.issues.some(issue => issue.id === 'power' || issue.id === 'school'), false);
  assert.equal(result.sections.length, 8);
  assert.equal(result.sections.find(section => section.id === 'terrain').value, '10.0 m');
});

test('city diagnosis spans housing, jobs, roads, utilities, safety and nearby services', () => {
  const city = createCity('blank');
  city.plots = [site('home-site', 0, 0), site('remote-site', 85, 0), site('school-site', 30, 0), site('park-site', 35, 30), site('shop-site', 60, 0)];
  city.roads = [{ id: 'street', type: 'street', a: { x: -20, z: -16 }, b: { x: 50, z: -16 } }];
  city.objects = [object('home', 'house', 0, 0), object('school', 'school', 30, 0), object('park', 'park', 35, 30)];
  const result = analyze(city);
  assert.equal(result.population, 8);
  assert.equal(result.workforce, 4);
  assert.equal(result.access.school.reached, 8);
  assert.equal(result.access.park.reached, 0);
  assert.equal(result.facilities.get('school').nearbyResidents, 8);
  assert.ok(result.issues.some(issue => issue.id === 'roads' && issue.targetId === 'remote-site'));
  assert.ok(result.issues.some(issue => issue.id === 'jobs' && issue.asset === 'shop'));
  assert.ok(result.issues.some(issue => issue.id === 'park' && issue.asset === 'park'));
  assert.ok(result.issues.some(issue => issue.id === 'power' && issue.category === 'power'));
  assert.ok(result.issues.some(issue => issue.id === 'fire' && issue.asset === 'fire-station'));
  assert.equal(result.issues.find(issue => issue.id === 'power').targetId, 'home');
  assert.equal(result.issues.find(issue => issue.id === 'park').targetId, 'home');
  city.objects.push(object('shop', 'shop', 60, 0));
  assert.equal(analyze(city).issues.some(issue => issue.id === 'jobs'), false);
});

test('overlapping facilities do not count residents twice and capacity is separate from access', () => {
  const city = createCity('blank');
  city.plots = [site('home-site', 0, 0), site('school-a-site', 24, 0), site('school-b-site', 24, 28)];
  city.objects = [object('home', 'house', 0, 0), object('school-a', 'school', 24, 0), object('school-b', 'school', 24, 28)];
  const result = analyze(city);
  assert.equal(result.access.school.reached, 8);
  assert.equal(result.access.school.capacity, 240);
  assert.equal(result.schoolDemand, 2);
  assert.equal(result.issues.some(issue => issue.id === 'school' || issue.id === 'school-capacity'), false);
});

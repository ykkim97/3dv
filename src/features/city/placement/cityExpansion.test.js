import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from '../core/cityState.js';
import { validateCity } from '../core/cityValidation.js';
import { roadDraft, planRoadDraft, planBatch, setLocked, cleanDistricts, districtSummary } from './cityExpansion.js';
import { calculateUtilityService } from '../simulation/utilityService.js';

test('curves and closed roundabouts are connected, valid and saved together', () => {
  for (const points of [roadDraft({ x: -20, z: 0 }, { x: 20, z: 0 }, 'curve', { x: 0, z: 25 }), roadDraft({ x: 0, z: 0 }, { x: 12, z: 0 }, 'roundabout')]) {
    const city = createCity('blank'), plan = planRoadDraft(city, points, 'street', 'curve');
    assert.equal(plan.problem, null);
    assert.ok(plan.roads.length > 5);
    for (let i = 1; i < plan.roads.length; i++) assert.deepEqual(plan.roads[i].a, plan.roads[i - 1].b);
    city.roads = plan.roads;
    assert.equal(validateCity(JSON.parse(JSON.stringify(city))).roads.length, plan.roads.length);
    const moved = planBatch(city, [plan.roads[0].id], 'move', 0, 20);
    assert.equal(moved.problem, undefined);
    assert.equal(moved.count, plan.roads.length, 'selecting one part transforms the entire curve');
  }
  const circle = roadDraft({ x: 0, z: 0 }, { x: 12, z: 0 }, 'roundabout');
  assert.ok(Math.hypot(circle[0].x - circle.at(-1).x, circle[0].z - circle.at(-1).z) < 1e-6);
});

test('invalid road drafts fail atomically without changing the city', () => {
  const city = createCity('blank'); city.plots.push({ id: 'plot', x: 0, z: 0, width: 12, depth: 12 });
  const before = JSON.stringify(city);
  assert.ok(planRoadDraft(city, roadDraft({ x: -20, z: 0 }, { x: 20, z: 0 }), 'street').problem);
  assert.equal(JSON.stringify(city), before);
  assert.ok(planRoadDraft(city, roadDraft({ x: 115, z: 100 }, { x: 120, z: 100 }, 'roundabout'), 'street').problem);
});

function districtCity() {
  const city = createCity('blank');
  city.plots = [{ id: 'plot', x: 0, z: 0, width: 24, depth: 24 }];
  city.objects = [{ id: 'house', asset: 'house', x: 0, z: 0, rotation: 0 }];
  city.roads = [{ id: 'road', type: 'street', a: { x: -12, z: -17 }, b: { x: 12, z: -17 } }];
  city.districts = [{ id: 'district', name: '주거 단지', color: '#78c99e', plotIds: ['plot'] }];
  return city;
}
test('mixed edits carry buildings with their plots and retain district membership', () => {
  const city = districtCity(), before = JSON.stringify(city);
  const moved = planBatch(city, ['plot', 'road'], 'move', 40, 0);
  assert.equal(moved.problem, undefined);
  assert.equal(moved.count, 3);
  assert.equal(moved.city.objects[0].x, 40);
  assert.equal(moved.city.plots[0].x, 40);
  assert.equal(moved.city.roads[0].a.x, 28);
  assert.deepEqual(moved.city.districts[0].plotIds, ['plot']);
  const copied = planBatch(city, ['plot', 'road'], 'copy', 40, 0);
  assert.equal(copied.problem, undefined);
  assert.equal(copied.city.objects.length, 2);
  assert.equal(copied.city.districts[0].plotIds.length, 2);
  validateCity(copied.city);
  assert.equal(JSON.stringify(city), before);
  assert.ok(planBatch(city, ['plot'], 'copy', 2, 0).problem);
  const deleted = planBatch(city, ['plot'], 'delete');
  assert.equal(deleted.city.objects.length, 0);
  assert.deepEqual(deleted.city.districts[0].plotIds, []);
});

test('locks protect contained facilities and every batch operation until unlocked', () => {
  const city = setLocked(districtCity(), ['plot'], true);
  assert.ok(city.objects[0].locked);
  for (const action of ['move', 'copy', 'delete']) assert.match(planBatch(city, ['plot'], action, 40, 0).problem, /잠긴/);
  const unlocked = setLocked(city, ['plot'], false);
  assert.equal(planBatch(unlocked, ['plot'], 'move', 40, 0).problem, undefined);
  assert.ok(validateCity(JSON.parse(JSON.stringify(city))).objects[0].locked);
});

test('district summaries count only assigned sites and removed sites are pruned', () => {
  const city = districtCity(), summary = districtSummary(city, city.districts[0], calculateUtilityService(city));
  assert.equal(summary.objects.length, 1);
  assert.equal(summary.consumers, 1);
  assert.equal(summary.power, 0);
  assert.deepEqual(cleanDistricts({ ...city, plots: [] }).districts[0].plotIds, []);
  assert.throws(() => validateCity({ ...city, districts: [...city.districts, { ...city.districts[0], id: 'duplicate' }] }), /구역/);
  assert.throws(() => validateCity({ ...city, lifeSettings: { cars: 'yes' } }), /생활/);
});

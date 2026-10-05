import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from './cityState.js';
import { levelPlot, terrainHeight } from '../terrain/terrainModel.js';
import { unbuildableCells } from '../core/buildability.js';
import { placementProblem } from '../placement/placementRules.js';
import { plotFromCorners, plotProblem, plotEditProblem, plotHasRoadAccess } from '../plots/plotModel.js';
import { validateCity } from './cityValidation.js';
import { snapRoadPoint, roadIntersections, roadProblem } from '../roads/roadModel.js';
import { snapBuildingPlacement, placementDistances } from '../placement/alignment.js';
import { planBuildingCopies, planGroupTransform } from '../placement/duplication.js';

test('group edits preserve spacing and reject the full operation on collision or plot overflow', () => {
  const city = createCity('blank');
  city.plots = [{ id: 'site', x: 0, z: 0, width: 40, depth: 40 }];
  city.objects = [
    { id: 'a', asset: 'house', x: -12, z: 0, rotation: 0 },
    { id: 'b', asset: 'house', x: -4, z: 0, rotation: 0 },
  ];
  const ids = ['a', 'b'];
  const moved = planGroupTransform(city, ids, 'move', 0, 8);
  assert.equal(moved.problem, null);
  assert.deepEqual(moved.objects.map(o => [o.x, o.z]), [[-12, 8], [-4, 8]]);
  const copied = planGroupTransform(city, ids, 'copy', 0, 8);
  assert.equal(copied.problem, null);
  assert.deepEqual(copied.objects.map(o => o.id), ids);
  const rotated = planGroupTransform(city, ids, 'rotate');
  assert.equal(rotated.problem, null);
  assert.deepEqual(rotated.objects.map(o => [o.x, o.z]), [[-8, -4], [-8, 4]]);
  assert.match(planGroupTransform(city, ids, 'copy', 4, 0).problem, /시설/);
  assert.deepEqual(planGroupTransform(city, ids, 'move', 40, 0).objects, []);
  assert.deepEqual(city.objects.map(o => [o.x, o.z]), [[-12, 0], [-4, 0]], 'planning leaves the original city untouched');
});

test('copy planning uses exact spacing and rejects the entire row when it leaves its plot', () => {
  const city = createCity('blank');
  city.plots = [{ id: 'site', x: 0, z: 0, width: 24, depth: 24 }];
  const source = { id: 'home', asset: 'house', x: -8, z: 0, rotation: 0 };
  city.objects = [source];
  const plan = planBuildingCopies(city, source, 2, 2, 'x+');
  assert.equal(plan.problem, null);
  assert.deepEqual(plan.copies.map(item => item.x), [-1, 6]);
  assert.deepEqual(plan.copies.map(item => item.z), [0, 0]);
  assert.equal(city.objects.length, 1, 'planning does not mutate the city');
  assert.match(planBuildingCopies(city, source, 3, 2, 'x+').problem, /3번째/);
  assert.deepEqual(planBuildingCopies(city, source, 3, 2, 'x+').copies, [], 'an invalid row is atomic');
  assert.match(planBuildingCopies(city, source, 2, -1, 'x+').problem, /확인/);
  assert.deepEqual(placementDistances(city, 'house', -1, 0), { boundary: 8.5, neighbor: 2 });
});

test('building alignment uses plot edges and neighboring buildings without violating placement rules', () => {
  const city = createCity('blank');
  city.plots = [{ id: 'site', x: 0, z: 0, width: 24, depth: 24 }];
  city.objects = [];
  assert.deepEqual(snapBuildingPlacement(city, 'house', { x: 8.8, z: 8.6 }).guides?.label, '부지 경계');
  const edge = snapBuildingPlacement(city, 'house', { x: 8.8, z: 8.6 });
  assert.equal(edge.x, 8.5);
  assert.equal(edge.z, 8.5);
  assert.equal(placementProblem(city, 'house', edge.x, edge.z), null);
  city.objects.push({ id: 'old', asset: 'house', x: -5, z: -3, rotation: 0 });
  const aligned = snapBuildingPlacement(city, 'house', { x: 1.8, z: -2.6 });
  assert.equal(aligned.x, 1);
  assert.equal(aligned.z, -3);
  assert.match(aligned.guides.label, /건물/);
  assert.equal(placementProblem(city, 'house', aligned.x, aligned.z), null);
  assert.deepEqual(snapBuildingPlacement(city, 'house', { x: 1.8, z: -2.6 }, 0, false), { x: 2, z: -2, guides: null });
  assert.deepEqual(snapBuildingPlacement(city, 'house', { x: 30, z: 0 }), { x: 30, z: 0, guides: null });
});

test('roads snap to real endpoints, centerlines, then the construction grid', () => {
  const roads = [{ id: 'old', type: 'street', a: { x: 6, z: -67 }, b: { x: 6, z: 67 } }];
  assert.deepEqual(snapRoadPoint(roads, { x: 8, z: 65 }), { x: 6, z: 67, kind: 'endpoint' });
  assert.deepEqual(snapRoadPoint(roads, { x: 8, z: 12 }), { x: 6, z: 12, kind: 'junction' });
  assert.deepEqual(snapRoadPoint(roads, { x: 16.8, z: 13.1 }), { x: 16, z: 14, kind: 'grid' });
});

test('road crossings and T junctions are unique and duplicate roads are rejected', () => {
  const city = createCity('blank');
  city.roads = [
    { id: 'a', type: 'street', a: { x: -20, z: 0 }, b: { x: 20, z: 0 } },
    { id: 'b', type: 'avenue', a: { x: 0, z: -20 }, b: { x: 0, z: 20 } },
    { id: 'c', type: 'street', a: { x: 0, z: 0 }, b: { x: 16, z: 16 } },
  ];
  assert.deepEqual(roadIntersections(city.roads), [{ x: 0, z: 0, width: 7 }]);
  assert.equal(roadProblem(city, { type: 'street', a: { x: -10, z: 10 }, b: { x: 10, z: -10 } }), null);
  assert.match(roadProblem(city, { type: 'street', a: { x: -10, z: 0 }, b: { x: 10, z: 0 } }), /겹칩니다/);
  assert.match(roadProblem(city, { type: 'street', a: { x: 0, z: 0 }, b: { x: 0, z: 0 } }), /2 m/);
});

test('resizing a site keeps its buildings inside and rejects overlap', () => {
  const city = createCity('blank');
  city.plots.push({ id: 'site', x: 0, z: 0, width: 20, depth: 20 });
  city.plots.push({ id: 'neighbor', x: 30, z: 0, width: 12, depth: 12 });
  city.objects.push({ id: 'home', asset: 'house', x: -5, z: -5, rotation: 0 });
  assert.equal(plotEditProblem(city, 'site', { id: 'site', x: 2, z: 2, width: 24, depth: 24 }), null);
  assert.match(plotEditProblem(city, 'site', { id: 'site', x: 4, z: 4, width: 12, depth: 12 }), /시설/);
  assert.match(plotEditProblem(city, 'site', { id: 'site', x: 6, z: 0, width: 40, depth: 20 }), /겹칩니다/);
});

test('information view identifies disconnected plots and occupied build cells', () => {
  const city = createCity('blank');
  const near = { id: 'near', x: 0, z: 12, width: 12, depth: 12 };
  const far = { id: 'far', x: 70, z: 70, width: 12, depth: 12 };
  city.plots.push(near, far);
  city.roads.push({ id: 'street', type: 'street', a: { x: -30, z: 0 }, b: { x: 30, z: 0 } });
  assert.equal(plotHasRoadAccess(city, near), true);
  assert.equal(plotHasRoadAccess(city, far), false);
  city.roads[0].type = 'path';
  assert.equal(plotHasRoadAccess(city, near), false, 'a footpath is not a vehicle connection');
  assert.ok(unbuildableCells(city).some(cell => cell.reason === 'occupied'));
});

test('facilities stay inside a plot and cannot overlap, including after rotation', () => {
  const city = createCity('blank');
  city.plots.push({ id: 'site', x: 0, z: 0, width: 24, depth: 24 });
  assert.match(placementProblem(city, 'house', 30, 0), /부지/);
  assert.equal(placementProblem(city, 'house', 0, 0), null);
  city.objects.push({ id: 'home', asset: 'house', x: 0, z: 0, rotation: 0 });
  assert.match(placementProblem(city, 'apartment', 4, 0), /시설/);
  assert.equal(placementProblem(city, 'house', 8, 0), null);
  assert.match(placementProblem(city, 'hotel', 5, 0, Math.PI / 2), /시설/);
  assert.match(placementProblem(city, 'house', 12, 0), /부지/);
});

test('sites do not overlap and flatten sloped ground', () => {
  const city = createCity('alpine');
  const site = { id: 'new-site', x: -96, z: 50, width: 12, depth: 12 };
  // Existing scenery may occupy a proposed site; clear it for this terrain test.
  city.objects = []; city.roads = []; city.plots = [];
  assert.equal(plotProblem(city, site), null);
  const target = terrainHeight(city.heights, site.x, site.z);
  levelPlot(city, site);
  city.plots.push(site);
  for (let x = site.x - 6; x <= site.x + 6; x += 2) for (let z = site.z - 6; z <= site.z + 6; z += 2) assert.ok(Math.abs(terrainHeight(city.heights, x, z) - target) < 1e-6);
  assert.match(plotProblem(city, { ...site, id: 'overlap', x: -86 }), /겹칩니다/);
  assert.equal(validateCity(city), city);
});

test('starter city includes a central empty site ready for placement', () => {
  const city = createCity('river');
  const site = city.plots.find(plot => plot.id === 'plot-2-2');
  assert.ok(site);
  assert.ok(!city.objects.some(object => Math.abs(object.x - site.x) < site.width / 2 && Math.abs(object.z - site.z) < site.depth / 2));
  assert.equal(placementProblem(city, 'house', site.x, site.z), null);
});

test('site rectangle follows both axes, snaps to grid, and stays within editable limits', () => {
  assert.deepEqual(plotFromCorners({ x: 0, z: 0 }, { x: 15, z: -9 }), { x: 8, z: -5, width: 16, depth: 10 });
  assert.deepEqual(plotFromCorners({ x: 0, z: 0 }, { x: -7, z: 13 }), { x: -4, z: 7, width: 8, depth: 14 });
  assert.deepEqual(plotFromCorners({ x: 118, z: 118 }, { x: 118, z: 118 }), { x: 116, z: 116, width: 4, depth: 4 });
  assert.deepEqual(plotFromCorners({ x: -118, z: -118 }, { x: -120, z: -120 }), { x: -116, z: -116, width: 4, depth: 4 });
  const large = plotFromCorners({ x: 0, z: 0 }, { x: 120, z: -120 });
  assert.equal(large.width, 80);
  assert.equal(large.depth, 80);
});

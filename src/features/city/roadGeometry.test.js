import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createCity, roadProblem, snapRoadPoint } from './cityModel.js';
import { roadProfile, roadTerrainWarning, roadJunctions, createJunctionSurface } from './roadGeometry.js';

test('roads follow longitudinal terrain heights and warn on steep terrain', () => {
  const city = createCity('blank'); city.plots = []; city.roads = [];
  for (let r = 0; r <= 120; r++) for (let c = 0; c <= 120; c++) city.heights[r * 121 + c] = 20 + (c * 2 - 120) * 0.05;
  const road = { id: 'road', type: 'street', a: { x: 0, z: 0 }, b: { x: 20, z: 0 } };
  const profile = roadProfile(city, road);
  assert.equal(profile.samples[0].height, 20);
  assert.equal(profile.samples.at(-1).height, 21);
  assert.equal(roadTerrainWarning(city, road), null);
  for (let r = 0; r <= 120; r++) for (let c = 0; c <= 120; c++) city.heights[r * 121 + c] = 30 + (c * 2 - 120) * 0.2;
  assert.match(roadTerrainWarning(city, road), /급경사 20%/);
  city.roads.push(road);
  assert.equal(roadProblem(city, { ...road, type: 'avenue' }), null, 'editing ignores the road itself');
  city.plots.push({ id: 'site', x: 10, z: 6, width: 4, depth: 4 });
  assert.equal(roadProblem(city, road), null);
  city.plots[0].z = 5;
  assert.match(roadProblem(city, { ...road, type: 'avenue' }), /부지/);
});

test('wide roads attract their outer edges and real endpoints retain priority', () => {
  const roads = [{ id: 'main', type: 'avenue', a: { x: -20, z: 0 }, b: { x: 20, z: 0 } }];
  assert.deepEqual(snapRoadPoint(roads, { x: 0, z: 5 }), { x: 0, z: 0, kind: 'junction' });
  assert.deepEqual(snapRoadPoint(roads, { x: 17, z: 3 }), { x: 20, z: 0, kind: 'endpoint' });
});

test('crossroads share an elevation and stop lane and curb runs in their interior', () => {
  const city = createCity('blank'); city.plots = [];
  for (let r = 0; r <= 120; r++) for (let c = 0; c <= 120; c++) city.heights[r * 121 + c] = 5 + (c * 2 - 120) * 0.03;
  city.roads = [
    { id: 'east-west', type: 'street', a: { x: -20, z: 0 }, b: { x: 20, z: 0 } },
    { id: 'north-south', type: 'avenue', a: { x: 0, z: -20 }, b: { x: 0, z: 20 } },
  ];
  const junctions = roadJunctions(city);
  assert.equal(junctions.length, 1);
  assert.equal(junctions[0].boundary.length, 8, 'directional entrances create chamfered corners');
  for (const road of city.roads) {
    const profile = roadProfile(city, road, junctions), center = profile.samples.find(point => Math.abs(point.x) < 1e-6 && Math.abs(point.z) < 1e-6);
    assert.equal(center.height, junctions[0].height);
    assert.equal(center.junction, true);
    assert.equal(profile.samples[0].junction, false);
    const mouth = profile.samples.find(point => Math.abs(Math.hypot(point.x, point.z) - junctions[0].radius) < 1e-6);
    assert.ok(mouth, 'curbs end exactly at the entrance instead of leaving a gap');
    assert.equal(mouth.junction, false);
  }
});

test('T junctions and collinear width transitions retain open road entrances', () => {
  const city = createCity('blank');
  const main = { id: 'main', type: 'avenue', a: { x: -20, z: 0 }, b: { x: 0, z: 0 } };
  for (const branch of [
    { id: 'branch', type: 'street', a: { x: 0, z: 0 }, b: { x: 20, z: 0 } },
    { id: 'branch', type: 'street', a: { x: 0, z: 0 }, b: { x: 0, z: 20 } },
  ]) {
    city.roads = [main, branch];
    const [junction] = roadJunctions(city);
    assert.ok(junction);
    const mouths = junction.boundary.filter((a, i) => a.mouth === junction.boundary[(i + 1) % junction.boundary.length].mouth);
    assert.equal(mouths.length, 2);
  }
});

test('elbow junctions cover the outer bend with rounded curbs and nonoverlapping upward faces', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const city = createCity('blank');
    for (const end of [{ x: 0, z: 20 }, { x: 10, z: 20 }, { x: 20, z: 1 }, { x: -10, z: 20 }]) {
      city.roads = [
        { id: 'main', type: 'street', a: { x: -20, z: 0 }, b: { x: 0, z: 0 } },
        { id: 'branch', type: 'avenue', a: { x: 0, z: 0 }, b: end },
      ];
      const [junction] = roadJunctions(city), mesh = createJunctionSurface(scene, junction);
      const vertices = mesh.getVerticesData('position'), normals = mesh.getVerticesData('normal'), indices = mesh.getIndices();
      let area = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = indices.slice(i, i + 3).map(index => index * 3);
        const signed = (vertices[b] - vertices[a]) * (vertices[c + 2] - vertices[a + 2])
          - (vertices[b + 2] - vertices[a + 2]) * (vertices[c] - vertices[a]);
        assert.ok(signed > 1e-8, 'every triangle faces upward without folded or degenerate wedges');
        area += signed / 2;
      }
      const boundaryArea = junction.boundary.reduce((sum, p, i, points) => {
        const next = points[(i + 1) % points.length];
        return sum + (p.x * next.z - p.z * next.x) / 2;
      }, 0);
      assert.ok(Math.abs(area - boundaryArea) < 1e-4, 'the surface fills the outline exactly once');
      assert.ok(normals.filter((_, i) => i % 3 === 1).every(y => y > 0.99));
      if (end.x === 0) {
        assert.equal(junction.boundary.filter((p, i, points) => p.mouth === points[(i + 1) % points.length].mouth).length, 2);
        assert.ok(junction.boundary.some(p => p.x > 3 && p.z < -1), 'outside of the bend has a paved corner');
        assert.ok(junction.boundary.length > 6, 'outer corner uses a smooth rounded outline');
      }
      mesh.dispose();
    }
  } finally { scene.dispose(); engine.dispose(); }
});

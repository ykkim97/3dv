import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity, validateCity, RESOLUTION } from './cityModel.js';
import { paintTerrain, terrainVertexColor } from './terrainPaint.js';

test('painting blends within brush radius, leaves heights untouched and survives city export', () => {
  const city = createCity('blank');
  city.plots = [];
  const heights = city.heights.slice();
  const center = 60 * (RESOLUTION + 1) + 60;
  assert.equal(paintTerrain(city, { x: 0, z: 0 }, 12, 1, '#ff0000'), true);
  assert.deepEqual(city.heights, heights);
  assert.deepEqual(terrainVertexColor(city, center), [255, 0, 0]);
  assert.equal(city.terrainPaint[center + 6], null, 'brush edge is not painted');
  assert.notEqual(city.terrainPaint[center + 1], '#ff0000', 'soft falloff blends near the edge');
  const restored = validateCity(JSON.parse(JSON.stringify(city)));
  assert.deepEqual(restored.terrainPaint, city.terrainPaint);
  restored.heights[center] = 40;
  assert.deepEqual(terrainVertexColor(restored, center), [255, 0, 0], 'sculpting preserves paint');
});

test('constructed sites are protected and legacy saves need no paint data', () => {
  const city = createCity('blank');
  city.plots = [{ id: 'site', x: 0, z: 0, width: 12, depth: 12 }];
  assert.doesNotThrow(() => validateCity(city));
  paintTerrain(city, { x: 0, z: 0 }, 16, 1, '#3366ff');
  assert.equal(city.terrainPaint[60 * 121 + 60], null);
  assert.equal(paintTerrain(city, { x: 40, z: 0 }, 12, 1, 'invalid'), false);
  assert.throws(() => validateCity({ ...city, terrainPaint: ['#ff0000'] }), /색상/);
});

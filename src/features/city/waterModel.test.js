import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity, validateCity } from './cityModel.js';
import { waterRegions, waterGeometry, waterSettings, WATER_LEVEL } from './waterModel.js';

test('separate basins can be drained independently and settings survive save and load', () => {
  const city = createCity('blank'); city.heights.fill(2);
  city.heights[40 * 121 + 40] = -3;
  city.heights[80 * 121 + 80] = -6;
  const regions = waterRegions(city);
  assert.equal(regions.length, 2);
  city.waterSettings = { flowing: false, regions: [{ anchor: regions[0].anchor, enabled: false }] };
  assert.equal(waterSettings(city, regions[0]).enabled, false);
  assert.equal(waterSettings(city, regions[1]).enabled, true);
  assert.equal(waterSettings(city, regions[1]).flowing, false);
  const restored = validateCity(JSON.parse(JSON.stringify(city)));
  assert.equal(waterSettings(restored, waterRegions(restored)[0]).enabled, false);
  const before = city.heights.slice();
  city.waterSettings.regions[0].enabled = true;
  assert.deepEqual(city.heights, before, 'refilling never sculpts terrain');
  assert.throws(() => validateCity({ ...city, waterSettings: { opacity: 20 } }), /수면/);
});

test('water mesh clips to the terrain shoreline and remains level', () => {
  const city = createCity('blank'); city.heights.fill(2);
  city.heights[60 * 121 + 60] = -2;
  const [region] = waterRegions(city), data = waterGeometry(city, region);
  assert.ok(data.indices.length > 0);
  assert.ok(data.depths.some(depth => depth === 0));
  assert.ok(data.depths.some(depth => depth > 0));
  for (let i = 0; i < data.positions.length; i += 3) {
    assert.ok(Math.abs(data.positions[i]) < 2);
    assert.ok(Math.abs(data.positions[i + 2]) < 2);
    assert.equal(data.positions[i + 1], WATER_LEVEL + 0.015);
  }
});

test('shoreline clipping uses the same cell diagonal as the terrain mesh', () => {
  const city = createCity('blank'); city.heights.fill(2);
  city.heights[60 * 121 + 60] = -2;
  const data = waterGeometry(city, { cells: [60 * 120 + 60] });
  assert.equal(data.indices.length, 6, 'the lowered corner belongs to both terrain triangles');
});

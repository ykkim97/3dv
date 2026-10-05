import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, MeshBuilder, ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { CityEngine } from '../rendering/CityEngine.js';
import { createCity } from '../core/cityState.js';
import { expandCity } from '../core/mapExpansion.js';
import { mapDimensions } from '../core/mapDimensions.js';
import { terrainHeight, levelPlot } from './terrainModel.js';
import { validateCity } from '../core/cityValidation.js';
import { plotProblem, plotFromCorners } from '../plots/plotModel.js';
import { roadProblem, snapRoadPoint } from '../roads/roadModel.js';
import { waterRegions, waterSettings, waterGeometry } from '../water/waterModel.js';
import { paintTerrain } from './terrainPaint.js';

test('expansion preserves old terrain, paint, entities and independent basin settings', () => {
  const city = createCity('blank');
  delete city.map; // A saved city from before map dimensions were introduced.
  city.heights[40 * 121 + 40] = -5;
  city.heights[80 * 121 + 80] = -3;
  city.terrainPaint = Array(city.heights.length).fill(null);
  city.terrainPaint[40 * 121 + 40] = '#ffab12';
  city.plots.push({ id: 'plot', x: 0, z: 0, width: 12, depth: 12 });
  city.objects.push({ id: 'home', asset: 'house', x: 0, z: 0, rotation: 0 });
  city.roads.push({ id: 'road', type: 'street', a: { x: -20, z: -10 }, b: { x: 20, z: -10 } });
  const basin = waterRegions(city)[0];
  city.waterSettings = { regions: [{ anchor: basin.anchor, enabled: false, flowing: false, color: '#123456' }] };
  const before = structuredClone(city), next = expandCity(city);
  assert.deepEqual(city, before, 'expansion does not mutate undo history');
  assert.deepEqual(next.objects, city.objects);
  assert.deepEqual(next.roads, city.roads);
  assert.deepEqual(next.plots, city.plots);
  for (let r = 0; r <= 120; r++) for (let c = 0; c <= 120; c++) {
    assert.equal(next.heights[(r + 60) * 241 + c + 60], city.heights[r * 121 + c]);
    assert.equal(next.terrainPaint[(r + 60) * 241 + c + 60], city.terrainPaint[r * 121 + c]);
  }
  const regions = waterRegions(next);
  assert.equal(regions.length, 2);
  const saved = regions.find(region => region.cells.includes(next.waterSettings.regions[0].anchor));
  assert.equal(waterSettings(next, saved).enabled, false);
  assert.equal(waterSettings(next, saved).color, '#123456');
  assert.equal(saved.x, basin.x);
  assert.equal(saved.z, basin.z);
  assert.deepEqual(waterGeometry(next, saved), waterGeometry(city, basin));
  assert.equal(validateCity(JSON.parse(JSON.stringify(next))).map.size, 480);
});

test('expanded land supports terrain painting, leveling, plots and roads beyond legacy bounds', () => {
  const city = expandCity(createCity('blank'));
  const plot = { id: 'new', ...plotFromCorners({ x: 180, z: 180 }, { x: 194, z: 194 }, city) };
  assert.equal(plotProblem(city, plot), null);
  assert.equal(plotProblem(createCity('blank'), plot), '부지를 지도 경계 안에 배치해 주세요.');
  const road = { id: 'far', type: 'street', a: { x: 180, z: 170 }, b: { x: 220, z: 170 } };
  assert.equal(roadProblem(city, road), null);
  assert.deepEqual(snapRoadPoint([], { x: 200.4, z: 240.5 }, city), { x: 200, z: 240, kind: 'grid' });
  assert.equal(paintTerrain(city, { x: 200, z: 200 }, 8, 1, '#ff0000'), true);
  assert.equal(city.terrainPaint[20 * 241 + 220], '#ff0000');
  for (const r of [26, 27]) for (const c of [213, 214]) city.heights[r * 241 + c] = 4;
  levelPlot(city, plot);
  assert.equal(terrainHeight(city.heights, plot.x, plot.z), 4);
  assert.equal(terrainHeight(city.heights, 240, -240), 1.5);
});

test('new maps keep 2 m cells and saved dimensions are validated including legacy saves', () => {
  const legacy = createCity('blank'); delete legacy.map;
  assert.equal(validateCity(legacy), legacy);
  for (const preset of ['blank', 'river', 'coast', 'alpine']) {
    const city = createCity(preset, 480);
    assert.equal(city.heights.length, 241 ** 2);
    assert.equal(mapDimensions(city).cameraLimit, 780);
    assert.equal(validateCity(city), city);
  }
  const city = createCity('blank', 480);
  assert.throws(() => expandCity(city));
  for (const map of [null, { size: 480, resolution: 120, cellSize: 2 }, { size: 960, resolution: 480, cellSize: 2 }]) {
    assert.throws(() => validateCity({ ...city, map }));
  }
  assert.throws(() => validateCity({ ...legacy, heights: city.heights }));
});

test('scene rebuilds terrain, closed sides and grid on expansion and undo', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.nodes = []; editor.materials = new Map();
  editor.camera = new ArcRotateCamera('camera', -1, 0.8, 205, Vector3.Zero(), editor.scene);
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.ring = editor.brushSpokes = { setEnabled() {} };
  editor.terrain = MeshBuilder.CreateGround('terrain', { width: 240, height: 240, subdivisions: 120, updatable: true }, editor.scene);
  editor.terrain.material = editor.material('terrain', '#91ac7b');
  editor.gridVisible = true;
  try {
    const city = createCity('blank');
    editor.setCity(city);
    const oldGrid = editor.grid, oldTerrain = editor.terrain, oldSides = editor.terrainSides;
    editor.setCity(expandCity(city));
    assert.ok(oldGrid.isDisposed()); assert.ok(oldTerrain.isDisposed()); assert.ok(oldSides.isDisposed());
    assert.equal(editor.terrain.getTotalVertices(), 241 ** 2);
    assert.equal(editor.terrain.getHeightAtCoordinates(220, 220), 1.5);
    assert.equal(editor.terrain.getBoundingInfo().boundingBox.maximum.x, 240);
    assert.equal(editor.terrainBottom.getBoundingInfo().boundingBox.maximum.x, 240);
    assert.equal(editor.grid.getTotalVertices(), 242 * 241);
    assert.equal(editor.camera.upperRadiusLimit, 780);
    editor.focusPoint(500, -500);
    assert.equal(editor.camera.target.x, 240);
    assert.equal(editor.camera.target.z, -240);
    editor.setCity(city);
    assert.equal(editor.terrain.getTotalVertices(), 121 ** 2);
    assert.equal(editor.grid.getTotalVertices(), 122 * 121);
    assert.equal(editor.camera.upperRadiusLimit, 390);
    assert.equal(editor.terrain.getHeightAtCoordinates(0, 0), 1.5);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

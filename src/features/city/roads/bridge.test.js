import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { CityEngine } from '../rendering/CityEngine.js';
import { BRIDGE_PRESETS } from '../presets/bridgePresets.js';
import { createCity } from '../core/cityState.js';
import { roadProblem, snapRoadPoint, roadIntersections } from './roadModel.js';
import { validateCity } from '../core/cityValidation.js';
import { roadProfile, roadTerrainWarning } from './roadGeometry.js';
import { planRoadDraft } from '../placement/cityExpansion.js';
import { calculateFireService } from '../simulation/fireService.js';

function riverCity() {
  const city = createCity('blank');
  for (let r = 0; r <= 120; r++) for (let c = 0; c <= 120; c++) {
    const x = c * 2 - 120, z = 120 - r * 2;
    if (Math.abs(x) < 20 && Math.abs(z) < 20) city.heights[r * 121 + c] = -4;
  }
  return city;
}
const bridgeRoad = preset => ({ id: 'bridge', bridge: preset.id, type: preset.type, a: { x: -30, z: 0 }, b: { x: 30, z: 0 } });

test('bridge presets keep their decks over water and require valid land approaches', () => {
  for (const preset of BRIDGE_PRESETS) {
    const city = riverCity(), road = bridgeRoad(preset);
    assert.equal(roadProblem(city, road), null);
    const profile = roadProfile(city, road);
    assert.equal(profile.samples[0].height, 1.5);
    assert.equal(profile.samples.at(-1).height, 1.5);
    assert.ok(profile.samples[30].height > 1.5, 'deck clears water while meeting both banks');
    assert.equal(roadTerrainWarning(city, road), null, 'short spans do not inherit an excessively steep hump');
    assert.match(roadProblem(city, { ...road, b: { x: 0, z: 0 } }), /육지|길이/);
    assert.match(roadProblem(city, { ...road, b: { x: -28, z: 0 } }), /길이/);
    const plan = planRoadDraft(city, [road.a, road.b], preset.type, 'bridge-chain', preset.id);
    assert.equal(plan.problem, null);
    city.roads = plan.roads;
    assert.equal(validateCity(JSON.parse(JSON.stringify(city))).roads[0].bridge, preset.id);
    assert.equal(city.plots.length, 0);
    assert.match(planRoadDraft(city, [road.a, { x: 0, z: 8 }, road.b], preset.type, 'invalid', preset.id).problem, /직선/);
  }
  const city = riverCity(); city.roads = [{ ...bridgeRoad(BRIDGE_PRESETS[0]), bridge: 'unknown' }];
  assert.throws(() => validateCity(city), /교량/);
});

test('all bridge presets render recognizable structural geometry, preview and remain selectable', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.materials = new Map(); editor.nodes = [];
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  const distinctive = { small: 'bridge-pier', arch: 'bridge-arch', cable: 'bridge-stay-cable', suspension: 'bridge-main-cable', footbridge: 'bridge-guardrail' };
  try {
    for (const preset of BRIDGE_PRESETS) {
      editor.city = riverCity(); const road = bridgeRoad(preset); editor.city.roads = [road];
      editor.showRoadPreview(road);
      const preview = editor.roadPreview.getChildMeshes();
      assert.ok(preview.some(mesh => mesh.name === distinctive[preset.id]), preset.name);
      assert.ok(preview.some(mesh => mesh.name === 'bridge-deck'));
      assert.ok(preview.every(mesh => !mesh.isPickable));
      assert.ok(preview.every(mesh => mesh.getVerticesData('position').every(Number.isFinite)));
      editor.roadPreview.dispose(); editor.roadPreview = null;
      const root = editor.buildRoad(road);
      assert.ok(root.getChildMeshes().every(mesh => mesh.metadata?.roadId === 'bridge'));
      assert.ok(root.getChildMeshes().some(mesh => mesh.material.name === 'bridge-concrete'));
      editor.select('bridge'); assert.equal(editor.selectionFrames.length, 1);
      editor.select(null); root.dispose(); editor.nodes = [];
    }
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('roads snap to bridge approaches, but elevated deck crossings are not surface junctions', () => {
  const road = bridgeRoad(BRIDGE_PRESETS[0]);
  assert.equal(snapRoadPoint([road], { x: -28, z: 1 }).kind, 'endpoint');
  assert.equal(snapRoadPoint([road], { x: 0, z: 1 }).kind, 'grid');
  const under = { id: 'under', type: 'street', a: { x: 0, z: -30 }, b: { x: 0, z: 30 } };
  assert.equal(roadIntersections([road, under]).length, 0);
  const approach = { id: 'approach', type: 'street', a: { x: -50, z: 0 }, b: road.a };
  assert.equal(roadIntersections([road, approach]).length, 1);
  const city = riverCity(); city.roads = [road, under];
  city.plots = [{ id: 'station-plot', x: -38, z: 0, width: 12, depth: 12 }, { id: 'house-plot', x: 0, z: 38, width: 12, depth: 12 }];
  city.objects = [{ id: 'station', asset: 'fire-station', x: -38, z: 0, rotation: 0 }, { id: 'house', asset: 'house', x: 0, z: 38, rotation: 0 }];
  assert.equal(calculateFireService(city).buildings.get('house').stationId, null);
  city.roads.push({ id: 'end-link', type: 'street', a: road.b, b: { x: 30, z: 30 } }, { id: 'bank-link', type: 'street', a: { x: 30, z: 30 }, b: under.b });
  assert.equal(calculateFireService(city).buildings.get('house').stationId, 'station');
});

test('bridge endpoint edits reject underwater landings and commit a valid extended span', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.materials = new Map(); editor.nodes = [];
  editor.city = riverCity(); const road = bridgeRoad(BRIDGE_PRESETS[0]); editor.city.roads = [road];
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.canvas = { setPointerCapture() {}, hasPointerCapture: () => false };
  const commits = []; editor.onChange = city => commits.push(city); editor.onMessage = () => {}; editor.onSelect = () => {};
  try {
    editor.buildRoad(road);
    editor.beginRoadEdit('bridge', 'b', { pointerId: 1 }); editor.updateRoadEdit({ x: 0, z: 0 }, { clientX: 0, clientY: 0 }); editor.finishRoadEdit({ pointerId: 1 });
    assert.equal(commits.length, 0);
    editor.beginRoadEdit('bridge', 'b', { pointerId: 1 }); editor.updateRoadEdit({ x: 40, z: 0 }, { clientX: 0, clientY: 0 }); editor.finishRoadEdit({ pointerId: 1 });
    assert.equal(commits.length, 1); assert.equal(commits[0].roads[0].bridge, 'small');
    assert.deepEqual(commits[0].roads[0].b, { x: 40, z: 0 });
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

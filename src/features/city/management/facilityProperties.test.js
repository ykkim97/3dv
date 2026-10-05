import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { createCity } from '../core/cityState.js';
import { validateCity } from '../core/cityValidation.js';
import { CityEngine } from '../rendering/CityEngine.js';
import { planBuildingCopies, planGroupTransform } from '../placement/duplication.js';
import { planBatch } from '../placement/cityExpansion.js';
import { DEFAULT_CONNECTION } from '../connections/connectionModel.js';
import { facilityName, facilityStatus, facilityNumberFields, updateFacilityProperties } from './facilityProperties.js';

function fixture() {
  const city = createCity('blank');
  city.plots = [{ id: 'site', x: 0, z: 0, width: 80, depth: 80 }];
  city.objects = [
    { id: 'a', asset: 'house', x: -12, z: 0, rotation: 0 },
    { id: 'b', asset: 'house', x: 0, z: 0, rotation: 0 },
  ];
  return city;
}

test('facility properties round-trip, normalize input and preserve legacy names and defaults', () => {
  const city = fixture();
  assert.equal(validateCity(city), city);
  assert.equal(facilityName(city.objects[0]), '가든 하우스');
  assert.equal(facilityStatus(city.objects[0]).id, 'running');
  const next = updateFacilityProperties(city, 'a', { name: ' 제1 주택 ', code: ' H-01 ', notes: ' 중요 부하 ', status: 'fault', demandKW: 0 });
  assert.equal(city.objects[0].properties, undefined, 'updates do not mutate history');
  assert.equal(next.objects[1], city.objects[1]);
  const loaded = validateCity(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(loaded.objects[0].properties, { name: '제1 주택', code: 'H-01', notes: '중요 부하', status: 'fault', demandKW: 0 });
  assert.equal(facilityName(loaded.objects[0]), '제1 주택');
  assert.equal(facilityStatus(loaded.objects[0]).name, '고장');
  const cleared = updateFacilityProperties(next, 'a', { name: '', code: '', notes: '', status: 'running', demandKW: undefined });
  assert.deepEqual(cleared.objects[0].properties, {});
  assert.equal(facilityName(cleared.objects[0]), '가든 하우스');
  assert.deepEqual(facilityNumberFields({ asset: 'ess' }), ['demandKW', 'capacityKW', 'storageKWh', 'chargePercent']);
  assert.ok(facilityNumberFields({ asset: 'smart-factory' }).includes('generationKW'));
  assert.ok(facilityNumberFields({ asset: 'pump-station' }).includes('capacityM3h'));
});

test('invalid imported values, duplicate equipment codes and locked edits fail without mutation', () => {
  const city = fixture();
  for (const properties of [null, [], 'text', { name: 5 }, { name: 'a'.repeat(61) }, { notes: 'a'.repeat(501) }, { status: 'unknown' }, { demandKW: -1 }, { generationKW: Infinity }, { capacityKW: NaN }, { chargePercent: 101 }, { storageKWh: '12' }, { flowM3h: -1 }]) {
    assert.throws(() => validateCity({ ...city, objects: [{ ...city.objects[0], properties }] }));
  }
  const configured = updateFacilityProperties(city, 'a', { code: 'SUB-01' });
  assert.throws(() => updateFacilityProperties(configured, 'b', { code: ' sub-01 ' }), /중복/);
  assert.equal(configured.objects[1].properties, undefined);
  assert.throws(() => updateFacilityProperties({ ...configured, objects: configured.objects.map(o => ({ ...o, locked: true })) }, 'a', { name: 'rename' }), /잠긴/);
  assert.throws(() => updateFacilityProperties(city, 'missing', {}), /찾을/);
});

test('all copy paths inherit configuration, clear equipment codes and leave the original unchanged', () => {
  const city = updateFacilityProperties(fixture(), 'a', { name: '주택 A', code: 'H-01', demandKW: 15 });
  const row = planBuildingCopies(city, city.objects[0], 1, 1, 'z+');
  assert.equal(row.problem, null);
  assert.deepEqual(row.copies[0].properties, { name: '주택 A 복사본', demandKW: 15 });
  const group = planGroupTransform(city, ['a', 'b'], 'copy', 0, 12);
  assert.equal(group.problem, null);
  assert.equal(group.objects[0].properties.code, undefined);
  const batch = planBatch(city, ['a', 'b'], 'copy', 0, 12);
  assert.equal(batch.problem, undefined);
  assert.equal(batch.city.objects.find(o => o.id !== 'a' && o.properties?.name === '주택 A 복사본').properties.demandKW, 15);
  validateCity(batch.city);
  const move = planBatch(city, ['a'], 'move', 0, 12);
  assert.equal(move.city.objects.find(o => o.id === 'a').properties.code, 'H-01');
  assert.equal(city.objects[0].properties.code, 'H-01');
});

test('property-only edits keep facility geometry, flow batches and cached shadows intact', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.nodes = []; editor.materials = new Map();
  editor.ring = editor.brushSpokes = { setEnabled() {} };
  editor.terrain = MeshBuilder.CreateGround('terrain', { width: 240, height: 240, subdivisions: 120, updatable: true }, editor.scene);
  editor.terrain.material = editor.material('terrain', '#91ac7b');
  let invalidations = 0;
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {}, getShadowMap: () => ({ resetRefreshCounter() { invalidations++; } }) };
  try {
    const city = fixture();
    city.connections = [{ ...DEFAULT_CONNECTION, id: 'line', from: 'a', to: 'b' }];
    editor.setCity(city);
    const node = editor.nodes.find(item => item.name === 'a');
    const meshes = node.getChildMeshes();
    const flow = editor.flowNodes.get('line');
    const before = invalidations;
    editor.setCity(updateFacilityProperties(city, 'a', { name: '주택 A', demandKW: 25, status: 'fault' }));
    assert.ok(editor.nodes.find(item => item.name === 'a') === node, 'facility meshes must be reused');
    assert.ok(meshes.every(mesh => !mesh.isDisposed()));
    assert.ok(editor.flowNodes.get('line') === flow, 'property edits must not rebuild flow geometry');
    assert.equal(invalidations, before);
    assert.equal(editor.city.objects[0].properties.demandKW, 25);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

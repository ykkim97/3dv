import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createCity } from '../core/cityState.js';
import { validateCity } from '../core/cityValidation.js';
import { CityEngine } from '../rendering/CityEngine.js';
import { cleanConnections, connectionPath, DEFAULT_CONNECTION, FLOW_EFFECTS } from './connectionModel.js';
import { connectionIdFromPick } from './connectionRendering.js';

function fixture() {
  const city = createCity('blank');
  city.objects = [{ id: 'a', asset: 'solar-farm', x: -20, z: 0, rotation: 0 }, { id: 'b', asset: 'ess', x: 20, z: 30, rotation: 0 }];
  city.connections = [{ ...DEFAULT_CONNECTION, id: 'line', from: 'a', to: 'b' }];
  return city;
}

test('connections survive export, reject invalid references and clean up deleted facilities', () => {
  const city = fixture();
  assert.deepEqual(validateCity(JSON.parse(JSON.stringify(city))).connections, city.connections);
  for (const patch of [{ to: 'missing' }, { to: 'a' }, { radius: -1 }, { speed: Infinity }, { direction: 'invalid' }, { color: 'red' }, { effect: 'invalid' }]) {
    assert.throws(() => validateCity({ ...city, connections: [{ ...city.connections[0], ...patch }] }), /연결선/);
  }
  assert.throws(() => validateCity({ ...city, connections: [...city.connections, ...city.connections] }), /연결선/);
  assert.equal(cleanConnections({ ...city, objects: city.objects.slice(0, 1) }).connections.length, 0);
  const legacy = createCity('blank');
  assert.equal(validateCity(legacy), legacy);
});

test('mixed effects batch together, preserve face picking and only rebuild affected batches', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.city = fixture();
  editor.city.connections = Array.from({ length: 65 }, (_, i) => ({ ...DEFAULT_CONNECTION,
    id: `line-${i}`, from: 'a', to: 'b', effect: FLOW_EFFECTS[i % FLOW_EFFECTS.length].id,
    direction: ['forward', 'reverse', 'both'][i % 3], animated: i !== 1,
  }));
  try {
    validateCity(editor.city); editor.updateConnections();
    assert.equal(editor.scene.meshes.length, 3);
    assert.equal(editor.scene.materials.length, 1);
    for (const batch of editor.flowBatches.values()) {
      const mesh = batch.mesh;
      for (const kind of ['position', 'flowColor', 'flowParams', 'flowPhase']) assert.ok(mesh.getVerticesData(kind).every(Number.isFinite));
      for (const range of mesh.metadata.connectionRanges) {
        assert.equal(connectionIdFromPick({ pickedMesh: mesh, faceId: range.start }), range.id);
        assert.equal(connectionIdFromPick({ pickedMesh: mesh, faceId: range.end - 1 }), range.id);
      }
      assert.equal(connectionIdFromPick({ pickedMesh: mesh, faceId: -1 }), undefined);
    }
    const batches = [...editor.flowBatches.values()];
    let updates = 0;
    const setFloat = editor.flowMaterial.setFloat.bind(editor.flowMaterial);
    editor.flowMaterial.setFloat = (...args) => { updates++; return setFloat(...args); };
    editor.tickConnections(0.05);
    assert.equal(updates, 1, 'all styles update one time uniform');
    assert.equal(editor.flowNodes.get('line-1').elapsed, 0);
    const phase = editor.flowNodes.get('line-0').elapsed;
    editor.city.connections[0].animated = false; editor.updateConnections();
    assert.ok(batches[0].mesh.isDisposed());
    assert.equal(editor.flowBatches.get(1), batches[1]);
    editor.tickConnections(0.05);
    assert.equal(editor.flowNodes.get('line-0').elapsed, phase);
    editor.city.connections[0].animated = true; editor.updateConnections(); editor.tickConnections(0.05);
    assert.ok(Math.abs(editor.flowNodes.get('line-0').elapsed - phase - 0.05) < 1e-10);
    delete editor.city.connections[0].effect;
    assert.doesNotThrow(() => validateCity(editor.city), 'old links default to bands');
    editor.city.connections = []; editor.updateConnections();
    assert.equal(editor.scene.meshes.length, 0); assert.equal(editor.scene.materials.length, 0);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('rounded tube rendering is cached, follows moving facilities, hides and restores without leaks', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.city = fixture();
  try {
    const path = connectionPath(editor.city, editor.city.connections[0]);
    assert.equal(path[0].x, -20); assert.equal(path.at(-1).z, 30);
    assert.ok(path.every(p => Object.values(p).every(Number.isFinite)));
    assert.ok(path.length > 3, 'corners are rounded');
    editor.updateConnections();
    const first = editor.flowNodes.get('line');
    assert.ok(first.mesh.getVerticesData('position').every(Number.isFinite));
    assert.equal(connectionIdFromPick({ pickedMesh: first.mesh, faceId: 0 }), 'line');
    editor.updateConnections(); assert.equal(editor.flowNodes.get('line'), first);
    editor.tickConnections(0.05);
    const elapsed = first.elapsed;
    editor.city = structuredClone(editor.city);
    editor.city.connections[0].animated = false;
    editor.updateConnections();
    const paused = editor.flowNodes.get('line');
    editor.tickConnections(0.05); assert.equal(paused.elapsed, elapsed, 'pause retains the flow phase');
    editor.city.objects[1].x = 32;
    editor.updateConnections(); assert.ok(paused.mesh.isDisposed());
    assert.equal(connectionPath(editor.city, editor.city.connections[0]).at(-1).x, 32);
    assert.equal(editor.scene.meshes.length, 1); assert.equal(editor.scene.materials.filter(m => m.name.startsWith('flow-material')).length, 1);
    editor.city.connections[0].visible = false;
    editor.updateConnections(); assert.equal(editor.flowNodes.size, 0); assert.equal(editor.scene.meshes.length, 0);
    editor.city.connections[0].visible = true;
    editor.updateConnections(); assert.equal(editor.flowNodes.size, 1);
    editor.city = cleanConnections({ ...editor.city, objects: [] });
    editor.updateConnections(); assert.equal(editor.scene.meshes.length, 0);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

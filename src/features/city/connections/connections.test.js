import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { createCity } from '../core/cityState.js';
import { validateCity } from '../core/cityValidation.js';
import { CityEngine } from '../rendering/CityEngine.js';
import { cleanConnections, connectionPath, DEFAULT_CONNECTION, FLOW_EFFECTS, editWaypoint } from './connectionModel.js';
import { connectionIdFromPick } from './connectionRendering.js';
import { waypointInteraction, waypointInsertionIndex } from './waypointInteraction.js';

test('clicking the selected tube inserts in segment order; dragging commits once or cancels without edits', () => {
  const original = fixture();
  original.connections[0].waypoints = [{ x: -20, z: 30 }, { x: 0, z: 30 }];
  assert.equal(waypointInsertionIndex(original, original.connections[0], { x: -20, z: 15 }), 0);
  assert.equal(waypointInsertionIndex(original, original.connections[0], { x: 10, z: 30 }), 2);
  const commits = [], camera = [], captures = new Set();
  let pick;
  const editor = { ...waypointInteraction, city: original, options: { mode: 'waypoint' }, waypointConnectionId: 'line',
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) },
    scene: { pick: () => pick }, camera: { detachControl: () => camera.push('detach'), attachControl: () => camera.push('attach') },
    waypointPlanePoint: e => ({ x: e.clientX, z: e.clientY }), updateConnections() {}, showConnectionWaypoints() {},
    onChange: city => commits.push(city), onMessage() {},
  };
  pick = { hit: true, pickedMesh: { metadata: { waypointIndex: 0 }, position: { y: 10 } } };
  editor.beginWaypointPointer({ clientX: -20, clientY: 30, pointerId: 1 });
  editor.updateWaypointPointer({ clientX: -40, clientY: 50, pointerId: 1 });
  assert.equal(commits.length, 0, 'preview does not add undo or autosave entries');
  assert.deepEqual(editor.city.connections[0].waypoints[0], { x: -40, z: 50 });
  assert.deepEqual(original.connections[0].waypoints[0], { x: -20, z: 30 });
  editor.finishWaypointPointer({ pointerId: 1 });
  assert.equal(commits.length, 1); assert.equal(captures.size, 0);
  assert.deepEqual(camera, ['detach', 'attach']);
  const afterDrag = editor.city;
  assert.equal(afterDrag, commits[0], 'release keeps the final preview instead of flashing the original path');
  editor.beginWaypointPointer({ clientX: -40, clientY: 50, pointerId: 2 });
  editor.updateWaypointPointer({ clientX: 500, clientY: 30, pointerId: 2 });
  assert.equal(editor.city, afterDrag, 'outside-map drag keeps the valid state');
  editor.updateWaypointPointer({ clientX: -30, clientY: 40, pointerId: 2 });
  editor.finishWaypointPointer({ pointerId: 2 }, true);
  assert.equal(editor.city, afterDrag); assert.equal(commits.length, 1);
  pick = { hit: false, faceId: 2, pickedPoint: { x: -20, z: 15 }, pickedMesh: { metadata: { connectionRanges: [{ id: 'line', start: 0, end: 10 }] } } };
  editor.beginWaypointPointer({ clientX: 0, clientY: 0, pointerId: 3 });
  assert.deepEqual(commits[1].connections[0].waypoints[0], { x: -20, z: 15 });
});

function fixture() {
  const city = createCity('blank');
  city.objects = [{ id: 'a', asset: 'solar-farm', x: -20, z: 0, rotation: 0 }, { id: 'b', asset: 'ess', x: 20, z: 30, rotation: 0 }];
  city.connections = [{ ...DEFAULT_CONNECTION, id: 'line', from: 'a', to: 'b' }];
  return city;
}

test('waypoint handles reuse meshes and the pointer ray maps to the elevated editing plane', () => {
  const graphics = new NullEngine({ renderWidth: 800, renderHeight: 600 }), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.city = fixture(); editor.materials = new Map();
  editor.city.connections[0].waypoints = [{ x: -20, z: 30 }];
  editor.camera = new ArcRotateCamera('test', -1, 0.8, 100, Vector3.Zero(), editor.scene);
  editor.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  try {
    editor.scene.render(); editor.showConnectionWaypoints('line', -1);
    const marker = editor.waypointMarkers[0];
    assert.equal(marker.isPickable, true); assert.equal(marker.metadata.waypointIndex, 0);
    const screen = Vector3.Project(marker.position, Matrix.Identity(), editor.scene.getTransformMatrix(), editor.camera.viewport.toGlobal(800, 600));
    const point = editor.waypointPlanePoint({ clientX: screen.x, clientY: screen.y }, marker.position.y);
    assert.ok(Math.hypot(point.x - marker.position.x, point.z - marker.position.z) < 0.001);
    editor.city = editWaypoint(editor.city, 'line', 'move', 0, { x: -30, z: 40 });
    editor.showConnectionWaypoints('line', 0);
    assert.equal(editor.waypointMarkers[0], marker); assert.equal(marker.position.x, -30);
    editor.clearConnectionWaypoints(); assert.ok(marker.isDisposed()); assert.equal(editor.waypointConnectionId, null);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('waypoints round-trip, route through terrain, preserve endpoints after facility movement and undo immutably', () => {
  const original = fixture();
  const added = editWaypoint(original, 'line', 'insert', 0, { x: -50, z: 40 });
  const city = editWaypoint(added, 'line', 'insert', 1, { x: 50, z: 40 });
  assert.equal(original.connections[0].waypoints, undefined);
  assert.deepEqual(validateCity(JSON.parse(JSON.stringify(city))).connections, city.connections);
  const path = connectionPath(city, city.connections[0]);
  assert.ok(path.some(p => p.x < -45 && p.z > 35));
  assert.ok(path.some(p => p.x > 45 && p.z > 35));
  const moved = editWaypoint(city, 'line', 'move', 0, { x: -60, z: 40 });
  assert.equal(city.connections[0].waypoints[0].x, -50);
  assert.equal(moved.connections[0].waypoints[0].x, -60);
  const reversed = editWaypoint(city, 'line', 'up', 1);
  assert.equal(reversed.connections[0].waypoints[0].x, 50);
  const shifted = { ...city, objects: city.objects.map(o => ({ ...o, x: o.x + 3 })) };
  assert.equal(connectionPath(shifted, shifted.connections[0])[0].x, -17);
  assert.deepEqual(shifted.connections[0].waypoints, city.connections[0].waypoints);
  assert.equal(editWaypoint(city, 'line', 'remove', 0).connections[0].waypoints.length, 1);
  assert.deepEqual(connectionPath(editWaypoint(city, 'line', 'clear'), original.connections[0]), connectionPath(original, original.connections[0]));
  for (const waypoints of [null, [{ x: NaN, z: 0 }], [{ x: 500, z: 0 }], Array.from({ length: 33 }, () => ({ x: 0, z: 0 }))]) {
    assert.throws(() => validateCity({ ...city, connections: [{ ...city.connections[0], waypoints }] }), /연결선/);
  }
  assert.throws(() => editWaypoint(city, 'line', 'move', 0, { x: 999, z: 0 }), /경유점/);
  const repeated = { ...city.connections[0], waypoints: [{ x: -20, z: 0 }, { x: -20, z: 0 }, { x: 20, z: 30 }] };
  assert.ok(connectionPath(city, repeated).every(p => Object.values(p).every(Number.isFinite)));
});

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
    assert.equal(editor.flowNodes.get('line-0').geometry, batches[0].members[0].geometry, 'animation-only changes reuse tube geometry');
    assert.equal(editor.flowBatches.get(0).mesh, batches[0].mesh, 'style edits preserve the visible mesh');
    assert.equal(batches[0].mesh.isDisposed(), false);
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
    editor.updateConnections(); assert.equal(editor.flowNodes.get('line').mesh, paused.mesh);
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

test('continuous waypoint drag preserves visible mesh, GPU buffers and submeshes without resource growth', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.city = fixture();
  editor.city.connections[0].waypoints = [{ x: -40, z: 40 }];
  try {
    editor.updateConnections();
    const mesh = editor.flowNodes.get('line').mesh, buffer = mesh.getVertexBuffer('position'), submesh = mesh.subMeshes[0];
    const original = [...mesh.getVerticesData('position')];
    for (let i = 0; i < 30; i++) {
      editor.city = editWaypoint(editor.city, 'line', 'move', 0, { x: -40 - i, z: 40 + i });
      editor.updateConnections();
      assert.equal(editor.flowNodes.get('line').mesh, mesh);
      assert.equal(mesh.getVertexBuffer('position'), buffer);
      assert.equal(mesh.subMeshes[0], submesh);
      assert.equal(mesh.isDisposed(), false);
      assert.equal(editor.scene.meshes.length, 1);
    }
    assert.notDeepEqual(mesh.getVerticesData('position'), original);
    assert.ok(mesh.getVerticesData('position').every(Number.isFinite));
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

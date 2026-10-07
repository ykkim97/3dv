import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { selectionFrame } from './frameSelection.js';
import { cameraControls } from './cameraControls.js';
import { createCity } from '../../core/cityState.js';

test('F framing keeps every corner inside the free screen area at different angles and aspect ratios', () => {
  for (const [width, height, alpha, beta] of [[1600, 900, -1, 0.8], [700, 900, 2, 1.2], [1200, 700, 0, 0.03]]) {
    const graphics = new NullEngine({ renderWidth: width, renderHeight: height }), scene = new Scene(graphics);
    const camera = new ArcRotateCamera('fit', alpha, beta, 200, Vector3.Zero(), scene);
    const bounds = { min: new Vector3(20, 3, -40), max: new Vector3(55, 85, -10) };
    const viewport = { width, height, left: 52, right: 380, top: 140, bottom: 200 };
    try {
      const frame = selectionFrame(bounds, camera, viewport);
      camera.setTarget(frame.target); camera.alpha = alpha; camera.beta = beta; camera.radius = frame.radius;
      camera.targetScreenOffset.set(frame.screenOffset.x, frame.screenOffset.y);
      assert.deepEqual(camera.getTarget(), bounds.min.add(bounds.max).scale(0.5));
      const transform = camera.getViewMatrix().multiply(camera.getProjectionMatrix(true));
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const p = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), transform, { x: 0, y: 0, width, height });
        assert.ok(p.x >= viewport.left && p.x <= width - viewport.right, `x ${p.x} must fit`);
        assert.ok(p.y >= viewport.top && p.y <= height - viewport.bottom, `y ${p.y} must fit`);
      }
    } finally { scene.dispose(); graphics.dispose(); }
  }
});

test('framing uses roof bounds, supports a group and clears camera inertia without changing direction', () => {
  const graphics = new NullEngine(), scene = new Scene(graphics);
  const editor = { ...cameraControls, scene, city: createCity('blank'), camera: new ArcRotateCamera('fit', -1, 0.8, 205, Vector3.Zero(), scene), nodes: [{ name: 'tower', getHierarchyBoundingVectors: () => ({ min: new Vector3(-8, 2, -5), max: new Vector3(8, 90, 5) }) }] };
  editor.city.objects = [{ id: 'tower', asset: 'house', x: 0, z: 0, rotation: 0 }, { id: 'home', asset: 'house', x: 60, z: 10, rotation: Math.PI / 4 }];
  try {
    editor.camera.inertialRadiusOffset = 10;
    const viewport = { width: 1400, height: 900, right: 380, top: 140, bottom: 200 };
    assert.equal(editor.frameEntities(['tower'], viewport), true);
    assert.equal(editor.camera.target.y, 46);
    assert.equal(editor.camera.alpha, -1);
    assert.equal(editor.camera.beta, 0.8);
    assert.equal(editor.camera.inertialRadiusOffset, 0);
    const pivot = new Vector3(0, 46, 0);
    assert.deepEqual(editor.camera.getTarget(), pivot);
    editor.camera.alpha += 0.7;
    editor.camera.beta += 0.2;
    editor.camera.getViewMatrix(true);
    assert.deepEqual(editor.camera.getTarget(), pivot);
    assert.ok(Math.abs(Vector3.Distance(editor.camera.position, pivot) - editor.camera.radius) < 1e-6);
    const focused = editor.cameraState();
    editor.view('home');
    assert.equal(editor.camera.targetScreenOffset.length(), 0);
    editor.restoreCamera(focused);
    assert.deepEqual(editor.cameraState(), focused);
    const singleRadius = editor.camera.radius;
    assert.equal(editor.frameEntities(['tower', 'home'], viewport), true);
    assert.ok(editor.camera.radius >= singleRadius);
    const state = editor.cameraState();
    assert.equal(editor.frameEntities(['missing'], viewport), false);
    assert.deepEqual(editor.cameraState(), state);
  } finally { scene.dispose(); graphics.dispose(); }
});

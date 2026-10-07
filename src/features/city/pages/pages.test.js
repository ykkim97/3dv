import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { createCity } from '../core/cityState.js';
import { validateCity } from '../core/cityValidation.js';
import { objectBaseHeight } from '../plots/plotModel.js';
import { CityEngine } from '../rendering/CityEngine.js';
import { createSceneProject, validateSceneProject, removePage } from './projectModel.js';
import { portalAnchor, portalPosition, cleanPortals } from './portalModel.js';
import { portalRendering } from './portalRendering.js';
import { createSceneProjectStore } from './sceneProjectStore.js';
import { waitForRenderedScene } from './sceneReadiness.js';
import { capturePageThumbnail, isPageThumbnail } from './pageThumbnail.js';

test('thumbnail capture fits the current frame without cropping or starting another renderer', () => {
  const calls = [], source = { width: 1000, height: 1000 };
  const context = { fillRect: (...args) => calls.push(args), drawImage: (...args) => calls.push(args) };
  const canvas = { getContext: () => context, toDataURL: () => 'data:image/jpeg;base64,YWJj' };
  assert.equal(capturePageThumbnail(source, () => canvas), 'data:image/jpeg;base64,YWJj');
  assert.deepEqual([canvas.width, canvas.height], [320, 180]);
  assert.deepEqual(calls[1], [source, 70, 0, 180, 180]);
  assert.equal(capturePageThumbnail(null), undefined);
  assert.equal(capturePageThumbnail(source, () => { throw new Error('No canvas'); }), undefined);
});

test('project thumbnails round-trip while remote, executable and oversized images are rejected', () => {
  const project = fixture(); project.pages[0].thumbnail = 'data:image/jpeg;base64,YWJj';
  assert.equal(validateSceneProject(JSON.parse(JSON.stringify(project))).pages[0].thumbnail, project.pages[0].thumbnail);
  for (const invalid of ['https://example.com/image.png', 'data:image/svg+xml;base64,YWJj', 'data:image/png;base64,' + 'a'.repeat(180000)]) {
    assert.equal(isPageThumbnail(invalid), false);
    project.pages[0].thumbnail = invalid;
    assert.throws(() => validateSceneProject(project));
  }
});

test('portal hover anchors to the mesh, hides when occluded or blocked, and reuses geometry', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const camera = new ArcRotateCamera('camera', -.8, 1, 30, Vector3.Zero(), scene);
  const runtime = { city: fixture().pages[0].city, scene, camera, options: { mode: 'select' }, portalHoverEnabled: true,
    canvas: { getBoundingClientRect: () => ({ left: 20, top: 30, width: 800, height: 600 }) }, onPortalHover: value => { runtime.popup = value; } };
  Object.assign(runtime, portalRendering); runtime.updatePortals(); scene.render();
  const mesh = runtime.portalMeshes.get('portal'), count = scene.meshes.length;
  scene.pick = (x, y, predicate) => { assert.equal(predicate(mesh), true); return { pickedMesh: mesh }; };
  runtime.updatePortalHover({ clientX: 300, clientY: 200 });
  assert.equal(runtime.popup.id, 'portal'); assert.ok(Number.isFinite(runtime.popup.x)); assert.ok(Number.isFinite(runtime.popup.y));
  assert.equal(mesh.renderOverlay, true);
  runtime.refreshPortalHover(); assert.equal(scene.meshes.length, count);
  scene.pick = () => ({ pickedMesh: { metadata: { objectId: 'home' } } });
  runtime.updatePortalHover({ clientX: 300, clientY: 200 }); assert.equal(runtime.popup, null); assert.equal(mesh.renderOverlay, false);
  scene.pick = () => ({ pickedMesh: mesh }); runtime.updatePortalHover({ clientX: 300, clientY: 200 });
  runtime.portalHoverEnabled = false; runtime.refreshPortalHover(); assert.equal(runtime.popup, null);
  scene.dispose(); engine.dispose();
});

function fixture() {
  const city = createCity('blank');
  city.objects.push({ id: 'home', asset: 'house', x: 0, z: 0, rotation: 0 });
  const project = createSceneProject(city);
  project.pages.push({ id: 'second', type: '3d', name: 'Second', city: createCity('blank') }, { id: 'dashboard', type: '2d', name: 'Dashboard' });
  city.portals = [{ id: 'portal', name: 'Portal', targetPageId: 'second', ...portalAnchor(city, { x: 2, y: 5, z: 1 }, 'home') }];
  return project;
}
test('independent cities, 2D pages, camera and portal links round-trip together', () => {
  const project = fixture();
  project.pages[0].camera = { alpha: 1, beta: .8, radius: 10, target: { x: 1, y: 2, z: 3 }, screenOffset: { x: 0, y: 1 } };
  const restored = validateSceneProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(restored, project);
  restored.pages[1].city.heights[0] = 20;
  assert.notEqual(restored.pages[0].city.heights[0], 20);
});
test('missing destinations, duplicate pages, invalid camera and malformed points fail validation', () => {
  const original = fixture();
  for (const mutate of [p => { p.pages[0].city.portals[0].targetPageId = 'missing'; }, p => { p.pages[0].city.portals[0].targetPageId = p.pages[0].id; }, p => { p.pages[1].id = p.pages[0].id; }, p => { p.pages[0].city.portals[0].position.y = NaN; }, p => { p.pages[0].city.portals[0].objectId = 'missing'; }, p => { p.pages[0].camera = { alpha: 0, beta: 0, radius: -1 }; }]) {
    const project = structuredClone(original); mutate(project); assert.throws(() => validateSceneProject(project));
  }
});
test('attached points follow translation, rotation and elevation; free points stay fixed', () => {
  const city = fixture().pages[0].city, portal = city.portals[0], before = portalPosition(city, portal);
  assert.deepEqual(before, { x: 2, y: 6.5, z: 1 });
  city.objects[0] = { ...city.objects[0], x: 10, z: 20, rotation: Math.PI / 2 };
  const after = portalPosition(city, portal);
  assert.ok(Math.abs(after.x - 11) < 1e-9); assert.ok(Math.abs(after.z - 18) < 1e-9);
  assert.equal(after.y, objectBaseHeight(city, city.objects[0]) + portal.offset.y);
  const free = { ...portal, ...portalAnchor(city, { x: 0, y: 1, z: 0 }), objectId: undefined };
  assert.deepEqual(portalPosition(city, free), free.position);
});
test('deleted buildings clean their points without mutating undo history', () => {
  const city = fixture().pages[0].city;
  const next = cleanPortals({ ...city, objects: [] });
  assert.equal(next.portals.length, 0); assert.equal(city.portals.length, 1); validateCity(next);
});
test('page deletion removes incoming links and cannot remove current or last page', () => {
  const project = fixture(), next = removePage(project, 'second');
  assert.equal(next.pages.length, 2); assert.equal(next.pages[0].city.portals.length, 0); validateSceneProject(next);
  assert.equal(project.pages[0].city.portals.length, 1);
  assert.throws(() => removePage(project, project.activePageId));
  assert.throws(() => removePage(createSceneProject(createCity('blank')), 'missing'));
});
test('portal rendering reuses meshes/material and releases removed points', () => {
  const engine = new NullEngine(), scene = new Scene(engine), city = fixture().pages[0].city;
  const runtime = { city, scene, ...portalRendering };
  try {
    runtime.updatePortals(); const mesh = runtime.portalMeshes.get('portal'), materialCount = scene.materials.length;
    for (let i = 0; i < 20; i++) { city.objects[0].x = i; runtime.updatePortals(); assert.equal(runtime.portalMeshes.get('portal'), mesh); }
    assert.equal(scene.meshes.length, 1); assert.equal(scene.materials.length, materialCount);
    assert.equal(mesh.metadata.portalId, 'portal');
    city.portals = []; runtime.updatePortals(); assert.equal(scene.meshes.length, 0); assert.equal(mesh.isDisposed(), true);
  } finally { scene.dispose(); engine.dispose(); }
});
test('scene disposal stops rendering before releasing scene and is safe to call twice', () => {
  const events = [], runtime = {
    engine: { stopRenderLoop: () => events.push('stop'), dispose: () => events.push('engine') },
    scene: { dispose: () => events.push('scene') }, camera: { detachControl: () => events.push('camera') },
    resize: { disconnect: () => events.push('resize') }, handlers: { pointerdown: () => {} }, canvas: { removeEventListener: () => events.push('input') },
    finishWaypointPointer() {}, setPerformanceMonitoring() {}, clearServiceBadges() {}, cancelBoxSelection() {},
  };
  CityEngine.prototype.dispose.call(runtime); CityEngine.prototype.dispose.call(runtime);
  assert.deepEqual(events, ['stop', 'camera', 'resize', 'input', 'scene', 'engine']); assert.equal(runtime.renderPaused, true);
});
test('unavailable storage and invalid projects report failure without replacing recovery data', async () => {
  const store = createSceneProjectStore(null);
  await assert.rejects(store.load(), /자동 저장소/);
  await assert.rejects(store.save({ version: 999 }), /지원하지/);
});
test('loading waits for readiness and a rendered frame; cancelled/disposed scenes cannot complete a new transition', () => {
  let ready, rendered, removed = 0, completed = 0;
  const instance = { scene: { executeWhenReady: callback => { ready = callback; }, onAfterRenderObservable: { addOnce: callback => { rendered = callback; return callback; }, remove: () => { removed++; } } } };
  const cancel = waitForRenderedScene(instance, () => completed++);
  assert.equal(completed, 0); ready(); assert.equal(completed, 0); rendered(); assert.equal(completed, 1);
  cancel(); rendered(); assert.equal(completed, 1); assert.equal(removed, 1);
  const cancelBeforeReady = waitForRenderedScene(instance, () => completed++); cancelBeforeReady(); ready(); assert.equal(completed, 1);
  waitForRenderedScene(instance, () => completed++); instance.disposed = true; ready(); assert.equal(completed, 1);
});

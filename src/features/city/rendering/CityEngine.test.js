import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { CityEngine } from './CityEngine.js';
import { ASSETS, CATEGORIES } from '../presets/catalog.js';
import { createCity } from '../core/cityState.js';
import { terrainHeight } from '../terrain/terrainModel.js';
import { PLOT_ELEVATION, PLOT_SURFACES } from '../plots/plotModel.js';
import { placementProblem } from '../placement/placementRules.js';
import { validateCity } from '../core/cityValidation.js';
import { createCurbStone } from '../plots/plotGeometry.js';

test('facilities instance shared presets and refresh frozen transforms after terrain edits', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.city = createCity('blank');
  editor.nodes = []; editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.terrain = MeshBuilder.CreateGround('ground', { width: 240, height: 240, subdivisions: 120, updatable: true }, editor.scene);
  editor.terrain.material = editor.material('terrain-test', '#91ac7b');
  try {
    const records = Array.from({ length: 100 }, (_, i) => ({ id: `solar-${i}`, asset: 'solar-farm', x: i, z: 0, rotation: 0 }));
    editor.city.objects = records;
    const roots = records.map(object => editor.buildObject(object));
    const sources = editor.propTemplates.get('solar-farm');
    assert.ok(sources.length < 10);
    for (const root of roots) for (const mesh of root.getChildMeshes()) {
      assert.ok(sources.includes(mesh.sourceMesh));
      assert.equal(mesh.metadata.objectId, root.name);
    }
    const preview = editor.buildObject({ ...records[0], id: '__placement-preview' });
    assert.ok(preview.getChildMeshes().every(mesh => !mesh.sourceMesh));
    preview.position.x = -50;
    assert.equal(preview.getChildMeshes()[0].computeWorldMatrix(true).getTranslation().x, -50);
    preview.dispose(); editor.nodes = editor.nodes.filter(root => !root.isDisposed());
    const mesh = roots[1].getChildMeshes()[0], before = mesh.getWorldMatrix().getTranslation().y;
    editor.city.heights.fill(5); editor.updateTerrain();
    assert.ok(Math.abs(mesh.getWorldMatrix().getTranslation().y - before - 3.5) < 1e-6);
    roots[0].dispose();
    assert.ok(sources.every(source => !source.isDisposed()));
    assert.ok(!roots[1].getChildMeshes()[0].sourceMesh.isDisposed());
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('curbstones face outward and site edit handles only appear when selected', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  try {
    const stone = createCurbStone(editor.scene, 2, 0.26, 0.18);
    const normals = stone.getVerticesData('normal');
    assert.equal(normals.at(-2), 1, 'top receives light from above');
    assert.equal(normals[2], -1, 'front faces outward');
    const plot = { id: 'site', x: 0, z: 0, width: 24, depth: 12, surface: 'grass' };
    editor.city.plots.push(plot);
    editor.buildPlot(plot);
    const meshes = editor.nodes[0].getChildMeshes();
    const handles = meshes.filter(mesh => mesh.name === 'plot-corner');
    assert.ok(handles.every(mesh => !mesh.isEnabled()));
    editor.select('site');
    assert.ok(handles.every(mesh => mesh.isEnabled()));
    assert.equal(editor.selectionFrames.length, 1);
    assert.equal(editor.selectionFrames[0].material.emissiveColor.toHexString(), '#61FF83');
    assert.equal(editor.selectionFrames[0].isPickable, false);
    editor.selectionFrames[0].computeWorldMatrix(true);
    const siteBounds = editor.selectionFrames[0].getBoundingInfo().boundingBox;
    assert.ok(siteBounds.maximumWorld.x - siteBounds.minimumWorld.x > plot.width);
    assert.ok(siteBounds.maximumWorld.z - siteBounds.minimumWorld.z > plot.depth);
    editor.select(null);
    assert.ok(handles.every(mesh => !mesh.isEnabled()));
    assert.equal(editor.selectionFrames.length, 0);
    editor.setInfoVisible(true);
    assert.ok(meshes.find(mesh => mesh.name === 'plot-boundary').isEnabled(), 'disconnected overlay remains available');
    const material = meshes.find(mesh => mesh.name === 'plot').material;
    editor.buildPlot({ ...plot, id: 'second', x: 30 });
    assert.equal(editor.nodes[1].getChildMeshes().find(mesh => mesh.name === 'plot').material, material, 'same finishes share textures');
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('selected roads receive a visible bounds frame', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  try {
    const road = { id: 'road-1', type: 'street', a: { x: -10, z: 0 }, b: { x: 10, z: 0 } };
    editor.city.roads.push(road);
    editor.buildRoad(road);
    editor.select(road.id);
    assert.equal(editor.selectionFrames.length, 1);
    assert.equal(editor.selectionFrames[0].isPickable, false);
    editor.select(null);
    assert.equal(editor.selectionFrames.length, 0);
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('road preview uses real paving width and endpoint edits commit once or reject overlap', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.city = createCity('blank'); editor.city.plots = [];
  editor.nodes = []; editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.canvas = { setPointerCapture() {}, hasPointerCapture() { return false; } };
  const commits = []; editor.onChange = city => commits.push(city); editor.onSelect = () => {}; editor.onMessage = () => {};
  const road = { id: 'road', type: 'avenue', a: { x: 0, z: 0 }, b: { x: 20, z: 0 } };
  editor.city.roads = [road];
  try {
    editor.showRoadPreview(road, null);
    assert.ok(editor.roadPreview.getChildMeshes().some(mesh => mesh.name === 'road-asphalt'));
    assert.ok(editor.roadPreview.getChildMeshes().some(mesh => mesh.name === 'road-lane'));
    assert.ok(editor.roadPreview.getChildMeshes().every(mesh => !mesh.isPickable));
    const paving = editor.roadPreview.getChildMeshes().find(mesh => mesh.name === 'road-asphalt');
    assert.equal(paving.getBoundingInfo().boundingBox.extendSize.z * 2, 7);
    const normals = paving.getVerticesData('normal');
    for (let i = 0; i < normals.length / 3; i++) if (i % 4 < 2) assert.ok(normals[i * 3 + 1] > 0, 'paving top receives light from above');
    editor.buildRoad(road); editor.select('road');
    assert.equal(editor.nodes[0].getChildMeshes().filter(mesh => mesh.name === 'road-endpoint' && mesh.isEnabled()).length, 2);
    editor.beginRoadEdit('road', 'b', { pointerId: 1 });
    editor.updateRoadEdit({ x: 30, z: 10 }, { clientX: 0, clientY: 0 });
    editor.finishRoadEdit({ pointerId: 1 });
    assert.equal(commits.length, 1);
    assert.deepEqual(commits[0].roads[0].b, { x: 30, z: 10 });
    editor.city.plots = [{ id: 'blocked', x: 40, z: 0, width: 12, depth: 12 }];
    editor.beginRoadEdit('road', 'b', { pointerId: 1 });
    editor.updateRoadEdit({ x: 50, z: 0 }, { clientX: 0, clientY: 0 });
    editor.finishRoadEdit({ pointerId: 1 });
    assert.equal(commits.length, 1);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('road placement never creates plots or levels terrain, even with an old autoPlots option', () => {
  const editor = Object.create(CityEngine.prototype);
  editor.city = createCity('blank');
  editor.options = { road: 'street', autoPlots: true };
  editor.roadStart = { x: -40, z: 0 };
  const original = structuredClone(editor.city), commits = [];
  editor.onChange = city => commits.push(city); editor.onMessage = () => {};
  assert.equal(editor.placeRoad({ x: 40, z: 0 }), true);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].roads.length, 1);
  assert.deepEqual(commits[0].plots, original.plots);
  assert.deepEqual(commits[0].heights, original.heights);
  editor.roadStart = { x: -40, z: 0 };
  assert.equal(editor.placeRoad({ x: 40, z: 0 }), false, 'duplicate road is rejected');
  assert.equal(commits.length, 1);
});

test('junction surfaces and neighboring roads refresh on add, resize and removal', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.nodes = []; editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.ring = editor.brushSpokes = { setEnabled() {} };
  for (const method of ['updateTerrain', 'updateGrid', 'updateWater', 'refreshInfoOverlay', 'updateServiceGuides']) editor[method] = () => {};
  const city = createCity('blank');
  city.roads = [{ id: 'main', type: 'street', a: { x: -20, z: 0 }, b: { x: 20, z: 0 } }];
  try {
    editor.setCity(city);
    const main = editor.nodes[0], next = structuredClone(city);
    next.roads.push({ id: 'branch', type: 'street', a: { x: 0, z: 0 }, b: { x: 0, z: 20 } });
    editor.setCity(next);
    assert.ok(main.isDisposed(), 'existing road markings must be rebuilt around new intersections');
    const surface = editor.junctions.find(mesh => mesh.name === 'road-junction');
    assert.ok(surface);
    assert.equal(surface.material, editor.roadMaterial('street'));
    assert.equal(surface.metadata.roadId, 'main');
    assert.ok(surface.getVerticesData('normal').filter((_, i) => i % 3 === 1).every(y => y > 0.99));
    const resized = structuredClone(next); resized.roads[1].type = 'avenue';
    editor.setCity(resized);
    assert.ok(surface.isDisposed());
    assert.equal(editor.roadConnections[0].width, 7);
    const removed = structuredClone(resized); removed.roads.pop();
    editor.setCity(removed);
    assert.equal(editor.junctions.length, 0);
    assert.equal(editor.nodes.length, 1);
    editor.showRoadPreview({ id: 'preview', type: 'street', a: { x: 0, z: 0 }, b: { x: 0, z: 20 } });
    assert.ok(editor.roadPreview.getChildMeshes().some(mesh => mesh.name === 'road-junction'));
    assert.ok(editor.roadPreview.getChildMeshes().every(mesh => !mesh.isPickable));
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('curved roads commit as one edit and continuous placement resumes after the scene refresh', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.nodes = []; editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.ring = editor.brushSpokes = { setEnabled() {} };
  for (const method of ['updateTerrain', 'updateGrid', 'updateWater', 'refreshInfoOverlay', 'updateServiceGuides']) editor[method] = () => {};
  editor.options = { mode: 'road', road: 'street', roadShape: 'curve', roadContinuous: true };
  editor.onMessage = () => {};
  const commits = []; editor.onChange = city => commits.push(city);
  try {
    editor.setCity(createCity('blank'));
    editor.roadStart = { x: -20, z: 0 }; editor.roadEnd = { x: 20, z: 0 };
    assert.equal(editor.showRoadDraft({ x: 0, z: 25 }).problem, null);
    assert.ok(editor.roadPreview.getChildMeshes().length > 5);
    assert.equal(editor.placeRoad({ x: 0, z: 25 }), true);
    assert.equal(commits.length, 1);
    assert.ok(commits[0].roads.length > 5);
    editor.setCity(commits[0]);
    assert.deepEqual(editor.roadStart, { x: 20, z: 0 });
    assert.equal(editor.roadEnd, null);
    assert.equal(editor.city.plots.length, 0);
    assert.ok(editor.nodes.every(node => node.getChildMeshes().every(mesh => !mesh.material?.diffuseTexture || mesh.getVerticesData('uv'))));
    const target = editor.city.roads[0]; target.locked = true;
    editor.canvas = { setPointerCapture() { throw new Error('locked editing must not capture'); } };
    editor.beginRoadEdit(target.id, 'a', { pointerId: 1 });
    assert.ok(!editor.roadEdit);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('marquee selection projects building, plot and road centers into the same screen rectangle', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.camera = new ArcRotateCamera('camera', -Math.PI / 2, 0.8, 80, Vector3.Zero(), editor.scene);
  editor.city = createCity('blank');
  editor.city.plots = [{ id: 'site', x: 0, z: 0, width: 12, depth: 12 }];
  editor.city.objects = [{ id: 'building', asset: 'house', x: 0, z: 0, rotation: 0 }, { id: 'outside', asset: 'house', x: 90, z: 0, rotation: 0 }];
  editor.city.roads = [{ id: 'road', type: 'street', a: { x: -10, z: 0 }, b: { x: 10, z: 0 } }];
  const rect = { left: 100, top: 50, width: 800, height: 600 };
  editor.canvas = { getBoundingClientRect: () => rect, hasPointerCapture: () => false };
  let selection; editor.onSelect = ids => { selection = ids; }; editor.onMessage = () => {};
  try {
    editor.scene.render();
    const point = Vector3.Project(new Vector3(0, 1.9, 0), Matrix.Identity(), editor.scene.getTransformMatrix(), editor.camera.viewport.toGlobal(rect.width, rect.height));
    editor.boxSelection = { x: rect.left + point.x - 10, y: rect.top + point.y - 10 };
    editor.finishBoxSelection({ clientX: rect.left + point.x + 10, clientY: rect.top + point.y + 10, pointerId: 1 });
    assert.deepEqual(new Set(selection), new Set(['building', 'site', 'road']));
    assert.equal(editor.boxSelection, null);
    editor.city.districts = [{ id: 'district', name: '주거 단지', color: '#78c99e', plotIds: ['site'] }];
    editor.updateDistricts();
    assert.equal(editor.districtMeshes.length, 1);
    assert.equal(editor.districtMeshes[0].color.toHexString(), '#78C99E');
    assert.equal(editor.districtMeshes[0].isPickable, false);
    editor.city.plots = []; editor.updateDistricts();
    assert.equal(editor.districtMeshes.length, 0);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('camera bookmarks round-trip and image capture restores all editor guides on success and failure', async () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.camera = new ArcRotateCamera('camera', -1, 0.8, 80, new Vector3(12, 3, -8), editor.scene);
  editor.grid = MeshBuilder.CreateGround('grid', { width: 10, height: 10 }, editor.scene);
  editor.grid.renderOverlay = true;
  try {
    const state = editor.cameraState();
    editor.camera.radius = 120; editor.camera.setTarget(Vector3.Zero());
    editor.restoreCamera(state);
    assert.deepEqual(editor.cameraState(), state);
    const city = createCity('blank'); city.cameraViews = [{ ...state, id: 'view', name: '전경' }];
    assert.equal(validateCity(JSON.parse(JSON.stringify(city))).cameraViews[0].radius, 80);
    editor.canvas = { toBlob(callback, type) { assert.equal(type, 'image/png'); assert.equal(editor.grid.isEnabled(), false); assert.equal(editor.grid.renderOverlay, false); callback(new Blob(['png'])); } };
    assert.ok(await editor.captureImage());
    assert.equal(editor.grid.isEnabled(), true);
    assert.equal(editor.grid.renderOverlay, true);
    editor.canvas.toBlob = callback => callback(null);
    await assert.rejects(editor.captureImage(), /이미지/);
    assert.equal(editor.grid.isEnabled(), true);
    assert.equal(editor.grid.renderOverlay, true);
    assert.throws(() => validateCity({ ...city, cameraViews: [{ ...city.cameraViews[0], radius: -10 }] }), /카메라/);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('utility range guides follow selection and information visibility', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  try {
    const plant = { id: 'plant', asset: 'power-plant', x: 0, z: 0, rotation: 0 };
    const relay = { id: 'relay', asset: 'distribution', x: 90, z: 0, rotation: 0 };
    editor.city.objects.push(plant, relay);
    editor.buildObject(plant);
    editor.buildObject(relay);
    editor.select('plant');
    assert.equal(editor.serviceGuides.length, 3, 'selected producer shows its location, range outline and fill');
    const fill = editor.serviceGuides.find(guide => guide.name === 'service-range-fill');
    assert.equal(fill.material.alpha, 0.16);
    assert.equal(fill.material.emissiveColor.toHexString(), '#F3D27A');
    assert.ok(fill.getVerticesData('position').every(Number.isFinite));
    assert.ok(editor.serviceGuides.every(guide => !guide.isPickable));
    editor.select(null);
    assert.equal(editor.serviceGuides.length, 0, 'deselecting removes the range');
    editor.setInfoVisible(true);
    assert.equal(editor.serviceGuides.length, 3, 'information view also marks the disconnected relay');
    editor.setInfoVisible(false);
    assert.equal(editor.serviceGuides.length, 0);
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('fire road guides follow station selection and information visibility', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  try {
    editor.city.plots = [
      { id: 'fire-site', x: 0, z: 0, width: 24, depth: 24 },
      { id: 'home-site', x: 40, z: 0, width: 12, depth: 12 },
    ];
    editor.city.roads = [{ id: 'street', type: 'street', a: { x: -10, z: -10 }, b: { x: 55, z: -10 } }];
    const station = { id: 'station', asset: 'fire-station', x: 0, z: 0, rotation: 0 };
    const home = { id: 'home', asset: 'house', x: 40, z: 0, rotation: 0 };
    editor.city.objects.push(station, home);
    editor.buildObject(station);
    editor.buildObject(home);
    editor.select('station');
    assert.deepEqual(editor.serviceGuides.map(guide => guide.name), ['fire-station-access', 'fire-response-roads']);
    assert.ok(editor.serviceGuides.every(guide => !guide.isPickable));
    editor.select(null);
    assert.equal(editor.serviceGuides.length, 0);
    editor.setInfoVisible(true);
    assert.deepEqual(editor.serviceGuides.map(guide => guide.name), ['fire-station-access', 'fire-response-roads']);
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('camera focuses facilities and map navigation preserves zoom and clamps to the city', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.camera = new ArcRotateCamera('focus-camera', -1, 0.8, 205, Vector3.Zero(), editor.scene);
  try {
    editor.city.objects = [{ id: 'home', asset: 'house', x: 40, z: -30, rotation: 0 }];
    editor.focusEntity('home');
    assert.equal(editor.camera.target.x, 40);
    assert.equal(editor.camera.target.z, -30);
    assert.equal(editor.camera.radius, 38);
    editor.focusPoint(500, -500);
    assert.equal(editor.camera.target.x, 120);
    assert.equal(editor.camera.target.z, -120);
    assert.equal(editor.camera.radius, 38);
    editor.focusEntity('missing');
    assert.equal(editor.camera.target.x, 120);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('map layer filters cover utility and living-service guides together', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.nodes = [];
  editor.city.objects = [
    { id: 'plant', asset: 'power-plant', x: 0, z: 0, rotation: 0 },
    { id: 'school', asset: 'school', x: 30, z: 0, rotation: 0 },
  ];
  try {
    editor.setInfoVisible(true);
    assert.ok(editor.serviceGuides.some(guide => guide.name === 'school-range'));
    assert.ok(editor.serviceGuides.some(guide => guide.name === 'service-range'));
    editor.setMapLayers({ power: false, school: false });
    assert.equal(editor.serviceGuides.length, 0);
    editor.selectedId = 'school';
    editor.setInfoVisible(false);
    assert.deepEqual(editor.serviceGuides.map(guide => guide.name), ['school-range'], 'selection shows its guide independently of the information filters');
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('power and water presets build distinct pickable facilities on valid plots', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  const utilities = ASSETS.filter(asset => ['power', 'water'].includes(asset.category));
  try {
    assert.deepEqual(CATEGORIES.filter(category => ['power', 'water'].includes(category.id)).map(category => category.name), ['전력시설', '수도시설']);
    assert.equal(utilities.length, 14);
    for (const asset of utilities) {
      editor.city = createCity('blank');
      editor.city.plots.push({ id: 'utility-site', x: 0, z: 0, width: Math.max(24, asset.width + 2), depth: Math.max(24, asset.depth + 2) });
      assert.equal(placementProblem(editor.city, asset.id, 0, 0), null, `${asset.name} fits on a plot`);
      assert.match(placementProblem(editor.city, asset.id, 40, 40), /부지/, `${asset.name} needs a plot`);
      const object = { id: asset.id, asset: asset.id, x: 0, z: 0, rotation: 0 };
      editor.city.objects.push(object);
      const root = editor.buildObject(object);
      const parts = root.getChildMeshes();
      assert.ok(parts.length >= 3, `${asset.name} has recognizable 3D parts`);
      assert.ok(parts.every(mesh => mesh.metadata?.objectId === object.id), `${asset.name} can be selected`);
      for (const mesh of parts) {
        mesh.computeWorldMatrix(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        const extentX = Math.max(Math.abs(bounds.minimumWorld.x), Math.abs(bounds.maximumWorld.x));
        const extentZ = Math.max(Math.abs(bounds.minimumWorld.z), Math.abs(bounds.maximumWorld.z));
        assert.ok(extentX <= asset.width / 2 + 0.251, `${asset.name} width extent ${extentX.toFixed(2)} m`);
        assert.ok(extentZ <= asset.depth / 2 + 0.251, `${asset.name} depth extent ${extentZ.toFixed(2)} m`);
      }
      assert.equal(validateCity(structuredClone(editor.city)).objects[0].asset, asset.id);
      root.dispose();
      editor.nodes = [];
    }
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('first expansion presets render, preview and remain within their placement footprints', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  const newIds = ['townhouses', 'cafe', 'fire-station', 'wind-turbine', 'transmission-tower', 'intake-station', 'water-tower', 'playground'];
  try {
    for (const id of newIds) {
      const asset = ASSETS.find(item => item.id === id);
      assert.ok(asset, `${id} is listed in the library`);
      editor.city = createCity('blank');
      editor.city.plots.push({ id: 'site', x: 0, z: 0, width: 24, depth: 24 });
      assert.equal(placementProblem(editor.city, id, 0, 0), null, `${id} fits on a plot`);
      assert.match(placementProblem(editor.city, id, 40, 40), /부지/, `${id} requires a plot`);
      const object = { id: `placed-${id}`, asset: id, x: 0, z: 0, rotation: 0 };
      editor.city.objects.push(object);
      const root = editor.buildObject(object);
      const parts = root.getChildMeshes();
      assert.ok(parts.length >= 3, `${id} has distinct model parts`);
      assert.ok(parts.every(mesh => mesh.metadata?.objectId === object.id), `${id} is selectable`);
      for (const mesh of parts) {
        mesh.computeWorldMatrix(true);
        const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox;
        const extentX = Math.max(Math.abs(minimumWorld.x), Math.abs(maximumWorld.x));
        const extentZ = Math.max(Math.abs(minimumWorld.z), Math.abs(maximumWorld.z));
        assert.ok(extentX <= asset.width / 2 + 0.251, `${id} width extent ${extentX.toFixed(2)} m`);
        assert.ok(extentZ <= asset.depth / 2 + 0.251, `${id} depth extent ${extentZ.toFixed(2)} m`);
      }
      assert.equal(validateCity(structuredClone(editor.city)).objects[0].asset, id);
      editor.createPlacementPreview(id);
      assert.ok(editor.preview.getChildMeshes().every(mesh => !mesh.isPickable && mesh.material.alpha < 1), `${id} previews without blocking placement`);
      editor.preview.dispose(false, true);
      editor.preview = null;
      root.dispose();
      editor.nodes = [];
    }
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('opaque raised sites cover the grid and support buildings at their top surface', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  try {
    for (const [index, surface] of PLOT_SURFACES.entries()) {
      const plot = { id: `plot-${index}`, x: index * 24 - 36, z: 0, width: 20, depth: 20, surface: surface.id };
      editor.city.plots.push(plot);
      editor.buildPlot(plot);
      const top = editor.nodes.at(-1).getChildMeshes().find(mesh => mesh.name === 'plot');
      const ground = terrainHeight(editor.city.heights, plot.x, plot.z);
      assert.equal(top.material.alpha, 1);
      assert.ok(top.material.diffuseTexture, 'surface has a tiled material texture');
      assert.ok(top.material.bumpTexture, 'surface has normal detail');
      assert.equal(Math.max(...top.getVerticesData('uv')), plot.width / 8, 'texture scale stays in world meters');
      assert.ok(top.position.y > ground + 0.09, 'surface occludes construction grid');
      assert.equal(top.position.y, ground + PLOT_ELEVATION);
      const object = { id: `house-${index}`, asset: 'house', x: plot.x, z: 0, rotation: 0 };
      editor.city.objects.push(object);
      const building = editor.buildObject(object);
      assert.equal(building.position.y, top.position.y);
      editor.updateGrid();
      assert.equal(building.position.y, top.position.y);
    }
    const restored = validateCity(JSON.parse(JSON.stringify(editor.city)));
    assert.deepEqual(restored.plots.map(plot => plot.surface), PLOT_SURFACES.map(surface => surface.id));
    delete restored.plots[0].surface;
    assert.doesNotThrow(() => validateCity(restored), 'legacy saves remain supported');
    restored.plots[0].surface = 'unknown';
    assert.throws(() => validateCity(restored));
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('selected asset previews use the actual preset geometry and a highlighted footprint', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.ring = { setEnabled() {} };
  editor.brushSpokes = { setEnabled() {} };
  editor.onBrushMove = () => {};
  try {
    editor.createPlacementPreview('house');
    const parts = editor.preview.getChildMeshes();
    assert.ok(parts.length >= 3, 'house preview contains the body, windows and roof');
    assert.ok(parts.every(mesh => mesh.isPickable === false && mesh.material.alpha < 1));
    editor.showTargetCell(0, 0, 1.5, 6, 6, null);
    assert.equal(editor.targetCell.scaling.x, 6);
    assert.equal(editor.targetCell.scaling.z, 6);
    const validColor = editor.targetCell.material.diffuseColor.toHexString();
    editor.showTargetCell(0, 0, 1.5, 6, 6, 'occupied');
    assert.notEqual(editor.targetCell.material.diffuseColor.toHexString(), validColor);
    editor.clearPreview();
    assert.equal(editor.preview, null);
    assert.equal(editor.targetCell, null);
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('building preview, alignment guide and click share one snapped position', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  const listeners = {}, changes = [], hints = [];
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.city.plots = [{ id: 'site', x: 0, z: 0, width: 24, depth: 24 }];
  editor.city.objects = [];
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.ring = { setEnabled() {} };
  editor.brushSpokes = { setEnabled() {} };
  editor.canvas = { style: {}, addEventListener(name, listener) { listeners[name] = listener; } };
  editor.onChange = city => changes.push(city);
  editor.onSelect = () => {};
  editor.onMessage = () => {};
  editor.onBrushMove = hint => hints.push(hint);
  editor.pick = event => ({ hit: true, pickedPoint: new Vector3(event.clientX, 1.5, event.clientY) });
  const pointer = { button: 0, clientX: 8.8, clientY: 8.6, pointerId: 1 };
  try {
    editor.options = { mode: 'build', asset: 'house', rotation: 0, align: true };
    editor.bindEvents();
    listeners.pointermove(pointer);
    assert.equal(editor.preview.position.x, 8.5);
    assert.equal(editor.preview.position.z, 8.5);
    assert.equal(editor.targetCell.position.x, 8.5);
    assert.equal(editor.alignmentGuide.isEnabled(), true);
    assert.match(hints.at(-1).label, /부지 경계/);
    listeners.pointerdown(pointer);
    assert.equal(changes.at(-1).objects[0].x, 8.5);
    assert.equal(changes.at(-1).objects[0].z, 8.5);
    editor.setOptions({ mode: 'build', asset: 'house', rotation: 0, align: false });
    listeners.pointermove({ ...pointer, clientX: -8.8, clientY: -8.6 });
    assert.equal(editor.preview.position.x, -8);
    assert.equal(editor.preview.position.z, -8);
    assert.equal(editor.alignmentGuide, null);
    const movingId = editor.city.objects[0].id;
    editor.setOptions({ mode: 'move', asset: 'house', rotation: 0, align: true, gap: 1, movingId });
    listeners.pointermove({ ...pointer, clientX: -8.8, clientY: -8.6 });
    assert.equal(editor.preview.position.x, -8.5);
    assert.equal(editor.preview.position.z, -8.5);
    listeners.pointerdown({ ...pointer, clientX: -8.8, clientY: -8.6 });
    assert.equal(changes.at(-1).objects[0].x, -8.5);
    assert.equal(changes.at(-1).objects[0].z, -8.5);
    assert.equal(changes.at(-1).objects.length, 1, 'moving replaces the original position');
    const changeCount = changes.length;
    listeners.pointerdown({ ...pointer, clientX: 30, clientY: 30 });
    assert.equal(changes.length, changeCount, 'moving outside a plot is rejected');
  } finally {
    editor.clearPreview();
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('Shift-click reports additive object selection and group highlights', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  const listeners = {}, selected = [];
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.city.plots = [{ id: 'site', x: 0, z: 0, width: 24, depth: 24 }];
  editor.city.objects = [
    { id: 'a', asset: 'house', x: -6, z: 0, rotation: 0 },
    { id: 'b', asset: 'house', x: 6, z: 0, rotation: 0 },
  ];
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.options = { mode: 'select' };
  editor.canvas = { addEventListener(name, listener) { listeners[name] = listener; } };
  editor.onSelect = (...args) => selected.push(args);
  editor.pick = event => ({ pickedMesh: { metadata: { objectId: event.clientX < 0 ? 'a' : 'b' } } });
  try {
    editor.buildObject(editor.city.objects[0]);
    editor.buildObject(editor.city.objects[1]);
    editor.bindEvents();
    listeners.pointerdown({ button: 0, clientX: -6, shiftKey: false });
    listeners.pointerdown({ button: 0, clientX: 6, shiftKey: true });
    assert.deepEqual(selected, [['a', false, 'object'], ['b', true, 'object']]);
    editor.select(['a', 'b']);
    assert.ok(editor.nodes.every(node => node.getChildMeshes().every(mesh => mesh.renderOverlay)));
    assert.equal(editor.selectionFrames.length, 2, 'each selected building has its own bounds');
    editor.select(null);
    assert.ok(editor.nodes.every(node => node.getChildMeshes().every(mesh => !mesh.renderOverlay)));
    assert.equal(editor.selectionFrames.length, 0, 'selection bounds are removed when deselected');
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('raised terrain stays opaque, refreshes its height cache and closes its perimeter', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.materials = new Map(); editor.nodes = [];
  editor.city = createCity('blank');
  editor.terrain = MeshBuilder.CreateGround('terrain', { width: 240, height: 240, subdivisions: 120, updatable: true }, editor.scene);
  editor.terrain.material = editor.material('terrain', '#91ac7b');
  try {
    editor.city.heights.fill(20);
    editor.updateTerrain();
    assert.equal(editor.terrain.getHeightAtCoordinates(0, 0), 20);
    assert.equal(editor.terrain.material.backFaceCulling, false);
    assert.equal(editor.terrain.hasVertexAlpha, false);
    assert.equal(editor.terrain.getBoundingInfo().boundingBox.maximum.y, 20);
    const sides = editor.terrainSides;
    const positions = sides.getVerticesData('position');
    assert.equal(positions[1], 20, 'side joins the raised surface');
    assert.equal(positions[7], -31, 'side reaches below editable heights');
    assert.equal(editor.terrainBottom.position.y, -31);
    editor.city.heights.fill(35);
    editor.city.terrainPaint = Array(editor.city.heights.length).fill('#ff0000');
    editor.updateTerrain();
    assert.equal(editor.terrainSides, sides, 'repeated edits update the existing sides');
    assert.equal(editor.terrain.getHeightAtCoordinates(0, 0), 35);
    assert.equal(sides.getVerticesData('position')[1], 35);
    assert.deepEqual(editor.terrain.getVerticesData('color').slice(0, 4), [1, 0, 0, 1]);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('water regions render, are selectable and draining one leaves the other intact', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.materials = new Map(); editor.nodes = [];
  editor.camera = new ArcRotateCamera('water-camera', -1, 0.8, 100, Vector3.Zero(), editor.scene);
  editor.city = createCity('blank'); editor.city.heights.fill(2);
  editor.city.heights[40 * 121 + 40] = -3; editor.city.heights[80 * 121 + 80] = -4;
  try {
    editor.updateWater();
    assert.equal(editor.waterNodes.length, 2);
    const first = editor.waterRegions[0];
    assert.equal(editor.waterNodes[0].getChildMeshes()[0].metadata.waterId, first.id);
    editor.select(first.id);
    assert.equal(editor.selectionFrames.length, 1);
    editor.scene.render();
    editor.city.waterSettings = { regions: [{ anchor: first.anchor, enabled: false, flowing: false }] };
    editor.updateWater();
    assert.equal(editor.waterNodes.length, 1);
    assert.equal(editor.waterRegions.length, 2, 'drained basins remain in the region list');
    assert.notEqual(editor.waterNodes[0].metadata.waterId, first.id);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('the default camera sees the terrain and construction grid', () => {
  const graphics = new NullEngine({ renderWidth: 1440, renderHeight: 960 });
  const editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics);
  editor.materials = new Map();
  editor.city = createCity('blank');
  editor.nodes = [];
  editor.gridVisible = true;
  editor.terrain = MeshBuilder.CreateGround('terrain', { width: 240, height: 240, subdivisions: 120, updatable: true }, editor.scene);
  editor.terrain.material = editor.material('terrain', '#91ac7b');
  editor.camera = new ArcRotateCamera('city-camera', -Math.PI / 2.8, 0.83, 205, new Vector3(-13, 0, 4), editor.scene);
  try {
    editor.updateTerrain();
    editor.updateGrid();
    editor.scene.render();
    const active = editor.scene.getActiveMeshes();
    assert.ok(active.data.slice(0, active.length).includes(editor.terrain), 'ground is inside the camera view');
    assert.ok(active.data.slice(0, active.length).includes(editor.grid), 'grid is inside the camera view');
    assert.equal(editor.grid.color.toHexString(), '#718E80', 'grid lines use muted green');
    assert.equal(editor.grid.alpha, 0.44);
    editor.setGridVisible(false);
    assert.equal(editor.grid.isEnabled(), false, 'grid switch hides the native grid');
  } finally {
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('two clicks size a site; a selected preset then places once and rejects overlap', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  const listeners = {}, changes = [], notices = [], hints = [];
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.nodes = [];
  editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.ring = { setEnabled() {} };
  editor.brushSpokes = { setEnabled() {} };
  editor.canvas = { style: {}, addEventListener(name, listener) { listeners[name] = listener; } };
  editor.onChange = city => changes.push(city);
  editor.onSelect = () => {};
  editor.onMessage = message => notices.push(message);
  editor.onBrushMove = hint => hints.push(hint);
  editor.pick = event => ({ hit: true, pickedPoint: new Vector3(event.clientX, 1.5, event.clientY) });
  const pointer = (x, z) => ({ clientX: x, clientY: z, button: 0, pointerId: 1 });
  try {
    editor.options = { mode: 'build', plot: 'medium', asset: 'house', rotation: 0 };
    editor.bindEvents();
    const untouchedCity = structuredClone(editor.city);
    listeners.pointermove(pointer(0, 0));
    assert.equal(hints.at(-1).invalid, true, 'empty land has an invalid preview');
    listeners.pointerdown(pointer(0, 0));
    assert.match(notices.at(-1), /먼저 부지를/);
    assert.deepEqual(editor.city, untouchedCity, 'rejected placement changes neither terrain, plots nor buildings');
    assert.equal(changes.length, 0);
    editor.setOptions({ mode: 'plot', plot: 'medium', asset: 'house', rotation: 0 });
    listeners.pointermove(pointer(0, 0));
    assert.equal(editor.preview, null, 'no area preview before choosing a corner');
    assert.equal(editor.targetCell, null, 'no filled footprint before first click');
    assert.equal(editor.plotAnchor.isEnabled(), true);
    listeners.pointerdown(pointer(0, 0));
    assert.equal(changes.length, 0, 'first click only starts the site');
    assert.equal(editor.plotAnchor.isEnabled(), false);
    assert.equal(editor.preview.isEnabled(), true, 'area preview starts after the first click');
    listeners.pointermove(pointer(16, 12));
    assert.equal(editor.plotDraft.width, 16);
    assert.equal(editor.plotDraft.depth, 12);
    listeners.pointerdown(pointer(16, 12));
    assert.equal(changes.length, 1, 'second click creates the sized site');
    assert.equal(editor.city.plots[0].width, 16);
    assert.equal(editor.city.plots[0].depth, 12);
    assert.equal(editor.preview.isEnabled(), false, 'completed site returns to corner picking');
    assert.equal(editor.plotAnchor.isEnabled(), true);
    editor.setOptions({ mode: 'build', plot: 'medium', asset: 'house', rotation: 0 });
    for (const [x, z] of [[30, 30], [0, 6]]) {
      listeners.pointermove(pointer(x, z));
      assert.equal(hints.at(-1).invalid, true, 'outside or straddling the plot boundary is invalid');
      listeners.pointerdown(pointer(x, z));
      assert.match(notices.at(-1), /먼저 부지를/);
      assert.equal(editor.city.plots.length, 1);
      assert.equal(editor.city.objects.length, 0);
      assert.equal(changes.length, 1);
    }
    listeners.pointermove(pointer(8, 6));
    assert.equal(hints.at(-1).invalid, false, 'existing plot allows placement');
    assert.ok(editor.preview.getChildMeshes().length >= 3);
    listeners.pointerdown(pointer(8, 6));
    assert.equal(changes.length, 2);
    assert.equal(editor.city.objects.length, 1);
    listeners.pointerdown(pointer(8, 6));
    assert.equal(changes.length, 2, 'overlapping building is rejected');
    assert.ok(notices.some(message => message.includes('시설')));
  } finally {
    editor.clearPreview();
    editor.scene.dispose();
    graphics.dispose();
  }
});

test('dragging a plot corner previews a valid resize and commits once on release', () => {
  const graphics = new NullEngine();
  const editor = Object.create(CityEngine.prototype);
  const listeners = {}, changes = [], selected = [];
  editor.scene = new Scene(graphics);
  editor.city = createCity('blank');
  editor.city.plots.push({ id: 'site', x: 0, z: 0, width: 12, depth: 12, surface: 'asphalt' });
  editor.options = { mode: 'select' };
  editor.canvas = { addEventListener(name, fn) { listeners[name] = fn; }, setPointerCapture() {}, hasPointerCapture() { return true; }, releasePointerCapture() {} };
  editor.onChange = city => changes.push(city);
  editor.onSelect = id => selected.push(id);
  editor.onMessage = () => {};
  editor.onBrushMove = () => {};
  editor.ring = { setEnabled() {} };
  editor.brushSpokes = { setEnabled() {} };
  editor.pick = (event, terrainOnly = true) => terrainOnly
    ? { hit: true, pickedPoint: new Vector3(event.clientX, 1.5, event.clientY) }
    : { hit: true, pickedMesh: { metadata: { plotId: 'site', corner: 2 } } };
  try {
    editor.bindEvents();
    listeners.pointerdown({ button: 0, pointerId: 1, clientX: 6, clientY: 6 });
    assert.equal(selected.at(-1), 'site');
    listeners.pointermove({ clientX: 10, clientY: 10 });
    assert.equal(editor.targetCell.scaling.x, 16);
    assert.equal(changes.length, 0, 'dragging only updates the preview');
    listeners.pointerup({ pointerId: 1 });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].plots[0].width, 16);
    assert.equal(changes[0].plots[0].depth, 16);
    assert.equal(changes[0].plots[0].surface, 'asphalt', 'resizing preserves the chosen finish');
  } finally {
    editor.clearPreview(); editor.scene.dispose(); graphics.dispose();
  }
});

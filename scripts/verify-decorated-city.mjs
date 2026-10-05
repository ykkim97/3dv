import fs from 'node:fs';
import assert from 'node:assert/strict';
import { NullEngine, Scene, MeshBuilder, ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { CityEngine } from '../src/features/city/CityEngine.js';
import { validateCity, mapDimensions } from '../src/features/city/cityModel.js';

const city = validateCity(JSON.parse(fs.readFileSync(process.argv[2] || 'artifacts/decorated-city/TEST_1_decorated.city.json', 'utf8')));
const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
editor.scene = new Scene(graphics); editor.nodes = []; editor.materials = new Map();
editor.camera = new ArcRotateCamera('camera', -1.08, .72, 350, Vector3.Zero(), editor.scene);
editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
editor.ring = editor.brushSpokes = { setEnabled() {} };
const { size, resolution } = mapDimensions(city);
editor.terrain = MeshBuilder.CreateGround('terrain', { width: size, height: size, subdivisions: resolution, updatable: true }, editor.scene);
editor.terrain.material = editor.material('terrain', '#91ac7b'); editor.gridVisible = false;
try {
  editor.setCity(city);
  assert.equal(editor.nodes.length, city.objects.length + city.roads.length + city.plots.length);
  for (const mesh of editor.scene.meshes) {
    const positions = mesh.getVerticesData('position');
    if (positions) assert.ok(positions.every(Number.isFinite), `${mesh.name} contains invalid geometry`);
  }
  editor.scene.render();
  console.log(JSON.stringify({ loadedObjects: city.objects.length, loadedPlots: city.plots.length, loadedRoads: city.roads.length, meshes: editor.scene.meshes.length, verified: 'Babylon NullEngine scene load and finite geometry' }));
} finally { editor.scene.dispose(); graphics.dispose(); }

import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { CityEngine } from './CityEngine.js';
import { buildEnergyDemoAsset } from './builders/energyDemoAssets.js';
import { assetById } from '../presets/catalog.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { calculateUtilityService } from '../simulation/utilityService.js';

test('nuclear generation supplies a factory and new presets build finite recognizable geometry', () => {
  const service = calculateUtilityService({ objects: [
    { id: 'reactor', asset: 'nuclear-plant', x: 0, z: 0 },
    { id: 'relay', asset: 'substation', x: 40, z: 0 },
    { id: 'factory', asset: 'smart-factory', x: 60, z: 0 },
  ] });
  assert.equal(service.totals.consumers, 1);
  assert.equal(service.totals.power, 1);
  assert.equal(service.consumers.get('factory').power, 'relay');
  const graphics = new NullEngine(), scene = new Scene(graphics);
  try {
    const editor = Object.create(CityEngine.prototype);
    editor.scene = scene; editor.materials = new Map(); editor.shadows = { addShadowCaster() {} };
    for (const id of ['nuclear-plant', 'smart-factory']) buildEnergyDemoAsset(editor, assetById[id], new TransformNode(id, scene));
    assert.equal(scene.meshes.filter(m => m.name === 'cooling-tower').length, 2);
    assert.equal(scene.meshes.filter(m => m.name === 'reactor-dome').length, 2);
    assert.equal(scene.meshes.filter(m => m.name === 'factory-rooftop-solar').length, 9);
    for (const mesh of scene.meshes) assert.ok(mesh.getVerticesData('position').every(Number.isFinite), mesh.name);
  } finally { scene.dispose(); graphics.dispose(); }
});

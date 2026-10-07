import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { CityEngine } from './CityEngine.js';
import { EXPANSION_ASSETS } from '../presets/expansionAssets.js';
import { createCity } from '../core/cityState.js';
import { validateCity } from '../core/cityValidation.js';
import { placementProblem } from '../placement/placementRules.js';
import { calculateUtilityService } from '../simulation/utilityService.js';
import { facilityNumberFields } from '../management/facilityProperties.js';
import { DEFAULT_CONNECTION } from '../connections/connectionModel.js';

test('all thirteen expansion facilities fit their plots, remain pickable and share geometry', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.nodes = []; editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  try {
    assert.equal(EXPANSION_ASSETS.length, 13);
    for (const asset of EXPANSION_ASSETS) {
      editor.city = createCity('blank');
      editor.city.plots = [{ id: 'site', x: 0, z: 0, width: asset.width + 2, depth: asset.depth + 2 }];
      const object = { id: asset.id, asset: asset.id, x: 0, z: 0, rotation: 0 };
      assert.equal(placementProblem(editor.city, asset.id, 0, 0), null);
      assert.match(placementProblem(editor.city, asset.id, 50, 50), /부지/);
      editor.city.objects = [object];
      const root = editor.buildObject(object), meshes = root.getChildMeshes();
      assert.ok(meshes.length >= 3 && meshes.length <= 9, `${asset.id}: ${meshes.length} material batches`);
      const triangles = meshes.reduce((sum, mesh) => sum + mesh.sourceMesh.getTotalIndices() / 3, 0);
      assert.ok(triangles <= 3000, `${asset.id}: ${triangles} triangles`);
      for (const mesh of meshes) {
        assert.equal(mesh.metadata.objectId, object.id);
        assert.ok(mesh.sourceMesh.getVerticesData('position').every(Number.isFinite));
        mesh.computeWorldMatrix(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        assert.ok(bounds.maximumWorld.y - root.position.y <= asset.height + 0.2, `${asset.id} declared height contains roof details`);
        for (const [axis, dimension] of [['x', asset.width], ['z', asset.depth]]) {
          assert.ok(Math.max(Math.abs(bounds.minimumWorld[axis]), Math.abs(bounds.maximumWorld[axis])) <= dimension / 2 + 0.251, `${asset.id} ${axis} footprint`);
        }
      }
      const geometryCount = editor.scene.geometries.length;
      const copy = editor.buildObject({ ...object, id: `${asset.id}-copy`, x: 40, rotation: Math.PI / 2 });
      assert.equal(editor.scene.geometries.length, geometryCount);
      assert.ok(copy.getChildMeshes().every(mesh => meshes.some(original => original.sourceMesh === mesh.sourceMesh)));
      assert.equal(validateCity(JSON.parse(JSON.stringify(editor.city))).objects[0].asset, asset.id);
    }
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('expansion facilities use existing directed power and water paths and power demand calculation', () => {
  for (const asset of EXPANSION_ASSETS) {
    const city = createCity('blank'); city.powerSupplyMode = 'network'; city.waterSupplyMode = 'network';
    city.objects = [
      { id: 'power', asset: 'solar-farm', x: 0, z: 0, rotation: 0, properties: { generationKW: 20 } },
      { id: 'water', asset: 'water-treatment', x: 30, z: 0, rotation: 0 },
      { id: 'consumer', asset: asset.id, x: 0, z: 30, rotation: 0, properties: { demandKW: 10 } },
    ];
    city.connections = [
      { ...DEFAULT_CONNECTION, id: 'electric', type: 'power', from: 'power', to: 'consumer' },
      { ...DEFAULT_CONNECTION, id: 'pipe', type: 'water', from: 'water', to: 'consumer' },
    ];
    const saved = validateCity(JSON.parse(JSON.stringify(city)));
    let service = calculateUtilityService(saved);
    assert.deepEqual(service.consumers.get('consumer'), { power: 'power', water: 'water' });
    assert.equal(service.powerBalance.results.get('consumer').status, 'normal');
    assert.ok(facilityNumberFields(city.objects[2]).includes('demandKW'));
    saved.connections = saved.connections.filter(line => line.type !== 'power');
    service = calculateUtilityService(saved);
    assert.equal(service.consumers.get('consumer').power, null);
    assert.equal(service.consumers.get('consumer').water, 'water');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { CityEngine } from './CityEngine.js';
import { createCity, placementProblem, validateCity } from './cityModel.js';
import { STREET_PROPS } from './streetProps.js';
import { DEFAULT_ENVIRONMENT, advanceHour, daylightAt } from './dayLighting.js';

test('clock wraps midnight, smoothly blends dusk and validates persisted settings', () => {
  assert.equal(advanceHour(23, 25, 10), 0);
  assert.equal(daylightAt(12).daylight, 1);
  assert.equal(daylightAt(0).lamps, 1);
  assert.ok(daylightAt(18).daylight > 0 && daylightAt(18).daylight < 1);
  const city = createCity('blank'); city.environment = { ...DEFAULT_ENVIRONMENT, hour: 22, autoCycle: true };
  assert.deepEqual(validateCity(JSON.parse(JSON.stringify(city))).environment, city.environment);
  assert.throws(() => validateCity({ ...city, environment: { ...city.environment, cycleMinutes: 0 } }));
  for (const prop of STREET_PROPS) assert.equal(placementProblem(city, prop.id, 0, 0), null, 'street furniture needs no building plot');
  assert.match(placementProblem(city, 'sidewalk', 120, 120), /지도/);
  assert.match(placementProblem(city, 'house', 0, 0), /부지/);
});

test('hundreds of street props share geometry, preserve picking and keep only two local lights', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.city = createCity('blank'); editor.city.objects = [];
  editor.nodes = []; editor.materials = new Map();
  editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
  editor.sun = new DirectionalLight('sun', new Vector3(0, -1, 0), editor.scene);
  editor.ambient = new HemisphericLight('sky', Vector3.Up(), editor.scene);
  editor.camera = { position: new Vector3(0, 8, 0) };
  editor.ring = { setEnabled() {} };
  editor.brushSpokes = { setEnabled() {} };
  try {
    for (const prop of STREET_PROPS) {
      const roots = Array.from({ length: 80 }, (_, index) => {
        const object = { id: `${prop.id}-${index}`, asset: prop.id, x: index, z: 0, rotation: 0 };
        editor.city.objects.push(object); return editor.buildObject(object);
      });
      const template = editor.propTemplates.get(prop.id);
      for (const root of roots.slice(1)) for (const mesh of root.getChildMeshes()) {
        assert.ok(template.includes(mesh.sourceMesh), 'GPU instances reuse the preset model');
        assert.equal(mesh.metadata.objectId, root.name); assert.equal(mesh.isPickable, true);
        assert.equal(mesh.isEnabled(), true); assert.equal(mesh.isVisible, true);
      }
      roots[0].dispose();
      assert.ok(template.every(source => !source.isDisposed()), 'deleting the original does not break copies');
    }
    editor.propLightNodes = editor.nodes.filter(root => !root.isDisposed() && root.name.startsWith('street-lamp-'));
    editor.setTimeOfDay(22);
    assert.equal(editor.scene.lights.length, 4);
    assert.ok(editor.materials.get('city-lamp').emissiveColor.r > 0.8);
    assert.ok(editor.localLights.every(light => light.intensity > 0));
    const material = editor.propTemplates.get('street-lamp')[0].material;
    const diffuse = material.diffuseColor.toHexString();
    editor.createPlacementPreview('street-lamp'); editor.clearPreview();
    assert.ok(editor.scene.materials.includes(material), 'preview cleanup keeps the shared material alive');
    assert.equal(material.diffuseColor.toHexString(), diffuse);
    editor.setTimeOfDay(12);
    assert.equal(editor.materials.get('city-lamp').emissiveColor.r, 0);
    assert.ok(editor.localLights.every(light => light.intensity === 0));
    editor.environment = { ...DEFAULT_ENVIRONMENT, autoCycle: true }; editor.hour = 23;
    editor.tickDaylight(25); assert.equal(editor.hour, 0);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

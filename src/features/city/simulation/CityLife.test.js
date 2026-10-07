import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CityEngine } from '../rendering/CityEngine.js';
import { CityLife, roadTravel } from './CityLife.js';
import { createCity } from '../core/cityState.js';
import { roadProfile } from '../roads/roadGeometry.js';
import { validateCity } from '../core/cityValidation.js';
import { LIFE_SETTING_KEYS } from './lifeSettings.js';
import { AMBIENT_LIMITS } from './AmbientLife.js';
import { spreadSites, steamPixels } from './AmbientLife.js';

test('visual traffic follows linked roads, pauses and never becomes selectable', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.materials = new Map();
  new ArcRotateCamera('camera', 0, 0.8, 80, Vector3.Zero(), editor.scene);
  const city = createCity('blank');
  city.roads = [
    { id: 'a', chainId: 'curve', type: 'street', a: { x: 0, z: 0 }, b: { x: 10, z: 0 } },
    { id: 'b', chainId: 'curve', type: 'street', a: { x: 10, z: 0 }, b: { x: 20, z: 10 } },
    { id: 'walk', type: 'path', a: { x: 30, z: 0 }, b: { x: 40, z: 0 } },
  ];
  const life = new CityLife(editor);
  try {
    life.update(city);
    assert.equal(life.actors.filter(actor => !actor.person).length, 1, 'one vehicle per connected curve, not per short segment');
    assert.equal(life.actors.filter(actor => actor.person).length, 2);
    assert.ok(life.root.getChildMeshes().every(mesh => !mesh.isPickable));
    const car = life.actors.find(actor => !actor.person);
    const initial = car.root.position.clone(); life.tick(3);
    assert.equal(car.roadId, 'b');
    assert.notDeepEqual(car.root.position, initial);
    life.settings.enabled = false;
    const position = car.root.position.clone(); life.tick(1);
    assert.deepEqual(car.root.position, position);
    assert.equal(car.root.isEnabled(), false);
    life.setNight(true);
    assert.ok(editor.materials.get('life-#ffe5a0').emissiveColor.r > 0.8);
    const old = life.root; life.update({ ...city, roads: [], lifeSettings: { cars: false, people: false } });
    assert.ok(old.isDisposed());
    assert.equal(life.actors.length, 0);
    editor.scene.render();
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('road travelers interpolate elevation and heading along their actual road', () => {
  const city = createCity('blank');
  for (let r = 0; r <= 120; r++) for (let c = 0; c <= 120; c++) city.heights[r * 121 + c] = 5 + (c * 2 - 120) * 0.05;
  const road = { id: 'slope', type: 'street', a: { x: 0, z: 0 }, b: { x: 20, z: 0 } };
  const point = roadTravel(roadProfile(city, road), 10.5);
  assert.equal(point.x, 10.5);
  assert.equal(point.z, 0);
  assert.ok(Math.abs(point.y - 5.725) < 1e-6);
  assert.equal(point.angle, Math.PI / 2);
});

test('bridge pedestrians remain on the deck and footbridges never carry cars', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.materials = new Map();
  const city = createCity('blank'); city.roads = [{ id: 'foot', bridge: 'footbridge', type: 'path', a: { x: -20, z: 0 }, b: { x: 20, z: 0 } }];
  const life = new CityLife(editor);
  try {
    life.update(city); life.tick(1);
    assert.equal(life.actors.length, 1);
    assert.ok(life.actors[0].person);
    assert.ok(Math.abs(life.actors[0].root.position.z) < 1);
    assert.equal(life.lamps.length, 0);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('ambient effects follow facilities, honor night and toggles, reuse geometry and remain bounded', () => {
  const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
  editor.scene = new Scene(graphics); editor.materials = new Map();
  new ArcRotateCamera('camera', .6, .8, 80, Vector3.Zero(), editor.scene);
  const city = createCity('blank');
  city.objects = [
    { id: 'park', asset: 'park', x: 10, z: 10, rotation: 0 },
    { id: 'plant', asset: 'power-plant', x: -20, z: -10, rotation: Math.PI / 2 },
    ...Array.from({ length: 30 }, (_, i) => ({ id: `garden-${i}`, asset: 'playground', x: -90 + i * 6, z: 60, rotation: 0 })),
    ...Array.from({ length: 30 }, (_, i) => ({ id: `plant-${i}`, asset: 'nuclear-plant', x: -90 + i * 6, z: -60, rotation: 0 })),
  ];
  const life = new CityLife(editor);
  try {
    life.update(city);
    const ambient = life.ambient;
    for (const [key, limit] of Object.entries(AMBIENT_LIMITS)) assert.equal(ambient.actors.filter(a => a.kind === key).length, limit);
    const puff = ambient.actors.find(a => a.kind === 'steam');
    editor.scene.render();
    const normal = Vector3.TransformNormal(new Vector3(0, 0, 1), puff.puff.computeWorldMatrix(true)).normalize();
    const view = editor.scene.activeCamera.getForwardRay().direction;
    assert.ok(Math.abs(Vector3.Dot(normal, view)) > .99, 'soft steam faces the camera');
    const meshes = editor.scene.meshes.length, materials = editor.scene.materials.length;
    const position = ambient.actors[0].root.position.clone();
    for (let i = 0; i < 100; i++) life.tick(.03);
    assert.notDeepEqual(ambient.actors[0].root.position, position);
    assert.equal(editor.scene.meshes.length, meshes);
    assert.equal(editor.scene.materials.length, materials);
    assert.equal(ambient.templates.size, 9);
    assert.equal(new Set(ambient.actors.filter(a => a.kind === 'steam').map(a => a.puff.material.diffuseTexture)).size, 1, 'all steam shares one soft texture');
    assert.ok(puff.puff.material.alpha > 0 && puff.puff.material.alpha <= .36);
    assert.ok(ambient.root.getChildMeshes().every(m => !m.isPickable));
    life.setNight(true);
    assert.equal(ambient.groups.birds.isEnabled(), false);
    assert.equal(ambient.groups.garden.isEnabled(), true);
    assert.ok(ambient.templates.get('garden-wing').material.emissiveColor.g > .5);
    life.setNight(false);
    assert.equal(ambient.groups.birds.isEnabled(), true);
    life.settings.enabled = false; const paused = puff.root.position.clone(); life.tick(1);
    assert.deepEqual(puff.root.position, paused);
    assert.ok(Object.values(ambient.groups).every(group => !group.isEnabled()));
    life.update({ ...city, lifeSettings: { birds: false, garden: false, steam: false } });
    assert.ok(ambient.root.isDisposed());
    assert.equal(life.ambient.actors.length, 0);
    const size = editor.scene.meshes.length;
    for (let i = 0; i < 3; i++) life.update({ ...city, lifeSettings: { birds: false, garden: false, steam: false } });
    assert.equal(editor.scene.meshes.length, size, 'rebuilding does not leak meshes');
    life.update({ ...city, objects: [city.objects[1]] });
    const rotatedPuff = life.ambient.actors.find(a => a.kind === 'steam');
    assert.ok(Math.abs(rotatedPuff.x - (-18.9)) < 1e-6);
    assert.ok(Math.abs(rotatedPuff.z - (-12.1)) < 1e-6);
  } finally { editor.scene.dispose(); graphics.dispose(); }
});

test('scenery sites are distributed and steam has soft transparent edges', () => {
  const sites = spreadSites([{ x: 0, z: 0 }, { x: 1, z: 1 }, { x: 80, z: 0 }, { x: -80, z: 0 }, { x: 0, z: 80 }], 3);
  assert.equal(sites.length, 3);
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) assert.ok(Math.hypot(sites[i].x - sites[j].x, sites[i].z - sites[j].z) >= 80);
  const pixels = steamPixels(), alpha = Array.from(pixels).filter((_, index) => index % 4 === 3);
  assert.equal(pixels.length, 64 * 64 * 4);
  assert.equal(alpha[0], 0);
  assert.ok(alpha.some(a => a > 0 && a < 80));
  assert.ok(alpha.some(a => a > 150));
});

test('ambient options survive city files and reject non-boolean values', () => {
  const city = createCity('blank');
  city.lifeSettings = { enabled: true, cars: false, people: true, birds: false, garden: true, steam: false };
  assert.deepEqual(validateCity(JSON.parse(JSON.stringify(city))).lifeSettings, city.lifeSettings);
  for (const key of LIFE_SETTING_KEYS) assert.throws(() => validateCity({ ...city, lifeSettings: { [key]: 'false' } }));
  assert.doesNotThrow(() => validateCity(createCity('blank')), 'older files without options still load');
});

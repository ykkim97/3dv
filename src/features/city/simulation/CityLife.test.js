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

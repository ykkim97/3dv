import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createCity } from '../core/cityState.js';
import { calculateUtilityService } from '../simulation/utilityService.js';
import { serviceBadgeRecords } from '../simulation/serviceBadges.js';
import { serviceBadges } from './systems/serviceBadges.js';

const object = (id, asset, x = 0) => ({ id, asset, x, z: 0, rotation: 0 });
function fixture() {
  const plant = { ...object('plant', 'power-plant'), properties: { generationKW: 100 } };
  const home = { ...object('home', 'house', 20), properties: { demandKW: 10 } };
  return { ...createCity('blank'), powerSupplyMode: 'network', objects: [plant, home, object('water', 'water-treatment'), object('waste', 'wastewater')], connections: [{ id: 'line', type: 'power', from: 'plant', to: 'home', direction: 'forward' }] };
}

test('badges reflect both assessments, exclude sewage terminals and filter missing facilities', () => {
  const city = fixture(), options = { power: true, water: true };
  const records = serviceBadgeRecords(calculateUtilityService(city), options);
  assert.equal(records.length, 4);
  assert.ok(records.every(record => record.connected));
  assert.equal(serviceBadgeRecords(calculateUtilityService(city), { ...options, missingOnly: true }).length, 0);
  city.connections = [];
  city.objects.find(o => o.id === 'home').x = 100;
  const missing = serviceBadgeRecords(calculateUtilityService(city), { ...options, missingOnly: true });
  assert.deepEqual(missing.map(record => `${record.id}:${record.kind}`), ['home:power', 'home:water']);
  assert.equal(serviceBadgeRecords(calculateUtilityService(city), { power: false, water: false }).length, 0);
});

test('batched sprites reuse icons, follow roofs and camera, update faults and release resources on OFF', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  let created = 0, disposed = 0;
  const editor = { ...serviceBadges, scene, city: fixture(), nodes: [], camera: { radius: 205, alpha: 0 }, createServiceBadgeManager: () => {
    created++;
    return { scene, sprites: [], dispose() { disposed++; } };
  } };
  try {
    editor.setServiceBadgeOptions({ power: true, water: true });
    assert.equal(created, 1);
    assert.equal(editor.serviceBadgeSprites.size, 4);
    const power = editor.serviceBadgeSprites.get('home:power');
    let water = editor.serviceBadgeSprites.get('home:water');
    assert.equal(power.cellIndex, 0);
    assert.equal(water.cellIndex, 2);
    assert.equal(power.isPickable, false);
    editor.city.objects.find(o => o.id === 'plant').properties.generationKW = 1;
    editor.updateServiceBadges();
    assert.equal(power.cellIndex, 4, 'connected but underpowered buildings use the shortage icon');
    editor.setServiceBadgeOptions({ power: true, water: true, missingOnly: true });
    assert.equal(editor.serviceBadgeSprites.get('home:power'), power, 'the warning filter includes shortages');
    delete editor.city.objects.find(o => o.id === 'plant').properties.generationKW;
    editor.updateServiceBadges();
    assert.equal(power.cellIndex, 5, 'missing required values use the unset icon');
    editor.city.objects.find(o => o.id === 'plant').properties.generationKW = 100;
    editor.setServiceBadgeOptions({ power: true, water: true });
    water = editor.serviceBadgeSprites.get('home:water');
    assert.notEqual(power.position.z, water.position.z, 'icons remain separate in the top view');
    const y = power.position.y;
    editor.nodes = [{ name: 'home', getHierarchyBoundingVectors: () => ({ max: { y: 40 } }) }];
    editor.city.objects.find(o => o.id === 'home').x = 100;
    editor.city.objects.find(o => o.id === 'plant').properties = { status: 'fault' };
    editor.updateServiceBadges();
    assert.equal(editor.serviceBadgeSprites.get('home:power'), power);
    assert.equal(power.cellIndex, 1);
    assert.equal(water.cellIndex, 3);
    assert.equal(power.position.x, 100);
    assert.ok(power.position.y > y && power.position.y > 40);
    editor.camera.radius = 350; editor.camera.alpha = Math.PI / 2;
    editor.positionServiceBadges();
    assert.ok(power.width > 9);
    assert.notEqual(power.position.x, water.position.x);
    editor.setServiceBadgeOptions({ power: true, water: false, missingOnly: true });
    assert.equal(editor.serviceBadgeSprites.size, 2);
    assert.equal(editor.serviceBadgeManager.sprites.length, 2);
    assert.equal(created, 1);
    editor.setServiceBadgeOptions({ power: false, water: false });
    assert.equal(disposed, 1);
    assert.equal(editor.serviceBadgeSprites.size, 0);
    assert.equal(scene.onBeforeRenderObservable.hasObservers(), false);
    editor.setServiceBadgeOptions({ power: true });
    assert.equal(created, 2);
    editor.clearServiceBadges();
    assert.equal(disposed, 2);
  } finally { scene.dispose(); engine.dispose(); }
});

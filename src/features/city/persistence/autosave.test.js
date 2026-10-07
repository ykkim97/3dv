import test from 'node:test';
import assert from 'node:assert/strict';
import { Autosave } from './autosave.js';
import { projectRecord, createProjectStore, MAX_SNAPSHOTS } from './projectStore.js';
import { createCity } from '../core/cityState.js';
import { validateCity } from '../core/cityValidation.js';

function clock() {
  let now = 0, id = 0;
  const tasks = new Map();
  return { setTimeout(fn, wait) { tasks.set(++id, { fn, at: now + wait }); return id; }, clearTimeout(key) { tasks.delete(key); },
    advance(ms) { now += ms; for (const [key, task] of [...tasks]) if (task.at <= now && tasks.delete(key)) task.fn(); } };
}

test('autosave coalesces rapid edits, forces a maximum wait and writes only the latest revision', async () => {
  const timers = clock(), saved = [], statuses = [];
  const saver = new Autosave({ async save(city, id) { saved.push([city.name, id]); return { updatedAt: 10 }; } }, status => statuses.push(status), { timers, delay: 100, maxWait: 300 });
  for (let i = 0; i < 4; i++) { saver.schedule({ name: String(i) }, 'p'); timers.advance(80); }
  await saver.flush();
  assert.deepEqual(saved, [['3', 'p']]);
  assert.equal(statuses.at(-1).state, 'saved'); assert.equal(saver.dirty, false);
  saver.schedule({ name: 'new' }, 'p'); timers.advance(100); await saver.flush();
  assert.equal(saved.length, 2);
  saver.dispose(); timers.advance(1000); assert.equal(saved.length, 2);
});

test('in-flight writes are serialized, newer edits survive and project switching keeps independent keys', async () => {
  let finish;
  const saved = [];
  const saver = new Autosave({ async save(city, id) {
    saved.push([city.name, id]);
    if (saved.length === 1) await new Promise(resolve => { finish = resolve; });
    return { updatedAt: saved.length };
  } }, () => {}, { timers: clock() });
  saver.schedule({ name: 'first' }, 'old'); const writer = saver.flush();
  saver.schedule({ name: 'stale' }, 'new'); saver.schedule({ name: 'latest' }, 'new');
  assert.equal(saver.flush(), writer); finish(); await writer;
  assert.deepEqual(saved, [['first', 'old'], ['latest', 'new']]); assert.equal(saver.dirty, false);
  saver.dispose();
});

test('storage failure retains pending work, reports error and allows retry without replacing the last recovery copy', async () => {
  let fail = true; const statuses = [], stored = { name: 'previous' };
  const saver = new Autosave({ async save(city) { if (fail) throw new Error('quota'); stored.name = city.name; return { updatedAt: 1 }; } }, s => statuses.push(s), { timers: clock() });
  saver.schedule({ name: 'edited' }, 'p');
  await assert.rejects(saver.flush(), /quota/);
  assert.equal(stored.name, 'previous'); assert.equal(saver.dirty, true); assert.equal(statuses.at(-1).state, 'error');
  fail = false; await saver.flush(); assert.equal(stored.name, 'edited'); assert.equal(saver.dirty, false); saver.dispose();
  await assert.rejects(createProjectStore(null).list(), /자동 저장소/);
});

test('recovery snapshots are bounded, validate before replacement and preserve waypoint data', () => {
  const city = createCity('blank');
  city.objects = [{ id: 'a', asset: 'house', x: 0, z: 0, rotation: 0 }, { id: 'b', asset: 'house', x: 20, z: 0, rotation: 0 }];
  city.connections = [{ id: 'line', from: 'a', to: 'b', type: 'power', color: '#f4c95d', radius: 0.4, clearance: 2, speed: 4, direction: 'forward', route: 'straight', animated: true, visible: true, waypoints: [{ x: 10, z: 10 }] }];
  let previous;
  for (let i = 0; i < 5; i++) previous = projectRecord({ ...city, name: `City ${i}` }, 'p', previous, i);
  assert.equal(previous.snapshots.length, MAX_SNAPSHOTS);
  assert.deepEqual(previous.snapshots.map(s => s.savedAt), [4, 3, 2]);
  assert.deepEqual(validateCity(structuredClone(previous.snapshots[0].city)).connections, city.connections);
  assert.throws(() => projectRecord({ ...city, version: 100 }, 'p', previous));
  assert.equal(previous.snapshots[0].city.name, 'City 4');
});

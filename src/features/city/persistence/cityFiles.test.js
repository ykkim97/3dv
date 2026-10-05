import test from 'node:test';
import assert from 'node:assert/strict';
import { cityFileName, saveCityFile } from './cityFiles.js';
import { createCity } from '../core/cityState.js';
import { expandCity } from '../core/mapExpansion.js';
import { validateCity } from '../core/cityValidation.js';

test('city filenames keep Korean names, normalize extensions and avoid invalid Windows names', () => {
  assert.equal(cityFileName('우리 도시'), '우리 도시.city.json');
  assert.equal(cityFileName('도시.city.json'), '도시.city.json');
  assert.equal(cityFileName('도시.JSON'), '도시.city.json');
  assert.equal(cityFileName('CON'), '_CON.city.json');
  assert.equal(cityFileName('a/b:c'), 'a_b_c.city.json');
  assert.throws(() => cityFileName('  '));
});

test('desktop export delegates to the native save dialog and preserves cancellation', async () => {
  const city = createCity('blank');
  let call;
  const options = { desktop: true, desktopSave: async (...args) => { call = args; return true; } };
  assert.equal(await saveCityFile(city, '백업', options), 'saved');
  assert.equal(call[0], city);
  assert.equal(call[1], '백업.city.json');
  assert.equal(await saveCityFile(city, '백업', { desktop: true, desktopSave: async () => false }), 'cancelled');
});

test('browser export writes an expanded city to the chosen file and awaits close', async () => {
  const city = expandCity(createCity('blank'));
  let contents, request, closed = false;
  const runtime = { showSaveFilePicker: async options => {
    request = options;
    return { createWritable: async () => ({ write: async value => { contents = value; }, close: async () => { closed = true; } }) };
  } };
  assert.equal(await saveCityFile(city, '확장 도시', { runtime, desktop: false }), 'saved');
  assert.equal(request.suggestedName, '확장 도시.city.json');
  assert.equal(closed, true);
  const saved = validateCity(JSON.parse(contents));
  assert.deepEqual(saved, city);
  assert.equal(city.name, '빈 평지', 'file naming does not rename the city');
});

test('picker cancellation writes nothing, permission and write failures stay visible', async () => {
  const city = createCity('blank');
  const cancel = Object.assign(new Error('cancel'), { name: 'AbortError' });
  assert.equal(await saveCityFile(city, '도시', { desktop: false, runtime: { showSaveFilePicker: async () => { throw cancel; } } }), 'cancelled');
  await assert.rejects(saveCityFile(city, '도시', { desktop: false, runtime: { showSaveFilePicker: async () => { throw new Error('Permission denied'); } } }), /Permission denied/);
  let aborted = false, closed = false;
  const runtime = { showSaveFilePicker: async () => ({ createWritable: async () => ({
    write: async () => { throw new Error('Disk full'); }, close: async () => { closed = true; }, abort: async () => { aborted = true; },
  }) }) };
  await assert.rejects(saveCityFile(city, '도시', { desktop: false, runtime }), /Disk full/);
  assert.equal(aborted, true); assert.equal(closed, false);
});

test('unsupported browsers request a named download and release its URL', async () => {
  let clicked = false, removed = false, revoked = false, filename;
  const link = { click() { clicked = true; filename = this.download; }, remove() { removed = true; } };
  const runtime = { document: { createElement: () => link, body: { appendChild() {} } },
    URL: { createObjectURL: () => 'blob:city', revokeObjectURL: () => { revoked = true; } }, setTimeout: fn => fn() };
  assert.equal(await saveCityFile(createCity('blank'), '도시', { desktop: false, runtime }), 'downloaded');
  assert.equal(filename, '도시.city.json');
  assert.ok(clicked && removed && revoked);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { readSceneFile } from './importSceneFile.js';
import { createCity } from '../core/cityState.js';
import { createSceneProject } from './projectModel.js';

const file = (contents, size = Buffer.byteLength(contents)) => ({ size, text: async () => contents });

const demoUrl = new URL('../../../../artifacts/smart-grid-pages-demo/Smart_Grid_Connected_Demo.project.json', import.meta.url);
test('the supplied four-page demo imports as a project through the shared file loader', { skip: !existsSync(demoUrl) }, async () => {
  const contents = await fs.readFile(demoUrl, 'utf8');
  const result = await readSceneFile(file(contents));
  assert.equal(result.kind, 'project');
  assert.equal(result.value.pages.length, 4);
  const ids = new Set(result.value.pages.map(p => p.id));
  assert.ok(result.value.pages.every(p => p.city.portals.every(portal => ids.has(portal.targetPageId))));
  assert.equal((await readSceneFile(file(contents, 9_000_000))).kind, 'project', 'projects can exceed the single-city limit');
  const invalid = JSON.parse(contents); invalid.pages[0].city.portals[0].targetPageId = 'missing';
  await assert.rejects(readSceneFile(file(JSON.stringify(invalid))), /목적지/);
});

test('single-city imports remain supported and malformed or oversized files fail before mutation', async () => {
  const city = JSON.stringify(createCity('blank'));
  assert.equal((await readSceneFile(file(city))).kind, 'city');
  const project = JSON.stringify(createSceneProject(JSON.parse(city)));
  assert.equal((await readSceneFile(file(project, 9_000_000))).kind, 'project');
  await assert.rejects(readSceneFile(file(city, 9_000_000)), /8MB/);
  await assert.rejects(readSceneFile(file(city, 65 * 1024 * 1024)), /64 MB/);
  await assert.rejects(readSceneFile(file('{')), /JSON/);
  await assert.rejects(readSceneFile(file('null')), /지원하지/);
});

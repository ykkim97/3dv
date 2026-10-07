import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS, CATEGORIES, assetById } from './catalog.js';
import { filterLibrary, libraryCategory, libraryGroups } from './libraryGroups.js';

test('every preset appears once in the library and old simulation categories remain unchanged', () => {
  const listed = CATEGORIES.flatMap(category => filterLibrary(ASSETS, category.id));
  assert.equal(listed.length, ASSETS.length);
  assert.equal(new Set(listed.map(asset => asset.id)).size, ASSETS.length);
  assert.equal(assetById['smart-factory'].category, 'commercial');
  assert.equal(libraryCategory(assetById['smart-factory']), 'industrial');
  for (const category of CATEGORIES) {
    assert.equal(libraryGroups(category.id, ASSETS).reduce((sum, group) => sum + group.count, 0), filterLibrary(ASSETS, category.id).length);
  }
});

test('search matches names, roles and groups while respecting both filters', () => {
  assert.deepEqual(filterLibrary(ASSETS, 'power', 'charging', '충전').map(asset => asset.id), ['ess', 'fast-charger', 'slow-charger']);
  assert.deepEqual(filterLibrary(ASSETS, 'power', 'renewable', '태양광 주차').map(asset => asset.id), ['solar-carport']);
  assert.equal(filterLibrary(ASSETS, 'power', 'charging', '태양광').length, 0);
  assert.equal(filterLibrary(ASSETS, 'industrial', 'all', '  SMART-FACTORY  ').length, 1);
  assert.equal(filterLibrary(ASSETS, 'water', 'all', '재생에너지').length, 0);
});

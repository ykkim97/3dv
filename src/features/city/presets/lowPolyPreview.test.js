import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS, ROAD_TYPES, PLOT_TYPES, PRESETS } from './catalog.js';
import { BRIDGE_PRESETS } from './bridgePresets.js';
import { lowPolyPreview } from './lowPolyPreview.js';

test('all facility, plot, road and bridge thumbnails are distinct and fit the SVG canvas', () => {
  const signatures = new Set();
  for (const [kind, assets] of [['asset', ASSETS], ['plot', PLOT_TYPES], ['road', ROAD_TYPES], ['bridge', BRIDGE_PRESETS], ['world', PRESETS]]) {
    for (const asset of assets) {
      const parts = lowPolyPreview(asset, kind);
      assert.ok(parts.length > 3 && parts.length < 200, `${kind}/${asset.id}: bounded SVG detail`);
      const signature = JSON.stringify(parts);
      assert.ok(!signatures.has(signature), `${kind}/${asset.id}: distinctive silhouette or details`);
      signatures.add(signature);
      for (const part of parts) {
        assert.match(part.fill, /^#[a-f0-9]{6}$/i);
        const points = part.text ? [[part.x, part.y]] : part.points.split(' ').map(pair => pair.split(',').map(Number));
        for (const [x, y] of points) assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 160 && y >= 0 && y <= 104, `${asset.id} stays inside viewBox: ${x}, ${y}`);
      }
    }
  }
});

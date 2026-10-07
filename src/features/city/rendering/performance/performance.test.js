import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from '../../core/cityState.js';
import { performanceControls } from './performanceControls.js';
import { qualityScale, normalizeQuality } from './renderQuality.js';
import { pointerControls } from '../../interaction/pointerControls.js';
import { nextFrameTime } from './frameTiming.js';

test('quality controls bound pixel density, keep service assessment independent and cache by scene revision', () => {
  assert.equal(qualityScale('low', 3), 3);
  assert.equal(qualityScale('balanced', 3), 2);
  assert.equal(qualityScale('high', 3), 1.5);
  assert.equal(qualityScale('high', 1), 1);
  assert.deepEqual(normalizeQuality({ preset: 'bad', fpsLimit: -1 }), { preset: 'balanced', fpsLimit: 60, motion: true });
  const editor = { ...performanceControls, city: createCity('blank'), engine: { setHardwareScalingLevel() {} }, scene: {}, invalidateShadows() {} };
  const original = editor.getUtilityService();
  assert.equal(editor.getUtilityService(), original);
  editor.setRenderQuality({ preset: 'low', fpsLimit: 30, motion: false });
  assert.equal(editor.scene.shadowsEnabled, false);
  assert.equal(editor.getUtilityService(), original);
  editor.city = { ...editor.city, objects: [{ id: 'new', asset: 'house', x: 0, z: 0, rotation: 0 }] };
  assert.notEqual(editor.getUtilityService(), original);
  editor.setRenderQuality({ preset: 'balanced' });
  assert.equal(editor.scene.shadowsEnabled, true);
});

test('selection and connection mouse movement skip hit tests while placement still picks terrain', () => {
  let picks = 0;
  const editor = { ...pointerControls, city: createCity('blank'), pick() { picks++; return { hit: false }; }, ring: { setEnabled() {} }, brushSpokes: { setEnabled() {} } };
  for (const mode of ['select', 'connect', 'waypoint', 'bulldoze']) { editor.options = { mode }; editor.move({ clientX: 4, clientY: 5 }); }
  assert.equal(picks, 0);
  editor.options = { mode: 'build' }; editor.move({ clientX: 4, clientY: 5 });
  assert.equal(picks, 1);
});

test('frame pacing reaches the requested rate on 60, 120 and 144 Hz displays without bursts after a stall', () => {
  for (const refresh of [60, 120, 144]) for (const fps of [30, 60]) {
    let next = null, frames = 0;
    for (let tick = 0; tick < refresh * 10; tick++) {
      const now = tick * 1000 / refresh;
      if (next != null && now < next - 0.5) continue;
      next = nextFrameTime(now, next, 1000 / fps); frames++;
    }
    assert.ok(Math.abs(frames / 10 - fps) < 0.2, `${refresh} Hz / ${fps} FPS: ${frames / 10}`);
  }
  assert.equal(nextFrameTime(5000, 16, 20), 5020);
});

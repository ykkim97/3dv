import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import { calculateUtilityService } from '../../simulation/utilityService.js';
import { normalizeQuality, qualityScale } from './renderQuality.js';

export const performanceControls = {
  getUtilityService() {
    if (this.utilityCity !== this.city) { this.utilityCity = this.city; this.utilityService = calculateUtilityService(this.city); }
    return this.utilityService;
  },
  setRenderQuality(value) {
    this.renderQuality = normalizeQuality(value);
    this.engine.setHardwareScalingLevel(qualityScale(this.renderQuality.preset, typeof window === 'undefined' ? 1 : window.devicePixelRatio));
    this.scene.shadowsEnabled = this.renderQuality.preset !== 'low';
    this.lastRenderAt = null;
    this.nextRenderAt = null; this.frameMeter = null;
    this.invalidateShadows();
  },
  setPerformanceMonitoring(enabled) {
    this.performanceInstrumentation?.dispose(); this.performanceInstrumentation = null;
    if (enabled) this.performanceInstrumentation = new SceneInstrumentation(this.scene);
  },
  performanceSnapshot() {
    const meter = this.frameMeter;
    return {
      fps: meter?.fps || 0, renderMS: meter?.renderMS || 0,
      meshes: this.scene.meshes.length, activeMeshes: this.scene.getActiveMeshes().length,
      drawCalls: this.performanceInstrumentation?.drawCallsCounter.current || 0,
      width: this.engine.getRenderWidth(), height: this.engine.getRenderHeight(),
      connections: this.flowNodes?.size || 0, batches: this.flowBatches?.size || 0,
    };
  },
  recordFrame(now, renderMS) {
    this.frameMeter ||= { since: now, frames: 0, cost: 0, fps: 0, renderMS: 0 };
    const meter = this.frameMeter;
    meter.frames++; meter.cost += renderMS;
    if (now - meter.since >= 1000) {
      meter.fps = meter.frames * 1000 / (now - meter.since); meter.renderMS = meter.cost / meter.frames;
      meter.since = now; meter.frames = 0; meter.cost = 0;
    }
  },
};

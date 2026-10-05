import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { assetById } from '../../presets/catalog.js';
import { WORLD_SIZE, mapDimensions } from '../../core/mapDimensions.js';
import { terrainHeight } from '../../terrain/terrainModel.js';

export const cameraControls = {
  view(type) {
    const scale = mapDimensions(this.city).size / WORLD_SIZE;
    if (type === 'top') { this.camera.beta = 0.03; this.camera.alpha = -Math.PI / 2; }
    else { this.camera.alpha = -Math.PI / 2.8; this.camera.beta = 0.83; this.camera.radius = 205 * scale; this.camera.setTarget(new Vector3(-13, 0, 4)); }
  },
  cameraState() {
    const target = this.camera.getTarget();
    return { alpha: this.camera.alpha, beta: this.camera.beta, radius: this.camera.radius, target: { x: target.x, y: target.y, z: target.z } };
  },
  restoreCamera(view) {
    this.camera.alpha = view.alpha; this.camera.beta = view.beta; this.camera.radius = view.radius;
    this.camera.setTarget(new Vector3(view.target.x, view.target.y, view.target.z));
  },
  async captureImage() {
    const guides = [this.grid, this.ring, this.brushSpokes, this.preview, this.roadPreview, this.roadSnapMarker, this.plotAnchor, this.targetCell, this.targetBorder, this.alignmentGuide, ...(this.selectionFrames || []), ...(this.serviceGuides || []), ...(this.districtMeshes || []), ...this.scene.meshes.filter(mesh => ['plot-corner', 'road-endpoint', 'plot-boundary'].includes(mesh.name))].filter(Boolean);
    const states = guides.map(node => [node, node.isEnabled()]);
    const overlays = this.scene.meshes.filter(mesh => mesh.renderOverlay);
    try {
      states.forEach(([node]) => node.setEnabled(false)); overlays.forEach(mesh => { mesh.renderOverlay = false; });
      this.scene.render();
      return await new Promise((resolve, reject) => this.canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지를 저장하지 못했습니다.')), 'image/png'));
    } finally {
      states.forEach(([node, enabled]) => { if (!node.isDisposed()) node.setEnabled(enabled); });
      overlays.forEach(mesh => { if (!mesh.isDisposed()) mesh.renderOverlay = true; });
    }
  },
  focusPoint(x, z, radius = this.camera.radius) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const { half, cameraLimit } = mapDimensions(this.city);
    x = Math.max(-half, Math.min(half, x));
    z = Math.max(-half, Math.min(half, z));
    this.camera.setTarget(new Vector3(x, Math.max(0, terrainHeight(this.city.heights, x, z)), z));
    this.camera.radius = Math.max(25, Math.min(cameraLimit, radius));
  },
  focusEntity(id) {
    const water = this.waterRegions?.find(region => region.id === id);
    if (water) { this.focusPoint(water.x, water.z, Math.max(40, Math.min(180, Math.sqrt(water.cells.length) * 3))); return; }
    const object = this.city.objects.find(item => item.id === id);
    const plot = this.city.plots.find(item => item.id === id);
    const road = this.city.roads.find(item => item.id === id);
    const item = object || plot;
    if (item) {
      const spec = object ? assetById[object.asset] : plot;
      this.focusPoint(item.x, item.z, Math.max(38, Math.max(spec.width, spec.depth, spec.height || 0) * 3));
    } else if (road) this.focusPoint((road.a.x + road.b.x) / 2, (road.a.z + road.b.z) / 2, Math.max(40, Math.hypot(road.a.x - road.b.x, road.a.z - road.b.z) * 1.4));
  }
};

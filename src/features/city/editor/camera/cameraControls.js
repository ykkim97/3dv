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
import { footprint } from '../../placement/footprint.js';
import { objectBaseHeight, plotTopHeight } from '../../plots/plotModel.js';
import { selectionFrame } from './frameSelection.js';

export const cameraControls = {
  frameEntities(ids, viewport) {
    const boxes = ids.map(id => {
      const node = this.nodes?.find(n => n.name === id);
      if (node) { const { min, max } = node.getHierarchyBoundingVectors(); return { min, max }; }
      const object = this.city.objects.find(o => o.id === id), plot = this.city.plots.find(p => p.id === id);
      if (object || plot) {
        const item = object || plot, size = object ? footprint(object.asset, object.rotation) : plot;
        const y = object ? objectBaseHeight(this.city, object) : plotTopHeight(this.city, plot);
        return { min: new Vector3(item.x - size.width / 2, y, item.z - size.depth / 2), max: new Vector3(item.x + size.width / 2, y + (object ? assetById[object.asset].height : 0.3), item.z + size.depth / 2) };
      }
      return null;
    }).filter(Boolean);
    if (!boxes.length || !viewport.width || !viewport.height) return false;
    const bounds = boxes.reduce((b, box) => ({ min: Vector3.Minimize(b.min, box.min), max: Vector3.Maximize(b.max, box.max) }));
    const frame = selectionFrame(bounds, this.camera, viewport);
    this.camera.inertialAlphaOffset = this.camera.inertialBetaOffset = this.camera.inertialRadiusOffset = 0;
    this.camera.inertialPanningX = this.camera.inertialPanningY = 0;
    this.camera.lowerRadiusLimit = Math.min(2, frame.radius);
    this.camera.upperRadiusLimit = Math.max(this.camera.upperRadiusLimit || 0, frame.radius);
    this.camera.setTarget(frame.target, false, true, true); this.camera.radius = frame.radius;
    this.camera.targetScreenOffset.set(frame.screenOffset.x, frame.screenOffset.y);
    return true;
  },
  view(type) {
    this.camera.targetScreenOffset.set(0, 0);
    const scale = mapDimensions(this.city).size / WORLD_SIZE;
    if (type === 'top') { this.camera.beta = 0.03; this.camera.alpha = -Math.PI / 2; }
    else { this.camera.alpha = -Math.PI / 2.8; this.camera.beta = 0.83; this.camera.radius = 205 * scale; this.camera.setTarget(new Vector3(-13, 0, 4)); }
  },
  cameraState() {
    const target = this.camera.getTarget();
    const offset = this.camera.targetScreenOffset;
    return { alpha: this.camera.alpha, beta: this.camera.beta, radius: this.camera.radius, target: { x: target.x, y: target.y, z: target.z }, screenOffset: { x: offset.x, y: offset.y } };
  },
  restoreCamera(view) {
    this.camera.alpha = view.alpha; this.camera.beta = view.beta; this.camera.radius = view.radius;
    this.camera.setTarget(new Vector3(view.target.x, view.target.y, view.target.z), false, true, true);
    this.camera.targetScreenOffset.set(view.screenOffset?.x || 0, view.screenOffset?.y || 0);
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
    this.camera.targetScreenOffset.set(0, 0);
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

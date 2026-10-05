import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { terrainHeight } from '../terrain/terrainModel.js';
import { PLOT_ELEVATION, plotTopHeight } from '../plots/plotModel.js';

export const selection = {
  select(id) {
    this.clearSelectionFrames();
    this.selectedId = Array.isArray(id) ? null : id;
    const ids = new Set(Array.isArray(id) ? id : id ? [id] : []);
    for (const root of this.nodes) {
      const selected = ids.has(root.metadata?.objectId) || ids.has(root.metadata?.roadId) || ids.has(root.metadata?.plotId);
      for (const mesh of root.getChildMeshes()) {
        mesh.renderOverlay = selected;
        mesh.overlayColor = new Color3(0.3, 1, 0.7); mesh.overlayAlpha = 0.16;
        if (mesh.name === 'plot-corner') {
          mesh.setEnabled(root.metadata?.plotId === this.selectedId && !this.city.plots.find(plot => plot.id === this.selectedId)?.locked);
          mesh.scaling.setAll(2.2);
        }
        if (mesh.name === 'road-endpoint') mesh.setEnabled(root.metadata?.roadId === this.selectedId && !this.city.roads.find(road => road.id === this.selectedId)?.locked);
      }
      if (selected) this.addSelectionFrame(root);
    }
    for (const root of this.waterNodes || []) if (root.metadata.waterId === this.selectedId) this.addSelectionFrame(root);
    this.refreshInfoOverlay();
    this.updateServiceGuides();
  },
  clearSelectionFrames() {
    for (const frame of this.selectionFrames || []) frame.dispose();
    this.selectionFrames = [];
  },
  beginBoxSelection(event) {
    this.cancelBoxSelection();
    this.boxSelection = { x: event.clientX, y: event.clientY };
    this.camera.detachControl(); this.boxCameraDetached = true;
    this.boxElement = document.createElement('div'); this.boxElement.className = 'box-selection'; document.body.appendChild(this.boxElement);
    this.canvas.setPointerCapture(event.pointerId); this.updateBoxSelection(event);
  },
  updateBoxSelection(event) {
    const start = this.boxSelection;
    if (!start || !this.boxElement) return;
    Object.assign(this.boxElement.style, { left: `${Math.min(start.x, event.clientX)}px`, top: `${Math.min(start.y, event.clientY)}px`, width: `${Math.abs(start.x - event.clientX)}px`, height: `${Math.abs(start.y - event.clientY)}px` });
  },
  cancelBoxSelection() {
    this.boxElement?.remove(); this.boxElement = null; this.boxSelection = null;
    if (this.boxCameraDetached) { this.camera.attachControl(this.canvas, true); this.boxCameraDetached = false; }
  },
  finishBoxSelection(event) {
    const start = this.boxSelection; this.cancelBoxSelection();
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) {
      const meta = this.pick(event, false).pickedMesh?.metadata;
      const id = meta?.objectId || meta?.plotId || meta?.roadId;
      if (id) this.onSelect(id, true, meta.objectId ? 'object' : meta.plotId ? 'plot' : 'road');
      return;
    }
    const rect = this.canvas.getBoundingClientRect(), viewport = this.camera.viewport.toGlobal(rect.width, rect.height);
    const ids = [...this.city.objects, ...this.city.plots, ...this.city.roads].filter(item => {
      const x = item.a ? (item.a.x + item.b.x) / 2 : item.x, z = item.a ? (item.a.z + item.b.z) / 2 : item.z;
      const point = Vector3.Project(new Vector3(x, Math.max(0, terrainHeight(this.city.heights, x, z)) + 0.4, z), Matrix.Identity(), this.scene.getTransformMatrix(), viewport);
      return point.z >= 0 && point.z <= 1 && point.x + rect.left >= Math.min(start.x, event.clientX) && point.x + rect.left <= Math.max(start.x, event.clientX) && point.y + rect.top >= Math.min(start.y, event.clientY) && point.y + rect.top <= Math.max(start.y, event.clientY);
    }).map(item => item.id);
    this.onSelect(ids, false, 'mixed'); this.onMessage(`${ids.length}개 대상을 선택했습니다.`);
  },
  addSelectionFrame(root) {
    let minimum, maximum;
    const plot = this.city.plots.find(item => item.id === root.metadata?.plotId);
    if (plot) {
      const top = plotTopHeight(this.city, plot);
      minimum = new Vector3(plot.x - plot.width / 2, top - PLOT_ELEVATION, plot.z - plot.depth / 2);
      maximum = new Vector3(plot.x + plot.width / 2, top + 0.1, plot.z + plot.depth / 2);
    } else {
      for (const mesh of root.getChildMeshes()) {
        if (!mesh.isEnabled()) continue;
        mesh.computeWorldMatrix(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        minimum = minimum ? Vector3.Minimize(minimum, bounds.minimumWorld) : bounds.minimumWorld.clone();
        maximum = maximum ? Vector3.Maximize(maximum, bounds.maximumWorld) : bounds.maximumWorld.clone();
      }
    }
    if (!minimum || !maximum) return;
    minimum.subtractInPlace(new Vector3(0.12, 0.08, 0.12));
    maximum.addInPlace(new Vector3(0.12, 0.08, 0.12));
    const size = maximum.subtract(minimum);
    const center = minimum.add(maximum).scale(0.5);
    const thickness = Math.max(0.08, Math.min(0.14, Math.max(size.x, size.y, size.z) * 0.005));
    const material = this.material('selection-bounds', '#61ff83');
    material.diffuseColor = Color3.Black();
    material.emissiveColor = Color3.FromHexString('#61ff83');
    material.disableLighting = true;
    material.fogEnabled = false;
    const edges = [];
    const edge = (width, height, depth, x, y, z) => {
      const mesh = MeshBuilder.CreateBox('selection-edge', { width, height, depth }, this.scene);
      mesh.position.set(x, y, z);
      mesh.material = material;
      edges.push(mesh);
    };
    for (const y of [minimum.y, maximum.y]) for (const z of [minimum.z, maximum.z]) edge(size.x, thickness, thickness, center.x, y, z);
    for (const x of [minimum.x, maximum.x]) for (const z of [minimum.z, maximum.z]) edge(thickness, size.y, thickness, x, center.y, z);
    for (const x of [minimum.x, maximum.x]) for (const y of [minimum.y, maximum.y]) edge(thickness, thickness, size.z, x, y, center.z);
    const frame = Mesh.MergeMeshes(edges, true, true);
    if (frame) {
      frame.name = 'selection-bounds';
      frame.isPickable = false;
      frame.renderingGroupId = 1;
      this.selectionFrames.push(frame);
    }
  }
};

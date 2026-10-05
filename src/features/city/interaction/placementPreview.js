import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { terrainHeight } from '../terrain/terrainModel.js';
import { plotFromCorners } from '../plots/plotModel.js';
import { plotTopHeight } from '../plots/plotModel.js';
import { roadJunctions } from '../roads/roadGeometry.js';
import { roadDraft, planRoadDraft } from '../placement/cityExpansion.js';

export const placementPreview = {
  clearPreview() {
    this.cancelBoxSelection();
    this.roadSnapMarker?.dispose(); this.roadSnapMarker = null;
    this.alignmentGuide?.dispose(); this.alignmentGuide = null;
    this.plotAnchor?.dispose(); this.plotAnchor = null;
    this.preview?.dispose(false, true); this.preview = null;
    this.targetCell?.dispose(false, true); this.targetCell = null;
    this.targetBorder?.dispose(); this.targetBorder = null;
    this.roadPreview?.dispose(); this.roadPreview = null;
    this.ring.setEnabled(false);
    this.brushSpokes.setEnabled(false);
    this.onBrushMove?.(null);
  },
  createPlacementPreview(assetId) {
    const root = this.buildObject({ id: '__placement-preview', asset: assetId, x: 0, z: 0, rotation: 0 });
    this.nodes = this.nodes.filter(node => node !== root);
    root.metadata = null;
    for (const mesh of root.getChildMeshes()) {
      this.shadows.removeShadowCaster(mesh);
      mesh.material = mesh.material.clone(`preview-${assetId}-${mesh.uniqueId}`);
      mesh.material.alpha = 0.62;
      mesh.material.emissiveColor = new Color3(0.16, 0.22, 0.18);
      mesh.isPickable = false;
      mesh.metadata = null;
      mesh.receiveShadows = false;
    }
    this.preview = root;
  },
  createTargetCell() {
    this.targetCell = MeshBuilder.CreateGround('placement-cell', { width: 1, height: 1 }, this.scene);
    this.targetCell.isPickable = false;
    const material = new StandardMaterial('placement-cell-material', this.scene);
    material.disableLighting = true;
    material.alpha = 0.36;
    material.backFaceCulling = false;
    this.targetCell.material = material;
    this.targetBorder = MeshBuilder.CreateLines('placement-boundary', {
      points: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]].map(([x, z]) => new Vector3(x, 0, z)),
    }, this.scene);
    this.targetBorder.isPickable = false;
  },
  showTargetCell(x, z, y, width, depth, problem) {
    if (!this.targetCell) this.createTargetCell();
    this.targetCell.setEnabled(true);
    this.targetBorder.setEnabled(true);
    const color = Color3.FromHexString(problem ? '#ff7770' : '#75e9ac');
    this.targetCell.position.set(x, y + 0.13, z);
    this.targetCell.scaling.set(width, 1, depth);
    this.targetCell.material.diffuseColor = color;
    this.targetCell.material.emissiveColor = color.scale(0.55);
    this.targetBorder.position.set(x, y + 0.16, z);
    this.targetBorder.scaling.set(width, 1, depth);
    this.targetBorder.color = color;
  },
  showAlignmentGuides(guides) {
    if (!guides) { this.alignmentGuide?.setEnabled(false); return; }
    const { plot, x, z } = guides;
    const y = plotTopHeight(this.city, plot) + 0.22;
    const lines = [
      [new Vector3(x ?? plot.x, y, plot.z - plot.depth / 2), new Vector3(x ?? plot.x, y, plot.z + plot.depth / 2)],
      [new Vector3(plot.x - plot.width / 2, y, z ?? plot.z), new Vector3(plot.x + plot.width / 2, y, z ?? plot.z)],
    ];
    if (x === null) lines[0][1] = lines[0][0].clone();
    if (z === null) lines[1][1] = lines[1][0].clone();
    if (this.alignmentGuide) MeshBuilder.CreateLineSystem('building-alignment', { lines, instance: this.alignmentGuide });
    else {
      this.alignmentGuide = MeshBuilder.CreateLineSystem('building-alignment', { lines, updatable: true }, this.scene);
      this.alignmentGuide.color = Color3.FromHexString('#f2df8e');
      this.alignmentGuide.isPickable = false;
    }
    this.alignmentGuide.setEnabled(true);
  },
  updatePlotDraft(point) {
    if (!this.plotStart) return;
    if (Math.abs(point.x - this.plotStart.x) < 2 && Math.abs(point.z - this.plotStart.z) < 2 && !this.plotMoved) return;
    this.plotMoved = true;
    this.plotDraft = plotFromCorners(this.plotStart, point, this.city);
  },
  cancelPlotDraft() {
    this.roadEnd = null; this.pendingRoadStart = null;
    this.plotStart = null;
    this.plotDraft = null;
    this.plotMoved = false;
    this.clearPreview();
    this.cancelPlotEdit();
    this.cancelRoadEdit();
  },
  showRoadPreview(road, problem) {
    this.roadPreview?.dispose(); this.roadPreview = null;
    if (Math.hypot(road.b.x - road.a.x, road.b.z - road.a.z) < 0.01) return;
    this.roadPreview = this.buildRoad({ ...road, id: '__road-preview' }, true, problem);
  },
  showRoadSnap(point) {
    if (!this.roadSnapMarker) {
      this.roadSnapMarker = MeshBuilder.CreateTorus('road-snap-marker', { diameter: 1.8, thickness: 0.14, tessellation: 32 }, this.scene);
      this.roadSnapMarker.material = this.material('road-snap-marker', '#8df5c0');
      this.roadSnapMarker.material.emissiveColor = Color3.FromHexString('#58bc86');
      this.roadSnapMarker.isPickable = false;
    }
    this.roadSnapMarker.position.set(point.x, Math.max(0.25, terrainHeight(this.city.heights, point.x, point.z)) + 0.55, point.z);
    this.roadSnapMarker.scaling.setAll(point.kind === 'grid' ? 0.65 : 1);
    this.roadSnapMarker.setEnabled(true);
  },
  showRoadDraft(end) {
    const points = roadDraft(this.roadStart, this.roadEnd || end, this.options.roadShape, this.roadEnd ? end : null);
    const plan = planRoadDraft(this.city, points, this.options.road, '__draft', this.options.bridge);
    this.roadPreview?.dispose();
    this.roadPreview = new TransformNode('road-draft-preview', this.scene);
    const roads = points.slice(1).map((b, i) => ({ id: `__draft:${i}`, chainId: '__draft', type: this.options.road, bridge: this.options.bridge || undefined, a: points[i], b }));
    this.previewNetwork = { ...this.city, roads: [...this.city.roads, ...roads] };
    this.previewConnections = roadJunctions(this.previewNetwork);
    try { for (const road of roads) if (Math.hypot(road.b.x - road.a.x, road.b.z - road.a.z) > 0.01) this.buildRoad(road, true, plan.problem).parent = this.roadPreview; }
    finally { this.previewNetwork = null; this.previewConnections = null; }
    return { problem: plan.problem, length: roads.reduce((sum, road) => sum + Math.hypot(road.b.x - road.a.x, road.b.z - road.a.z), 0) };
  }
};

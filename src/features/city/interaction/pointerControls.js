import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { connectionIdFromPick } from '../connections/connectionRendering.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { assetById, PLOT_TYPES } from '../presets/catalog.js';
import { terrainHeight } from '../terrain/terrainModel.js';
import { placementProblem } from '../placement/placementRules.js';
import { plotProblem, plotFromCorners } from '../plots/plotModel.js';
import { containingPlot, footprint } from '../placement/footprint.js';
import { snapRoadPoint } from '../roads/roadModel.js';
import { snapBuildingPlacement, placementDistances } from '../placement/alignment.js';
import { PLOT_ELEVATION, plotSurface, plotTopHeight } from '../plots/plotModel.js';
import { bridgeById } from '../presets/bridgePresets.js';

export const pointerControls = {
  setOptions(options) {
    const changed = this.options.mode !== options.mode || this.options.asset !== options.asset || this.options.road !== options.road || this.options.bridge !== options.bridge || this.options.roadShape !== options.roadShape || this.options.plot !== options.plot || this.options.rotation !== options.rotation || this.options.surface !== options.surface || this.options.align !== options.align || this.options.gap !== options.gap || this.options.movingId !== options.movingId;
    const plotChanged = this.options.mode !== options.mode || this.options.plot !== options.plot;
    this.options = options;
    if (options.mode !== 'select') this.cancelPlotEdit();
    if (options.mode !== 'select') this.cancelRoadEdit();
    if (changed) { this.clearPreview(); this.roadStart = null; this.roadEnd = null; this.pendingRoadStart = null; if (plotChanged) { this.plotStart = null; this.plotDraft = null; this.plotMoved = false; } }
    this.canvas.style.cursor = options.mode === 'select' && !options.boxSelect ? 'default' : 'crosshair';
    if (changed && this.lastPointer) this.move(this.lastPointer);
  },
  pick(event, terrainOnly = true) {
    const rect = this.canvas.getBoundingClientRect();
    return this.scene.pick(event.clientX - rect.left, event.clientY - rect.top, mesh => terrainOnly ? mesh === this.terrain : !!mesh.metadata);
  },
  move(event) {
    if (this.boxSelection) { this.updateBoxSelection(event); return; }
    this.lastPointer = { clientX: event.clientX, clientY: event.clientY };
    if (!this.city) return;
    if (this.roadEdit) { const terrain = this.pick(event); if (terrain.hit) this.updateRoadEdit(terrain.pickedPoint, event); return; }
    if (this.plotEdit) { const terrain = this.pick(event); if (terrain.hit) this.updatePlotEdit(terrain.pickedPoint, event); return; }
    const hit = this.pick(event);
    if (!hit.hit) { this.roadSnapMarker?.setEnabled(false); this.roadPreview?.setEnabled(false); this.plotAnchor?.setEnabled(false); this.alignmentGuide?.setEnabled(false); this.ring.setEnabled(false); this.brushSpokes.setEnabled(false); this.preview?.setEnabled(false); this.targetCell?.setEnabled(false); this.targetBorder?.setEnabled(false); this.onBrushMove?.(null); return; }
    const p = hit.pickedPoint;
    if (this.options.mode === 'terrain') {
      const painting = this.options.brush === 'paint';
      this.ring.color = Color3.FromHexString(painting ? this.options.paintColor : '#c9ffdf');
      this.onBrushMove?.({ x: event.clientX, y: event.clientY, label: `${painting ? `색칠 ${this.options.paintColor} · ` : ''}반경 ${this.options.radius} m` });
      const points = Array.from({ length: 65 }, (_, i) => {
        const x = p.x + Math.cos(i / 64 * Math.PI * 2) * this.options.radius;
        const z = p.z + Math.sin(i / 64 * Math.PI * 2) * this.options.radius;
        return new Vector3(x, Math.max(0, terrainHeight(this.city.heights, x, z)) + 0.35, z);
      });
      MeshBuilder.CreateLines('brush', { points, instance: this.ring }); this.ring.setEnabled(true);
      const center = new Vector3(p.x, Math.max(0, p.y) + 0.36, p.z);
      MeshBuilder.CreateLineSystem('brush-radius', { lines: [[center, points[0]], [center, points[16]]], instance: this.brushSpokes });
      this.brushSpokes.setEnabled(true);
      if (this.down) this.sculpt(p);
    } else if (this.options.mode === 'build' || this.options.mode === 'plot' || this.options.mode === 'move') {
      const isPlot = this.options.mode === 'plot';
      const moving = this.options.mode === 'move' ? this.city.objects.find(item => item.id === this.options.movingId) : null;
      if (this.options.mode === 'move' && !moving) return;
      const x = Math.round(p.x / 2) * 2, z = Math.round(p.z / 2) * 2;
      if (isPlot && !this.plotStart) {
        this.preview?.setEnabled(false);
        this.targetCell?.setEnabled(false);
        this.targetBorder?.setEnabled(false);
        if (!this.plotAnchor) {
          this.plotAnchor = MeshBuilder.CreateLineSystem('plot-start-corner', { lines: [
            [new Vector3(-0.8, 0, 0), new Vector3(0.8, 0, 0)],
            [new Vector3(0, 0, -0.8), new Vector3(0, 0, 0.8)],
          ] }, this.scene);
          this.plotAnchor.color = Color3.FromHexString('#e7ffcc');
          this.plotAnchor.isPickable = false;
        }
        const underPointer = this.city.plots.find(plot => Math.abs(x - plot.x) <= plot.width / 2 && Math.abs(z - plot.z) <= plot.depth / 2);
        const y = underPointer ? plotTopHeight(this.city, underPointer) : terrainHeight(this.city.heights, x, z);
        this.plotAnchor.position.set(x, y + 0.15, z);
        this.plotAnchor.setEnabled(true);
        this.onBrushMove?.({ x: event.clientX, y: event.clientY, label: '첫 모서리를 클릭하세요', invalid: false });
        return;
      }
      this.plotAnchor?.setEnabled(false);
      const preset = PLOT_TYPES.find(type => type.id === this.options.plot);
      if (isPlot && this.plotStart) this.updatePlotDraft({ x, z });
      const rect = isPlot ? this.plotDraft || { x, z, width: preset.width, depth: preset.depth } : null;
      const asset = isPlot ? null : assetById[moving?.asset || this.options.asset];
      if (!isPlot && !asset) return;
      if (!this.preview) {
        if (isPlot) {
          this.preview = MeshBuilder.CreateBox('plot-preview', { width: 1, height: PLOT_ELEVATION, depth: 1 }, this.scene);
          const material = new StandardMaterial('plot-preview-material', this.scene);
          material.alpha = 0.85;
          material.diffuseColor = Color3.FromHexString('#c5e5aa');
          this.preview.material = material;
          this.preview.isPickable = false;
        } else this.createPlacementPreview(asset.id);
      }
      this.preview.setEnabled(true);
      const rotation = moving?.rotation ?? this.options.rotation;
      const snapped = isPlot ? null : snapBuildingPlacement(this.city, asset.id, p, rotation, this.options.align !== false, this.options.gap ?? 1, moving?.id);
      const centerX = isPlot ? rect.x : snapped.x, centerZ = isPlot ? rect.z : snapped.z;
      const owner = !isPlot && containingPlot(this.city, asset.id, centerX, centerZ, rotation);
      const y = owner ? plotTopHeight(this.city, owner) : terrainHeight(this.city.heights, centerX, centerZ) + (isPlot ? PLOT_ELEVATION : 0);
      const size = isPlot ? rect : footprint(asset.id, rotation);
      if (isPlot) {
        this.preview.position.set(centerX, y - PLOT_ELEVATION / 2, centerZ);
        this.preview.scaling.set(rect.width, 1, rect.depth);
      } else {
        this.preview.position.set(centerX, this.placementBaseHeight({ asset: asset.id, x: centerX, z: centerZ, rotation }), centerZ);
        this.preview.rotation.y = rotation;
      }
      const problem = isPlot ? plotProblem(this.city, rect) : placementProblem(this.city, asset.id, centerX, centerZ, rotation, moving?.id);
      this.showAlignmentGuides(problem ? null : snapped?.guides);
      this.showTargetCell(centerX, centerZ, Math.max(0, y), isPlot ? Math.ceil(size.width / 2) * 2 : size.width, isPlot ? Math.ceil(size.depth / 2) * 2 : size.depth, problem);
      if (isPlot) this.preview.material.diffuseColor = Color3.FromHexString(problem ? '#ed8d80' : plotSurface(this.options.surface).color);
      if (!isPlot) for (const mesh of this.preview.getChildMeshes()) {
        mesh.renderOverlay = true;
        mesh.overlayColor = Color3.FromHexString(problem ? '#ff7770' : '#81f4b4');
        mesh.overlayAlpha = problem ? 0.3 : 0.12;
      }
      const distances = !problem && !isPlot ? placementDistances(this.city, asset.id, centerX, centerZ, rotation, moving?.id) : null;
      const measure = distances ? `경계 ${distances.boundary.toFixed(1)} m${distances.neighbor === null ? '' : ` · 최근접 시설 ${distances.neighbor.toFixed(1)} m`}` : '';
      this.onBrushMove?.({ x: event.clientX, y: event.clientY, label: problem || (isPlot ? `${rect.width} × ${rect.depth} m · 클릭하여 확정` : `${snapped.guides ? `${snapped.guides.label}에 맞춤 · ` : ''}${measure} · 클릭하여 ${moving ? '이동' : '배치'}`), invalid: !!problem });
    } else if (this.options.mode === 'road') {
      const end = snapRoadPoint(this.city.roads, p, this.city);
      this.showRoadSnap(end);
      if (!this.roadStart) {
        this.onBrushMove?.({ x: event.clientX, y: event.clientY, label: `${end.kind === 'endpoint' ? '기존 도로 끝점' : end.kind === 'junction' ? '기존 도로 중심선' : '2 m 격자'} · 클릭하여 시작` });
        return;
      }
      const { problem, length } = this.showRoadDraft(end);
      this.onBrushMove?.({ x: event.clientX, y: event.clientY, label: problem || `${this.options.bridge ? `${bridgeById[this.options.bridge].name} · ` : ''}${length.toFixed(1)} m · ${this.options.roadShape === 'curve' ? this.roadEnd ? '곡률 조절 · 클릭하여 확정' : '끝점 클릭 → 곡률 조절' : '클릭하여 확정'} · ${end.kind === 'grid' ? '2 m 격자' : '도로 연결'}`, invalid: !!problem });
    }
  },
  bindEvents() {
    this.handlers = {
      contextmenu: e => e.preventDefault(),
      pointermove: e => this.move(e),
      pointerleave: () => { this.roadSnapMarker?.setEnabled(false); this.roadPreview?.setEnabled(false); this.lastPointer = null; this.plotAnchor?.setEnabled(false); this.alignmentGuide?.setEnabled(false); this.ring.setEnabled(false); this.brushSpokes.setEnabled(false); this.onBrushMove?.(null); this.preview?.setEnabled(false); this.targetCell?.setEnabled(false); this.targetBorder?.setEnabled(false); },
      pointerdown: e => {
        if (e.button !== 0 || !this.city) return;
        const { mode } = this.options;
        if (mode === 'connect') {
          const rect = this.canvas.getBoundingClientRect();
          const hit = this.scene.pick(e.clientX - rect.left, e.clientY - rect.top, mesh => !!mesh.metadata?.objectId);
          const id = hit.pickedMesh?.metadata?.objectId;
          if (id) this.onConnectionPick?.(id);
          else this.onMessage('연결할 시설을 클릭하세요.');
          return;
        }
        if (mode === 'select' && (e.shiftKey || this.options.boxSelect) && typeof document !== 'undefined') { this.beginBoxSelection(e); return; }
        if (mode === 'select' || mode === 'bulldoze') {
          const hit = this.pick(e, false), meta = hit.pickedMesh?.metadata;
          const connectionId = connectionIdFromPick(hit);
          if (connectionId) { this.onConnectionSelect?.(connectionId); return; }
          const id = meta?.objectId || meta?.roadId || meta?.plotId || meta?.waterId;
          if (mode === 'select' && meta?.endpoint && meta?.roadId) { this.beginRoadEdit(meta.roadId, meta.endpoint, e); return; }
          if (mode === 'select' && meta?.corner !== undefined && meta?.plotId) { this.beginPlotEdit(meta.plotId, meta.corner, e); return; }
          if (mode === 'select') this.onSelect(id || null, !!e.shiftKey, meta?.objectId ? 'object' : meta?.plotId ? 'plot' : meta?.roadId ? 'road' : meta?.waterId ? 'water' : null);
          else if (id) {
            if (meta?.waterId) { this.onSelect(id, false, 'water'); this.onMessage('물 비우기는 선택한 수역의 물 설정에서 변경하세요.'); return; }
            const plot = this.city.plots.find(p => p.id === id);
            const entity = plot || this.city.objects.find(item => item.id === id) || this.city.roads.find(item => item.id === id);
            if (entity?.locked) { this.onMessage('잠긴 대상입니다. 먼저 잠금을 해제하세요.'); return; }
            if (plot && this.city.objects.some(o => Math.abs(o.x - plot.x) < plot.width / 2 && Math.abs(o.z - plot.z) < plot.depth / 2)) { this.onMessage('부지 위 시설을 먼저 철거해 주세요.'); return; }
            this.city.objects = this.city.objects.filter(o => o.id !== id);
            this.city.roads = this.city.roads.filter(r => r.id !== id);
            this.city.plots = this.city.plots.filter(p => p.id !== id);
            this.onChange(structuredClone(this.city)); this.onSelect(null);
          }
          return;
        }
        const hit = this.pick(e);
        if (!hit.hit) {
          if (mode === 'build' || mode === 'move') this.onMessage('먼저 부지를 조성한 다음, 부지 안에 시설을 배치해 주세요.');
          return;
        }
        const p = hit.pickedPoint, x = Math.round(p.x / 2) * 2, z = Math.round(p.z / 2) * 2;
        if (mode === 'terrain') {
          if (this.city.plots.some(plot => Math.abs(x - plot.x) <= plot.width / 2 && Math.abs(z - plot.z) <= plot.depth / 2)) { this.onMessage('조성된 부지는 평탄하게 유지됩니다. 주변 지형을 편집하거나 빈 부지를 철거해 주세요.'); return; }
          this.down = true; this.flattenHeight = p.y; this.canvas.setPointerCapture(e.pointerId); this.sculpt(p);
        }
        if (mode === 'build') {
          this.placeAsset(this.options.asset, p);
        }
        if (mode === 'move') this.moveObject(p);
        if (mode === 'plot') {
          if (!this.plotStart) {
            this.plotStart = { x, z };
            this.plotMoved = false;
            const preset = PLOT_TYPES.find(type => type.id === this.options.plot);
            this.plotDraft = plotFromCorners(this.plotStart, { x: x + preset.width, z: z + preset.depth }, this.city);
            this.onMessage('마우스를 움직여 두 축의 길이를 조정한 뒤 다시 클릭하세요. Esc로 취소합니다.');
          } else {
            this.updatePlotDraft({ x, z });
            this.placePlot(this.plotDraft);
          }
          this.move(e);
        }
        if (mode === 'road') {
          const end = snapRoadPoint(this.city.roads, p, this.city);
          if (!this.roadStart) { this.roadStart = end; this.onMessage('도로의 끝 지점을 클릭하세요. 기존 도로 끝·중심선과 격자에 자동으로 맞춥니다.'); }
          else if (this.options.roadShape === 'curve' && !this.roadEnd) { this.roadEnd = end; this.onMessage('마우스로 곡률을 조절한 뒤 클릭해 곡선 도로를 확정하세요.'); }
          else this.placeRoad(end);
        }
      },
      pointerup: e => { if (this.boxSelection) this.finishBoxSelection(e); else if (this.roadEdit) this.finishRoadEdit(e); else if (this.plotEdit) this.finishPlotEdit(e); else this.endStroke(e); },
      pointercancel: e => { this.cancelBoxSelection(); this.cancelRoadEdit(); this.cancelPlotEdit(); this.endStroke(e); },
      lostpointercapture: e => { this.cancelBoxSelection(); this.cancelRoadEdit(); this.cancelPlotEdit(); this.endStroke(e); },
    };
    for (const [name, handler] of Object.entries(this.handlers)) this.canvas.addEventListener(name, handler);
  },
  endStroke(event) {
    if (!this.down) return;
    this.down = false;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.onChange(structuredClone(this.city));
  }
};

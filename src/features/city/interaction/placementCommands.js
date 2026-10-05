import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { assetById } from '../presets/catalog.js';
import { mapDimensions } from '../core/mapDimensions.js';
import { levelPlot } from '../terrain/terrainModel.js';
import { placementProblem } from '../placement/placementRules.js';
import { plotProblem, plotEditProblem, plotFromCorners } from '../plots/plotModel.js';
import { snapRoadPoint, roadProblem } from '../roads/roadModel.js';
import { snapBuildingPlacement } from '../placement/alignment.js';
import { plotSurface, plotTopHeight } from '../plots/plotModel.js';
import { paintTerrain } from '../terrain/terrainPaint.js';
import { roadTerrainWarning, roadJunctions } from '../roads/roadGeometry.js';
import { roadDraft, planRoadDraft } from '../placement/cityExpansion.js';

export const placementCommands = {
  placeRoad(end) {
    const points = roadDraft(this.roadStart, this.roadEnd || end, this.options.roadShape, this.roadEnd ? end : null);
    const { roads, problem } = planRoadDraft(this.city, points, this.options.road, crypto.randomUUID(), this.options.bridge);
    if (problem) { this.onMessage(problem); return false; }
    this.city.roads.push(...roads);
    this.pendingRoadStart = this.options.roadContinuous && this.options.roadShape !== 'roundabout' ? { ...points.at(-1) } : null;
    this.roadStart = null; this.roadPreview?.dispose(); this.roadPreview = null;
    this.roadEnd = null;
    this.roadSnapMarker?.setEnabled(false);
    this.onBrushMove?.(null);
    this.onChange(structuredClone(this.city));
    const connections = roadJunctions(this.city);
    this.onMessage(roads.map(road => roadTerrainWarning(this.city, road, connections)).find(Boolean) || (this.pendingRoadStart ? '도로를 연결했습니다. 다음 끝점을 클릭해 이어가세요. Esc로 종료합니다.' : '도로를 연결했습니다. 부지는 부지 도구로 직접 조성하세요.'));
    return true;
  },
  beginRoadEdit(id, endpoint, event) {
    const road = this.city.roads.find(item => item.id === id);
    if (!road) return;
    if (road.locked) { this.onMessage('잠긴 도로입니다. 먼저 잠금을 해제하세요.'); return; }
    this.roadEdit = { id, endpoint, original: structuredClone(road), candidate: structuredClone(road), moved: false, problem: null };
    this.canvas.setPointerCapture(event.pointerId);
    this.onSelect(id, false, 'road');
    this.onMessage('끝점을 드래그하세요. 놓으면 길이·방향이 확정됩니다. Esc로 취소합니다.');
  },
  updateRoadEdit(point, event) {
    const edit = this.roadEdit;
    if (!edit) return;
    const end = snapRoadPoint(this.city.roads.filter(road => road.id !== edit.id), point, this.city);
    this.showRoadSnap(end);
    edit.candidate = { ...edit.original, [edit.endpoint]: { x: end.x, z: end.z } };
    edit.problem = roadProblem(this.city, edit.candidate);
    edit.moved = true;
    this.nodes.find(node => node.metadata?.roadId === edit.id)?.setEnabled(false);
    this.showRoadPreview(edit.candidate, edit.problem);
    const warning = roadTerrainWarning(this.city, edit.candidate);
    const length = Math.hypot(edit.candidate.b.x - edit.candidate.a.x, edit.candidate.b.z - edit.candidate.a.z);
    this.onBrushMove?.({ x: event.clientX, y: event.clientY, label: edit.problem || `${length.toFixed(1)} m · 놓으면 확정${warning ? ` · ${warning}` : ''}`, invalid: !!edit.problem });
  },
  cancelRoadEdit() {
    const edit = this.roadEdit;
    if (!edit) return;
    this.roadEdit = null;
    this.nodes.find(node => node.metadata?.roadId === edit.id)?.setEnabled(true);
    this.roadPreview?.dispose(); this.roadPreview = null;
    this.roadSnapMarker?.setEnabled(false);
    this.onBrushMove?.(null);
  },
  finishRoadEdit(event) {
    const edit = this.roadEdit;
    if (!edit) return;
    this.cancelRoadEdit();
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (!edit.moved) return;
    if (edit.problem) { this.onMessage(edit.problem); return; }
    this.city.roads = this.city.roads.map(road => road.id === edit.id ? edit.candidate : road);
    this.onChange(structuredClone(this.city));
    this.onMessage(roadTerrainWarning(this.city, edit.candidate) || '도로 길이·방향을 변경했습니다.');
  },
  beginPlotEdit(plotId, corner, event) {
    const plot = this.city.plots.find(item => item.id === plotId);
    if (!plot) return;
    if (plot.locked) { this.onMessage('잠긴 부지입니다. 먼저 잠금을 해제하세요.'); return; }
    const corners = [[plot.x - plot.width / 2, plot.z - plot.depth / 2], [plot.x + plot.width / 2, plot.z - plot.depth / 2], [plot.x + plot.width / 2, plot.z + plot.depth / 2], [plot.x - plot.width / 2, plot.z + plot.depth / 2]];
    const opposite = corners[(corner + 2) % 4];
    this.plotEdit = { id: plotId, original: plot, fixed: { x: opposite[0], z: opposite[1] }, candidate: plot, moved: false, problem: null };
    this.canvas.setPointerCapture(event.pointerId);
    this.onSelect(plotId);
    this.onMessage('모서리를 끌어 크기를 조절하세요. 놓으면 부지 크기가 확정됩니다.');
  },
  updatePlotEdit(point, event) {
    if (!this.plotEdit) return;
    const candidate = { ...this.plotEdit.original, ...plotFromCorners(this.plotEdit.fixed, point, this.city) };
    const problem = plotEditProblem(this.city, this.plotEdit.id, candidate);
    this.plotEdit.candidate = candidate;
    this.plotEdit.problem = problem;
    this.plotEdit.moved = true;
    const y = plotTopHeight(this.city, candidate);
    this.showTargetCell(candidate.x, candidate.z, y, candidate.width, candidate.depth, problem);
    this.onBrushMove?.({ x: event.clientX, y: event.clientY, label: problem || `${candidate.width} × ${candidate.depth} m · 놓으면 확정`, invalid: !!problem });
  },
  cancelPlotEdit() {
    if (!this.plotEdit) return;
    this.plotEdit = null;
    this.targetCell?.setEnabled(false);
    this.targetBorder?.setEnabled(false);
    this.onBrushMove?.(null);
  },
  finishPlotEdit(event) {
    const edit = this.plotEdit;
    if (!edit) return;
    this.cancelPlotEdit();
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (!edit.moved) return;
    if (edit.problem) { this.onMessage(edit.problem); return; }
    levelPlot(this.city, edit.candidate);
    this.city.plots = this.city.plots.map(plot => plot.id === edit.id ? edit.candidate : plot);
    this.onChange(structuredClone(this.city));
    this.onMessage(`부지 크기를 ${edit.candidate.width} × ${edit.candidate.depth} m로 변경했습니다.`);
  },
  placeAsset(assetId, point) {
    const asset = assetById[assetId];
    if (!asset || !point) return;
    const { x, z } = snapBuildingPlacement(this.city, asset.id, point, this.options.rotation, this.options.align !== false, this.options.gap ?? 1);
    const problem = placementProblem(this.city, asset.id, x, z, this.options.rotation);
    if (problem) { this.onMessage(problem); return; }
    this.city.objects.push({ id: crypto.randomUUID(), asset: asset.id, x, z, rotation: this.options.rotation });
    this.onChange(structuredClone(this.city));
  },
  moveObject(point) {
    const object = this.city.objects.find(item => item.id === this.options.movingId);
    if (!object) return;
    if (object.locked) { this.onMessage('잠긴 시설입니다. 먼저 잠금을 해제하세요.'); return; }
    const { x, z } = snapBuildingPlacement(this.city, object.asset, point, object.rotation, this.options.align !== false, this.options.gap ?? 1, object.id);
    const problem = placementProblem(this.city, object.asset, x, z, object.rotation, object.id);
    if (problem) { this.onMessage(problem); return; }
    if (object.x === x && object.z === z) { this.onMessage('건물이 이미 이 위치에 있습니다.'); return; }
    object.x = x; object.z = z;
    this.onChange(structuredClone(this.city));
    this.onMessage('건물 위치를 변경했습니다.');
    this.onSelect(object.id);
  },
  placePlot(rect) {
    if (!rect) return;
    const plot = { id: crypto.randomUUID(), ...rect, surface: plotSurface(this.options.surface).id };
    const problem = plotProblem(this.city, plot);
    if (problem) { this.onMessage(problem); return; }
    levelPlot(this.city, plot);
    this.city.plots.push(plot);
    this.plotStart = null;
    this.plotDraft = null;
    this.plotMoved = false;
    this.onChange(structuredClone(this.city));
    this.onMessage('부지가 준비됐습니다. 주거·상업·공공시설에서 건물을 선택하세요.');
  },
  sculpt(point) {
    const now = performance.now();
    if (now - (this.lastBrush || 0) < 28) return;
    this.lastBrush = now;
    const { radius, strength, brush } = this.options;
    if (brush === 'paint') {
      if (paintTerrain(this.city, point, radius, strength, this.options.paintColor)) this.updateTerrainColors();
      return;
    }
    const source = this.city.heights.slice();
    const { resolution, half } = mapDimensions(this.city);
    const rowSize = resolution + 1;
    for (let row = 0; row <= resolution; row++) for (let col = 0; col <= resolution; col++) {
      const distance = Math.hypot(col * 2 - half - point.x, half - row * 2 - point.z);
      if (distance > radius) continue;
      const index = row * rowSize + col, weight = (1 - distance / radius) ** 2 * strength;
      // Constructed sites stay level while the surrounding landscape is sculpted.
      if (this.city.plots.some(p => Math.abs(col * 2 - half - p.x) <= p.width / 2 + 1 && Math.abs(half - row * 2 - p.z) <= p.depth / 2 + 1)) continue;
      let h = source[index];
      if (brush === 'raise') h += weight * 1.4;
      if (brush === 'lower') h -= weight * 1.4;
      if (brush === 'flatten') h += (this.flattenHeight - h) * weight;
      if (brush === 'smooth') {
        const neighbors = [source[Math.max(0, row - 1) * rowSize + col], source[Math.min(resolution, row + 1) * rowSize + col], source[row * rowSize + Math.max(0, col - 1)], source[row * rowSize + Math.min(resolution, col + 1)]];
        h += (neighbors.reduce((s, v) => s + v, 0) / 4 - h) * weight;
      }
      this.city.heights[index] = Math.max(-30, Math.min(60, h));
    }
    this.updateTerrain();
    if (now - (this.lastGridUpdate || 0) > 120) { this.updateGrid(); this.updateWater(); this.lastGridUpdate = now; }
  }
};

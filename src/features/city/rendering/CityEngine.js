import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { RESOLUTION, WORLD_SIZE, mapDimensions } from '../core/mapDimensions.js';
import { terrainHeight } from '../terrain/terrainModel.js';
import { createPlotTextures } from '../plots/plotMaterials.js';
import { roadJunctions } from '../roads/roadGeometry.js';
import { CityLife } from '../simulation/CityLife.js';
import { DEFAULT_ENVIRONMENT } from '../lighting/dayLighting.js';

import { assetBuilders } from './builders/assetBuilders.js';
import { plotBuilder } from './builders/plotBuilder.js';
import { roadBuilder } from './builders/roadBuilder.js';
import { terrainRendering } from './systems/terrainRendering.js';
import { cityOverlays } from './systems/cityOverlays.js';
import { waterRendering } from './systems/waterRendering.js';
import { placementPreview } from '../interaction/placementPreview.js';
import { placementCommands } from '../interaction/placementCommands.js';
import { pointerControls } from '../interaction/pointerControls.js';
import { selection } from '../interaction/selection.js';
import { cameraControls } from '../editor/camera/cameraControls.js';
import { lightingSystem } from '../lighting/LightingSystem.js';
import { connectionRendering } from '../connections/connectionRendering.js';

export class CityEngine {
  constructor(canvas, onChange, onSelect, onMessage, onBrushMove, onRenderError) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.onMessage = onMessage;
    this.onBrushMove = onBrushMove;
    this.onRenderError = onRenderError;
    this.engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true });
    this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.66, 0.77, 0.78, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0018;
    this.scene.fogColor = new Color3(0.66, 0.77, 0.78);
    this.camera = new ArcRotateCamera('city-camera', -Math.PI / 2.8, 0.83, 205, new Vector3(-13, 0, 4), this.scene);
    this.camera.lowerRadiusLimit = 25;
    this.camera.upperRadiusLimit = 390;
    this.camera.lowerBetaLimit = 0.15;
    this.camera.upperBetaLimit = 1.42;
    this.camera.wheelPrecision = 12;
    this.camera.panningSensibility = 45;
    this.camera.minZ = 0.1;
    this.camera.attachControl(canvas, true);
    this.camera.inputs.attached.pointers.buttons = [1, 2];
    this.camera.panningMouseButton = 1;
    this.ambient = new HemisphericLight('sky', new Vector3(0, 1, 0), this.scene);
    this.ambient.intensity = 0.85;
    this.ambient.groundColor = new Color3(0.38, 0.42, 0.32);
    this.sun = new DirectionalLight('sun', new Vector3(-0.5, -1, 0.45), this.scene);
    this.sun.position = new Vector3(70, 120, -70);
    this.sun.intensity = 1.5;
    this.shadows = new ShadowGenerator(2048, this.sun);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.bias = 0.003;
    // Static cities reuse the shadow texture until geometry or sunlight changes.
    this.shadows.getShadowMap().refreshRate = 0;
    this.materials = new Map();
    this.nodes = [];
    this.selectionFrames = [];
    this.serviceGuides = [];
    this.junctions = [];
    this.terrain = MeshBuilder.CreateGround('terrain', { width: WORLD_SIZE, height: WORLD_SIZE, subdivisions: RESOLUTION, updatable: true }, this.scene);
    this.terrain.material = this.material('terrain', '#91ac7b');
    this.terrain.receiveShadows = true;
    this.waterNodes = [];
    this.ring = MeshBuilder.CreateLines('brush', { points: Array.from({ length: 65 }, (_, i) => new Vector3(Math.cos(i / 64 * Math.PI * 2), 0, Math.sin(i / 64 * Math.PI * 2))), updatable: true }, this.scene);
    this.ring.color = Color3.FromHexString('#c9ffdf');
    this.ring.isPickable = false;
    this.ring.setEnabled(false);
    this.brushSpokes = MeshBuilder.CreateLineSystem('brush-radius', { lines: [[new Vector3(0, 0, 0), new Vector3(1, 0, 0)], [new Vector3(0, 0, 0), new Vector3(0, 0, 1)]], updatable: true }, this.scene);
    this.brushSpokes.color = Color3.FromHexString('#e0f5d8');
    this.brushSpokes.isPickable = false;
    this.brushSpokes.setEnabled(false);
    this.options = { mode: 'select', radius: 12, strength: 0.5, rotation: 0 };
    this.gridVisible = true;
    this.down = false;
    this.bindEvents();
    this.resize = new ResizeObserver(() => this.engine.resize());
    this.resize.observe(canvas);
    this.engine.resize();
    this.engine.runRenderLoop(() => {
      if (this.renderPaused) return;
      try { this.tickDaylight(this.engine.getDeltaTime() / 1000); this.tickConnections(this.engine.getDeltaTime() / 1000); this.life?.tick(Math.min(0.06, this.engine.getDeltaTime() / 1000)); this.scene.render(); }
      catch (error) {
        if (!this.renderErrorReported) { this.renderErrorReported = true; this.onRenderError?.(`3D 장면 렌더링 오류: ${error.message}`); }
      }
    });
  }
  material(key, hex) {
    if (!this.materials.has(key)) {
      const mat = new StandardMaterial(key, this.scene);
      mat.diffuseColor = Color3.FromHexString(hex);
      mat.specularColor = new Color3(0.08, 0.08, 0.08);
      this.materials.set(key, mat);
    }
    return this.materials.get(key);
  }
  box(name, w, h, d, x, y, z, material, parent) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.parent = parent;
    mesh.receiveShadows = true;
    this.shadows.addShadowCaster(mesh);
    return mesh;
  }
  plotMaterial(finish) {
    const material = this.material(`plot-surface-${finish.id}`, finish.color);
    if (!material.diffuseTexture) {
      const textures = createPlotTextures(this.scene, finish.id);
      material.diffuseTexture = textures.diffuse;
      material.bumpTexture = textures.normal;
      material.specularColor = new Color3(0.015, 0.015, 0.015);
      // The scene has a strong sun; retain the deeper natural surface colors.
      material.diffuseColor = Color3.FromHexString(finish.color).scale(0.78);
    }
    return material;
  }
  compact(root, metadata, castShadow = false) {
    const groups = new Map();
    for (const mesh of root.getChildMeshes()) {
      this.shadows.removeShadowCaster(mesh);
      const list = groups.get(mesh.material) || [];
      list.push(mesh); groups.set(mesh.material, list);
    }
    for (const meshes of groups.values()) {
      const merged = Mesh.MergeMeshes(meshes, true, true);
      if (merged) { merged.parent = root; merged.metadata = metadata; merged.receiveShadows = true; if (castShadow) this.shadows.addShadowCaster(merged); }
    }
  }
  invalidateShadows() {
    this.shadows?.getShadowMap?.()?.resetRefreshCounter();
  }
  setCity(city) {
    this.cancelRoadEdit();
    this.clearSelectionFrames();
    const previous = this.renderedCity;
    const terrainChanged = !previous || previous.heights.length !== city.heights.length || previous.heights.some((h, i) => h !== city.heights[i]);
    const paintChanged = !previous || previous.terrainPaint !== city.terrainPaint && JSON.stringify(previous.terrainPaint) !== JSON.stringify(city.terrainPaint);
    const roadsChanged = !previous || JSON.stringify(previous.roads) !== JSON.stringify(city.roads);
    // Facility properties describe equipment; they do not change its geometry.
    const renderRecord = object => JSON.stringify({ ...object, properties: undefined });
    const oldRecords = new Map(previous ? [...previous.objects, ...previous.roads, ...previous.plots].map(o => [o.id, renderRecord(o)]) : []);
    const nextRecords = new Map([...city.objects, ...city.roads, ...city.plots].map(o => [o.id, renderRecord(o)]));
    const dimensions = mapDimensions(city);
    if (this.terrain && this.terrain.getTotalVertices() !== (dimensions.resolution + 1) ** 2) {
      const material = this.terrain.material;
      this.terrain.dispose(); this.terrainSides?.dispose(); this.terrainBottom?.dispose();
      this.terrainSides = null; this.terrainBottom = null;
      this.terrain = MeshBuilder.CreateGround('terrain', { width: dimensions.size, height: dimensions.size, subdivisions: dimensions.resolution, updatable: true }, this.scene);
      this.terrain.material = material; this.terrain.receiveShadows = true;
    }
    if (this.camera) {
      this.camera.upperRadiusLimit = dimensions.cameraLimit;
      const scale = dimensions.size / mapDimensions(previous).size;
      this.camera.radius = Math.max(25, Math.min(this.camera.radius * scale, dimensions.cameraLimit));
      if (scale < 1) {
        const target = this.camera.getTarget();
        const x = Math.max(-dimensions.half, Math.min(dimensions.half, target.x));
        const z = Math.max(-dimensions.half, Math.min(dimensions.half, target.z));
        this.camera.setTarget(new Vector3(x, Math.max(0, terrainHeight(city.heights, x, z)), z));
      }
    }
    this.city = structuredClone(city);
    if (!previous || JSON.stringify(previous.environment) !== JSON.stringify(city.environment)) {
      this.environment = { ...DEFAULT_ENVIRONMENT, ...city.environment }; this.hour = this.environment.hour;
    }
    this.renderedCity = city;
    if (terrainChanged || roadsChanged) this.roadConnections = roadJunctions(this.city);
    this.plotEdit = null;
    this.clearPreview(); this.roadStart = this.pendingRoadStart || null; this.pendingRoadStart = null; this.roadEnd = null; this.plotStart = null; this.plotDraft = null; this.plotMoved = false;
    const crosswalkIds = new Set(city.objects.filter(o => o.asset === 'crosswalk').map(o => o.id));
    this.nodes = this.nodes.filter(n => {
      if (oldRecords.get(n.name) !== nextRecords.get(n.name) || !nextRecords.has(n.name) || (terrainChanged && !n.metadata.objectId) || (roadsChanged && (n.metadata.roadId || crosswalkIds.has(n.name)))) {
        n.getChildMeshes().forEach(m => this.shadows.removeShadowCaster(m)); n.dispose(); return false;
      }
      return true;
    });
    if (terrainChanged) this.updateTerrain();
    else if (paintChanged) this.updateTerrainColors();
    const kept = new Set(this.nodes.map(n => n.name));
    city.plots.filter(p => !kept.has(p.id)).forEach(p => this.buildPlot(p));
    city.roads.filter(r => !kept.has(r.id)).forEach(r => this.buildRoad(r));
    city.objects.filter(o => !kept.has(o.id)).forEach(o => this.buildObject(o));
    const lampIds = new Set(city.objects.filter(o => ['street-lamp', 'bus-stop'].includes(o.asset)).map(o => o.id));
    this.propLightNodes = this.nodes.filter(node => lampIds.has(node.name));
    if (terrainChanged) this.updateGrid();
    if (terrainChanged || roadsChanged) this.updateJunctions();
    if (terrainChanged || !previous || JSON.stringify(previous.waterSettings) !== JSON.stringify(city.waterSettings)) this.updateWater();
    if (this.engine) {
      if (!this.life) this.life = new CityLife(this);
      if (terrainChanged || roadsChanged || !previous || JSON.stringify(previous.lifeSettings) !== JSON.stringify(city.lifeSettings)) this.life.update(this.city);
    }
    this.updateDistricts();
    this.updateConnections(terrainChanged);
    this.refreshInfoOverlay();
    this.updateServiceGuides();
    if (terrainChanged || roadsChanged || [...nextRecords].some(([id, record]) => oldRecords.get(id) !== record) || oldRecords.size !== nextRecords.size) this.invalidateShadows();
    if (this.sun && this.ambient) this.setTimeOfDay(this.hour ?? 12);
  }
  dispose() {
    this.cancelBoxSelection();
    this.resize.disconnect();
    for (const [name, handler] of Object.entries(this.handlers)) this.canvas.removeEventListener(name, handler);
    this.scene.dispose(); this.engine.dispose();
  }
}

Object.assign(CityEngine.prototype, assetBuilders, plotBuilder, roadBuilder, terrainRendering, cityOverlays, waterRendering, placementPreview, placementCommands, pointerControls, selection, cameraControls, lightingSystem, connectionRendering);

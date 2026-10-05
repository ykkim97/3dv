import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { assetById, RESOLUTION, WORLD_SIZE, mapDimensions, terrainHeight, ROAD_TYPES, PLOT_TYPES, placementProblem, plotProblem, plotEditProblem, plotHasRoadAccess, levelPlot, containingPlot, footprint, plotFromCorners, snapRoadPoint, roadProblem, snapBuildingPlacement, placementDistances } from './cityModel.js';
import { PLOT_ELEVATION, plotSurface, plotTopHeight, objectBaseHeight } from './cityModel.js';
import { createPlotTextures, PLOT_TEXTURE_METERS } from './plotMaterials.js';
import { createCurbStone } from './plotGeometry.js';
import { calculateUtilityService } from './utilityService.js';
import { calculateFireService } from './fireService.js';
import { CITY_ROLE_SPECS } from './cityDiagnostics.js';
import { defaultMapLayers, MAP_LAYERS, roleLayer } from './cityManagement.js';
import { paintTerrain, terrainVertexColor } from './terrainPaint.js';
import { roadProfile, roadTerrainWarning, createRoadStrip, roadJunctions, createJunctionSurface } from './roadGeometry.js';
import { waterRegions, waterSettings } from './waterModel.js';
import { waterGeometry } from './waterModel.js';
import { createWaterMaterial } from './waterMaterial.js';
import { roadDraft, planRoadDraft } from './cityExpansion.js';
import { CityLife } from './CityLife.js';
import { buildBridgeDetails } from './bridgeGeometry.js';
import { bridgeById } from './bridgePresets.js';
import { buildStreetProp } from './streetProps.js';
import { DEFAULT_ENVIRONMENT, daylightAt, advanceHour } from './dayLighting.js';
import { closestRoadPoint } from './cityModel.js';

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
      try { this.tickDaylight(this.engine.getDeltaTime() / 1000); this.life?.tick(Math.min(0.06, this.engine.getDeltaTime() / 1000)); this.scene.render(); }
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
  tree(x, z, pine, parent) {
    const trunk = MeshBuilder.CreateCylinder('trunk', { height: 2.3, diameter: 0.45, tessellation: 5 }, this.scene);
    trunk.position.set(x, 1.15, z); trunk.parent = parent; trunk.material = this.material('bark', '#82735a');
    const crown = pine ? MeshBuilder.CreateCylinder('pine', { height: 5, diameterTop: 0, diameterBottom: 3.7, tessellation: 7 }, this.scene)
      : MeshBuilder.CreateSphere('leaves', { diameter: 3.8, segments: 3 }, this.scene);
    crown.position.set(x, pine ? 4 : 3.3, z); crown.scaling.y = pine ? 1 : 1.2;
    crown.parent = parent; crown.material = this.material(pine ? 'pine' : 'leaf', pine ? '#4d7960' : '#6e965e');
    this.shadows.addShadowCaster(crown);
  }
  buildUtility(asset, root) {
    const { width: w, depth: d } = asset;
    const concrete = this.material('utility-concrete', '#8c9993');
    const steel = this.material('utility-steel', '#b7c8c4');
    const dark = this.material('utility-dark', '#435a61');
    const blue = this.material('utility-water', '#4d9ca6');
    const copper = this.material('utility-copper', '#d8aa68');
    const glass = this.material('utility-glass', '#77b8bd');
    const warning = this.material('utility-warning', '#d98658');
    this.box('utility-pad', w + 0.3, 0.18, d + 0.3, 0, 0.08, 0, concrete, root);
    const cylinder = (name, diameter, height, x, y, z, material) => {
      const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 16 }, this.scene);
      mesh.position.set(x, y, z);
      mesh.material = material;
      mesh.parent = root;
      return mesh;
    };
    if (asset.id === 'power-plant') {
      this.box('turbine-hall', 6, 4.6, 6, -2, 2.4, 0, this.material('power-hall', asset.color), root);
      this.box('turbine-roof', 6.4, 0.3, 6.3, -2, 4.85, 0, dark, root);
      for (const x of [-4.3, -2.8, -1.3]) {
        this.box('turbine-window', 0.9, 1.15, 0.08, x, 3.1, -3.04, glass, root);
        this.box('turbine-vent', 0.95, 0.18, 0.1, x, 1.4, -3.05, dark, root);
      }
      for (const x of [2.3, 4]) {
        cylinder('exhaust-stack', 1.25, 6.2, x, 3.2, 1, steel);
        cylinder('stack-rim', 1.35, 0.2, x, 6.35, 1, copper);
        for (const y of [4.65, 5.4]) cylinder('stack-safety-band', 1.29, 0.18, x, y, 1, warning);
      }
      this.box('generator', 3.5, 2.4, 2.2, 2.5, 1.3, -2.6, dark, root);
      this.box('steam-header', 4.4, 0.26, 0.26, 0.2, 5.15, 0, steel, root);
      this.box('steam-drop', 0.26, 2.5, 0.26, 2.3, 3.85, 0, steel, root);
      this.box('generator-safety-stripe', 3.55, 0.18, 0.08, 2.5, 1.25, -3.74, warning, root);
    } else if (asset.id === 'solar-farm') {
      for (const x of [-3, 0, 3]) for (const z of [-2, 1.8]) {
        this.box('solar-stand', 0.15, 1.2, 0.15, x, 0.7, z, steel, root);
        const panel = this.box('solar-panel', 2.65, 0.12, 2.5, x, 1.42, z, dark, root);
        panel.rotation.x = -0.28;
        this.box('solar-cell', 2.35, 0.035, 2.15, x, 1.48, z, this.material('solar-glass', '#477e9b'), root).rotation.x = -0.28;
        for (const offset of [-0.58, 0, 0.58]) this.box('solar-cell-seam', 0.035, 0.04, 2.1, x + offset, 1.51, z, steel, root).rotation.x = -0.28;
      }
      this.box('solar-inverter', 1.1, 1.1, 0.9, 0, 0.68, 3.15, steel, root);
      this.box('solar-inverter-face', 0.75, 0.42, 0.06, 0, 0.92, 2.66, dark, root);
    } else if (asset.id === 'wind-turbine') {
      cylinder('wind-mast', 0.8, 12.6, 0, 6.4, 0, this.material('wind-mast', asset.color));
      cylinder('wind-base', 1.4, 0.5, 0, 0.35, 0, concrete);
      this.box('wind-nacelle', 2.4, 0.85, 1.25, 0, 13.15, 0.25, steel, root);
      const hub = cylinder('wind-hub', 0.8, 0.45, 0, 13.15, -0.58, dark);
      hub.rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const angle = i * Math.PI * 2 / 3;
        const blade = this.box('wind-blade', 0.44, 4.3, 0.13, Math.sin(angle) * 2.05, 13.15 + Math.cos(angle) * 2.05, -0.85, this.material('wind-blade', '#ecf3eb'), root);
        blade.rotation.z = -angle;
      }
      this.box('wind-access-door', 0.48, 1.25, 0.1, 0, 0.8, -0.42, dark, root);
    } else if (asset.id === 'transmission-tower') {
      for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) this.box('tower-leg', 0.23, 13.6, 0.23, x, 6.9, z, steel, root);
      for (const y of [1.6, 4.5, 7.4, 10.3, 13.4]) {
        this.box('tower-front-brace', 3.25, 0.18, 0.18, 0, y, -1.5, dark, root);
        this.box('tower-back-brace', 3.25, 0.18, 0.18, 0, y, 1.5, dark, root);
        this.box('tower-side-brace', 0.18, 0.18, 3.25, -1.5, y, 0, dark, root);
        this.box('tower-side-brace', 0.18, 0.18, 3.25, 1.5, y, 0, dark, root);
      }
      for (const y of [10.8, 13.1]) {
        this.box('tower-crossarm', 6.5, 0.24, 0.24, 0, y, -0.15, steel, root);
        for (const x of [-2.8, -1.8, 1.8, 2.8]) cylinder('tower-insulator', 0.22, 0.8, x, y - 0.5, -0.15, copper);
      }
      cylinder('tower-beacon', 0.35, 0.35, 0, 14.05, 0, warning);
    } else if (asset.id === 'ess') {
      for (const x of [-2.3, 0, 2.3]) {
        this.box('battery-cabinet', 1.85, 2.65, 4.3, x, 1.47, 0, this.material('battery-cabinet', asset.color), root);
        this.box('battery-door', 1.65, 2.15, 0.08, x, 1.45, -2.2, dark, root);
        for (const y of [0.8, 1.3, 1.8]) this.box('battery-vent', 1.15, 0.06, 0.1, x, y, -2.27, steel, root);
        this.box('battery-indicator', 0.18, 0.18, 0.12, x + 0.56, 2.35, -2.3, glass, root);
        this.box('battery-warning', 0.48, 0.16, 0.12, x - 0.3, 2.35, -2.3, warning, root);
        this.box('battery-cooling-unit', 1.2, 0.28, 1.6, x, 2.98, 1.1, dark, root);
      }
      this.box('ess-cable-trench', 6.7, 0.12, 0.26, 0, 0.3, 2.5, copper, root);
    } else if (asset.id === 'substation') {
      for (const x of [-3.4, 3.4]) for (const z of [-2.4, 2.4]) this.box('gantry-post', 0.23, 5.7, 0.23, x, 2.95, z, steel, root);
      for (const z of [-2.4, 2.4]) this.box('gantry-beam', 7.1, 0.24, 0.24, 0, 5.7, z, steel, root);
      for (const x of [-3.4, 3.4]) this.box('gantry-side-beam', 0.22, 0.22, 5, x, 5.7, 0, steel, root);
      for (const x of [-2, 0, 2]) {
        for (const z of [-2.4, 2.4]) cylinder('line-insulator', 0.26, 0.6, x, 6.1, z, copper);
        this.box('busbar', 0.12, 0.12, 4.8, x, 6.48, 0, dark, root);
      }
      for (const x of [-2, 2]) {
        this.box('transformer', 2.5, 1.9, 2.4, x, 1.1, 0, dark, root);
        for (const z of [-0.7, 0, 0.7]) cylinder('insulator', 0.28, 1.1, x, 2.6, z, copper);
        for (const z of [-0.8, -0.3, 0.2, 0.7]) this.box('transformer-fin', 0.22, 1.35, 0.12, x + 1.35, 1.18, z, steel, root);
      }
    } else if (asset.id === 'distribution') {
      this.box('switchgear-house', 4.2, 2.8, 3.3, -0.6, 1.5, 0, this.material('distribution-house', asset.color), root);
      this.box('switchgear-roof', 4.6, 0.25, 3.7, -0.6, 3.02, 0, dark, root);
      for (const x of [-1.8, -0.6, 0.6]) this.box('switchgear-door', 0.8, 1.8, 0.08, x, 1.35, -1.69, steel, root);
      for (const x of [-1.8, -0.6, 0.6]) this.box('switchgear-vent', 0.55, 0.16, 0.1, x, 2.55, -1.73, dark, root);
      cylinder('distribution-pole', 0.22, 4.2, 2.15, 2.2, 1, steel);
      this.box('distribution-crossarm', 2.2, 0.16, 0.2, 2.15, 4.1, 1, dark, root);
      for (const x of [1.4, 2.15, 2.9]) cylinder('distribution-insulator', 0.2, 0.38, x, 4.38, 1, copper);
      this.box('distribution-conduit', 1.15, 0.14, 0.14, 1.45, 1.1, 1, dark, root);
    } else if (asset.id === 'water-treatment') {
      this.box('filter-building', 4, 3.8, 7.2, -3.4, 2, 0, this.material('filter-building', asset.color), root);
      this.box('filter-roof', 4.3, 0.25, 7.5, -3.4, 4.05, 0, dark, root);
      for (const z of [-2.3, 0, 2.3]) this.box('filter-window', 0.1, 1.05, 1.1, -5.45, 2.4, z, glass, root);
      for (const z of [-2, 2]) {
        this.box('filter-basin', 5.8, 0.9, 3.2, 2.45, 0.55, z, concrete, root);
        this.box('clean-water', 5.3, 0.05, 2.7, 2.45, 1.04, z, blue, root);
        for (const x of [-0.3, 5.2]) this.box('basin-edge', 0.16, 0.24, 3.25, x, 1.13, z, steel, root);
        for (const offset of [-1.5, 1.5]) this.box('basin-edge', 5.8, 0.24, 0.16, 2.45, 1.13, z + offset, steel, root);
      }
      this.box('filter-walkway', 5.8, 0.16, 0.65, 2.45, 1.3, 0, steel, root);
      for (const z of [-0.32, 0.32]) this.box('filter-rail', 5.8, 0.08, 0.08, 2.45, 2.1, z, dark, root);
    } else if (asset.id === 'intake-station') {
      this.box('intake-house', 4.3, 3.7, 4.8, -2.35, 2, 0.55, this.material('intake-house', asset.color), root);
      this.box('intake-roof', 4.55, 0.24, 5.05, -2.35, 3.98, 0.55, dark, root);
      this.box('intake-door', 1, 2.1, 0.09, -2.25, 1.25, -1.9, steel, root);
      this.box('intake-channel', 4.4, 0.7, 6, 2.45, 0.45, 0, concrete, root);
      this.box('intake-water', 3.95, 0.06, 5.55, 2.45, 0.85, 0, blue, root);
      for (const z of [-2.25, -1.5, -0.75, 0, 0.75, 1.5, 2.25]) this.box('intake-screen', 0.12, 1.25, 0.12, 0.3, 1.35, z, steel, root);
      for (const z of [-1.45, 1.45]) this.box('intake-pipe', 3.7, 0.35, 0.35, 0.2, 1.3, z, dark, root);
      this.box('intake-walkway', 4.4, 0.16, 0.7, 2.45, 1.12, 0, steel, root);
    } else if (asset.id === 'water-tower') {
      for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) this.box('water-tower-leg', 0.25, 8.2, 0.25, x, 4.2, z, steel, root);
      for (const y of [2.1, 5.3, 8.1]) {
        this.box('water-tower-brace', 3.25, 0.16, 0.16, 0, y, -1.5, dark, root);
        this.box('water-tower-brace', 3.25, 0.16, 0.16, 0, y, 1.5, dark, root);
      }
      cylinder('elevated-tank', 4.7, 2.85, 0, 9.65, 0, this.material('elevated-tank', asset.color));
      cylinder('elevated-tank-cap', 4.85, 0.2, 0, 11.2, 0, dark);
      for (const y of [8.4, 10.6]) cylinder('elevated-tank-band', 4.75, 0.12, 0, y, 0, steel);
      this.box('tower-supply-pipe', 0.28, 8.3, 0.28, 0, 4.3, -2.15, blue, root);
      this.box('tower-ladder', 0.1, 7.7, 0.1, 1.55, 4.1, -1.6, dark, root);
    } else if (asset.id === 'reservoir') {
      for (const x of [-2.35, 2.35]) {
        cylinder('water-tank', 4.1, 4.2, x, 2.25, 0, this.material('water-tank', asset.color));
        cylinder('tank-cap', 4.25, 0.2, x, 4.45, 0, dark);
        for (const y of [0.75, 2.65, 3.9]) cylinder('tank-band', 4.16, 0.12, x, y, 0, steel);
        this.box('tank-ladder', 0.12, 3.7, 0.1, x, 2.25, -2.09, dark, root);
        for (const y of [1, 1.7, 2.4, 3.1, 3.8]) this.box('ladder-rung', 0.65, 0.09, 0.1, x, y, -2.13, dark, root);
        this.box('tank-pipe', 0.26, 0.26, 2.4, x, 0.5, -3.1, steel, root);
      }
    } else if (asset.id === 'pump-station') {
      this.box('pump-house', 5.3, 3.1, 4.1, -0.5, 1.65, 0, this.material('pump-house', asset.color), root);
      this.box('pump-roof', 5.6, 0.25, 4.4, -0.5, 3.3, 0, dark, root);
      this.box('pump-door', 1.1, 2.05, 0.1, 2.2, 1.3, -0.3, dark, root);
      this.box('pump-window', 0.9, 0.75, 0.1, -1.8, 2.25, -2.1, glass, root);
      for (const x of [-1.8, 0, 1.8]) {
        this.box('pump-pipe', 0.38, 0.38, 1.8, x, 0.65, -2.05, blue, root);
        this.box('pump-valve', 0.7, 0.55, 0.4, x, 0.9, -2.75, steel, root);
        const wheel = cylinder('pump-valve-wheel', 0.65, 0.09, x, 1.23, -2.75, copper);
        wheel.rotation.x = Math.PI / 2;
      }
      this.box('main-water-pipe', 5.4, 0.3, 0.3, -0.4, 0.45, -3, blue, root);
    } else if (asset.id === 'wastewater') {
      this.box('process-house', 3.5, 3.1, 7.4, -3.8, 1.65, 0, this.material('process-house', asset.color), root);
      this.box('process-roof', 3.7, 0.2, 7.6, -3.8, 3.28, 0, dark, root);
      for (const z of [-2.6, 0, 2.6]) this.box('process-window', 0.1, 0.8, 1.1, -5.6, 2.2, z, glass, root);
      for (const z of [-2.25, 2.25]) {
        cylinder('settling-tank', 3.7, 1.25, 2.2, 0.75, z, concrete);
        cylinder('settling-water', 3.35, 0.05, 2.2, 1.4, z, blue);
        cylinder('clarifier-hub', 0.55, 0.3, 2.2, 1.58, z, dark);
        this.box('clarifier-arm', 3.5, 0.09, 0.12, 2.2, 1.47, z, steel, root);
        this.box('clarifier-walkway', 3.8, 0.16, 0.52, 2.2, 1.62, z, steel, root);
      }
      this.box('process-pipe', 3.1, 0.22, 0.22, -0.25, 0.7, 0, blue, root);
    }
  }
  buildNeighborhoodAsset(asset, root) {
    const pavement = this.material('neighborhood-pavement', '#b8b8a6');
    const steel = this.material('neighborhood-steel', '#afc2bd');
    const glass = this.material('neighborhood-glass', '#5b8990');
    const dark = this.material('neighborhood-dark', '#52635f');
    const accent = this.material('neighborhood-accent', '#bb705c');
    this.box('facility-pad', asset.width + 0.3, 0.18, asset.depth + 0.3, 0, 0.08, 0, pavement, root);
    if (asset.id === 'townhouses') {
      for (const [index, x] of [-2.9, 0, 2.9].entries()) {
        const wall = this.material(`townhouse-wall-${index}`, ['#e2d6c5', '#d0d6cc', '#d9c7b7'][index]);
        this.box('townhouse-unit', 2.7, 4.5, 4.7, x, 2.34, 0.4, wall, root);
        this.box('townhouse-roof', 2.85, 0.26, 4.95, x, 4.7, 0.4, index === 1 ? dark : accent, root);
        this.box('townhouse-door', 0.73, 1.75, 0.09, x + 0.62, 1, -1.99, dark, root);
        for (const y of [1.55, 3.32]) this.box('townhouse-window', 0.82, 0.84, 0.1, x - 0.53, y, -2, glass, root);
        this.box('townhouse-step', 0.95, 0.14, 0.5, x + 0.62, 0.18, -2.48, pavement, root);
      }
    } else if (asset.id === 'cafe') {
      this.box('cafe-room', 4.5, 3.3, 4.3, -1, 1.75, 0.55, this.material('cafe-wall', asset.color), root);
      this.box('cafe-roof', 4.85, 0.23, 4.6, -1, 3.53, 0.55, dark, root);
      this.box('cafe-shopfront', 2.25, 2.4, 0.1, -1.7, 1.55, -1.65, glass, root);
      this.box('cafe-door', 0.95, 2.15, 0.1, 0.45, 1.22, -1.65, dark, root);
      this.box('cafe-awning', 4.8, 0.16, 1.05, -1, 3.12, -2.02, accent, root);
      for (const x of [-2.6, -1.4, -0.2]) this.box('awning-stripe', 0.36, 0.17, 1.06, x, 3.13, -2.02, pavement, root);
      for (const z of [-1.2, 1.2]) {
        this.box('cafe-table-top', 1.05, 0.12, 1.05, 2.25, 0.8, z, dark, root);
        this.box('cafe-table-leg', 0.14, 0.72, 0.14, 2.25, 0.42, z, steel, root);
        for (const x of [1.35, 3.12]) this.box('cafe-chair', 0.48, 0.42, 0.48, x, 0.32, z, accent, root);
      }
    } else if (asset.id === 'fire-station') {
      const red = this.material('fire-station-red', '#c95448');
      this.box('fire-garage', 8.2, 4.35, 6.2, -1.25, 2.26, 0.45, this.material('fire-station-wall', asset.color), root);
      this.box('fire-roof', 8.45, 0.26, 6.45, -1.25, 4.57, 0.45, dark, root);
      this.box('fire-fascia', 8.3, 0.72, 0.11, -1.25, 3.9, -2.71, red, root);
      for (const x of [-3.6, -0.55]) {
        this.box('fire-bay-door', 2.45, 2.82, 0.1, x, 1.56, -2.72, this.material('fire-bay', '#82989a'), root);
        for (const y of [0.7, 1.35, 2, 2.65]) this.box('fire-door-seam', 2.4, 0.055, 0.12, x, y, -2.79, dark, root);
      }
      this.box('fire-watchtower', 1.75, 6.2, 2.5, 4.2, 3.2, 1.8, red, root);
      this.box('fire-watch-window', 1.55, 0.85, 0.1, 4.2, 5.4, 0.5, glass, root);
      this.box('fire-beacon', 0.5, 0.32, 0.5, 4.2, 6.46, 1.8, accent, root);
    } else if (asset.id === 'playground') {
      const timber = this.material('playground-timber', '#b98e61');
      const play = this.material('playground-play', '#dfa35b');
      this.box('playground-surface', 9.4, 0.12, 7.4, 0, 0.19, 0, this.material('playground-rubber', '#86a795'), root);
      for (const x of [-3.5, -0.8]) for (const z of [-1.5, 1.5]) this.box('swing-post', 0.2, 2.5, 0.2, x, 1.52, z, timber, root);
      this.box('swing-crossbar', 3, 0.2, 0.2, -2.15, 2.8, 0, dark, root);
      for (const x of [-2.9, -1.45]) {
        for (const z of [-0.45, 0.45]) this.box('swing-rope', 0.05, 1.45, 0.05, x, 1.98, z, steel, root);
        this.box('swing-seat', 0.65, 0.12, 1.2, x, 1.2, 0, play, root);
      }
      this.box('slide-platform', 2.15, 0.22, 1.8, 2.05, 2.05, 1.15, timber, root);
      for (const x of [1.15, 2.95]) for (const z of [0.45, 1.85]) this.box('slide-leg', 0.16, 1.85, 0.16, x, 1.05, z, timber, root);
      const slide = this.box('slide-ramp', 1.2, 0.12, 3.35, 2.05, 1.15, -0.9, play, root);
      slide.rotation.x = -0.52;
      for (const x of [1.42, 2.68]) this.box('slide-rail', 0.12, 0.28, 3.35, x, 1.28, -0.9, accent, root).rotation.x = -0.52;
      this.box('sandbox', 2.4, 0.2, 1.4, 0, 0.34, 2.7, this.material('playground-sand', '#d8c596'), root);
    }
  }
  buildObject(object) {
    const asset = assetById[object.asset];
    const root = new TransformNode(object.id, this.scene);
    root.metadata = { objectId: object.id };
    this.nodes.push(root);
    const prop = asset.category === 'streetscape', preview = object.id === '__placement-preview';
    this.propTemplates ||= new Map();
    const template = prop && this.propTemplates.get(asset.id);
    if (template) {
      for (const source of template) {
        const mesh = preview ? source.clone(`preview-${asset.id}`, root) : source.createInstance(`${asset.id}-${object.id}`);
        mesh.parent = root; mesh.isVisible = true; mesh.metadata = { objectId: object.id }; mesh.receiveShadows = true;
      }
    } else if (prop) buildStreetProp(this, asset, root);
    else if (object.asset === 'tree' || object.asset === 'pine') this.tree(0, 0, object.asset === 'pine', root);
    else if (object.asset === 'park') {
      this.box('lawn', 10, 0.15, 10, 0, 0.08, 0, this.material('lawn', '#7a9f65'), root);
      this.box('walk', 1.3, 0.18, 10, 0, 0.12, 0, this.material('walk', '#d0c6a8'), root);
      this.box('walk', 10, 0.18, 1.3, 0, 0.12, 0, this.material('walk', '#d0c6a8'), root);
      for (const x of [-3, 3]) for (const z of [-3, 3]) this.tree(x, z, false, root);
    } else if (asset.category === 'power' || asset.category === 'water') {
      this.buildUtility(asset, root);
    } else if (['townhouses', 'cafe', 'fire-station', 'playground'].includes(asset.id)) {
      this.buildNeighborhoodAsset(asset, root);
    } else {
      const { width: w, height: h, depth: d } = asset;
      this.box('foundation', w + 1, 0.25, d + 1, 0, 0.1, 0, this.material('pavement', '#c3c5b8'), root);
      this.box('building', w, h, d, 0, h / 2 + 0.2, 0, this.material(asset.id, asset.color), root);
      const glass = this.material('glass', '#5c7d87');
      for (let y = 1.6; y < h; y += 2.4) {
        this.box('windows', w * 0.8, 0.85, d + 0.03, 0, y, 0, glass, root);
        this.box('windows', w + 0.03, 0.85, d * 0.76, 0, y, 0, glass, root);
      }
      if (object.asset === 'house') {
        const roof = MeshBuilder.CreateCylinder('roof', { diameter: w * 1.5, height: d + 0.8, tessellation: 3 }, this.scene);
        roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
        roof.position.y = h + 0.6; roof.scaling.x = 0.55;
        roof.material = this.material('roof', asset.roof); roof.parent = root; this.shadows.addShadowCaster(roof);
      } else {
        this.box('roof', w + 0.3, 0.4, d + 0.3, 0, h + 0.4, 0, this.material('roof-slab', '#bdc6bd'), root);
        this.box('rooftop', w * 0.38, 0.8, d * 0.4, 0, h + 0.95, 0, this.material('equipment', '#93a29f'), root);
      }
      if (object.asset === 'hospital') {
        const red = this.material('medical', '#ba655f');
        this.box('cross', 2, 0.6, 0.12, 0, h - 1, -d / 2 - 0.03, red, root);
        this.box('cross', 0.6, 2, 0.13, 0, h - 1, -d / 2 - 0.03, red, root);
      }
    }
    if (!template) this.compact(root, { objectId: object.id }, !prop);
    if (prop && !template) {
      this.propTemplates.set(asset.id, root.getChildMeshes().map(mesh => {
        const source = mesh.clone(`template-${asset.id}`, null);
        source.parent = null; source.isVisible = false; source.isPickable = false; source.metadata = null;
        return source;
      }));
    }
    root.position.set(object.x, this.placementBaseHeight(object), object.z);
    root.rotation.y = object.rotation;
    return root;
  }
  placementBaseHeight(object) {
    let height = objectBaseHeight(this.city, object);
    const asset = assetById[object.asset];
    if (asset.id === 'crosswalk') {
      const road = this.city.roads.find(road => {
        const point = closestRoadPoint(road, object);
        const width = ROAD_TYPES.find(type => type.id === road.type).width;
        return Math.hypot(point.x - object.x, point.z - object.z) < width / 2;
      });
      if (road) height = Math.max(height, ...roadProfile(this.city, road, this.roadConnections || []).samples
        .filter(p => Math.hypot(p.x - object.x, p.z - object.z) < 5).map(p => p.height + 0.24));
    }
    return height;
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
  buildPlot(plot) {
    const root = new TransformNode(plot.id, this.scene);
    root.metadata = { plotId: plot.id }; this.nodes.push(root);
    const y = plotTopHeight(this.city, plot);
    const finish = plotSurface(plot.surface);
    const natural = finish.id === 'grass' || finish.id === 'soil';
    const base = this.box('plot-base', plot.width, PLOT_ELEVATION - 0.015, plot.depth, plot.x, y - PLOT_ELEVATION / 2 - 0.0075, plot.z, this.material(natural ? 'plot-earth-base' : 'plot-stone-base', natural ? '#514431' : '#575c58'), root);
    base.metadata = { plotId: plot.id };
    const surface = MeshBuilder.CreateGround('plot', { width: plot.width, height: plot.depth }, this.scene);
    surface.position.set(plot.x, y, plot.z); surface.parent = root;
    surface.material = this.plotMaterial(finish);
    const uvs = surface.getVerticesData(VertexBuffer.UVKind);
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i] *= plot.width / PLOT_TEXTURE_METERS;
      uvs[i + 1] *= plot.depth / PLOT_TEXTURE_METERS;
    }
    surface.setVerticesData(VertexBuffer.UVKind, uvs);
    surface.receiveShadows = true;
    surface.metadata = { plotId: plot.id };
    const w = plot.width / 2, d = plot.depth / 2;
    const curb = this.material('plot-curb', '#93988c');
    const stones = [], rimWidth = 0.26, rimHeight = 0.18;
    const addSide = (length, alongX, offset) => {
      const count = Math.ceil(length / 2), step = length / count;
      for (let i = 0; i < count; i++) {
        const position = -length / 2 + (i + 0.5) * step;
        const stone = createCurbStone(this.scene, alongX ? step - 0.025 : rimWidth, alongX ? rimWidth : step - 0.025, rimHeight);
        stone.position.set(plot.x + (alongX ? position : offset), y - 0.015, plot.z + (alongX ? offset : position));
        stone.material = curb;
        stones.push(stone);
      }
    };
    for (const z of [-d + rimWidth / 2, d - rimWidth / 2]) addSide(plot.width, true, z);
    for (const x of [-w + rimWidth / 2, w - rimWidth / 2]) addSide(plot.depth - rimWidth * 2, false, x);
    const rim = Mesh.MergeMeshes(stones, true, true);
    rim.name = 'plot-rim'; rim.parent = root; rim.receiveShadows = true;
    rim.metadata = { plotId: plot.id };
    this.shadows.addShadowCaster(rim);
    const points = [[-w,-d],[w,-d],[w,d],[-w,d],[-w,-d]].map(([x,z]) => new Vector3(plot.x + x, y + 0.035, plot.z + z));
    const edge = MeshBuilder.CreateLines('plot-boundary', { points }, this.scene);
    edge.color = Color3.FromHexString('#d6e6ad'); edge.alpha = 0.8; edge.parent = root; edge.isPickable = false;
    edge.setEnabled(false);
    // Handles are editor affordances; show them only on the selected site.
    for (const [corner, [x,z]] of [[-w,-d],[w,-d],[w,d],[-w,d]].entries()) {
      const marker = this.box('plot-corner', 0.4, 0.14, 0.4, plot.x + x, y + 0.13, plot.z + z, this.material('plot-marker', '#e7efc1'), root);
      marker.metadata = { plotId: plot.id, corner }; this.shadows.removeShadowCaster(marker);
      marker.setEnabled(false);
    }
  }
  updateGrid() {
    const { half } = mapDimensions(this.city);
    const lines = [];
    for (let axis = 0; axis < 2; axis++) for (let i = -half; i <= half; i += 4) {
      const line = [];
      for (let j = -half; j <= half; j += 2) {
        const x = axis ? j : i, z = axis ? i : j;
        line.push(new Vector3(x, Math.max(-0.08, terrainHeight(this.city.heights, x, z)) + 0.09, z));
      }
      lines.push(line);
    }
    if (this.grid && this.grid.getTotalVertices() !== lines.reduce((count, line) => count + line.length, 0)) { this.grid.dispose(); this.grid = null; }
    if (this.grid) MeshBuilder.CreateLineSystem('construction-grid', { lines, instance: this.grid });
    else { this.grid = MeshBuilder.CreateLineSystem('construction-grid', { lines, updatable: true }, this.scene); this.grid.color = Color3.FromHexString('#718e80'); this.grid.alpha = 0.44; this.grid.isPickable = false; }
    this.grid.setEnabled(this.gridVisible);
  }
  setGridVisible(visible) { this.gridVisible = visible; this.grid?.setEnabled(visible); }
  buildRoad(road, preview = false, problem = null) {
    const root = new TransformNode(road.id, this.scene);
    const network = preview ? this.previewNetwork || { ...this.city, roads: [...this.city.roads.filter(item => item.id !== this.roadEdit?.id), road] } : this.city;
    const connections = preview ? this.previewConnections || roadJunctions(network) : this.roadConnections || roadJunctions(network);
    const profile = roadProfile(network, road, connections), lift = preview ? 0.23 : 0.15;
    const addStrip = (name, width, offset, height, thickness, material, first, last) => {
      const mesh = createRoadStrip(this.scene, name, profile, width, offset, height, thickness, first, last);
      mesh.parent = root; mesh.material = material; mesh.receiveShadows = !preview;
      return mesh;
    };
    const asphalt = preview ? this.material(problem ? 'road-preview-invalid' : 'road-preview-valid', problem ? '#ae554b' : '#577d6b') : this.roadMaterial(road.type);
    const curb = this.material(preview ? problem ? 'road-preview-edge-invalid' : 'road-preview-edge-valid' : 'road-curb', preview ? problem ? '#ff8b80' : '#a5f4cb' : '#b8c6bd');
    const outside = (first, last) => !profile.samples.slice(first, last + 1).some(point => point.junction);
    const runs = [];
    let start = null;
    for (let i = 0; i < profile.samples.length - 1; i++) {
      if (outside(i, i + 1)) { if (start === null) start = i; }
      else if (start !== null) { runs.push([start, i]); start = null; }
    }
    if (start !== null) runs.push([start, profile.samples.length - 1]);
    for (const side of [-1, 1]) {
      for (const [first, last] of runs) {
        addStrip('road-curb', 0.32, side * (profile.width / 2 + 0.16), lift + 0.09, 0.18, curb, first, last);
        if (road.type !== 'path') addStrip('road-edge-line', 0.09, side * (profile.width / 2 - 0.23), lift + 0.067, 0.01, this.material('road-edge-paint', '#e6e9d9'), first, last);
      }
    }
    addStrip('road-asphalt', profile.width, 0, lift + 0.05, 0.12, asphalt);
    if (road.type !== 'path') {
      const offsets = road.type === 'avenue' ? [-profile.width / 4, profile.width / 4] : [0];
      for (const offset of offsets) for (let i = 0; i < profile.samples.length - 1; i += 4) {
        const last = Math.min(i + 2, profile.samples.length - 1);
        if (outside(i, last)) addStrip('road-lane', 0.11, offset, lift + 0.069, 0.01, this.material(road.type === 'street' ? 'road-center-paint' : 'road-edge-paint', road.type === 'street' ? '#edc974' : '#e6e9d9'), i, last);
      }
      if (road.type === 'avenue') for (const offset of [-0.13, 0.13]) for (const [first, last] of runs) addStrip('road-center-line', 0.08, offset, lift + 0.069, 0.01, this.material('road-center-paint', '#edc974'), first, last);
    }
    if (road.bridge) buildBridgeDetails(this, road, profile, root, preview, problem, lift);
    if (preview) {
      root.name = 'road-preview';
      for (const connection of connections.filter(item => item.roadIds.includes(road.id))) {
        const surface = createJunctionSurface(this.scene, connection);
        surface.parent = root; surface.material = asphalt; surface.position.y = 0.08;
      }
      for (const mesh of root.getChildMeshes()) { mesh.isPickable = false; mesh.material.backFaceCulling = false; }
    } else {
      root.metadata = { roadId: road.id }; this.nodes.push(root);
      this.compact(root, { roadId: road.id });
      for (const [endpoint, point] of Object.entries({ a: road.a, b: road.b })) {
        const handle = MeshBuilder.CreateSphere('road-endpoint', { diameter: 1.8, segments: 8 }, this.scene);
        handle.parent = root;
        handle.position.set(point.x, Math.max(0.25, terrainHeight(this.city.heights, point.x, point.z)) + 0.8, point.z);
        handle.material = this.material('road-handle', '#61ff83');
        handle.material.emissiveColor = Color3.FromHexString('#61ff83');
        handle.metadata = { roadId: road.id, endpoint };
        handle.setEnabled(this.selectedId === road.id);
      }
    }
    return root;
  }
  roadMaterial(type = 'street') {
    const path = type === 'path';
    const material = this.material(path ? 'road-path-surface' : 'road-asphalt-surface', path ? '#d0c4a6' : '#65736f');
    if (!material.diffuseTexture) {
      const textures = createPlotTextures(this.scene, path ? 'dirt' : 'asphalt');
      material.diffuseTexture = textures.diffuse; material.bumpTexture = textures.normal;
      material.bumpTexture.level = 0.22;
      material.specularColor = new Color3(0.025, 0.025, 0.025);
    }
    return material;
  }
  updateJunctions() {
    this.junctions?.forEach(mesh => mesh.dispose());
    this.junctions = [];
    for (const junction of this.roadConnections || roadJunctions(this.city)) {
      const surface = createJunctionSurface(this.scene, junction);
      const road = this.city.roads.find(item => junction.roadIds.includes(item.id) && item.type !== 'path') || this.city.roads.find(item => item.id === junction.roadIds[0]);
      surface.material = this.roadMaterial(road?.type);
      surface.metadata = { roadId: road?.id }; surface.receiveShadows = true;
      this.junctions.push(surface);
      for (let i = 0; i < junction.boundary.length; i++) {
        const a = junction.boundary[i], b = junction.boundary[(i + 1) % junction.boundary.length];
        if (a.mouth === b.mouth) continue; // Leave every road entrance open.
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const curb = MeshBuilder.CreateBox('junction-curb', { width: length, height: 0.14, depth: 0.25 }, this.scene);
        curb.position.set((a.x + b.x) / 2, junction.height + 0.2, (a.z + b.z) / 2);
        curb.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        curb.material = this.material('road-curb', '#b8c6bd'); curb.isPickable = false; curb.receiveShadows = true;
        this.junctions.push(curb);
      }
    }
  }
  setCity(city) {
    this.cancelRoadEdit();
    this.clearSelectionFrames();
    const previous = this.renderedCity;
    const terrainChanged = !previous || previous.heights.length !== city.heights.length || previous.heights.some((h, i) => h !== city.heights[i]);
    const paintChanged = !previous || previous.terrainPaint !== city.terrainPaint && JSON.stringify(previous.terrainPaint) !== JSON.stringify(city.terrainPaint);
    const roadsChanged = !previous || JSON.stringify(previous.roads) !== JSON.stringify(city.roads);
    const oldRecords = new Map(previous ? [...previous.objects, ...previous.roads, ...previous.plots].map(o => [o.id, JSON.stringify(o)]) : []);
    const nextRecords = new Map([...city.objects, ...city.roads, ...city.plots].map(o => [o.id, JSON.stringify(o)]));
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
    this.refreshInfoOverlay();
    this.updateServiceGuides();
    if (this.sun && this.ambient) this.setTimeOfDay(this.hour ?? 12);
  }
  setInfoVisible(visible) { this.infoVisible = visible; this.refreshInfoOverlay(); this.updateServiceGuides(); }
  updateWater() {
    for (const root of this.waterNodes || []) { for (const mesh of root.getChildMeshes()) mesh.material?.dispose(); root.dispose(); }
    this.waterNodes = [];
    this.waterRegions = waterRegions(this.city);
    for (const region of this.waterRegions) {
      const settings = waterSettings(this.city, region);
      if (this.city.waterSettings?.enabled === false || !settings.enabled) continue;
      const data = waterGeometry(this.city, region), root = new TransformNode(region.id, this.scene);
      root.metadata = { waterId: region.id };
      const mesh = new Mesh('water-surface', this.scene), vertices = new VertexData();
      vertices.positions = data.positions; vertices.indices = data.indices; vertices.applyToMesh(mesh);
      mesh.setVerticesData('waterDepth', data.depths, false, 1);
      mesh.parent = root; mesh.metadata = { waterId: region.id };
      mesh.material = createWaterMaterial(this.scene, region.id, { ...settings, flowing: this.city.waterSettings?.flowing === false ? false : settings.flowing }, this.camera, this.night);
      this.waterNodes.push(root);
    }
  }
  setMapLayers(layers) { this.mapLayers = { ...defaultMapLayers, ...layers }; this.updateServiceGuides(); }
  updateDistricts() {
    this.districtMeshes?.forEach(mesh => mesh.dispose()); this.districtMeshes = [];
    for (const district of this.city.districts || []) for (const plot of this.city.plots.filter(item => district.plotIds.includes(item.id))) {
      const points = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => new Vector3(plot.x + x * plot.width / 2, plotTopHeight(this.city, plot) + 0.06, plot.z + z * plot.depth / 2));
      const mesh = MeshBuilder.CreateLines('district-boundary', { points }, this.scene); mesh.color = Color3.FromHexString(district.color); mesh.isPickable = false; this.districtMeshes.push(mesh);
    }
  }
  updateServiceGuides() {
    for (const guide of this.serviceGuides || []) guide.dispose();
    this.serviceGuides = [];
    if (!this.city) return;
    const service = calculateUtilityService(this.city);
    const layers = this.mapLayers || defaultMapLayers;
    for (const facility of service.facilities.values()) {
      if (this.infoVisible && !layers[facility.network]) continue;
      if (!this.infoVisible && facility.id !== this.selectedId) continue;
      const baseColor = facility.network === 'power' ? '#f3d27a' : '#78d4df';
      const color = Color3.FromHexString(facility.role === 'terminal' ? '#a9b8b1' : facility.connected ? baseColor : '#e48e7e');
      const addRing = (radius, alpha) => {
        const points = Array.from({ length: 65 }, (_, i) => {
          const angle = i * Math.PI * 2 / 64;
          const x = facility.x + Math.cos(angle) * radius;
          const z = facility.z + Math.sin(angle) * radius;
          return new Vector3(x, Math.max(terrainHeight(this.city.heights, x, z) + 0.42, 0.42), z);
        });
        const ring = MeshBuilder.CreateLines('service-range', { points }, this.scene);
        ring.color = color;
        ring.alpha = alpha;
        ring.isPickable = false;
        this.serviceGuides.push(ring);
      };
      addRing(1.6, 0.95);
      if (facility.connected && facility.radius > 0) addRing(facility.radius, facility.id === this.selectedId ? 0.9 : 0.5);
    }
    for (const object of this.city.objects) {
      const layer = roleLayer(object.asset), spec = CITY_ROLE_SPECS[object.asset];
      if (!layer || (!this.infoVisible && object.id !== this.selectedId) || (this.infoVisible && !layers[layer])) continue;
      const points = Array.from({ length: 65 }, (_, i) => {
        const angle = i * Math.PI * 2 / 64;
        const x = object.x + Math.cos(angle) * spec.radius, z = object.z + Math.sin(angle) * spec.radius;
        return new Vector3(x, Math.max(terrainHeight(this.city.heights, x, z) + 0.5, 0.5), z);
      });
      const ring = MeshBuilder.CreateLines(`${layer}-range`, { points }, this.scene);
      ring.color = Color3.FromHexString(MAP_LAYERS.find(item => item.id === layer).color);
      ring.alpha = 0.7;
      ring.isPickable = false;
      this.serviceGuides.push(ring);
    }
    const selectedFireStation = this.city.objects.find(object => object.id === this.selectedId && object.asset === 'fire-station');
    if (this.infoVisible && !layers.fire) return;
    if (!this.infoVisible && !selectedFireStation) return;
    const fire = calculateFireService(this.city, this.infoVisible ? null : selectedFireStation.id);
    for (const station of fire.stations.values()) {
      if (!this.infoVisible && station.id !== this.selectedId) continue;
      const points = Array.from({ length: 33 }, (_, i) => {
        const angle = i * Math.PI * 2 / 32;
        return new Vector3(station.x + Math.cos(angle) * 2, objectBaseHeight(this.city, station) + 0.48, station.z + Math.sin(angle) * 2);
      });
      const marker = MeshBuilder.CreateLines('fire-station-access', { points }, this.scene);
      marker.color = Color3.FromHexString(station.roadConnected ? '#ffb078' : '#e48e7e');
      marker.isPickable = false;
      this.serviceGuides.push(marker);
    }
    if (fire.routes.length) {
      const lines = fire.routes.map(route => [route.a, route.b].map(point => new Vector3(point.x, Math.max(terrainHeight(this.city.heights, point.x, point.z) + 0.48, 0.48), point.z)));
      const routes = MeshBuilder.CreateLineSystem('fire-response-roads', { lines }, this.scene);
      routes.color = Color3.FromHexString('#ffb078');
      routes.alpha = this.infoVisible ? 0.85 : 1;
      routes.isPickable = false;
      this.serviceGuides.push(routes);
    }
  }
  refreshInfoOverlay() {
    if (!this.city) return;
    for (const node of this.nodes) {
      const id = node.metadata?.plotId;
      if (!id) continue;
      const plot = this.city.plots.find(item => item.id === id);
      if (!plot) continue;
      const disconnected = this.infoVisible && !plotHasRoadAccess(this.city, plot);
      for (const mesh of node.getChildMeshes()) if (mesh.name === 'plot-boundary') {
        mesh.setEnabled(disconnected || this.selectedId === plot.id);
        mesh.color = Color3.FromHexString(disconnected ? '#ff9a62' : '#d6e6ad');
        mesh.alpha = disconnected ? 1 : 0.8;
      }
    }
  }
  updateTerrain() {
    const positions = this.terrain.getVerticesData(VertexBuffer.PositionKind);
    for (let i = 0; i < this.city.heights.length; i++) positions[i * 3 + 1] = this.city.heights[i];
    const normals = [];
    VertexData.ComputeNormals(positions, this.terrain.getIndices(), normals);
    this.terrain.updateVerticesData(VertexBuffer.PositionKind, positions, true);
    this.terrain.updateVerticesData(VertexBuffer.NormalKind, normals);
    this.terrain.refreshBoundingInfo();
    this.terrain.updateCoordinateHeights();
    this.updateTerrainColors();
    this.updateTerrainSides(positions);
    for (const node of this.nodes) if (node.metadata?.objectId) {
      const object = this.city.objects.find(item => item.id === node.metadata.objectId);
      if (object) node.position.y = this.placementBaseHeight(object);
    }
  }
  updateTerrainColors() {
    const colors = [];
    for (let index = 0; index < this.city.heights.length; index++) {
      colors.push(...terrainVertexColor(this.city, index).map(value => value / 255), 1);
    }
    this.terrain.material.diffuseColor = Color3.White();
    this.terrain.material.backFaceCulling = false;
    this.terrain.hasVertexAlpha = false;
    if (this.terrain.isVerticesDataPresent(VertexBuffer.ColorKind)) this.terrain.updateVerticesData(VertexBuffer.ColorKind, colors);
    else this.terrain.setVerticesData(VertexBuffer.ColorKind, colors, true);
  }
  updateTerrainSides(surfacePositions) {
    // Close the heightfield at the map perimeter; its lower base stays below every editable height.
    const { resolution, size } = mapDimensions(this.city);
    const row = resolution + 1, perimeter = [];
    for (let col = 0; col < resolution; col++) perimeter.push(col);
    for (let r = 0; r < resolution; r++) perimeter.push(r * row + resolution);
    for (let col = resolution; col > 0; col--) perimeter.push(resolution * row + col);
    for (let r = resolution; r > 0; r--) perimeter.push(r * row);
    const positions = [], indices = [], normals = [];
    for (let i = 0; i < perimeter.length; i++) {
      const a = perimeter[i] * 3, b = perimeter[(i + 1) % perimeter.length] * 3, offset = positions.length / 3;
      positions.push(surfacePositions[a], surfacePositions[a + 1], surfacePositions[a + 2], surfacePositions[b], surfacePositions[b + 1], surfacePositions[b + 2], surfacePositions[b], -31, surfacePositions[b + 2], surfacePositions[a], -31, surfacePositions[a + 2]);
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
    VertexData.ComputeNormals(positions, indices, normals);
    if (!this.terrainSides) {
      this.terrainSides = new Mesh('terrain-sides', this.scene);
      const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals;
      data.applyToMesh(this.terrainSides, true);
      this.terrainSides.material = this.material('terrain-earth', '#8b7860');
      this.terrainSides.material.backFaceCulling = false;
      this.terrainSides.isPickable = false;
      this.terrainSides.receiveShadows = true;
      this.terrainBottom = MeshBuilder.CreateGround('terrain-bottom', { width: size, height: size }, this.scene);
      this.terrainBottom.position.y = -31;
      this.terrainBottom.material = this.terrainSides.material;
      this.terrainBottom.isPickable = false;
    } else {
      this.terrainSides.updateVerticesData(VertexBuffer.PositionKind, positions, true);
      this.terrainSides.updateVerticesData(VertexBuffer.NormalKind, normals);
      this.terrainSides.refreshBoundingInfo();
    }
  }
  setOptions(options) {
    const changed = this.options.mode !== options.mode || this.options.asset !== options.asset || this.options.road !== options.road || this.options.bridge !== options.bridge || this.options.roadShape !== options.roadShape || this.options.plot !== options.plot || this.options.rotation !== options.rotation || this.options.surface !== options.surface || this.options.align !== options.align || this.options.gap !== options.gap || this.options.movingId !== options.movingId;
    const plotChanged = this.options.mode !== options.mode || this.options.plot !== options.plot;
    this.options = options;
    if (options.mode !== 'select') this.cancelPlotEdit();
    if (options.mode !== 'select') this.cancelRoadEdit();
    if (changed) { this.clearPreview(); this.roadStart = null; this.roadEnd = null; this.pendingRoadStart = null; if (plotChanged) { this.plotStart = null; this.plotDraft = null; this.plotMoved = false; } }
    this.canvas.style.cursor = options.mode === 'select' && !options.boxSelect ? 'default' : 'crosshair';
    if (changed && this.lastPointer) this.move(this.lastPointer);
  }
  pick(event, terrainOnly = true) {
    const rect = this.canvas.getBoundingClientRect();
    return this.scene.pick(event.clientX - rect.left, event.clientY - rect.top, mesh => terrainOnly ? mesh === this.terrain : !!mesh.metadata);
  }
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
  }
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
  }
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
  }
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
  }
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
  }
  updatePlotDraft(point) {
    if (!this.plotStart) return;
    if (Math.abs(point.x - this.plotStart.x) < 2 && Math.abs(point.z - this.plotStart.z) < 2 && !this.plotMoved) return;
    this.plotMoved = true;
    this.plotDraft = plotFromCorners(this.plotStart, point, this.city);
  }
  cancelPlotDraft() {
    this.roadEnd = null; this.pendingRoadStart = null;
    this.plotStart = null;
    this.plotDraft = null;
    this.plotMoved = false;
    this.clearPreview();
    this.cancelPlotEdit();
    this.cancelRoadEdit();
  }
  showRoadPreview(road, problem) {
    this.roadPreview?.dispose(); this.roadPreview = null;
    if (Math.hypot(road.b.x - road.a.x, road.b.z - road.a.z) < 0.01) return;
    this.roadPreview = this.buildRoad({ ...road, id: '__road-preview' }, true, problem);
  }
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
  }
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
  }
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
  beginRoadEdit(id, endpoint, event) {
    const road = this.city.roads.find(item => item.id === id);
    if (!road) return;
    if (road.locked) { this.onMessage('잠긴 도로입니다. 먼저 잠금을 해제하세요.'); return; }
    this.roadEdit = { id, endpoint, original: structuredClone(road), candidate: structuredClone(road), moved: false, problem: null };
    this.canvas.setPointerCapture(event.pointerId);
    this.onSelect(id, false, 'road');
    this.onMessage('끝점을 드래그하세요. 놓으면 길이·방향이 확정됩니다. Esc로 취소합니다.');
  }
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
  }
  cancelRoadEdit() {
    const edit = this.roadEdit;
    if (!edit) return;
    this.roadEdit = null;
    this.nodes.find(node => node.metadata?.roadId === edit.id)?.setEnabled(true);
    this.roadPreview?.dispose(); this.roadPreview = null;
    this.roadSnapMarker?.setEnabled(false);
    this.onBrushMove?.(null);
  }
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
  }
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
  }
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
  }
  cancelPlotEdit() {
    if (!this.plotEdit) return;
    this.plotEdit = null;
    this.targetCell?.setEnabled(false);
    this.targetBorder?.setEnabled(false);
    this.onBrushMove?.(null);
  }
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
  }
  placeAsset(assetId, point) {
    const asset = assetById[assetId];
    if (!asset || !point) return;
    const { x, z } = snapBuildingPlacement(this.city, asset.id, point, this.options.rotation, this.options.align !== false, this.options.gap ?? 1);
    const problem = placementProblem(this.city, asset.id, x, z, this.options.rotation);
    if (problem) { this.onMessage(problem); return; }
    this.city.objects.push({ id: crypto.randomUUID(), asset: asset.id, x, z, rotation: this.options.rotation });
    this.onChange(structuredClone(this.city));
  }
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
  }
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
  }
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
  }
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
  bindEvents() {
    this.handlers = {
      contextmenu: e => e.preventDefault(),
      pointermove: e => this.move(e),
      pointerleave: () => { this.roadSnapMarker?.setEnabled(false); this.roadPreview?.setEnabled(false); this.lastPointer = null; this.plotAnchor?.setEnabled(false); this.alignmentGuide?.setEnabled(false); this.ring.setEnabled(false); this.brushSpokes.setEnabled(false); this.onBrushMove?.(null); this.preview?.setEnabled(false); this.targetCell?.setEnabled(false); this.targetBorder?.setEnabled(false); },
      pointerdown: e => {
        if (e.button !== 0 || !this.city) return;
        const { mode } = this.options;
        if (mode === 'select' && (e.shiftKey || this.options.boxSelect) && typeof document !== 'undefined') { this.beginBoxSelection(e); return; }
        if (mode === 'select' || mode === 'bulldoze') {
          const hit = this.pick(e, false), meta = hit.pickedMesh?.metadata;
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
  }
  endStroke(event) {
    if (!this.down) return;
    this.down = false;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.onChange(structuredClone(this.city));
  }
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
  }
  clearSelectionFrames() {
    for (const frame of this.selectionFrames || []) frame.dispose();
    this.selectionFrames = [];
  }
  beginBoxSelection(event) {
    this.cancelBoxSelection();
    this.boxSelection = { x: event.clientX, y: event.clientY };
    this.camera.detachControl(); this.boxCameraDetached = true;
    this.boxElement = document.createElement('div'); this.boxElement.className = 'box-selection'; document.body.appendChild(this.boxElement);
    this.canvas.setPointerCapture(event.pointerId); this.updateBoxSelection(event);
  }
  updateBoxSelection(event) {
    const start = this.boxSelection;
    if (!start || !this.boxElement) return;
    Object.assign(this.boxElement.style, { left: `${Math.min(start.x, event.clientX)}px`, top: `${Math.min(start.y, event.clientY)}px`, width: `${Math.abs(start.x - event.clientX)}px`, height: `${Math.abs(start.y - event.clientY)}px` });
  }
  cancelBoxSelection() {
    this.boxElement?.remove(); this.boxElement = null; this.boxSelection = null;
    if (this.boxCameraDetached) { this.camera.attachControl(this.canvas, true); this.boxCameraDetached = false; }
  }
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
  }
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
  view(type) {
    const scale = mapDimensions(this.city).size / WORLD_SIZE;
    if (type === 'top') { this.camera.beta = 0.03; this.camera.alpha = -Math.PI / 2; }
    else { this.camera.alpha = -Math.PI / 2.8; this.camera.beta = 0.83; this.camera.radius = 205 * scale; this.camera.setTarget(new Vector3(-13, 0, 4)); }
  }
  cameraState() {
    const target = this.camera.getTarget();
    return { alpha: this.camera.alpha, beta: this.camera.beta, radius: this.camera.radius, target: { x: target.x, y: target.y, z: target.z } };
  }
  restoreCamera(view) {
    this.camera.alpha = view.alpha; this.camera.beta = view.beta; this.camera.radius = view.radius;
    this.camera.setTarget(new Vector3(view.target.x, view.target.y, view.target.z));
  }
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
  }
  focusPoint(x, z, radius = this.camera.radius) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const { half, cameraLimit } = mapDimensions(this.city);
    x = Math.max(-half, Math.min(half, x));
    z = Math.max(-half, Math.min(half, z));
    this.camera.setTarget(new Vector3(x, Math.max(0, terrainHeight(this.city.heights, x, z)), z));
    this.camera.radius = Math.max(25, Math.min(cameraLimit, radius));
  }
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
  setNight(night) {
    this.setTimeOfDay(night ? 0 : 12);
  }
  previewTimeOfDay(hour) {
    if (this.environment) this.environment.autoCycle = false;
    this.setTimeOfDay(hour);
  }
  tickDaylight(seconds) {
    if (this.environment?.autoCycle) this.hour = advanceHour(this.hour ?? 12, seconds, this.environment.cycleMinutes);
    this.lightingElapsed = (this.lightingElapsed || 0) + seconds;
    if (this.lightingElapsed < 0.25) return;
    this.lightingElapsed = 0;
    if (this.environment?.autoCycle) this.setTimeOfDay(this.hour);
    else this.updateLocalLights();
  }
  updateLocalLights() {
    if (!this.city || !this.camera) return;
    // Every lamp emits visually, but only two nearby lamps illuminate surfaces.
    // Keep the total at four lights (sky, sun, two local), without local shadows.
    this.localLights ||= Array.from({ length: 2 }, (_, i) => {
      const light = new PointLight(`nearby-street-light-${i}`, Vector3.Zero(), this.scene);
      light.diffuse = new Color3(1, 0.79, 0.43); light.range = 12; light.intensity = 0;
      return light;
    });
    const lamps = [];
    if (this.night) for (const node of this.propLightNodes || []) {
      const candidate = { node, distance: Vector3.DistanceSquared(node.position, this.camera.position) };
      if (!lamps[0] || candidate.distance < lamps[0].distance) { lamps[1] = lamps[0]; lamps[0] = candidate; }
      else if (!lamps[1] || candidate.distance < lamps[1].distance) lamps[1] = candidate;
    }
    for (let i = 0; i < this.localLights.length; i++) {
      const light = this.localLights[i], node = lamps[i]?.node;
      light.intensity = node ? 2.5 : 0;
      if (node) light.position.copyFrom(node.position.add(new Vector3(0, 3.5, 0)));
    }
  }
  setTimeOfDay(hour) {
    this.hour = hour;
    const { elevation, daylight, lamps, night } = daylightAt(hour);
    if (this.night !== night) this.life?.setNight(night);
    this.night = night;
    for (const root of this.waterNodes || []) for (const mesh of root.getChildMeshes()) mesh.material.setFloat('daylight', daylight);
    this.ambient.intensity = 0.32 + daylight * 0.53; this.sun.intensity = 0.15 + daylight * 1.35;
    const angle = (hour - 6) / 24 * Math.PI * 2;
    this.sun.direction.set(-Math.cos(angle) * 0.7, -Math.max(0.16, Math.abs(elevation)), 0.45);
    this.sun.position.copyFrom(this.sun.direction.scale(-150));
    const dusk = daylight * (1 - daylight) * 4;
    this.sun.diffuse = new Color3(1, 1 - dusk * 0.3, 1 - dusk * 0.5);
    this.scene.clearColor = new Color4(0.09 + daylight * 0.57 + dusk * 0.06, 0.16 + daylight * 0.61 - dusk * 0.06, 0.23 + daylight * 0.55 - dusk * 0.1, 1);
    this.scene.fogColor = new Color3(this.scene.clearColor.r, this.scene.clearColor.g, this.scene.clearColor.b);
    for (const key of ['glass', 'neighborhood-glass', 'utility-glass']) {
      const mat = this.materials.get(key); if (mat) mat.emissiveColor = new Color3(0.8, 0.64, 0.3).scale(lamps);
    }
    for (const key of ['city-lamp', 'city-sign', 'city-light-pool', 'bridge-light']) {
      const mat = this.materials.get(key); if (mat) mat.emissiveColor = new Color3(1, 0.78, 0.38).scale(lamps * (key === 'city-light-pool' ? 0.3 : 0.9));
    }
    this.updateLocalLights();
  }
  dispose() {
    this.cancelBoxSelection();
    this.resize.disconnect();
    for (const [name, handler] of Object.entries(this.handlers)) this.canvas.removeEventListener(name, handler);
    this.scene.dispose(); this.engine.dispose();
  }
}

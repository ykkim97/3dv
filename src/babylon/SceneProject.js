// src/babylon/SceneProject.js
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { AdvancedDynamicTexture, StackPanel, TextBlock, Button as GUIButton, Rectangle } from "@babylonjs/gui";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/linesBuilder";
import "@babylonjs/core/Meshes/Builders/planeBuilder";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { createMeta } from "./MeshEntities";
import { DEFAULT_CONTOUR_COLOR_PRESET, getContourColorPreset } from "../ui/contourColorPresets";
export default class SceneProject {
  constructor({ id, name, initialJSON = null }) {
    this.id = id || `scene-${Date.now()}`;
    this.name = name || "Untitled Scene";

    this.canvas = null;
    this.engine = null;
    this.scene = null;
    this.camera = null;

    this.meshMetaMap = new Map();
    this.meshMap = new Map();
    this.materialMap = new Map();
    this._lights = new Map();
    this._modelLoadPromises = new Map();
    this._contourMaterialMap = new Map();

    this.commandQueue = [];
    this._running = false;

    this.highlightLayer = null; // legacy field kept for compatibility (no longer used)
    this._selectedId = null;
    this._highlightedIds = new Set();
    this._selectionBoxIds = new Set();
    this._selectionBoundsMeshes = new Map();
    this.onSelect = null; // callback: (id|null) => void
    this._changeCallback = null; // callback: (id) => void for runtime gizmo/transform updates
    this._lastAttachedState = {}; // store last known transform to detect changes
    this._changeCallback = null; // callback: (id) => void for runtime gizmo/transform updates

    // Grid related
    this._gridMesh = null;
    this._gridMaterial = null;
    this._gridMaterials = [];
    this._gridVisible = true;
    this._gridSize = 4000; // large shader plane that follows the camera target
    this._gridObserver = null;
    this._gizmoManager = null;
    this._gizmoVisible = true;
    this._gizmoMode = "all";
    this._toolMode = "select";
    this._snapEnabled = false;
    this._snapValue = 1;
    this._snapRotateRad = Math.PI / 12; // 15deg
    this._snapScaleValue = 0.1;
    this._cameraKeyboardEnabled = true;
    this._cameraPointerOrbitEnabled = true;

    // textbox mesh resources
    this._textTextureMap = new Map();

    // Optional WASM exports (injected by App). Use for CPU-heavy ops when needed.
    this._wasm = null;

    // Optional script engine (Worker sandbox) injected by App.
    this._scriptEngine = null;
    this._selectionSource = "unknown";

    // Runtime vs edit mode.
    this._runtimeEnabled = false;
    this._suppressPointerPickSelection = false;
    this._cursorMarker = null;
    this._cursorMarkerMaterial = null;
    this._measurementMarkers = [];
    this._measurementLine = null;
    this._measurementMaterial = null;

    // Placement preview (ghost mesh)
    this._placementPreviewKind = null;
    this._placementPreviewMesh = null;
    this._placementPreviewMaterial = null;

    // GUI panels (map id -> { type, mesh, adt, linkLine })
    this._guiPanels = new Map();
    this._guiPanelCallback = null; // (id, meta) => void
    this._guiPanelChangeListeners = []; // array of (id, meta) => void
    

    // 축
    this._axesHelper = null;
    this._axisGuideMeshes = [];
    this._axisGuideMaterials = [];
    this._axesVisible = true; // 기본 on; App에서 툴 상태로 제어

    this._hemisphericLight = null;

    if (initialJSON) {
      this._loadMetaFromJSON(initialJSON);
    } else {
      try {
        const starter = createMeta("box", {
          id: `box-${Date.now()}-starter`,
          name: "Box-001",
          position: { x: 0, y: 0.5, z: 0 },
          material: { color: { r: 0.35, g: 0.55, b: 1 } },
        });
        this.meshMetaMap.set(starter.id, starter);
      } catch (e) { void e; }
    }
  }

  // Create a fullscreen overlay GUI panel (anchored in screen space)
  addGuiPanelOverlay(opts = {}) {
    try {
      if (!this.scene) return null;
      // create a unique key
      const id = `gui-overlay-${Date.now()}`;
      const adt = AdvancedDynamicTexture.CreateFullscreenUI(id, true, this.scene);

      const rect = new Rectangle();
      rect.width = "320px";
      rect.height = "180px";
      rect.cornerRadius = 8;
      rect.color = "#ffffff";
      rect.background = "rgba(18,18,22,0.9)";
      rect.thickness = 1;
      rect.horizontalAlignment = 1; // RIGHT
      rect.verticalAlignment = 0; // TOP
      rect.top = "12px";
      rect.left = "-12px";
      adt.addControl(rect);

      const stack = new StackPanel();
      stack.paddingTop = "8px";
      rect.addControl(stack);

      const title = new TextBlock();
      title.text = opts.title || "GUI Panel";
      title.color = "#ffffff";
      title.fontSize = 14;
      title.textHorizontalAlignment = 0;
      stack.addControl(title);

      const body = new TextBlock();
      body.text = opts.text || "Overlay GUI panel";
      body.color = "#dfe6ff";
      body.fontSize = 12;
      body.textWrapping = true;
      stack.addControl(body);

      const rec = { type: "overlay", adt, rect, stack, titleControl: title, bodyControl: body };
      this._guiPanels.set(id, rec);
      return id;
    } catch (err) {
      console.error("addGuiPanelOverlay error:", err);
      return null;
    }
  }

  // --- lightweight API surface expected by App.jsx / SceneView ---
  setSelectionCallback(fn) {
    try { this.onSelect = typeof fn === 'function' ? fn : null; } catch (e) { void e; }
  }

  setChangeCallback(fn) {
    try { this._changeCallback = typeof fn === 'function' ? fn : null; } catch (e) { void e; }
  }

  setGuiPanelCallback(fn) {
    try { this._guiPanelCallback = typeof fn === 'function' ? fn : null; } catch (e) { void e; }
  }

  setCameraKeyboardEnabled(enabled) {
    try {
      this._cameraKeyboardEnabled = !!enabled;
      this._applyCameraInputState();
    } catch (e) { void e; }
  }

  setCameraPointerOrbitEnabled(enabled) {
    try {
      this._cameraPointerOrbitEnabled = !!enabled;
      this._applyCameraInputState();
    } catch (e) { void e; }
  }

  _applyCameraInputState() {
    try {
      if (!this.camera || !this.canvas || !this.camera.inputs) return;
      const attached = this.camera.inputs.attached || {};
      const pointerInput = attached.pointers;
      const keyboardInput = attached.keyboard;

      if (pointerInput && typeof pointerInput.attachControl === "function" && typeof pointerInput.detachControl === "function") {
        if (this._cameraPointerOrbitEnabled) pointerInput.attachControl(this.canvas);
        else pointerInput.detachControl(this.canvas);
      }

      if (keyboardInput && typeof keyboardInput.attachControl === "function" && typeof keyboardInput.detachControl === "function") {
        if (this._cameraKeyboardEnabled) keyboardInput.attachControl(this.canvas);
        else keyboardInput.detachControl(this.canvas);
      }
    } catch (e) { void e; }
  }

  setGridVisible(visible) {
    try {
      this._gridVisible = !!visible;
      if (!this.scene) return;
      if (this._gridVisible) {
        try { this._ensureDefaultViewportGuides(); } catch (e) { void e; }
      } else {
        try { if (this._gridMesh) { this._gridMesh.dispose(); this._gridMesh = null; } } catch (e) { void e; }
        try { if (this._gridMaterial) { this._gridMaterial.dispose(); this._gridMaterial = null; } } catch (e) { void e; }
        for (const mat of this._gridMaterials || []) {
          try { mat.dispose(); } catch (e) { void e; }
        }
        this._gridMaterials = [];
      }
    } catch (e) { void e; }
  }

  setAxesVisible(visible) {
    try {
      const next = !!visible;
      this._axesVisible = next;
      if (!this.scene) return;
      if (next) {
        try { this._ensureDefaultViewportGuides(); } catch (e) { void e; }
        try { if (this._axesHelper) this._axesHelper.setVisible(true); } catch (e) { void e; }
        for (const mesh of this._axisGuideMeshes || []) {
          try { mesh.setEnabled(true); } catch (e) { void e; }
        }
      } else {
        try { if (this._axesHelper) { this._axesHelper.dispose(); this._axesHelper = null; } } catch (e) { void e; }
        this._disposeAxisGuideMeshes();
      }
    } catch (e) { void e; }
  }

  setGizmoVisible(visible) {
    try {
      this._gizmoVisible = !!visible;
      if (!this._gizmoManager) return;
      try {
        if (!this._gizmoVisible) {
          this._gizmoManager.attachToMesh(null);
        }
      } catch (e) { void e; }
    } catch (e) { void e; }
  }

  setWasm(wasm) {
    try { this._wasm = wasm; } catch (e) { void e; }
  }

  ensureViewportGuides() {
    try {
      this._gridVisible = true;
      this._axesVisible = true;
      this._ensureDefaultViewportGuides();
    } catch (e) { void e; }
  }

  _createGridGuide() {
    const grid = MeshBuilder.CreateGround("__grid", {
      width: this._gridSize,
      height: this._gridSize,
      subdivisions: 1,
    }, this.scene);
    const mat = new ShaderMaterial("__grid_mat", this.scene, {
      vertexSource: `
        precision highp float;
        attribute vec3 position;
        uniform mat4 worldViewProjection;
        uniform mat4 world;
        varying vec3 vPositionW;
        void main(void) {
          vec4 worldPosition = world * vec4(position, 1.0);
          vPositionW = worldPosition.xyz;
          gl_Position = worldViewProjection * vec4(position, 1.0);
        }
      `,
      fragmentSource: `
        precision highp float;
        varying vec3 vPositionW;
        uniform vec3 cameraPosition;

        float gridLine(vec2 coord, float scale, float thickness) {
          vec2 scaled = coord / scale;
          vec2 derivative = fwidth(scaled);
          vec2 grid = abs(fract(scaled - 0.5) - 0.5) / max(derivative * thickness, vec2(0.0001));
          return 1.0 - min(min(grid.x, grid.y), 1.0);
        }

        void main(void) {
          vec2 coord = vPositionW.xz;
          float minor = gridLine(coord, 1.0, 1.15) * 0.34;
          float major = gridLine(coord, 5.0, 1.45) * 0.7;
          float line = max(minor, major);
          float dist = distance(coord, cameraPosition.xz);
          float fade = 1.0 - smoothstep(420.0, 1600.0, dist);
          vec3 gridColor = mix(vec3(0.22, 0.25, 0.30), vec3(0.54, 0.60, 0.70), major);
          float alpha = line * fade * 0.72;
          if (alpha < 0.015) discard;
          gl_FragColor = vec4(gridColor, alpha);
        }
      `,
    }, {
      attributes: ["position"],
      uniforms: ["world", "worldViewProjection", "cameraPosition"],
      needAlphaBlending: true,
    });
    mat.backFaceCulling = false;
    mat.disableDepthWrite = true;
    grid.material = mat;
    grid.isPickable = false;
    grid.position.y = -0.002;
    this._gridMaterial = mat;
    this._gridMaterials = [mat];
    this._syncInfiniteGridToCamera();
    if (!this._gridObserver && this.scene && this.scene.onBeforeRenderObservable) {
      this._gridObserver = this.scene.onBeforeRenderObservable.add(() => {
        try { this._syncInfiniteGridToCamera(); } catch (e) { void e; }
      });
    }
    return grid;
  }

  _syncInfiniteGridToCamera() {
    try {
      if (!this._gridMesh || !this.camera) return;
      const target = this.camera.target || Vector3.Zero();
      const snap = 100;
      this._gridMesh.position.x = Math.floor(target.x / snap) * snap;
      this._gridMesh.position.z = Math.floor(target.z / snap) * snap;
      const pos = this.camera.globalPosition || this.camera.position || Vector3.Zero();
      for (const mat of this._gridMaterials || []) {
        if (mat && typeof mat.setVector3 === "function") {
          mat.setVector3("cameraPosition", pos);
        }
      }
    } catch (e) { void e; }
  }

  _createFallbackAxesGuide() {
    this._disposeAxisGuideMeshes();
    if (!this.scene) return;
    const size = 50000;
    const axes = [
      ["__axis_x", new Vector3(0, 0.018, 0), new Vector3(0, 0, Math.PI / 2), new Color3(1, 0.12, 0.10)],
      ["__axis_y", new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Color3(0.2, 1, 0.18)],
      ["__axis_z", new Vector3(0, 0.018, 0), new Vector3(Math.PI / 2, 0, 0), new Color3(0.18, 0.36, 1)],
    ];
    for (const [name, position, rotation, color] of axes) {
      try {
        const axis = MeshBuilder.CreateCylinder(name, { height: size * 2, diameter: 0.035, tessellation: 8 }, this.scene);
        const mat = new StandardMaterial(`${name}_mat`, this.scene);
        mat.diffuseColor = color;
        mat.emissiveColor = color.scale(0.72);
        mat.specularColor = Color3.Black();
        axis.position = position;
        axis.rotation = rotation;
        axis.material = mat;
        axis.alwaysSelectAsActiveMesh = true;
        axis.isPickable = false;
        this._axisGuideMeshes.push(axis);
        this._axisGuideMaterials.push(mat);
      } catch (e) { console.warn(`Failed to create fallback axis ${name}`, e); }
    }
  }

  _disposeAxisGuideMeshes() {
    for (const mesh of this._axisGuideMeshes || []) {
      try { mesh.dispose(); } catch (e) { void e; }
    }
    for (const material of this._axisGuideMaterials || []) {
      try { material.dispose(); } catch (e) { void e; }
    }
    this._axisGuideMeshes = [];
    this._axisGuideMaterials = [];
  }

  _ensureDefaultViewportGuides() {
    try {
      if (!this.scene) return;
      const gridDisposed = this._gridMesh && typeof this._gridMesh.isDisposed === "function" && this._gridMesh.isDisposed();
      if (gridDisposed) {
        this._gridMesh = null;
        this._gridMaterial = null;
        this._gridMaterials = [];
      }

      const liveAxisMeshes = (this._axisGuideMeshes || []).filter((mesh) => {
        try { return mesh && !(typeof mesh.isDisposed === "function" && mesh.isDisposed()); } catch { return false; }
      });
      if (liveAxisMeshes.length !== (this._axisGuideMeshes || []).length) {
        this._axisGuideMeshes = liveAxisMeshes;
      }

      if (this._gridVisible && !this._gridMesh) {
        try { this._gridMesh = this._createGridGuide(); } catch (e) { console.warn("Failed to create viewport grid", e); }
      }
      if (this._axesVisible && !this._axesHelper && (!this._axisGuideMeshes || this._axisGuideMeshes.length === 0)) {
        this._createFallbackAxesGuide();
      }
    } catch (e) { void e; }
  }

  // The rest of the original file is unchanged; recreated to avoid BOM issues.
  attachCanvas(canvas) {
    try {
      if (!canvas) return;
      if (this.canvas === canvas && this.engine && this.scene) return true;
      if (this.engine || this.scene) {
        try { this.detachAndShutdown(); } catch (e) { void e; }
      }
      this.canvas = canvas;

      // initialize engine & scene
      this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
      this.scene = new Scene(this.engine);

      // default clear color
      try { this.scene.clearColor = new Color4(0.12, 0.12, 0.14, 1.0); } catch (e) { void e; }

      // camera
      this.camera = new ArcRotateCamera("sceneCamera", Math.PI / 4, Math.PI / 4, 10, new Vector3(0, 0, 0), this.scene);
      try { this.camera.attachControl(this.canvas, true); } catch (e) { void e; }
      try { this._applyCameraInputState(); } catch (e) { void e; }

      // lights
      this._hemisphericLight = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
      this._hemisphericLight.intensity = 0.9;
      try {
        const dir = new DirectionalLight("dir", new Vector3(-0.5, -1, -0.5), this.scene);
        dir.intensity = 0.6;
        this._lights.set("dir", dir);
      } catch (e) { void e; }

      // simple gizmo manager for selection/transforms
      try { this._gizmoManager = new GizmoManager(this.scene); this._gizmoManager.usePointerToAttachGizmos = false; } catch (e) { void e; }

      // Recreate Babylon runtime meshes from saved/imported metadata after a canvas
      // attach. The constructor only stores metadata because there is no Scene yet.
      try { this._rebuildRuntimeMeshes(); } catch (e) { void e; }

      // Make the default editor guides visible as soon as the scene attaches.
      this._gridVisible = true;
      this._axesVisible = true;
      try { this._ensureDefaultViewportGuides(); } catch (e) { void e; }

      // start render loop
      try {
        this.engine.runRenderLoop(() => {
          try {
            // process queued commands before rendering
            try { this._processCommands && typeof this._processCommands === 'function' && this._processCommands(); } catch (e) { void e; }
            try { this._syncSelectionBounds && this._syncSelectionBounds(); } catch (e) { void e; }
            if (this.scene) this.scene.render();
          } catch (err) { console.error('scene render error', err); }
        });
      } catch (err) { void err; }

      // resize handler
      this._resizeHandler = () => { try { this.engine && this.engine.resize(); } catch (err) { void err; } };
      try { window.addEventListener('resize', this._resizeHandler); } catch (e) { void e; }

      return true;
    } catch (err) {
      console.error('attachCanvas error', err);
      return false;
    }
  }

  detachAndShutdown() {
    try {
      if (this.engine) {
        try { this.engine.stopRenderLoop(); } catch (e) { void e; }
        try { if (this.scene) this.scene.dispose(); } catch (e) { void e; }
        try { this.engine.dispose(); } catch (e) { void e; }
      }
      try { window.removeEventListener('resize', this._resizeHandler); } catch (e) { void e; }
      this.canvas = null;
      this.engine = null;
      this.scene = null;
      this.camera = null;
      this._gridMesh = null;
      this._gridMaterial = null;
      this._gridMaterials = [];
      this._gridObserver = null;
      this._axesHelper = null;
      this._axisGuideMeshes = [];
      this._axisGuideMaterials = [];
      this._gizmoManager = null;
      this._selectionBoundsMeshes = new Map();
      this._contourMaterialMap = new Map();
      return true;
    } catch (err) {
      console.error('detachAndShutdown error', err);
      return false;
    }
  }

  // --- mesh/meta/query helpers ---
  getMeshMetaList() {
    try { return Array.from(this.meshMetaMap.values()).map(m => ({ ...m })); } catch { return []; }
  }

  getMeta(id) {
    try { const m = this.meshMetaMap.get(id); return m ? JSON.parse(JSON.stringify(m)) : null; } catch { return null; }
  }

  serialize() {
    try {
      const meshes = [];
      for (const [, m] of this.meshMetaMap) {
        const runtime = this.meshMap.get(m.id);
        let pos = { ...m.position }, rot = { ...m.rotation }, scl = { ...m.scaling };
        if (runtime) {
          try {
            if (runtime.position) pos = { x: runtime.position.x, y: runtime.position.y, z: runtime.position.z };
            if (runtime.rotation) rot = { x: runtime.rotation.x, y: runtime.rotation.y, z: runtime.rotation.z };
            if (runtime.scaling) scl = { x: runtime.scaling.x, y: runtime.scaling.y, z: runtime.scaling.z };
          } catch (e) { void e; }
        }
        meshes.push({ id: m.id, name: m.name, kind: m.kind, params: m.params, parent: m.parent, visible: m.visible !== false, locked: m.locked === true, position: pos, rotation: rot, scaling: scl, material: { ...m.material }, scripts: m.scripts ? JSON.parse(JSON.stringify(m.scripts)) : null });
      }
      const cam = this.camera ? { type: 'arcRotate', alpha: this.camera.alpha, beta: this.camera.beta, radius: this.camera.radius } : null;
      return { id: this.id, name: this.name, camera: cam, meshes, createdAt: Date.now() };
    } catch { return { id: this.id, name: this.name, camera: null, meshes: [], createdAt: Date.now() }; }
  }

  _loadMetaFromJSON(json) {
    try {
      if (!json || !json.meshes) return;
      for (const m of json.meshes) {
        try {
        const meta = createMeta(m.kind, { id: m.id, name: m.name, params: m.params, parent: m.parent, visible: m.visible, locked: m.locked, position: m.position, rotation: m.rotation, scaling: m.scaling, material: m.material, scripts: m.scripts });
          this.meshMetaMap.set(meta.id, meta);
        } catch (e) { void e; }
      }
      try { this._scriptEngine && typeof this._scriptEngine.setScripts === 'function' && this._scriptEngine.setScripts(this.getMeshMetaList()); } catch (e) { void e; }
    } catch (e) { void e; }
  }

  // --- command queue ---
  enqueueCommand(cmd) {
    try { this.commandQueue.push(cmd); } catch (e) { void e; }
  }

  _processCommands() {
    try {
      if (!this.commandQueue || !this.commandQueue.length) return;
      const items = this.commandQueue.splice(0, this.commandQueue.length);
      for (const c of items) {
        try { this._applyCommand && this._applyCommand(c); } catch (e) { console.error('SceneProject command error:', e); }
      }
      try { if (typeof this._changeCallback === 'function') this._changeCallback(); } catch (e) { void e; }
    } catch (e) { void e; }
  }

  _applyCommand(cmd) {
    try {
      if (!cmd || !cmd.type) return;
      const { type, payload } = cmd;
      if (type === 'createMesh') {
        const meshMeta = createMeta(payload.kind, { id: payload.id, name: payload.name, params: payload.params, parent: payload.parent, visible: payload.visible, locked: payload.locked, position: payload.position, rotation: payload.rotation, scaling: payload.scaling, material: payload.material, scripts: payload.scripts });
        this.meshMetaMap.set(meshMeta.id, meshMeta);
        if (this.scene) this._createRuntimeMesh(meshMeta);
        try { this._syncScriptEngineScripts && this._syncScriptEngineScripts(); } catch (e) { void e; }
        return;
      }
      if (type === 'updateMesh') {
        const { id, changes = {} } = payload || {};
        const meta = this.meshMetaMap.get(id);
        if (!meta) return;
        if (changes.name !== undefined) meta.name = changes.name;
        if (changes.visible !== undefined) meta.visible = changes.visible !== false;
        if (changes.locked !== undefined) meta.locked = changes.locked === true;
        if (changes.position) Object.assign(meta.position, changes.position);
        if (changes.rotation) Object.assign(meta.rotation, changes.rotation);
        if (changes.scaling) Object.assign(meta.scaling, changes.scaling);
        if (changes.material) meta.material = { ...meta.material, ...changes.material };
        if (changes.params) meta.params = { ...(meta.params || {}), ...(changes.params || {}) };
        if (changes.parent !== undefined) meta.parent = changes.parent;
        if (changes.scripts !== undefined) meta.scripts = changes.scripts;
        if (this.scene) {
          if (meta.kind === 'contour' && changes.params) {
            try { this._disposeContourRuntime(id); } catch (e) { void e; }
            try { this._createRuntimeMesh(meta); } catch (e) { void e; }
            try { this._applySelectionBounds(); } catch (e) { void e; }
            return;
          }
          const runtime = this.meshMap.get(id);
          if (runtime) {
            try { runtime.position && runtime.position.copyFromFloats(meta.position.x, meta.position.y, meta.position.z); } catch (e) { void e; }
            try { runtime.rotation && typeof runtime.rotation.copyFromFloats === 'function' ? runtime.rotation.copyFromFloats(meta.rotation.x, meta.rotation.y, meta.rotation.z) : runtime.rotation = new Vector3(meta.rotation.x, meta.rotation.y, meta.rotation.z); } catch (e) { void e; }
            try { runtime.scaling && typeof runtime.scaling.copyFromFloats === 'function' ? runtime.scaling.copyFromFloats(meta.scaling.x, meta.scaling.y, meta.scaling.z) : runtime.scaling = new Vector3(meta.scaling.x, meta.scaling.y, meta.scaling.z); } catch (e) { void e; }
            try { runtime.setEnabled(meta.visible !== false); } catch (e) { void e; }
            if (meta.visible === false || meta.locked === true) {
              try {
                this._highlightedIds.delete(id);
                if (this._selectedId === id) this._selectedId = null;
                this._applySelectionBounds();
              } catch (e) { void e; }
            }
          }
          try { this._applyMaterialToMesh && this._applyMaterialToMesh(meta); } catch (e) { void e; }
        }
        return;
      }
      if (type === 'removeMesh') {
        const { id } = payload || {};
        try { this._disposeSelectionBoundsMesh(id); } catch (e) { void e; }
        try { this._disposeContourRuntime(id); } catch (e) { void e; }
        try { const m = this.meshMap.get(id); if (m) { try { m.dispose(); } catch (e) { void e; } this.meshMap.delete(id); } } catch (e) { void e; }
        try { const mat = this.materialMap.get(id); if (mat) { try { mat.dispose(); } catch (e) { void e; } this.materialMap.delete(id); } } catch (e) { void e; }
        try { const txt = this._textTextureMap.get(id); if (txt) { try { txt.dispose(); } catch (e) { void e; } this._textTextureMap.delete(id); } } catch (e) { void e; }
        try { this.meshMetaMap.delete(id); } catch (e) { void e; }
        if (this._selectedId === id) this._selectMeshById && this._selectMeshById(null, 'api');
        try { this._syncScriptEngineScripts && this._syncScriptEngineScripts(); } catch (e) { void e; }
        return;
      }
    } catch (e) { console.warn('Unknown command or failed to apply', e); }
  }

  _rebuildRuntimeMeshes() {
    if (!this.scene) return;

    try {
      for (const [, mesh] of this.meshMap) {
        try { mesh.dispose(); } catch (e) { void e; }
      }
      for (const [, material] of this.materialMap) {
        try { material.dispose(); } catch (e) { void e; }
      }
      for (const [, materials] of this._contourMaterialMap) {
        for (const material of materials || []) {
          try { material.dispose(); } catch (e) { void e; }
        }
      }
      for (const [, texture] of this._textTextureMap) {
        try { texture.dispose(); } catch (e) { void e; }
      }
    } catch (e) { void e; }

    this.meshMap.clear();
    this.materialMap.clear();
    this._textTextureMap.clear();
    this._contourMaterialMap.clear();
    this._disposeAllSelectionBoundsMeshes();

    const metas = Array.from(this.meshMetaMap.values());
    for (const meta of metas) {
      try { this._createRuntimeMesh(meta); } catch (e) { void e; }
    }

    // Parent links can point to meshes that appear later in the serialized list.
    for (const meta of metas) {
      try {
        const mesh = this.meshMap.get(meta.id);
        if (!mesh) continue;
        mesh.parent = meta.parent ? (this.meshMap.get(meta.parent) || null) : null;
      } catch (e) { void e; }
    }
  }

  _createRuntimeMesh(meta) {
    try {
      if (!meta || !this.scene) return;
      // simple mapping of kinds
      let m = null;
      if (meta.kind === 'group') {
        m = MeshBuilder.CreateBox(meta.id, { size: 0.01 }, this.scene);
        m.isPickable = false;
        m.visibility = 0;
      } else if (meta.kind === 'box') {
        m = MeshBuilder.CreateBox(meta.id, meta.params || { size: 1 }, this.scene);
      } else if (meta.kind === 'sphere') {
        m = MeshBuilder.CreateSphere(meta.id, meta.params || { diameter: 1 }, this.scene);
      } else if (meta.kind === 'cylinder' || meta.kind === 'cone') {
        const params = { ...(meta.params || {}) };
        if (meta.kind === 'cone' && params.diameterTop === undefined) params.diameterTop = 0;
        m = MeshBuilder.CreateCylinder(meta.id, params, this.scene);
      } else if (meta.kind === 'line') {
        const pts = (meta.params && meta.params.points) ? (meta.params.points.map(p => new Vector3(p.x || 0, p.y || 0, p.z || 0))) : [];
        m = MeshBuilder.CreateLines(meta.id, { points: pts }, this.scene);
        try { m.isPickable = true; } catch (e) { void e; }
      } else if (meta.kind === 'textbox') {
        const p = meta.params || {};
        m = MeshBuilder.CreatePlane(meta.id, { width: p.width || 2, height: p.height || 1 }, this.scene);
      } else if (meta.kind === 'contour') {
        m = this._createContourRuntimeMesh(meta);
      } else {
        m = MeshBuilder.CreateBox(meta.id, { size: 1 }, this.scene);
      }
      if (!m) return;
      try { m.name = meta.name || meta.id; } catch (e) { void e; }
      try { m.position && m.position.copyFromFloats(meta.position.x, meta.position.y, meta.position.z); } catch (e) { void e; }
      try { if (m.rotation && typeof m.rotation.copyFromFloats === 'function') m.rotation.copyFromFloats(meta.rotation.x, meta.rotation.y, meta.rotation.z); else m.rotation = new Vector3(meta.rotation.x, meta.rotation.y, meta.rotation.z); } catch (e) { void e; }
      try { if (m.scaling && typeof m.scaling.copyFromFloats === 'function') m.scaling.copyFromFloats(meta.scaling.x, meta.scaling.y, meta.scaling.z); else m.scaling = new Vector3(meta.scaling.x, meta.scaling.y, meta.scaling.z); } catch (e) { void e; }
      try { m.setEnabled(meta.visible !== false); } catch (e) { void e; }
      if (meta.parent) {
        try { const p = this.meshMap.get(meta.parent); if (p) { try { m.parent = p; } catch (e) { void e; } } } catch (e) { void e; }
      }
      this.meshMap.set(meta.id, m);
      try { this._applyMaterialToMesh && this._applyMaterialToMesh(meta); } catch (e) { void e; }
    } catch (e) { console.error('Failed to create runtime mesh', e); }
  }

  _normalizeContourParams(params = {}) {
    const inferredDimensions = params.autoDimensions !== false ? this._inferContourDimensions(params.values) : null;
    const dim = inferredDimensions || params.dimensions || {};
    const size = params.size || {};
    const dimensions = {
      x: Math.max(1, Math.min(64, Math.floor(Number(dim.x) || 5))),
      y: Math.max(1, Math.min(64, Math.floor(Number(dim.y) || 5))),
      z: Math.max(1, Math.min(64, Math.floor(Number(dim.z) || 5))),
    };
    const normalized = {
      dimensions,
      size: {
        x: Math.max(0.01, Number(size.x) || 5),
        y: Math.max(0.01, Number(size.y) || 5),
        z: Math.max(0.01, Number(size.z) || 5),
      },
      values: this._flattenContourValues(params.values, dimensions),
      opacity: Math.max(0.05, Math.min(1, Number(params.opacity ?? 0.78))),
      cellGap: Math.max(0, Math.min(0.45, Number(params.cellGap ?? 0))),
      showBounds: params.showBounds !== false,
      autoDimensions: params.autoDimensions !== false,
      colorPreset: typeof params.colorPreset === "string" ? params.colorPreset : DEFAULT_CONTOUR_COLOR_PRESET,
      slice: this._normalizeContourSliceParams(params.slice || {}, dimensions),
    };
    const activeValues = normalized.values.filter((value) => Number.isFinite(value) && value !== 0);
    if (activeValues.length) {
      const minValue = Math.min(...activeValues);
      const maxValue = Math.max(...activeValues);
      normalized.minValue = minValue;
      normalized.maxValue = maxValue === minValue ? Math.max(0, minValue) : maxValue;
      if (normalized.maxValue === normalized.minValue) normalized.minValue = 0;
    } else {
      normalized.minValue = 0;
      normalized.maxValue = 1;
    }
    return normalized;
  }

  _normalizeContourSliceParams(slice = {}, dimensions = { x: 5, y: 5, z: 5 }) {
    const axis = ["x", "y", "z"].includes(slice.axis) ? slice.axis : "z";
    const maxIndex = Math.max(0, (dimensions[axis] || 1) - 1);
    const clampIndex = (value) => Math.max(0, Math.min(maxIndex, Math.floor(Number(value) || 0)));
    const baseIndex = clampIndex(slice.index ?? maxIndex);
    const rawQuadrants = Array.isArray(slice.quadrants) ? slice.quadrants : [];
    const quadrants = [0, 1, 2, 3].map((i) => clampIndex(rawQuadrants[i] ?? baseIndex));
    return {
      enabled: slice.enabled === true,
      axis,
      index: baseIndex,
      cumulative: slice.cumulative === true,
      quadMode: slice.quadMode === true,
      quadrants,
    };
  }

  _getContourSliceCoordinate(slice, x, y, z) {
    if (slice.axis === "x") return x;
    if (slice.axis === "y") return y;
    return z;
  }

  _getContourSliceQuadrant(slice, dimensions, x, y, z) {
    let u = x;
    let v = y;
    let uSize = dimensions.x;
    let vSize = dimensions.y;
    if (slice.axis === "x") {
      u = z;
      v = y;
      uSize = dimensions.z;
      vSize = dimensions.y;
    } else if (slice.axis === "y") {
      u = x;
      v = z;
      uSize = dimensions.x;
      vSize = dimensions.z;
    }
    const right = u >= Math.ceil(uSize / 2);
    const top = v >= Math.ceil(vSize / 2);
    return (top ? 2 : 0) + (right ? 1 : 0);
  }

  _isContourCellVisibleBySlice(slice, dimensions, x, y, z) {
    if (!slice || !slice.enabled) return true;
    const coord = this._getContourSliceCoordinate(slice, x, y, z);
    const target = slice.quadMode
      ? slice.quadrants[this._getContourSliceQuadrant(slice, dimensions, x, y, z)]
      : slice.index;
    return slice.cumulative ? coord <= target : coord === target;
  }

  _inferContourDimensions(values) {
    try {
      if (!Array.isArray(values) || !values.length) return null;
      if (!Array.isArray(values[0])) return null;
      if (Array.isArray(values[0][0])) {
        const z = values.length;
        let y = 0;
        let x = 0;
        for (const plane of values) {
          if (!Array.isArray(plane)) continue;
          y = Math.max(y, plane.length);
          for (const row of plane) {
            if (Array.isArray(row)) x = Math.max(x, row.length);
          }
        }
        return x && y && z ? { x, y, z } : null;
      }
      const y = values.length;
      const x = values.reduce((max, row) => Array.isArray(row) ? Math.max(max, row.length) : max, 0);
      return x && y ? { x, y, z: 1 } : null;
    } catch {
      return null;
    }
  }

  _flattenContourValues(values, dimensions) {
    const out = [];
    const visit = (item) => {
      if (Array.isArray(item)) {
        for (const child of item) visit(child);
      } else {
        const n = Number(item);
        out.push(Number.isFinite(n) ? n : 0);
      }
    };
    visit(Array.isArray(values) ? values : []);
    const total = dimensions.x * dimensions.y * dimensions.z;
    while (out.length < total) out.push(0);
    return out.slice(0, total);
  }

  _contourColor(value, minValue, maxValue, presetId = DEFAULT_CONTOUR_COLOR_PRESET) {
    const span = Math.max(0.000001, maxValue - minValue);
    const t = Math.max(0, Math.min(1, (value - minValue) / span));
    const preset = getContourColorPreset(presetId);
    const stops = preset.stops.map(([stop, color]) => ({ t: stop, c: new Color3(color[0], color[1], color[2]) }));
    for (let i = 1; i < stops.length; i += 1) {
      if (t <= stops[i].t) {
        const a = stops[i - 1];
        const b = stops[i];
        const f = (t - a.t) / Math.max(0.000001, b.t - a.t);
        return Color3.Lerp(a.c, b.c, f);
      }
    }
    return stops[stops.length - 1].c;
  }

  _contourValueAt(values, dimensions, x, y, z) {
    try {
      if (x < 0 || y < 0 || z < 0 || x >= dimensions.x || y >= dimensions.y || z >= dimensions.z) return 0;
      return Number(values[x + y * dimensions.x + z * dimensions.x * dimensions.y]) || 0;
    } catch {
      return 0;
    }
  }

  _contourCornerValue(values, dimensions, x, y, z, fallback) {
    let sum = 0;
    let count = 0;
    for (let dz = -1; dz <= 0; dz += 1) {
      for (let dy = -1; dy <= 0; dy += 1) {
        for (let dx = -1; dx <= 0; dx += 1) {
          const v = this._contourValueAt(values, dimensions, x + dx, y + dy, z + dz);
          if (v !== 0) {
            sum += v;
            count += 1;
          }
        }
      }
    }
    return count ? sum / count : fallback;
  }

  _createContourRuntimeMesh(meta) {
    const p = this._normalizeContourParams(meta.params || {});
    meta.params = { ...(meta.params || {}), ...p };
    const root = new Mesh(meta.id, this.scene);
    root.isPickable = true;
    root.metadata = { ...(root.metadata || {}), contourRootId: meta.id };

    const positions = [];
    const indices = [];
    const colors = [];
    const normals = [];
    const cellSize = {
      x: p.size.x / p.dimensions.x,
      y: p.size.y / p.dimensions.y,
      z: p.size.z / p.dimensions.z,
    };
    const gap = {
      x: cellSize.x * p.cellGap * 0.5,
      y: cellSize.y * p.cellGap * 0.5,
      z: cellSize.z * p.cellGap * 0.5,
    };
    const pushVertex = (x, y, z, value) => {
      const color = this._contourColor(value, p.minValue, p.maxValue, p.colorPreset);
      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b, p.opacity);
      return (positions.length / 3) - 1;
    };
    const pushFace = (corners) => {
      const base = positions.length / 3;
      for (const corner of corners) pushVertex(corner.x, corner.y, corner.z, corner.v);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const maxCells = Math.min(p.values.length, p.dimensions.x * p.dimensions.y * p.dimensions.z);
    for (let index = 0; index < maxCells; index += 1) {
      const value = Number(p.values[index]) || 0;
      if (value === 0) continue;
      const x = index % p.dimensions.x;
      const y = Math.floor(index / p.dimensions.x) % p.dimensions.y;
      const z = Math.floor(index / (p.dimensions.x * p.dimensions.y));
      if (!this._isContourCellVisibleBySlice(p.slice, p.dimensions, x, y, z)) continue;

      const x0 = -p.size.x / 2 + cellSize.x * x + gap.x;
      const x1 = -p.size.x / 2 + cellSize.x * (x + 1) - gap.x;
      const y0 = -p.size.y / 2 + cellSize.y * y + gap.y;
      const y1 = -p.size.y / 2 + cellSize.y * (y + 1) - gap.y;
      const z0 = -p.size.z / 2 + cellSize.z * z + gap.z;
      const z1 = -p.size.z / 2 + cellSize.z * (z + 1) - gap.z;

      const v000 = this._contourCornerValue(p.values, p.dimensions, x, y, z, value);
      const v100 = this._contourCornerValue(p.values, p.dimensions, x + 1, y, z, value);
      const v110 = this._contourCornerValue(p.values, p.dimensions, x + 1, y + 1, z, value);
      const v010 = this._contourCornerValue(p.values, p.dimensions, x, y + 1, z, value);
      const v001 = this._contourCornerValue(p.values, p.dimensions, x, y, z + 1, value);
      const v101 = this._contourCornerValue(p.values, p.dimensions, x + 1, y, z + 1, value);
      const v111 = this._contourCornerValue(p.values, p.dimensions, x + 1, y + 1, z + 1, value);
      const v011 = this._contourCornerValue(p.values, p.dimensions, x, y + 1, z + 1, value);

      pushFace([{ x: x0, y: y0, z: z0, v: v000 }, { x: x0, y: y1, z: z0, v: v010 }, { x: x1, y: y1, z: z0, v: v110 }, { x: x1, y: y0, z: z0, v: v100 }]);
      pushFace([{ x: x0, y: y0, z: z1, v: v001 }, { x: x1, y: y0, z: z1, v: v101 }, { x: x1, y: y1, z: z1, v: v111 }, { x: x0, y: y1, z: z1, v: v011 }]);
      pushFace([{ x: x0, y: y0, z: z0, v: v000 }, { x: x0, y: y0, z: z1, v: v001 }, { x: x0, y: y1, z: z1, v: v011 }, { x: x0, y: y1, z: z0, v: v010 }]);
      pushFace([{ x: x1, y: y0, z: z0, v: v100 }, { x: x1, y: y1, z: z0, v: v110 }, { x: x1, y: y1, z: z1, v: v111 }, { x: x1, y: y0, z: z1, v: v101 }]);
      pushFace([{ x: x0, y: y1, z: z0, v: v010 }, { x: x0, y: y1, z: z1, v: v011 }, { x: x1, y: y1, z: z1, v: v111 }, { x: x1, y: y1, z: z0, v: v110 }]);
      pushFace([{ x: x0, y: y0, z: z0, v: v000 }, { x: x1, y: y0, z: z0, v: v100 }, { x: x1, y: y0, z: z1, v: v101 }, { x: x0, y: y0, z: z1, v: v001 }]);
    }

    VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.colors = colors;
    data.normals = normals;
    data.applyToMesh(root, true);

    const mat = new StandardMaterial(`${meta.id}__contour_mat`, this.scene);
    mat.diffuseColor = Color3.White();
    mat.emissiveColor = new Color3(0.06, 0.08, 0.1);
    mat.specularColor = Color3.Black();
    mat.alpha = p.opacity;
    mat.backFaceCulling = false;
    mat.useVertexColors = true;
    if (p.opacity < 1) {
      mat.needDepthPrePass = true;
      root.hasVertexAlpha = true;
    }
    root.material = mat;

    if (p.showBounds) {
      const lines = [
        [new Vector3(-p.size.x / 2, -p.size.y / 2, -p.size.z / 2), new Vector3(p.size.x / 2, -p.size.y / 2, -p.size.z / 2)],
        [new Vector3(p.size.x / 2, -p.size.y / 2, -p.size.z / 2), new Vector3(p.size.x / 2, p.size.y / 2, -p.size.z / 2)],
        [new Vector3(p.size.x / 2, p.size.y / 2, -p.size.z / 2), new Vector3(-p.size.x / 2, p.size.y / 2, -p.size.z / 2)],
        [new Vector3(-p.size.x / 2, p.size.y / 2, -p.size.z / 2), new Vector3(-p.size.x / 2, -p.size.y / 2, -p.size.z / 2)],
        [new Vector3(-p.size.x / 2, -p.size.y / 2, p.size.z / 2), new Vector3(p.size.x / 2, -p.size.y / 2, p.size.z / 2)],
        [new Vector3(p.size.x / 2, -p.size.y / 2, p.size.z / 2), new Vector3(p.size.x / 2, p.size.y / 2, p.size.z / 2)],
        [new Vector3(p.size.x / 2, p.size.y / 2, p.size.z / 2), new Vector3(-p.size.x / 2, p.size.y / 2, p.size.z / 2)],
        [new Vector3(-p.size.x / 2, p.size.y / 2, p.size.z / 2), new Vector3(-p.size.x / 2, -p.size.y / 2, p.size.z / 2)],
        [new Vector3(-p.size.x / 2, -p.size.y / 2, -p.size.z / 2), new Vector3(-p.size.x / 2, -p.size.y / 2, p.size.z / 2)],
        [new Vector3(p.size.x / 2, -p.size.y / 2, -p.size.z / 2), new Vector3(p.size.x / 2, -p.size.y / 2, p.size.z / 2)],
        [new Vector3(p.size.x / 2, p.size.y / 2, -p.size.z / 2), new Vector3(p.size.x / 2, p.size.y / 2, p.size.z / 2)],
        [new Vector3(-p.size.x / 2, p.size.y / 2, -p.size.z / 2), new Vector3(-p.size.x / 2, p.size.y / 2, p.size.z / 2)],
      ];
      const bounds = MeshBuilder.CreateLineSystem(`${meta.id}__bounds`, { lines }, this.scene);
      bounds.parent = root;
      bounds.isPickable = false;
      bounds.color = new Color3(0.38, 0.84, 1);
      bounds.alpha = 0.42;
    }

    this._contourMaterialMap.set(meta.id, [mat]);
    return root;
  }

  _disposeContourRuntime(id) {
    try {
      const root = this.meshMap.get(id);
      if (root) {
        try { root.dispose(false, true); } catch (e) { void e; }
        this.meshMap.delete(id);
      }
      const materials = this._contourMaterialMap.get(id) || [];
      for (const material of materials) {
        try { material.dispose(); } catch (e) { void e; }
      }
      this._contourMaterialMap.delete(id);
    } catch (e) { void e; }
  }

  _applyMaterialToMesh(meta) {
    try {
      if (!meta || !this.scene) return;
      if (meta.kind === 'contour') return;
      const mesh = this.meshMap.get(meta.id);
      if (!mesh) return;
      const matInfo = meta.material || {};
      const color = matInfo.color || { r: 0.9, g: 0.9, b: 0.9 };
      if (matInfo.type === 'pbr') {
        let m = this.materialMap.get(meta.id);
        if (!m || !(m instanceof PBRMaterial)) {
          try { if (m) { m.dispose(); } } catch (e) { void e; }
          m = new PBRMaterial(`mat-${meta.id}`, this.scene);
          this.materialMap.set(meta.id, m);
        }
        try { m.albedoColor = new Color3(color.r, color.g, color.b); m.metallic = Number(matInfo.metallic || 0); m.roughness = Number(matInfo.roughness || 0.4); m.alpha = Number(matInfo.alpha || 1); mesh.material = m; } catch (e) { void e; }
      } else {
        let m = this.materialMap.get(meta.id);
        if (!m || !(m instanceof StandardMaterial)) {
          try { if (m) { m.dispose(); } } catch (e) { void e; }
          m = new StandardMaterial(`mat-${meta.id}`, this.scene);
          this.materialMap.set(meta.id, m);
        }
        try { m.diffuseColor = new Color3(color.r, color.g, color.b); m.specularPower = Number(matInfo.specularPower || 64); m.alpha = Number(matInfo.alpha || 1); mesh.material = m; } catch (e) { void e; }
      }
    } catch (e) { void e; }
  }

  getPlacementPoint(screenX, screenY) {
    try {
      if (!this.scene || !this.camera) return null;
      const ray = this.scene.createPickingRay(
        Number(screenX) || 0,
        Number(screenY) || 0,
        Matrix.Identity(),
        this.camera
      );
      const groundPlane = Plane.FromPositionAndNormal(Vector3.Zero(), Vector3.Up());
      const distance = ray.intersectsPlane(groundPlane);
      if (distance == null || !Number.isFinite(distance)) return null;
      const point = ray.origin.add(ray.direction.scale(distance));
      return { x: point.x, y: point.y, z: point.z };
    } catch (e) {
      void e;
      return null;
    }
  }

  setPointerPickSelectionSuppressed(suppressed) {
    try { this._suppressPointerPickSelection = !!suppressed; } catch (e) { void e; }
  }

  _getSelectableMeshId(mesh) {
    try {
      if (!mesh) return null;
      const contourRootId = mesh.metadata && mesh.metadata.contourRootId;
      if (contourRootId && this.meshMetaMap.has(contourRootId)) {
        const rootMeta = this.meshMetaMap.get(contourRootId);
        const rootMesh = this.meshMap.get(contourRootId);
        if (!rootMesh || rootMeta?.visible === false || rootMeta?.locked === true) return null;
        return contourRootId;
      }
      let candidate = mesh;
      while (candidate) {
        const candidateId = candidate.id || candidate.name;
        if (candidateId && this.meshMetaMap.has(candidateId) && this.meshMap.get(candidateId) === candidate) {
          mesh = candidate;
          break;
        }
        candidate = candidate.parent || null;
      }
      const id = mesh.id || mesh.name;
      if (!id || !this.meshMetaMap.has(id)) return null;
      if (this.meshMap.get(id) !== mesh) return null;
      if (mesh.isPickable === false) return null;
      if (typeof mesh.isEnabled === "function" && !mesh.isEnabled()) return null;
      const meta = this.meshMetaMap.get(id);
      if (meta && meta.visible === false) return null;
      if (meta && meta.locked === true) return null;
      return id;
    } catch {
      return null;
    }
  }

  pickMeshIdAt(screenX, screenY) {
    try {
      if (!this.scene || !this.camera) return null;
      const pick = this.scene.pick(
        Number(screenX) || 0,
        Number(screenY) || 0,
        (mesh) => !!this._getSelectableMeshId(mesh),
        false,
        this.camera
      );
      return pick && pick.hit ? this._getSelectableMeshId(pick.pickedMesh) : null;
    } catch {
      return null;
    }
  }

  _getMeshScreenBounds(mesh) {
    try {
      if (!mesh || !this.scene || !this.camera || !this.engine) return null;
      const info = mesh.getBoundingInfo && mesh.getBoundingInfo();
      const box = info && info.boundingBox;
      const corners = box && box.vectorsWorld;
      if (!corners || !corners.length) return null;

      const transform = this.scene.getTransformMatrix();
      const viewport = this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight());
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let visiblePointCount = 0;

      for (const corner of corners) {
        const projected = Vector3.Project(corner, Matrix.Identity(), transform, viewport);
        if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || !Number.isFinite(projected.z)) continue;
        if (projected.z >= -0.1 && projected.z <= 1.1) visiblePointCount += 1;
        minX = Math.min(minX, projected.x);
        minY = Math.min(minY, projected.y);
        maxX = Math.max(maxX, projected.x);
        maxY = Math.max(maxY, projected.y);
      }

      if (!visiblePointCount || !Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
      return { minX, minY, maxX, maxY };
    } catch {
      return null;
    }
  }

  getMeshIdsInScreenRect(x1, y1, x2, y2) {
    try {
      const rect = {
        minX: Math.min(Number(x1) || 0, Number(x2) || 0),
        minY: Math.min(Number(y1) || 0, Number(y2) || 0),
        maxX: Math.max(Number(x1) || 0, Number(x2) || 0),
        maxY: Math.max(Number(y1) || 0, Number(y2) || 0),
      };
      const ids = [];
      for (const [id, mesh] of this.meshMap) {
        if (!this._getSelectableMeshId(mesh)) continue;
        const bounds = this._getMeshScreenBounds(mesh);
        if (!bounds) continue;
        const overlaps = bounds.maxX >= rect.minX && bounds.minX <= rect.maxX && bounds.maxY >= rect.minY && bounds.minY <= rect.maxY;
        if (overlaps) ids.push(id);
      }
      return ids;
    } catch {
      return [];
    }
  }

  highlightMesh(id) {
    try { this._selectMeshById && this._selectMeshById(id, 'api'); } catch (e) { void e; }
  }

  setHighlightedMeshes(ids = [], activeId = null) {
    try {
      const nextIds = Array.isArray(ids) ? ids : Array.from(ids || []);
      this._highlightedIds = new Set(nextIds.filter((id) => {
        const meta = id ? this.meshMetaMap.get(id) : null;
        return meta && meta.visible !== false && meta.locked !== true;
      }));
      const selectedId = activeId && this._highlightedIds.has(activeId)
        ? activeId
        : (this._highlightedIds.size ? Array.from(this._highlightedIds).at(-1) : null);

      this._selectedId = selectedId;
      const selectedMesh = selectedId ? this.meshMap.get(selectedId) : null;
      if (this._gizmoManager) {
        this._gizmoManager.attachToMesh(this._gizmoVisible ? (selectedMesh || null) : null);
      }
      this._applySelectionBounds();
      return selectedId;
    } catch (e) {
      void e;
      return null;
    }
  }

  clearAllHighlights() {
    try {
      this._highlightedIds.clear();
      this._selectedId = null;
      if (this._gizmoManager) this._gizmoManager.attachToMesh(null);
      this._applySelectionBounds();
      if (typeof this.onSelect === "function") this.onSelect(null, { source: "api" });
      return true;
    } catch (e) {
      void e;
      return false;
    }
  }

  _selectMeshById(id, source = "api", info = {}) {
    try {
      const meta = id ? this.meshMetaMap.get(id) : null;
      const selectedId = meta && meta.visible !== false && meta.locked !== true ? id : null;
      this._selectedId = selectedId;
      this._highlightedIds = selectedId ? new Set([selectedId]) : new Set();

      const selectedMesh = selectedId ? this.meshMap.get(selectedId) : null;
      if (this._gizmoManager) {
        this._gizmoManager.attachToMesh(this._gizmoVisible ? (selectedMesh || null) : null);
      }
      this._applySelectionBounds();
      if (typeof this.onSelect === "function") {
        this.onSelect(selectedId, { source, ...info });
      }
      return selectedId;
    } catch (e) {
      void e;
      return null;
    }
  }

  _applySelectionBounds() {
    try {
      for (const id of this._selectionBoxIds || []) {
        const mesh = this.meshMap.get(id);
        if (!mesh) continue;
        try { mesh.showBoundingBox = false; } catch (e) { void e; }
        try { mesh.renderOutline = false; } catch (e) { void e; }
      }

      this._selectionBoxIds = new Set(this._highlightedIds || []);
      try {
        const renderer = this.scene && this.scene.getBoundingBoxRenderer && this.scene.getBoundingBoxRenderer();
        if (renderer) {
          renderer.frontColor = new Color4(0.58, 1, 0.12, 1);
          renderer.backColor = new Color4(0.16, 0.72, 0.08, 0.55);
        }
      } catch (e) { void e; }

      for (const id of this._selectionBoxIds) {
        const mesh = this.meshMap.get(id);
        if (!mesh) continue;
        try { mesh.showBoundingBox = true; } catch (e) { void e; }
        try {
          mesh.renderOutline = true;
          mesh.outlineColor = new Color3(0.58, 1, 0.12);
          mesh.outlineWidth = 0.035;
        } catch (e) { void e; }
      }

      for (const [id] of this._selectionBoundsMeshes || new Map()) {
        if (!this._selectionBoxIds.has(id)) this._disposeSelectionBoundsMesh(id);
      }
      this._syncSelectionBounds();
    } catch (e) { void e; }
  }

  _disposeSelectionBoundsMesh(id) {
    try {
      const box = this._selectionBoundsMeshes && this._selectionBoundsMeshes.get(id);
      if (box) {
        try { box.dispose(); } catch (e) { void e; }
        this._selectionBoundsMeshes.delete(id);
      }
    } catch (e) { void e; }
  }

  _disposeAllSelectionBoundsMeshes() {
    try {
      for (const [, box] of this._selectionBoundsMeshes || new Map()) {
        try { box.dispose(); } catch (e) { void e; }
      }
      this._selectionBoundsMeshes = new Map();
    } catch (e) { void e; }
  }

  _getSelectionBoundsLines(mesh) {
    try {
      if (!mesh || !mesh.getBoundingInfo) return null;
      mesh.computeWorldMatrix && mesh.computeWorldMatrix(true);
      const info = mesh.getBoundingInfo();
      const box = info && info.boundingBox;
      const min = box && box.minimumWorld;
      const max = box && box.maximumWorld;
      if (!min || !max) return null;
      const pad = 0.018;
      const x0 = min.x - pad, y0 = min.y - pad, z0 = min.z - pad;
      const x1 = max.x + pad, y1 = max.y + pad, z1 = max.z + pad;
      const c = [
        new Vector3(x0, y0, z0),
        new Vector3(x1, y0, z0),
        new Vector3(x1, y1, z0),
        new Vector3(x0, y1, z0),
        new Vector3(x0, y0, z1),
        new Vector3(x1, y0, z1),
        new Vector3(x1, y1, z1),
        new Vector3(x0, y1, z1),
      ];
      return [
        [c[0], c[1]], [c[1], c[2]], [c[2], c[3]], [c[3], c[0]],
        [c[4], c[5]], [c[5], c[6]], [c[6], c[7]], [c[7], c[4]],
        [c[0], c[4]], [c[1], c[5]], [c[2], c[6]], [c[3], c[7]],
      ];
    } catch {
      return null;
    }
  }

  _syncSelectionBounds() {
    try {
      if (!this.scene) return;
      const selectedIds = this._selectionBoxIds || new Set();
      for (const [id] of this._selectionBoundsMeshes || new Map()) {
        if (!selectedIds.has(id) || !this.meshMap.has(id)) this._disposeSelectionBoundsMesh(id);
      }
      for (const id of selectedIds) {
        const mesh = this.meshMap.get(id);
        const meta = this.meshMetaMap.get(id);
        if (!mesh || meta?.visible === false || meta?.locked === true) {
          this._disposeSelectionBoundsMesh(id);
          continue;
        }
        const lines = this._getSelectionBoundsLines(mesh);
        if (!lines) {
          this._disposeSelectionBoundsMesh(id);
          continue;
        }
        let box = this._selectionBoundsMeshes.get(id);
        if (!box) {
          box = MeshBuilder.CreateLineSystem(`__selection_bounds_${id}`, { lines, updatable: true }, this.scene);
          box.isPickable = false;
          box.alwaysSelectAsActiveMesh = true;
          box.renderingGroupId = 2;
          box.color = new Color3(0.56, 1, 0.08);
          box.alpha = 1;
          try { box.doNotSyncBoundingInfo = true; } catch (e) { void e; }
          this._selectionBoundsMeshes.set(id, box);
        } else {
          MeshBuilder.CreateLineSystem(box.name || `__selection_bounds_${id}`, { lines, instance: box });
          box.color = new Color3(0.56, 1, 0.08);
          box.alpha = 1;
          box.setEnabled(true);
        }
      }
    } catch (e) { void e; }
  }

  removeSelectedMesh() {
    try { if (!this._selectedId) return; this.enqueueCommand({ type: 'removeMesh', payload: { id: this._selectedId } }); this._selectMeshById && this._selectMeshById(null, 'api'); } catch (e) { void e; }
  }

  frameMesh(id) {
    try {
      if (!id || !this.camera) return false;
      const m = this.meshMap.get(id);
      if (!m) return false;
      let min = null, max = null;
      try { const bv = m.getBoundingInfo && m.getBoundingInfo(); if (bv && bv.boundingBox) { min = bv.boundingBox.minimumWorld; max = bv.boundingBox.maximumWorld; } } catch (e) { void e; }
      if (!min || !max) {
        try { const p = m.position || new Vector3(0,0,0); this.camera.setTarget(p); this.camera.radius = Math.max(6, this.camera.radius || 10); return true; } catch { return false; }
      }
      try {
        const center = min.add(max).scale(0.5);
        const sizeVec = max.subtract(min);
        const r = Math.max(0.001, sizeVec.length());
        const radius = Math.min(Math.max(r * 1.6, 4), 5000);
        this.camera.setTarget(center);
        this.camera.radius = radius;
        return true;
      } catch { return false; }
    } catch { return false; }
  }

  getEngine() { try { return this.engine; } catch { return null; } }
  getScene() { try { return this.scene; } catch { return null; } }
}

// src/babylon/SceneProject.js
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders";
import { GridMaterial } from "@babylonjs/materials";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import AxesHelper from "./AxesHelper";
import { createMeta } from "./MeshEntities";
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

    this.commandQueue = [];
    this._running = false;

    this.highlightLayer = null; // legacy field kept for compatibility (no longer used)
    this._selectedId = null;
    this.onSelect = null; // callback: (id|null) => void
    this._changeCallback = null; // callback: (id) => void for runtime gizmo/transform updates
    this._lastAttachedState = {}; // store last known transform to detect changes
    this._changeCallback = null; // callback: (id) => void for runtime gizmo/transform updates

    // Grid related
    this._gridMesh = null;
    this._gridMaterial = null;
    this._gridVisible = false;
    this._gridSize = 2000; // world units for grid and axes default
    this._gizmoManager = null;
    this._gizmoVisible = true;
    this._gizmoMode = "all";
    this._snapEnabled = false;
    this._snapValue = 1;
    this._cameraKeyboardEnabled = true;

    // textbox mesh resources
    this._textTextureMap = new Map();

    // Optional WASM exports (injected by App). Use for CPU-heavy ops when needed.
    this._wasm = null;

    // Optional script engine (Worker sandbox) injected by App.
    this._scriptEngine = null;
    this._selectionSource = "unknown";

    // Runtime vs edit mode.
    this._runtimeEnabled = false;

    // Placement preview (ghost mesh)
    this._placementPreviewKind = null;
    this._placementPreviewMesh = null;
    this._placementPreviewMaterial = null;
    

    // 축
    this._axesHelper = null;
    this._axesVisible = true; // 기본 on; App에서 툴 상태로 제어

    this._hemisphericLight = null;

    if (initialJSON) {
      this._loadMetaFromJSON(initialJSON);
    }
  }

  setWasm(wasmExports) {
    this._wasm = wasmExports || null;
  }

  getWasm() {
    return this._wasm;
  }

  setScriptEngine(engine) {
    this._scriptEngine = engine || null;
    try {
      if (this._scriptEngine && typeof this._scriptEngine.setScripts === 'function') {
        this._scriptEngine.setScripts(this.getMeshMetaList());
      }
    } catch (err) { void err; }

    // fire onLoad for meshes that have it
    try {
      if (this._scriptEngine) {
        for (const meta of this.meshMetaMap.values()) {
          const scripts = meta?.scripts;
          const events = scripts && typeof scripts === 'object' ? (scripts.events && typeof scripts.events === 'object' ? scripts.events : scripts) : null;
          if (meta && meta.id && events && typeof events.onLoad === 'string' && events.onLoad.trim()) {
            this._runMeshScriptEvent(meta.id, 'onLoad', null);
          }
        }
      }
    } catch (err) { void err; }
  }

  setRuntimeEnabled(enabled) {
    const next = !!enabled;
    const prev = this._runtimeEnabled;
    this._runtimeEnabled = next;

    // Runtime mode should not allow editing via gizmos.
    try {
      if (next) {
        this.setGizmoVisible(false);
      }
    } catch (err) { void err; }

    // When entering runtime mode, fire onLoad for meshes that have it.
    try {
      if (!prev && next && this._scriptEngine) {
        for (const meta of this.meshMetaMap.values()) {
          const scripts = meta?.scripts;
          const events = scripts && typeof scripts === 'object' ? (scripts.events && typeof scripts.events === 'object' ? scripts.events : scripts) : null;
          if (meta && meta.id && events && typeof events.onLoad === 'string' && events.onLoad.trim()) {
            this._runMeshScriptEvent(meta.id, 'onLoad', null);
          }
        }
      }
    } catch (err) { void err; }
  }

  frameMesh(meshId) {
    try {
      if (!meshId) return false;
      if (!this.camera) return false;
      const mesh = this.meshMap.get(meshId);
      if (!mesh) return false;

      let min = null;
      let max = null;
      try {
        const bb = mesh.getHierarchyBoundingVectors(true);
        min = bb?.min || null;
        max = bb?.max || null;
      } catch (err) {
        void err;
      }

      if (!min || !max) {
        try {
          const bi = mesh.getBoundingInfo?.();
          const bbox = bi?.boundingBox;
          min = bbox?.minimumWorld || null;
          max = bbox?.maximumWorld || null;
        } catch (err) {
          void err;
        }
      }

      if (!min || !max) {
        // fallback: target mesh position
        const pos = mesh.position || Vector3.Zero();
        this.camera.setTarget(pos);
        this.camera.radius = Math.max(6, this.camera.radius || 10);
        return true;
      }

      const center = min.add(max).scale(0.5);
      const extent = max.subtract(min);
      const diag = Math.max(0.001, extent.length());
      const nextRadius = Math.min(Math.max(diag * 1.6, 4), 5000);

      this.camera.setTarget(center);
      this.camera.radius = nextRadius;
      return true;
    } catch (err) {
      void err;
      return false;
    }
  }

  // Convert canvas-local screen coordinates into a world position for placing new meshes.
  // 1) If the cursor is over a pickable mesh, use its picked point.
  // 2) Otherwise, intersect the camera ray with the y=0 plane.
  getPlacementPoint(screenX, screenY) {
    try {
      if (!this.scene || !this.camera) return null;

      const pick = this.scene.pick(
        screenX,
        screenY,
        (m) => {
          if (!m) return false;
          if (this._gridMesh && m === this._gridMesh) return false;
          return m.isPickable !== false;
        }
      );

      if (pick && pick.hit && pick.pickedPoint) {
        return { x: pick.pickedPoint.x, y: pick.pickedPoint.y, z: pick.pickedPoint.z };
      }

      const ray = this.scene.createPickingRay(screenX, screenY, Matrix.Identity(), this.camera);
      const origin = ray.origin;
      const dir = ray.direction;
      if (!dir || Math.abs(dir.y) < 1e-6) return null;
      const t = -origin.y / dir.y;
      if (t < 0) return null;
      const p = origin.add(dir.scale(t));
      return { x: p.x, y: 0, z: p.z };
    } catch (err) {
      void err;
      return null;
    }
  }

  setPlacementPreviewKind(kind) {
    const next = kind ? String(kind) : null;
    if (this._placementPreviewKind === next) return;
    this._placementPreviewKind = next;
    this._disposePlacementPreview();
    if (next) this._ensurePlacementPreviewMesh(next);
  }

  clearPlacementPreview() {
    this._placementPreviewKind = null;
    this._disposePlacementPreview();
  }

  updatePlacementPreview(screenX, screenY) {
    try {
      if (!this.scene || !this.camera) return null;
      if (!this._placementPreviewKind) return null;

      this._ensurePlacementPreviewMesh(this._placementPreviewKind);
      const mesh = this._placementPreviewMesh;
      if (!mesh) return null;

      const point = this.getPlacementPoint(screenX, screenY);
      if (!point) {
        try { mesh.setEnabled(false); } catch { void 0; }
        return null;
      }

      try { mesh.setEnabled(true); } catch { void 0; }
      try { mesh.position.copyFromFloats(point.x, point.y, point.z); } catch { void 0; }
      return point;
    } catch (err) {
      void err;
      return null;
    }
  }

  _disposePlacementPreview() {
    try {
      if (this._placementPreviewMesh) {
        try { this._placementPreviewMesh.dispose(); } catch (err) { void err; }
      }
    } finally {
      this._placementPreviewMesh = null;
    }
    try {
      if (this._placementPreviewMaterial) {
        try { this._placementPreviewMaterial.dispose(); } catch (err) { void err; }
      }
    } finally {
      this._placementPreviewMaterial = null;
    }
  }

  _ensurePlacementPreviewMesh(kind) {
    try {
      if (!this.scene) return;
      if (this._placementPreviewMesh) return;

      const previewId = `__preview__${this.id}`;
      const meta = createMeta(kind, { id: previewId, name: "__preview__" });
      let mesh;

      if (meta.kind === "box") mesh = MeshBuilder.CreateBox(previewId, meta.params, this.scene);
      else if (meta.kind === "sphere") mesh = MeshBuilder.CreateSphere(previewId, meta.params, this.scene);
      else if (meta.kind === "cylinder") mesh = MeshBuilder.CreateCylinder(previewId, meta.params, this.scene);
      else if (meta.kind === "cone") {
        const p = { ...meta.params };
        if (p.diameterTop === undefined) p.diameterTop = 0;
        mesh = MeshBuilder.CreateCylinder(previewId, p, this.scene);
      } else if (meta.kind === "line") {
        mesh = MeshBuilder.CreateSphere(previewId, { diameter: 0.3, segments: 8 }, this.scene);
      } else if (meta.kind === "tetra") {
        const p = { size: 1, ...(meta.params || {}) };
        mesh = MeshBuilder.CreatePolyhedron(previewId, { type: 0, size: p.size }, this.scene);
      } else if (meta.kind === "torus") {
        const p = { diameter: 1, thickness: 0.25, tessellation: 32, ...(meta.params || {}) };
        mesh = MeshBuilder.CreateTorus(previewId, p, this.scene);
      } else if (meta.kind === "textbox") {
        const p = { width: 2, height: 1, ...(meta.params || {}) };
        mesh = MeshBuilder.CreatePlane(previewId, { width: p.width, height: p.height }, this.scene);
      } else {
        mesh = MeshBuilder.CreateBox(previewId, { size: 1 }, this.scene);
      }

      mesh.isPickable = false;
      try { mesh.setEnabled(false); } catch { void 0; }
      try { mesh.alwaysSelectAsActiveMesh = false; } catch { void 0; }

      const mat = new StandardMaterial(`mat-preview-${this.id}`, this.scene);
      mat.diffuseColor = new Color3(0.9, 0.9, 0.95);
      mat.emissiveColor = new Color3(0.22, 0.35, 0.65);
      mat.specularPower = 0;
      mat.alpha = 0.32;
      try { mat.backFaceCulling = false; } catch (err) { void err; }
      mesh.material = mat;

      this._placementPreviewMesh = mesh;
      this._placementPreviewMaterial = mat;
    } catch (err) {
      void err;
    }
  }

  _syncScriptEngineScripts() {
    try {
      if (this._scriptEngine && typeof this._scriptEngine.setScripts === 'function') {
        this._scriptEngine.setScripts(this.getMeshMetaList());
      }
    } catch (err) { void err; }
  }

  async _runMeshScriptEvent(meshId, eventName, payload = null) {
    try {
      if (!this._scriptEngine || typeof this._scriptEngine.run !== 'function') return;
      const meta = this.meshMetaMap.get(meshId);
      if (!meta || !meta.scripts) return;

      const sceneInfo = { id: this.id, name: this.name };
      const cmds = await this._scriptEngine.run({ eventName, meshId, scene: sceneInfo, payload });
      if (!cmds || !cmds.length) return;
      // Apply returned commands through the existing command pipeline.
      for (const c of cmds) {
        if (c && typeof c === 'object' && c.type) this.enqueueCommand(c);
      }
    } catch (err) {
      try { console.warn('[script] event failed', eventName, meshId, err); } catch { void 0; }
    }
  }

  attachCanvas(canvas) {
    if (this.canvas === canvas && this.engine) return;
    this.canvas = canvas;
    if (!this.engine) this._initEngineAndScene();
  }

  detachAndShutdown() {
    this._shutdownEngineOnly();
    this.canvas = null;
  }

  _initEngineAndScene() {
    if (!this.canvas) throw new Error("Canvas required to initialize engine");
    this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.scene = new Scene(this.engine);
    // patch console methods to filter out noisy Babylon rotation-gizmo warning about non-uniform scaling
    try {
      this._originalConsoleWarn = console.warn;
      this._originalConsoleLog = console.log;
      this._originalConsoleError = console.error;
      const filterMsg = "Unable to use a rotation gizmo matching mesh rotation with non uniform scaling";
      const makeFiltered = (orig) => (...args) => {
        try {
          if (args && args.length && typeof args[0] === "string" && args[0].includes(filterMsg)) return;
        } catch (err) { void err; }
        try { orig.apply(console, args); } catch (err) { void err; }
      };
      console.warn = makeFiltered(this._originalConsoleWarn);
      console.log = makeFiltered(this._originalConsoleLog);
      console.error = makeFiltered(this._originalConsoleError);
    } catch (err) { void err; }
    // match scene background to the (dark) grid main color for seamless look
    try { this.scene.clearColor = new Color4(0.03, 0.03, 0.04, 1); } catch (err) { void err; }

    this.camera = new ArcRotateCamera("camera-" + this.id, Math.PI / 4, Math.PI / 3, 50, Vector3.Zero(), this.scene);
    this.camera.attachControl(this.canvas, true);

    // apply keyboard control state if needed
    try { if (!this._cameraKeyboardEnabled) this.setCameraKeyboardEnabled(false); } catch (err) { void err; }

    this._hemisphericLight = new HemisphericLight("hemi-" + this.id, new Vector3(0, 1, 0), this.scene);
    this._hemisphericLight.intensity = 0.95;

    // Selection highlighting now uses mesh outline/edges rendering (Blender-like)

    this._axesHelper = new AxesHelper(this.scene, this._gridSize); // 길이를 그리드 크기에 맞춤

    // create runtime meshes from meta map
    for (const meta of this.meshMetaMap.values()) this._createRuntimeMesh(meta);

    // second pass: attach parents now that all runtime nodes exist
    try {
      for (const meta of this.meshMetaMap.values()) {
        if (!meta.parent) continue;
        const child = this.meshMap.get(meta.id);
        const parent = this.meshMap.get(meta.parent);
        if (child && parent) {
          try { child.parent = parent; } catch (err) { void err; }
        }
      }
    } catch (err) { void err; }

    // if grid requested earlier, create now
    if (this._gridVisible) this._createGrid();
    // only create axes if requested
    if (this._axesVisible) {
      try { this._axesHelper = new AxesHelper(this.scene, this._gridSize); } catch (err) { void err; this._axesHelper = null; }
    }

    // pointer pick + runtime script events
    this.scene.onPointerObservable.add((pi) => {
      if (!this.scene) return;
      if (pi.type === PointerEventTypes.POINTERPICK) {
        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        if (pick && pick.hit && pick.pickedMesh) {
          const picked = pick.pickedMesh;
          // ignore grid mesh
          if (this._gridMesh && picked === this._gridMesh) return;
          // find top-level mesh (if instances/subparts)
          let mesh = picked;
          // If a mesh is a child (has parent), ensure we select root mesh that has meta id in meshMap
          while (mesh && !this.meshMap.has(mesh.id) && mesh.parent) mesh = mesh.parent;
          if (mesh && this.meshMap.has(mesh.id)) {
            this._selectMeshById(mesh.id, "pick");

            // In runtime mode, clicking a mesh triggers its onClick script.
            if (this._runtimeEnabled) {
              try { this._runMeshScriptEvent(mesh.id, 'onClick', { x: this.scene.pointerX, y: this.scene.pointerY }); } catch { void 0; }
            }
          } else {
            // clicked empty space or untracked mesh
            this._selectMeshById(null, "pick");
          }
        } else {
          this._selectMeshById(null, "pick");
        }
      }

      if (this._runtimeEnabled && (pi.type === PointerEventTypes.POINTERDOWN || pi.type === PointerEventTypes.POINTERUP)) {
        try {
          const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
          if (!pick || !pick.hit || !pick.pickedMesh) return;
          const picked = pick.pickedMesh;
          if (this._gridMesh && picked === this._gridMesh) return;
          let mesh = picked;
          while (mesh && !this.meshMap.has(mesh.id) && mesh.parent) mesh = mesh.parent;
          if (!mesh || !this.meshMap.has(mesh.id)) return;

          const eventName = (pi.type === PointerEventTypes.POINTERDOWN) ? 'onMouseDown' : 'onMouseUp';
          const button = (pi.event && typeof pi.event.button === 'number') ? pi.event.button : 0;
          this._runMeshScriptEvent(mesh.id, eventName, { x: this.scene.pointerX, y: this.scene.pointerY, button });
        } catch (err) {
          void err;
        }
      }
    });

    // Preemptively handle pointer down/up to avoid rotation gizmo warning by normalizing scale
    try {
      this._tempScalingGlobal = new Map();
      this._pointerGizmoHandler = (pi) => {
        try {
          if (!this._gizmoManager) return;
          const attached = this._gizmoManager.attachedMesh || (this._selectedId ? this.meshMap.get(this._selectedId) : null);
          if (!attached) return;
          if (pi.type === PointerEventTypes.POINTERDOWN) {
            try {
              // disable rotation matching immediately
              try { this._gizmoManager.updateGizmoRotationToMatchAttachedMesh = false; } catch (err) { void err; }
              try { if (this._gizmoManager.rotationGizmo) this._gizmoManager.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false; } catch (err) { void err; }
              // if non-uniform, store and set uniform now
              const sx = attached.scaling?.x || 1;
              const sy = attached.scaling?.y || 1;
              const sz = attached.scaling?.z || 1;
              const eps = 1e-4;
              const nonUniform = (Math.abs(sx - sy) > eps) || (Math.abs(sx - sz) > eps) || (Math.abs(sy - sz) > eps);
              if (nonUniform) {
                this._tempScalingGlobal.set(attached.id, { x: sx, y: sy, z: sz });
                const avg = (sx + sy + sz) / 3;
                try { attached.scaling.copyFromFloats(avg, avg, avg); } catch { attached.scaling = new Vector3(avg, avg, avg); }
              }
            } catch (err) { void err; }
          }
          if (pi.type === PointerEventTypes.POINTERUP) {
            try {
              const orig = this._tempScalingGlobal.get(attached.id);
              if (orig) {
                try { attached.scaling.copyFromFloats(orig.x, orig.y, orig.z); } catch { attached.scaling = new Vector3(orig.x, orig.y, orig.z); }
                this._tempScalingGlobal.delete(attached.id);
              }
              // keep updateGizmoRotation disabled to be safe
              try { this._gizmoManager.updateGizmoRotationToMatchAttachedMesh = false; } catch (err) { void err; }
              try { if (this._gizmoManager.rotationGizmo) this._gizmoManager.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false; } catch (err) { void err; }
            } catch (err) { void err; }
          }
        } catch (err) { void err; }
      };
      this.scene.onPointerObservable.add(this._pointerGizmoHandler);
    } catch (err) { void err; }

    // initialize gizmo manager for transform controls
    try {
      this._gizmoManager = new GizmoManager(this.scene);
      // reduce default gizmo size so transforms appear appropriately scaled for small meshes
      try { this._gizmoManager.scaleRatio = 0.6; } catch (err) { void err; }
      // avoid rotation gizmo errors when mesh has non-uniform scaling
      try { this._gizmoManager.updateGizmoRotationToMatchAttachedMesh = false; } catch (err) { void err; }
      this._gizmoManager.positionGizmoEnabled = true;
      this._gizmoManager.rotationGizmoEnabled = true;
      this._gizmoManager.scaleGizmoEnabled = true;
      // register drag observables to reflect live changes back to mesh meta and UI
      try {
        const applyGizmoToMeta = () => {
          try {
            const attachedRuntime = (this._gizmoManager && this._gizmoManager.attachedMesh) ? this._gizmoManager.attachedMesh : (this._selectedId ? this.meshMap.get(this._selectedId) : null);
            if (!attachedRuntime) return;
            const id = attachedRuntime.id;
            const meta = this.meshMetaMap.get(id);
            if (!meta) return;
            // read runtime transforms and update meta
            try {
              if (attachedRuntime.position) meta.position = { x: attachedRuntime.position.x, y: attachedRuntime.position.y, z: attachedRuntime.position.z };
              if (attachedRuntime.rotation) meta.rotation = { x: attachedRuntime.rotation.x, y: attachedRuntime.rotation.y, z: attachedRuntime.rotation.z };
              if (attachedRuntime.scaling) meta.scaling = { x: attachedRuntime.scaling.x, y: attachedRuntime.scaling.y, z: attachedRuntime.scaling.z };
            } catch (err) { void err; }
            // notify app (UI) about the live change via changeCallback (preferred)
            if (typeof this._changeCallback === "function") {
              try { this._changeCallback(id); } catch (err) { void err; }
            } else if (typeof this.onSelect === "function") {
              try { this.onSelect(id); } catch (err) { void err; }
            }
          } catch (err) { void err; }
        };

        // helpers to temporarily normalize scaling during rotation drags
        const _tempScaling = new Map();
        const onDragStart = (gzType) => {
          try {
            const attachedRuntime = (this._gizmoManager && this._gizmoManager.attachedMesh) ? this._gizmoManager.attachedMesh : (this._selectedId ? this.meshMap.get(this._selectedId) : null);
            if (!attachedRuntime) return;
            if (gzType === 'rotation') {
              try {
                const sx = attachedRuntime.scaling?.x || 1;
                const sy = attachedRuntime.scaling?.y || 1;
                const sz = attachedRuntime.scaling?.z || 1;
                const eps = 1e-4;
                const nonUniform = (Math.abs(sx - sy) > eps) || (Math.abs(sx - sz) > eps) || (Math.abs(sy - sz) > eps);
                if (nonUniform) {
                  _tempScaling.set(attachedRuntime.id, { x: sx, y: sy, z: sz });
                  const avg = (sx + sy + sz) / 3;
                  try { attachedRuntime.scaling.copyFromFloats(avg, avg, avg); } catch { attachedRuntime.scaling = new Vector3(avg, avg, avg); }
                }
              } catch (err) { void err; }
            }
          } catch (err) { void err; }
        };
        const onDragEnd = (gzType) => {
          try {
            const attachedRuntime = (this._gizmoManager && this._gizmoManager.attachedMesh) ? this._gizmoManager.attachedMesh : (this._selectedId ? this.meshMap.get(this._selectedId) : null);
            if (!attachedRuntime) return;
            if (gzType === 'rotation') {
              const orig = _tempScaling.get(attachedRuntime.id);
              if (orig) {
                try { attachedRuntime.scaling.copyFromFloats(orig.x, orig.y, orig.z); } catch { attachedRuntime.scaling = new Vector3(orig.x, orig.y, orig.z); }
                _tempScaling.delete(attachedRuntime.id);
              }
            }
          } catch (err) { void err; }
        };

        // position gizmo
        try {
          if (this._gizmoManager.positionGizmo && this._gizmoManager.positionGizmo.gizmos) {
            for (const k in this._gizmoManager.positionGizmo.gizmos) {
              const gz = this._gizmoManager.positionGizmo.gizmos[k];
              if (gz && gz.onDragObservable) gz.onDragObservable.add(applyGizmoToMeta);
              if (gz && gz.onDragStartObservable) gz.onDragStartObservable.add(() => onDragStart('position'));
              if (gz && gz.onDragEndObservable) gz.onDragEndObservable.add(() => onDragEnd('position'));
            }
            if (this._gizmoManager.positionGizmo.onDragObservable) this._gizmoManager.positionGizmo.onDragObservable.add(applyGizmoToMeta);
            if (this._gizmoManager.positionGizmo.onDragStartObservable) this._gizmoManager.positionGizmo.onDragStartObservable.add(() => onDragStart('position'));
            if (this._gizmoManager.positionGizmo.onDragEndObservable) this._gizmoManager.positionGizmo.onDragEndObservable.add(() => onDragEnd('position'));
          } else if (this._gizmoManager.positionGizmo && this._gizmoManager.positionGizmo.onDragObservable) {
            this._gizmoManager.positionGizmo.onDragObservable.add(applyGizmoToMeta);
          }
        } catch (err) { void err; }

        // rotation gizmo
        try {
          if (this._gizmoManager.rotationGizmo) {
            if (this._gizmoManager.rotationGizmo.onDragObservable) this._gizmoManager.rotationGizmo.onDragObservable.add(applyGizmoToMeta);
            if (this._gizmoManager.rotationGizmo.onDragStartObservable) this._gizmoManager.rotationGizmo.onDragStartObservable.add(() => onDragStart('rotation'));
            if (this._gizmoManager.rotationGizmo.onDragEndObservable) this._gizmoManager.rotationGizmo.onDragEndObservable.add(() => onDragEnd('rotation'));
          }
        } catch (err) { void err; }

        // scale gizmo
        try {
          if (this._gizmoManager.scaleGizmo) {
            if (this._gizmoManager.scaleGizmo.onDragObservable) this._gizmoManager.scaleGizmo.onDragObservable.add(applyGizmoToMeta);
            if (this._gizmoManager.scaleGizmo.onDragStartObservable) this._gizmoManager.scaleGizmo.onDragStartObservable.add(() => onDragStart('scale'));
            if (this._gizmoManager.scaleGizmo.onDragEndObservable) this._gizmoManager.scaleGizmo.onDragEndObservable.add(() => onDragEnd('scale'));
          }
        } catch (err) { void err; }
      } catch (err) { void err; }
    } catch (err) { void err; this._gizmoManager = null; }

    this._running = true;
    this.engine.runRenderLoop(() => {
      this._processCommands();
      // ensure rotation matching disabled to avoid Babylon warning when non-uniform scaled
      try {
        if (this._gizmoManager) {
          try { this._gizmoManager.updateGizmoRotationToMatchAttachedMesh = false; } catch (err) { void err; }
          try { if (this._gizmoManager.rotationGizmo) this._gizmoManager.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false; } catch (err) { void err; }
        }
      } catch (err) { void err; }
      // sync attached gizmo mesh transforms to meta so UI can reflect live changes
      try { this._syncAttachedMesh(); } catch (err) { void err; }
      if (this.scene) this.scene.render();
    });

    window.addEventListener("resize", this._onResize);
  }

  _shutdownEngineOnly() {
    window.removeEventListener("resize", this._onResize);
    if (this.scene) {
      try { this._disposePlacementPreview(); } catch (err) { void err; }
      for (const m of this.scene.meshes.slice()) { try { m.dispose(); } catch (err) { void err; } }
      try { this.scene.dispose(); } catch (err) { void err; }
      this.scene = null;
    }
    if (this.engine) {
      try { this.engine.stopRenderLoop(); } catch (err) { void err; }
      try { this.engine.dispose(); } catch (err) { void err; }
      this.engine = null;
    }
    // Note: no HighlightLayer disposal needed (not used)

    // restore console methods if we patched them
    try { if (this._originalConsoleWarn) console.warn = this._originalConsoleWarn; } catch (err) { void err; }
    try { if (this._originalConsoleLog) console.log = this._originalConsoleLog; } catch (err) { void err; }
    try { if (this._originalConsoleError) console.error = this._originalConsoleError; } catch (err) { void err; }

    if (this._axesHelper) { try { this._axesHelper.dispose(); } catch (err) { void err; } this._axesHelper = null; }
    if (this._gridMesh) { try { this._gridMesh.dispose(); } catch (err) { void err; } this._gridMesh = null; }
    if (this._gridMaterial) { try { this._gridMaterial.dispose(); } catch (err) { void err; } this._gridMaterial = null; }
    if (this._gizmoManager) { try { this._gizmoManager.attachToMesh(null); } catch (err) { void err; } this._gizmoManager = null; }

    try {
      for (const dt of this._textTextureMap.values()) {
        try { dt.dispose(); } catch (err) { void err; }
      }
      this._textTextureMap.clear();
    } catch (err) { void err; }

    for (const mat of this.materialMap.values()) { try { mat.dispose(); } catch (err) { void err; } }
    this.materialMap.clear();
    this.meshMap.clear();
    this._running = false;
  }

  _onResize = () => { if (this.engine) this.engine.resize(); };

  enqueueCommand(cmd) { this.commandQueue.push(cmd); }

  _processCommands() {
    if (!this.commandQueue.length) return;
    const q = this.commandQueue.splice(0, this.commandQueue.length);
    for (const cmd of q) {
      try { this._applyCommand(cmd); } catch (err) { console.error("SceneProject command error:", err); }
    }
  }

  // Poll attached gizmo mesh and sync runtime transforms into meta map when changed
  _syncAttachedMesh() {
    if (!this._gizmoManager) return;
    const attached = this._gizmoManager.attachedMesh || (this._selectedId ? this.meshMap.get(this._selectedId) : null);
    if (!attached) return;
    const id = attached.id;
    const meta = this.meshMetaMap.get(id);
    if (!meta) return;

    const pos = attached.position ? { x: attached.position.x, y: attached.position.y, z: attached.position.z } : null;
    const rot = attached.rotation ? { x: attached.rotation.x, y: attached.rotation.y, z: attached.rotation.z } : null;
    const scl = attached.scaling ? { x: attached.scaling.x, y: attached.scaling.y, z: attached.scaling.z } : null;

    const last = this._lastAttachedState[id] || {};
    const changed = () => {
      // simple comparison with small epsilon
      const eps = 1e-5;
      if (pos) {
        if (!last.pos) return true;
        if (Math.abs(last.pos.x - pos.x) > eps) return true;
        if (Math.abs(last.pos.y - pos.y) > eps) return true;
        if (Math.abs(last.pos.z - pos.z) > eps) return true;
      }
      if (rot) {
        if (!last.rot) return true;
        if (Math.abs(last.rot.x - rot.x) > eps) return true;
        if (Math.abs(last.rot.y - rot.y) > eps) return true;
        if (Math.abs(last.rot.z - rot.z) > eps) return true;
      }
      if (scl) {
        if (!last.scl) return true;
        if (Math.abs(last.scl.x - scl.x) > eps) return true;
        if (Math.abs(last.scl.y - scl.y) > eps) return true;
        if (Math.abs(last.scl.z - scl.z) > eps) return true;
      }
      return false;
    };

    if (changed()) {
      // update meta
      try { if (pos) meta.position = pos; } catch (err) { void err; }
      try { if (rot) meta.rotation = rot; } catch (err) { void err; }
      try { if (scl) meta.scaling = scl; } catch (err) { void err; }

      // store last
      this._lastAttachedState[id] = { pos: { ...(pos || {}) }, rot: { ...(rot || {}) }, scl: { ...(scl || {}) } };

      // notify app
      if (typeof this._changeCallback === "function") {
        try { this._changeCallback(id); } catch (err) { void err; }
      } else if (typeof this.onSelect === "function") {
        try { this.onSelect(id); } catch (err) { void err; }
      }
    }
  }

  // snap a position object {x,y,z} to grid if snap enabled
  _snapPosition(pos) {
    if (!this._snapEnabled || !this._snapValue) return pos;
    const s = this._snapValue;
    return { x: Math.round(pos.x / s) * s, y: Math.round(pos.y / s) * s, z: Math.round(pos.z / s) * s };
  }

  setSnapEnabled(enabled) {
    this._snapEnabled = !!enabled;
    if (this._gizmoManager && this._gizmoManager.positionGizmo) {
      try { this._gizmoManager.positionGizmo.snapDistance = this._snapEnabled ? this._snapValue : 0; } catch (err) { void err; }
    }
  }

  setSnapValue(v) {
    const val = Math.max(0.0001, Number(v) || 1);
    this._snapValue = val;
    if (this._gizmoManager && this._gizmoManager.positionGizmo) {
      try { this._gizmoManager.positionGizmo.snapDistance = this._snapEnabled ? this._snapValue : 0; } catch (err) { void err; }
    }
  }

  

  _applyCommand(cmd) {
    const { type, payload } = cmd;
    if (type === "createMesh") {
      const { kind, params = {}, position, rotation, scaling, id, name, material, parent, scripts } = payload;
      const meta = createMeta(kind, { id, name, params, parent, position, rotation, scaling, material, scripts });
      this.meshMetaMap.set(meta.id, meta);
      try {
        console.log("SceneProject: applyCommand createMesh", meta.id, "kind", meta.kind, "sceneReady", !!this.scene);
      } catch (err) { void err; }
      if (this.scene) this._createRuntimeMesh(meta);

      // keep script engine caches fresh
      this._syncScriptEngineScripts();
      return;
    }

    if (type === "updateMesh") {
      const { id, changes = {} } = payload;
      const meta = this.meshMetaMap.get(id);
      if (!meta) return;
      if (changes.name !== undefined) meta.name = changes.name;
      if (changes.position) Object.assign(meta.position, this._snapPosition(changes.position));
      if (changes.rotation) Object.assign(meta.rotation, changes.rotation);
      if (changes.scaling) Object.assign(meta.scaling, changes.scaling);
      if (changes.material) Object.assign(meta.material, changes.material);
      if (changes.parent !== undefined) meta.parent = changes.parent;
      if (changes.scripts !== undefined) meta.scripts = changes.scripts;
      if (changes.params) meta.params = { ...(meta.params || {}), ...(changes.params || {}) };

      if (changes.scripts !== undefined) this._syncScriptEngineScripts();

      if (this.scene) {
        const mesh = this.meshMap.get(id);
        if (mesh) {
          if (changes.position) mesh.position.copyFromFloats(meta.position.x, meta.position.y, meta.position.z);
          if (changes.rotation) {
            if (mesh.rotation && typeof mesh.rotation.copyFromFloats === "function") {
              mesh.rotation.copyFromFloats(meta.rotation.x, meta.rotation.y, meta.rotation.z);
            } else {
              mesh.rotation = new Vector3(meta.rotation.x, meta.rotation.y, meta.rotation.z);
            }
          }
          if (changes.scaling) {
            if (mesh.scaling && typeof mesh.scaling.copyFromFloats === "function") {
              mesh.scaling.copyFromFloats(meta.scaling.x, meta.scaling.y, meta.scaling.z);
            } else {
              mesh.scaling = new Vector3(meta.scaling.x, meta.scaling.y, meta.scaling.z);
            }
          }
          if (changes.name) mesh.name = meta.name;
          if (changes.parent !== undefined) {
            const p = this.meshMap.get(meta.parent);
            try {
              if (typeof mesh.setParent === "function") mesh.setParent(p || null);
              else mesh.parent = p || null;
            } catch (err) { void err; }

            // Parent change can alter local transform (preserve world), so sync back.
            try {
              if (mesh.position) Object.assign(meta.position, { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z });
              if (mesh.rotation) Object.assign(meta.rotation, { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z });
              if (mesh.scaling) Object.assign(meta.scaling, { x: mesh.scaling.x, y: mesh.scaling.y, z: mesh.scaling.z });
            } catch (err) { void err; }
          }
        }
        if (changes.material) this._applyMaterialToMesh(meta);
        if (changes.params && meta.kind === 'textbox') this._applyMaterialToMesh(meta);
        try { console.log("SceneProject: applied updateMesh", id, changes); } catch (err) { void err; }
      }
      return;
    }

    if (type === "groupMeshes") {
      const { id, name, childIds = [] } = payload || {};
      const ids = Array.isArray(childIds) ? childIds.filter(Boolean) : [];
      if (!ids.length) return;

      const childMetas = ids.map((cid) => this.meshMetaMap.get(cid)).filter(Boolean);
      if (!childMetas.length) return;

      // common parent if all selected share it
      let commonParent = childMetas[0].parent || null;
      for (const cm of childMetas) {
        if ((cm.parent || null) !== commonParent) { commonParent = null; break; }
      }

      // center based on runtime absolute positions when possible
      let cx = 0, cy = 0, cz = 0, n = 0;
      for (const cm of childMetas) {
        const rt = this.meshMap.get(cm.id);
        try {
          if (rt && typeof rt.getAbsolutePosition === "function") {
            const ap = rt.getAbsolutePosition();
            cx += ap.x; cy += ap.y; cz += ap.z; n += 1;
            continue;
          }
        } catch (err) { void err; }
        cx += cm.position?.x || 0;
        cy += cm.position?.y || 0;
        cz += cm.position?.z || 0;
        n += 1;
      }
      if (n < 1) return;
      const worldCenter = { x: cx / n, y: cy / n, z: cz / n };

      // If we create the group under a parent, store the group's position in that parent's local space.
      // We prefer runtime matrix conversion (handles rotated/scaled parents) when available.
      let groupPosition = { ...worldCenter };
      if (commonParent) {
        const parentRuntime = this.meshMap.get(commonParent);
        try {
          if (parentRuntime && typeof parentRuntime.getWorldMatrix === "function") {
            const inv = Matrix.Invert(parentRuntime.getWorldMatrix());
            const local = Vector3.TransformCoordinates(
              new Vector3(worldCenter.x, worldCenter.y, worldCenter.z),
              inv
            );
            groupPosition = { x: local.x, y: local.y, z: local.z };
          }
        } catch (err) {
          void err;
        }
      }

      const meta = createMeta("group", {
        id,
        name,
        parent: commonParent,
        position: groupPosition,
        rotation: { x: 0, y: 0, z: 0 },
        scaling: { x: 1, y: 1, z: 1 },
      });
      this.meshMetaMap.set(meta.id, meta);
      if (this.scene) this._createRuntimeMesh(meta);

      const groupRuntime = this.meshMap.get(meta.id) || null;
      for (const cm of childMetas) {
        cm.parent = meta.id;
        const childRuntime = this.meshMap.get(cm.id);
        if (childRuntime) {
          try {
            if (typeof childRuntime.setParent === "function") childRuntime.setParent(groupRuntime);
            else childRuntime.parent = groupRuntime;
          } catch (err) { void err; }
          try {
            if (childRuntime.position) Object.assign(cm.position, { x: childRuntime.position.x, y: childRuntime.position.y, z: childRuntime.position.z });
            if (childRuntime.rotation) Object.assign(cm.rotation, { x: childRuntime.rotation.x, y: childRuntime.rotation.y, z: childRuntime.rotation.z });
            if (childRuntime.scaling) Object.assign(cm.scaling, { x: childRuntime.scaling.x, y: childRuntime.scaling.y, z: childRuntime.scaling.z });
          } catch (err) { void err; }
        }
      }
      return;
    }

    if (type === "ungroup") {
      const { id } = payload || {};
      if (!id) return;
      const groupMeta = this.meshMetaMap.get(id);
      if (!groupMeta) return;
      if (groupMeta.kind !== "group") return;

      const parentId = groupMeta.parent || null;
      const parentRuntime = parentId ? (this.meshMap.get(parentId) || null) : null;

      // find current children
      const children = [];
      for (const m of this.meshMetaMap.values()) {
        if ((m.parent || null) === id) children.push(m);
      }

      for (const cm of children) {
        cm.parent = parentId;
        const childRuntime = this.meshMap.get(cm.id);
        if (childRuntime) {
          try {
            if (typeof childRuntime.setParent === "function") childRuntime.setParent(parentRuntime);
            else childRuntime.parent = parentRuntime;
          } catch (err) { void err; }
          try {
            if (childRuntime.position) Object.assign(cm.position, { x: childRuntime.position.x, y: childRuntime.position.y, z: childRuntime.position.z });
            if (childRuntime.rotation) Object.assign(cm.rotation, { x: childRuntime.rotation.x, y: childRuntime.rotation.y, z: childRuntime.rotation.z });
            if (childRuntime.scaling) Object.assign(cm.scaling, { x: childRuntime.scaling.x, y: childRuntime.scaling.y, z: childRuntime.scaling.z });
          } catch (err) { void err; }
        }
      }

      const groupRuntime = this.meshMap.get(id);
      if (groupRuntime) {
        try { groupRuntime.dispose(); } catch (err) { void err; }
        this.meshMap.delete(id);
      }
      const mat = this.materialMap.get(id);
      if (mat) { try { mat.dispose(); } catch (err) { void err; } this.materialMap.delete(id); }

      this.meshMetaMap.delete(id);
      if (this._selectedId === id) this._selectMeshById(null, "api");
      return;
    }

    if (type === "removeMesh") {
      const { id } = payload;
      const mesh = this.meshMap.get(id);
      if (mesh) { try { mesh.dispose(); } catch (err) { void err; } this.meshMap.delete(id); }
      const mat = this.materialMap.get(id);
      if (mat) { try { mat.dispose(); } catch (err) { void err; } this.materialMap.delete(id); }
      const dt = this._textTextureMap.get(id);
      if (dt) { try { dt.dispose(); } catch (err) { void err; } this._textTextureMap.delete(id); }
      this.meshMetaMap.delete(id);
      if (this._selectedId === id) {
        this._selectMeshById(null, "api");
      }

      this._syncScriptEngineScripts();
      return;
    }

    if (type === "setCamera") {
      const { alpha, beta, radius, target } = payload;
      if (alpha !== undefined) this.camera.alpha = alpha;
      if (beta !== undefined) this.camera.beta = beta;
      if (radius !== undefined) this.camera.radius = radius;
      if (target) {
        if (typeof target === "object") this.camera.setTarget(new Vector3(target.x || 0, target.y || 0, target.z || 0));
        else this.camera.setTarget(Vector3.Zero());
      }
      return;
    }

    if (type === "splitMerged" || type === "splitMesh") {
      const { id } = payload;
      const meta = this.meshMetaMap.get(id);
      if (!meta || meta.kind !== "merged") return;
      const mergedIds = Array.isArray(meta.params?.mergedIds) ? meta.params.mergedIds : [];
      const original = meta.params?.originalParents || {};

      // restore meta parent links and runtime parents for each child
      for (const childId of mergedIds) {
        const childMeta = this.meshMetaMap.get(childId);
        if (childMeta) {
          childMeta.parent = original[childId] || null;
          const childRuntime = this.meshMap.get(childId);
          const newParentRuntime = original[childId] ? this.meshMap.get(original[childId]) : null;
          if (childRuntime) {
            try { childRuntime.parent = newParentRuntime || null; } catch { void 0; }
          }
        }
      }

      // dispose and remove the group runtime node (TransformNode)
      const groupRuntime = this.meshMap.get(id);
      if (groupRuntime) {
        try { groupRuntime.dispose(); } catch { void 0; }
        this.meshMap.delete(id);
      }

      // remove the merged meta
      this.meshMetaMap.delete(id);

      // if we had selection on the merged id, clear selection
      if (this._selectedId === id) this._selectMeshById(null);

      return;
    }

    console.warn("Unknown command:", type);
  }

  // Enable/disable camera keyboard inputs (arrow keys) to avoid conflicts with app shortcuts
  setCameraKeyboardEnabled(enabled) {
    this._cameraKeyboardEnabled = !!enabled;
    try {
      if (!this.camera) return;
      if (!this._cameraKeyboardEnabled) {
        this.camera.keysUp = [];
        this.camera.keysDown = [];
        this.camera.keysLeft = [];
        this.camera.keysRight = [];
      } else {
        // default arrow keys
        this.camera.keysUp = [38];
        this.camera.keysDown = [40];
        this.camera.keysLeft = [37];
        this.camera.keysRight = [39];
      }
    } catch (e) { void e; }
  }

  _createRuntimeMesh(meta) {
    if (meta.kind === "group") {
      const mesh = MeshBuilder.CreateBox(meta.id, { size: 0.01 }, this.scene);
      mesh.name = meta.name || meta.id;
      try { mesh.position.copyFromFloats(meta.position.x, meta.position.y, meta.position.z); } catch { void 0; }
      try { if (mesh.rotation) mesh.rotation.copyFromFloats(meta.rotation.x, meta.rotation.y, meta.rotation.z); } catch { void 0; }
      try { if (mesh.scaling) mesh.scaling.copyFromFloats(meta.scaling.x, meta.scaling.y, meta.scaling.z); } catch { void 0; }
      try { mesh.isPickable = false; } catch { void 0; }
      try { mesh.visibility = 0; } catch { void 0; }
      try { mesh.alwaysSelectAsActiveMesh = false; } catch { void 0; }

      if (meta.parent) {
        const pm = this.meshMap.get(meta.parent);
        if (pm) {
          try {
            // For initial creation we want meta.position/rotation/scaling to be treated as LOCAL.
            // Using setParent() would preserve world transform and can corrupt intended locals.
            mesh.parent = pm;
          } catch { void 0; }
        }
      }

      this.meshMap.set(meta.id, mesh);
      return;
    }

    let mesh;
    if (meta.kind === "box") mesh = MeshBuilder.CreateBox(meta.id, meta.params, this.scene);
    else if (meta.kind === "sphere") mesh = MeshBuilder.CreateSphere(meta.id, meta.params, this.scene);
    else if (meta.kind === "cylinder") mesh = MeshBuilder.CreateCylinder(meta.id, meta.params, this.scene);
    else if (meta.kind === "cone") {
      // represent cone as a cylinder with diameterTop = 0
      const p = { ...meta.params };
      if (p.diameterTop === undefined) p.diameterTop = 0;
      mesh = MeshBuilder.CreateCylinder(meta.id, p, this.scene);
    } else if (meta.kind === "line") {
      // meta.params.points expected as [{x,y,z}, ...]
      const pts = (meta.params?.points || []).map(p => new Vector3(p.x || 0, p.y || 0, p.z || 0));
      mesh = MeshBuilder.CreateLines(meta.id, { points: pts }, this.scene);
      // ensure lines are pickable like other meshes? typically no, but preserve basic behavior
      mesh.isPickable = true;
    } else if (meta.kind === "tetra") {
      // Tetrahedron via polyhedron type 0
      const p = { size: 1, ...(meta.params || {}) };
      mesh = MeshBuilder.CreatePolyhedron(meta.id, { type: 0, size: p.size }, this.scene);
    } else if (meta.kind === "torus") {
      const p = { diameter: 1, thickness: 0.25, tessellation: 32, ...(meta.params || {}) };
      mesh = MeshBuilder.CreateTorus(meta.id, p, this.scene);
    } else if (meta.kind === "textbox") {
      const p = { width: 2, height: 1, ...(meta.params || {}) };
      mesh = MeshBuilder.CreatePlane(meta.id, { width: p.width, height: p.height }, this.scene);
    } else {
      mesh = MeshBuilder.CreateBox(meta.id, { size: 1 }, this.scene);
    }

    mesh.name = meta.name || meta.id;
    // ensure mesh.id equals meta.id (meshBuilder uses the id param)
    mesh.position.copyFromFloats(meta.position.x, meta.position.y, meta.position.z);

    if (mesh.rotation && typeof mesh.rotation.copyFromFloats === "function") {
      mesh.rotation.copyFromFloats(meta.rotation.x, meta.rotation.y, meta.rotation.z);
    } else {
      mesh.rotation = new Vector3(meta.rotation.x, meta.rotation.y, meta.rotation.z);
    }

    if (mesh.scaling && typeof mesh.scaling.copyFromFloats === "function") {
      mesh.scaling.copyFromFloats(meta.scaling.x, meta.scaling.y, meta.scaling.z);
    } else {
      mesh.scaling = new Vector3(meta.scaling.x, meta.scaling.y, meta.scaling.z);
    }

    // if meta.parent exists and runtime parent mesh exists, attach
    if (meta.parent) {
      const pm = this.meshMap.get(meta.parent);
      if (pm) {
        try { mesh.parent = pm; } catch { void 0; }
      }
    }

    this.meshMap.set(meta.id, mesh);
    this._applyMaterialToMesh(meta);
  }

  _drawTextBoxTexture(dt, meta) {
    try {
      if (!dt || !meta) return;
      const text = (meta.params && typeof meta.params.text === 'string') ? meta.params.text : 'Text';
      const fontSize = Math.max(10, Math.min(256, Number(meta.params?.fontSize) || 64));
      const c = meta.material?.color ?? { r: 1, g: 1, b: 1 };
      const r = Math.max(0, Math.min(255, Math.round((c.r ?? 1) * 255)));
      const g = Math.max(0, Math.min(255, Math.round((c.g ?? 1) * 255)));
      const b = Math.max(0, Math.min(255, Math.round((c.b ?? 1) * 255)));

      const ctx = dt.getContext();
      const w = dt.getSize().width;
      const h = dt.getSize().height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${r},${g},${b},1)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${fontSize}px monospace`;

      // simple multi-line support
      const lines = String(text).split(/\r?\n/);
      const lineH = fontSize * 1.25;
      const startY = h / 2 - (lines.length - 1) * (lineH / 2);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, startY + i * lineH);
      }

      dt.update();
    } catch (err) { void err; }
  }

  _applyMaterialToMesh(meta) {
    if (!this.scene) return;
    const mesh = this.meshMap.get(meta.id);
    if (!mesh) return;

    const c = meta.material?.color ?? { r: 0.9, g: 0.9, b: 0.9 };
    const spec = meta.material?.specularPower ?? 64;
    const type = (meta.material && typeof meta.material.type === "string") ? meta.material.type : "standard";

    // special-case for textbox meshes: keep a text DynamicTexture material
    if (meta.kind === "textbox") {
      let mat = this.materialMap.get(meta.id);
      if (!mat) {
        mat = new StandardMaterial(`mat-${meta.id}`, this.scene);
        this.materialMap.set(meta.id, mat);
        mesh.material = mat;
      }

      // Ensure a dynamic texture exists
      let dt = this._textTextureMap.get(meta.id);
      if (!dt) {
        const dpi = window.devicePixelRatio || 1;
        const texSize = Math.min(1024, Math.max(512, Math.floor(512 * dpi)));
        dt = new DynamicTexture(`text-dt-${meta.id}`, { width: texSize, height: texSize }, this.scene, false);
        try { dt.hasAlpha = true; } catch (err) { void err; }
        this._textTextureMap.set(meta.id, dt);
      }

      try { mat.diffuseTexture = dt; } catch (err) { void err; }
      try { mat.emissiveColor = new Color3(1, 1, 1); } catch (err) { void err; }
      try { mat.specularPower = 0; } catch (err) { void err; }
      try { mat.backFaceCulling = false; } catch (err) { void err; }
      try { mat.useAlphaFromDiffuseTexture = true; } catch (err) { void err; }

      this._drawTextBoxTexture(dt, meta);
      return;
    }

    // special-case for line meshes: set color property on LinesMesh and skip StandardMaterial
    if (meta.kind === "line") {
      // For LinesMesh, Babylon exposes `color` (Color3) property.
      try {
        mesh.color = new Color3(c.r, c.g, c.b);
      } catch { void 0; }
      return;
    }

    let mat = this.materialMap.get(meta.id);

    if (type === "pbr") {
      if (!mat || !(mat instanceof PBRMaterial)) {
        if (mat) { try { mat.dispose(); } catch (err) { void err; } }
        mat = new PBRMaterial(`mat-${meta.id}`, this.scene);
        this.materialMap.set(meta.id, mat);
        mesh.material = mat;
      }

      try { mat.albedoColor = new Color3(c.r, c.g, c.b); } catch (err) { void err; }
      try { mat.metallic = Math.max(0, Math.min(1, Number(meta.material?.metallic ?? 0))); } catch (err) { void err; }
      try { mat.roughness = Math.max(0, Math.min(1, Number(meta.material?.roughness ?? 0.4))); } catch (err) { void err; }
      try { mat.alpha = Math.max(0, Math.min(1, Number(meta.material?.alpha ?? 1))); } catch (err) { void err; }
      return;
    }

    // default: StandardMaterial
    if (!mat || !(mat instanceof StandardMaterial)) {
      if (mat) { try { mat.dispose(); } catch (err) { void err; } }
      mat = new StandardMaterial(`mat-${meta.id}`, this.scene);
      this.materialMap.set(meta.id, mat);
      mesh.material = mat;
    }

    try {
      if (mat.diffuseColor) mat.diffuseColor.set(c.r, c.g, c.b);
      else mat.diffuseColor = new Color3(c.r, c.g, c.b);
    } catch (err) { void err; }
    try { mat.specularPower = spec; } catch (err) { void err; }
    try { mat.alpha = Math.max(0, Math.min(1, Number(meta.material?.alpha ?? 1))); } catch (err) { void err; }
  }

  // Selection & highlight helpers
  _selectMeshById(id, source = "unknown") {
    if (this._selectedId === id) return;
    // clear previous selection outline/edges
    if (this._selectedId) {
      const prevMesh = this.meshMap.get(this._selectedId);
      if (prevMesh) {
        try {
          if (typeof prevMesh.renderOutline !== "undefined") {
            prevMesh.renderOutline = false;
          }
          if (typeof prevMesh.disableEdgesRendering === "function") {
            try { prevMesh.disableEdgesRendering(); } catch { void 0; }
          }
        } catch { void 0; }
      }
    }

    this._selectedId = id || null;
    this._selectionSource = source || "unknown";

    // apply new selection style: prefer renderOutline (silhouette outline), fallback to edges rendering
    if (id) {
      const m = this.meshMap.get(id);
      if (m) {
        try {
          if (typeof m.renderOutline !== "undefined") {
            m.renderOutline = true;
            m.outlineColor = new Color3(1.0, 0.62, 0.25); // warm/orange tint similar to Blender
            m.outlineWidth = 0.02;
          } else if (typeof m.enableEdgesRendering === "function") {
            try {
              m.enableEdgesRendering();
              if (typeof m.edgesColor !== "undefined") {
                m.edgesColor = new Color4(1.0, 0.62, 0.25, 1.0);
                m.edgesWidth = 4.0;
              }
            } catch { void 0; }
          }
        } catch { void 0; }
      }
    }

    // attach/detach gizmo to selected mesh (edit mode only)
    try {
      if (this._gizmoManager && this._gizmoVisible && !this._runtimeEnabled) {
        const attach = this._selectedId ? this.meshMap.get(this._selectedId) : null;
        // if attached mesh has non-uniform scaling, ensure gizmo rotation matching is disabled to avoid Babylon warning
        try {
          if (attach && attach.scaling) {
            const sx = attach.scaling.x || 1;
            const sy = attach.scaling.y || 1;
            const sz = attach.scaling.z || 1;
            const eps = 1e-4;
            const nonUniform = (Math.abs(sx - sy) > eps) || (Math.abs(sx - sz) > eps) || (Math.abs(sy - sz) > eps);
            try { this._gizmoManager.updateGizmoRotationToMatchAttachedMesh = !nonUniform; } catch { void 0; }
            try { if (this._gizmoManager.rotationGizmo) this._gizmoManager.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = !nonUniform; } catch { void 0; }
          }
        } catch (e) { void e; }
        try { this._gizmoManager.attachToMesh(attach); } catch { void 0; }

        // Adaptive gizmo: depend on camera zoom but never exceed mesh size
        try {
          const camRadius = (this.camera && typeof this.camera.radius === "number") ? this.camera.radius : 50;
          // factor controls how large gizmo becomes with camera distance (tweakable)
          const CAM_FACTOR = 0.04;
          let desired = camRadius * CAM_FACTOR;

          // get mesh bounding radius to cap the gizmo size
          let meshRadius = 0;
          try {
            if (attach && typeof attach.getBoundingInfo === "function") {
              const bi = attach.getBoundingInfo();
              if (bi && bi.boundingSphere) meshRadius = bi.boundingSphere.radiusWorld || bi.boundingSphere.radius || 0;
            }
          } catch { void 0; }

          // cap desired so it does not exceed mesh radius (keep gizmo smaller than mesh)
          if (meshRadius > 0) desired = Math.min(desired, meshRadius * 0.9);

          // clamp to sensible bounds and apply user-requested scale reduction (quarter size)
          const MIN_GIZMO = 0.04;
          const MAX_GIZMO = Math.max(0.12, meshRadius || 0.12);
          // make gizmo 1/2 of the computed size
          const USER_SCALE_FACTOR = 0.5;
          let finalRatio = Math.max(MIN_GIZMO, Math.min(MAX_GIZMO, desired)) * USER_SCALE_FACTOR;
          try { this._gizmoManager.scaleRatio = finalRatio; } catch { void 0; }
          // leave updateScale behavior as default (allow camera influence)
        } catch { void 0; }

        if (this._gizmoManager.positionGizmo) {
          try { this._gizmoManager.positionGizmo.snapDistance = this._snapEnabled ? this._snapValue : 0; } catch { void 0; }
        }
      } else if (this._gizmoManager) {
        try { this._gizmoManager.attachToMesh(null); } catch { void 0; }
      }
    } catch (e) { void e; }
    // call callback
    if (typeof this.onSelect === "function") {
      try { this.onSelect(this._selectedId, { source: this._selectionSource }); } catch { void 0; }
    }
  }

  // Public API: allow App to be notified
  setSelectionCallback(fn) { this.onSelect = fn; }

  // allow app to register callback for runtime transform changes (gizmo drag)
  setChangeCallback(fn) { this._changeCallback = fn; }

  // Public API: highlight programmatically
  highlightMesh(id) { this._selectMeshById(id, "api"); }

  clearAllHighlights() { this._selectMeshById(null, "api"); }

  // 축 표시 제어
  setAxesVisible(visible) {
    const want = !!visible;
    this._axesVisible = want;
    if (!this.scene) return;
    if (want) {
      if (!this._axesHelper) {
        try { this._axesHelper = new AxesHelper(this.scene, this._gridSize); } catch { this._axesHelper = null; }
      } else {
        this._axesHelper.setVisible(true);
      }
    } else {
      if (this._axesHelper) {
        try { this._axesHelper.dispose(); } catch (e) { void e; }
        this._axesHelper = null;
      }
    }
  }

  // 축 표시 상태 반환
  isAxesVisible() { return !!this._axesVisible; }

  // 라이트 / 환경 관련 간단한 API
  setHemisphericIntensity(value) {
    try {
      const v = Number(value) || 0;
      if (this._hemisphericLight) this._hemisphericLight.intensity = v;
    } catch (e) { void e; }
  }

  addDirectionalLight({ direction = { x: -1, y: -2, z: 1 }, intensity = 1, name = null } = {}) {
    try {
      if (!this.scene) return null;
      const id = `dir-${Date.now()}`;
      const dir = new DirectionalLight(id, new Vector3(direction.x, direction.y, direction.z), this.scene);
      dir.intensity = Number(intensity) || 1;
      dir.name = name || id;
      this._lights.set(id, dir);
      return id;
    } catch { return null; }
  }

  removeLight(id) {
    try {
      const l = this._lights.get(id);
      if (l) { try { l.dispose(); } catch { void 0; } this._lights.delete(id); }
    } catch (e) { void e; }
  }

  listLights() {
    const out = [];
    try {
      for (const [id, l] of this._lights) {
        out.push({ id, type: l.getClassName ? l.getClassName() : "light", intensity: l.intensity, name: l.name || id });
      }
      if (this._hemisphericLight) out.push({ id: "hemi", type: "HemisphericLight", intensity: this._hemisphericLight.intensity, name: this._hemisphericLight.name || "hemi" });
    } catch (e) { void e; }
    return out;
  }

  // Gizmo mode: 'position' | 'rotation' | 'scale' | 'none' | 'all'
  setGizmoMode(mode) {
    try {
      const m = (mode || "none").toString();
      this._gizmoMode = m;
      if (this._runtimeEnabled) return;
      if (!this._gizmoVisible) return;
      if (!this._gizmoManager) return;
      this._gizmoManager.positionGizmoEnabled = (m === "position" || m === "all");
      this._gizmoManager.rotationGizmoEnabled = (m === "rotation" || m === "all");
      this._gizmoManager.scaleGizmoEnabled = (m === "scale" || m === "all");
      if (m === "none") this._gizmoManager.attachToMesh(null);
    } catch (e) { void e; }
  }

  // Allow App/UI to toggle gizmo visibility.
  setGizmoVisible(visible) {
    const want = !!visible;
    this._gizmoVisible = want;
    try {
      if (!this._gizmoManager) return;
      if (!want) {
        this._gizmoManager.positionGizmoEnabled = false;
        this._gizmoManager.rotationGizmoEnabled = false;
        this._gizmoManager.scaleGizmoEnabled = false;
        try { this._gizmoManager.attachToMesh(null); } catch { void 0; }
        return;
      }

      if (this._runtimeEnabled) {
        // runtime cannot re-enable gizmos
        this._gizmoManager.positionGizmoEnabled = false;
        this._gizmoManager.rotationGizmoEnabled = false;
        this._gizmoManager.scaleGizmoEnabled = false;
        try { this._gizmoManager.attachToMesh(null); } catch { void 0; }
        return;
      }

      // restore last known mode
      try { this.setGizmoMode(this._gizmoMode || "position"); } catch { void 0; }

      // if we have a selection and mode isn't none, re-attach
      try {
        if (this._gizmoManager && this._selectedId && (this._gizmoMode || "none") !== "none") {
          const attach = this.meshMap.get(this._selectedId);
          if (attach) this._gizmoManager.attachToMesh(attach);
        }
      } catch { void 0; }
    } catch (e) { void e; }
  }

  removeSelectedMesh() {
    try {
      if (!this._selectedId) return;
      this.enqueueCommand({ type: "removeMesh", payload: { id: this._selectedId } });
      this._selectMeshById(null);
    } catch (e) { void e; }
  }

  // Helpers to expose engine/scene for UI components
  getEngine() { return this.engine; }
  getScene() { return this.scene; }

  // Grid: create a textured plane with repeated dynamic texture for performance
  _createGrid() {
    if (!this.scene) return;
    if (this._gridMesh) return;
    const size = this._gridSize; // world units (확대)
    const _tile = 1; // tile repetition

    // Compute base cell size (previous behavior) and allow further subdivision by 10
    const baseCell = Math.max(1, Math.round(this._gridSize / 100));
    // one more subdivision: divide base cell by 20 so smallest visible cell becomes ~1 unit for default sizes
    const subdividedCell = Math.max(0.1, baseCell / 20);

    // Avoid expensive dynamic texture work when base cells are very small
    // (many lines would be drawn but they're handled efficiently by GridMaterial shader)
    let mat;
    const useDynamicTexture = baseCell >= 8; // only create DT for coarser grids
    if (useDynamicTexture) {
      const dpi = window.devicePixelRatio || 1;
      const texSize = Math.min(1024, Math.max(512, Math.floor(512 * dpi)));
      const dt = new DynamicTexture(`grid-dt-${this.id}`, { width: texSize, height: texSize }, this.scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, texSize, texSize);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;

      const majorEvery = Math.max(32, Math.floor(texSize / 16));
      for (let x = 0; x <= texSize; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, texSize);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1.6;
      for (let x = 0; x <= texSize; x += majorEvery) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, texSize);
        ctx.stroke();
      }
      dt.update();

      mat = new GridMaterial(`grid-mat-${this.id}`, this.scene);
      // When using the dynamic texture, keep grid shader params conservative
      // majorUnitFrequency should represent number of small cells between major lines (use 10)
      mat.majorUnitFrequency = 10;
      mat.minorUnitVisibility = 0.5;
      // gridRatio represents size of one cell in world units; use subdivided cell
      mat.gridRatio = subdividedCell;
    } else {
      // For fine grids (small cell size) prefer shader-only GridMaterial
      mat = new GridMaterial(`grid-mat-${this.id}`, this.scene);
      // major unit should be 10 small cells (so major lines remain spaced similarly to previous behavior)
      mat.majorUnitFrequency = 10;
      // reduce minor visibility a bit for performance/readability on dense grids
      mat.minorUnitVisibility = subdividedCell <= 0.2 ? 0.35 : 0.45;
      mat.gridRatio = subdividedCell;
    }

    mat.backFaceCulling = false;
    mat.opacity = 1;
    mat.mainColor = new Color3(0.03, 0.03, 0.04);
    mat.lineColor = new Color3(0.45, 0.45, 0.45);
    mat.lineColor2 = new Color3(0.25, 0.28, 0.30);

    const grid = MeshBuilder.CreateGround(`grid-${this.id}`, { width: size, height: size, subdivisions: 1 }, this.scene);
    grid.material = mat;
    grid.position.y = 0;
    grid.isPickable = false;

    // keep references
    this._gridMesh = grid;
    this._gridMaterial = mat;
  }

  _disposeGrid() {
    if (this._gridMesh) { try { this._gridMesh.dispose(); } catch { void 0; } this._gridMesh = null; }
    if (this._gridMaterial) { try { this._gridMaterial.dispose(); } catch { void 0; } this._gridMaterial = null; }
  }

  setGridVisible(visible) {
    this._gridVisible = !!visible;
    if (!this.scene) return;
    if (this._gridVisible) this._createGrid();
    else this._disposeGrid();
  }

  // simple getters for UI
  getMeshMetaList() {
    // return shallow copies
    return Array.from(this.meshMetaMap.values()).map(m => ({ ...m }));
  }
  getMeta(id) { const m = this.meshMetaMap.get(id); return m ? JSON.parse(JSON.stringify(m)) : null; }

  serialize() {
    const meshes = [];
    for (const [, m] of this.meshMetaMap) {
      // prefer live runtime values when available (gizmo or direct runtime changes)
      const runtime = this.meshMap.get(m.id);
      let position = { ...m.position };
      let rotation = { ...m.rotation };
      let scaling = { ...m.scaling };
      if (runtime) {
        try {
          if (runtime.position) position = { x: runtime.position.x, y: runtime.position.y, z: runtime.position.z };
          if (runtime.rotation) rotation = { x: runtime.rotation.x, y: runtime.rotation.y, z: runtime.rotation.z };
          if (runtime.scaling) scaling = { x: runtime.scaling.x, y: runtime.scaling.y, z: runtime.scaling.z };
        } catch {
          void 0;
          // fallback to meta values on error
        }
      }
      meshes.push({
        id: m.id, name: m.name, kind: m.kind, params: m.params, parent: m.parent,
        position, rotation, scaling,
        material: { ...m.material },
        scripts: m.scripts ? JSON.parse(JSON.stringify(m.scripts)) : null
      });
    }
    const camera = this.camera ? { type: "arcRotate", alpha: this.camera.alpha, beta: this.camera.beta, radius: this.camera.radius } : null;
    return { id: this.id, name: this.name, camera, meshes, createdAt: Date.now() };
  }

  _loadMetaFromJSON(json) {
    if (!json || !json.meshes) return;
    for (const m of json.meshes) {
      const meta = createMeta(m.kind, { id: m.id, name: m.name, params: m.params, parent: m.parent, position: m.position, rotation: m.rotation, scaling: m.scaling, material: m.material, scripts: m.scripts });
      this.meshMetaMap.set(meta.id, meta);
    }

    // keep script engine in sync
    try {
      if (this._scriptEngine && typeof this._scriptEngine.setScripts === 'function') {
        this._scriptEngine.setScripts(this.getMeshMetaList());
      }
    } catch (err) { void err; }
  }

  loadFromJSON(json) {
    this._loadMetaFromJSON(json);
    if (this.scene) {
      for (const meta of this.meshMetaMap.values()) {
        if (!this.meshMap.has(meta.id)) this._createRuntimeMesh(meta);
        else this._applyMaterialToMesh(meta);
      }
    }
  }

  // Replace existing meshes (runtime + meta) with those from JSON while keeping the engine/camera state.
  replaceWithJSON(json) {
    if (!json) return;
    // dispose existing runtime meshes and materials
    for (const m of this.meshMap.values()) { try { m.dispose(); } catch { void 0; } }
    for (const mat of this.materialMap.values()) { try { mat.dispose(); } catch { void 0; } }
    this.meshMap.clear();
    this.materialMap.clear();
    this.meshMetaMap.clear();

    // load new metas
    this._loadMetaFromJSON(json);

    // create runtime meshes if scene exists
    if (this.scene) {
      for (const meta of this.meshMetaMap.values()) {
        try {
          this._createRuntimeMesh(meta);
        } catch (e) { console.error("Failed to create runtime mesh:", e); }
      }
    }
  }

  disposeCompletely() {
    this._shutdownEngineOnly();
    this.meshMetaMap.clear();
    this.meshMap.clear();
  }
}
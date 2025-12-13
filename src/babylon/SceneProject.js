// src/babylon/SceneProject.js
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { HighlightLayer } from "@babylonjs/core/Layers/highlightLayer";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders";
import { GridMaterial } from "@babylonjs/materials";
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

    this.commandQueue = [];
    this._running = false;

    this.highlightLayer = null;
    this._selectedId = null;
    this.onSelect = null; // callback: (id|null) => void

    // Grid related
    this._gridMesh = null;
    this._gridMaterial = null;
    this._gridVisible = false;

    // 축
    this._axesHelper = null;
    this._axesVisible = true; // 기본 on; App에서 툴 상태로 제어

    if (initialJSON) {
      this._loadMetaFromJSON(initialJSON);
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

    this.camera = new ArcRotateCamera("camera-" + this.id, Math.PI / 4, Math.PI / 3, 50, Vector3.Zero(), this.scene);
    this.camera.attachControl(this.canvas, true);

    const hemi = new HemisphericLight("light-" + this.id, new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.95;

    // Highlight layer
    try {
      this.highlightLayer = new HighlightLayer("hl-" + this.id, this.scene);
    } catch (e) {
      this.highlightLayer = null;
    }

    this._axesHelper = new AxesHelper(this.scene, 2); // 길이 2, 필요하면 값 변경

    // create runtime meshes from meta map
    for (const meta of this.meshMetaMap.values()) this._createRuntimeMesh(meta);

    // if grid requested earlier, create now
    if (this._gridVisible) this._createGrid();
    // only create axes if requested
    if (this._axesVisible) {
      try { this._axesHelper = new AxesHelper(this.scene, 8); } catch (e) { this._axesHelper = null; }
    }

    // pointer pick handling
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
            this._selectMeshById(mesh.id);
          } else {
            // clicked empty space or untracked mesh
            this._selectMeshById(null);
          }
        } else {
          this._selectMeshById(null);
        }
      }
    });

    this._running = true;
    this.engine.runRenderLoop(() => {
      this._processCommands();
      if (this.scene) this.scene.render();
    });

    window.addEventListener("resize", this._onResize);
  }

  _shutdownEngineOnly() {
    window.removeEventListener("resize", this._onResize);
    if (this.scene) {
      for (const m of this.scene.meshes.slice()) { try { m.dispose(); } catch {} }
      try { this.scene.dispose(); } catch {}
      this.scene = null;
    }
    if (this.engine) {
      try { this.engine.stopRenderLoop(); } catch {}
      try { this.engine.dispose(); } catch {}
      this.engine = null;
    }
    try {
      if (this.highlightLayer) { try { this.highlightLayer.dispose(); } catch {} ; this.highlightLayer = null; }
    } catch {}

    if (this._axesHelper) { try { this._axesHelper.dispose(); } catch {} ; this._axesHelper = null; }
    if (this._gridMesh) { try { this._gridMesh.dispose(); } catch {} ; this._gridMesh = null; }
    if (this._gridMaterial) { try { this._gridMaterial.dispose(); } catch {} ; this._gridMaterial = null; }

    for (const mat of this.materialMap.values()) { try { mat.dispose(); } catch {} }
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

  _applyCommand(cmd) {
    const { type, payload } = cmd;
    if (type === "createMesh") {
      const { kind, params = {}, position, rotation, scaling, id, name, material, parent } = payload;
      const meta = createMeta(kind, { id, name, params, parent, position, rotation, scaling, material });
      this.meshMetaMap.set(meta.id, meta);
      if (this.scene) this._createRuntimeMesh(meta);
      return;
    }

    if (type === "updateMesh") {
      const { id, changes = {} } = payload;
      const meta = this.meshMetaMap.get(id);
      if (!meta) return;
      if (changes.name !== undefined) meta.name = changes.name;
      if (changes.position) Object.assign(meta.position, changes.position);
      if (changes.rotation) Object.assign(meta.rotation, changes.rotation);
      if (changes.scaling) Object.assign(meta.scaling, changes.scaling);
      if (changes.material) Object.assign(meta.material, changes.material);
      if (changes.parent !== undefined) meta.parent = changes.parent;

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
            try { mesh.parent = p || null; } catch {}
          }
        }
        if (changes.material) this._applyMaterialToMesh(meta);
      }
      return;
    }

    if (type === "removeMesh") {
      const { id } = payload;
      const mesh = this.meshMap.get(id);
      if (mesh) { try { mesh.dispose(); } catch {}; this.meshMap.delete(id); }
      const mat = this.materialMap.get(id);
      if (mat) { try { mat.dispose(); } catch {}; this.materialMap.delete(id); }
      this.meshMetaMap.delete(id);
      if (this._selectedId === id) {
        this._selectMeshById(null);
      }
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
            try { childRuntime.parent = newParentRuntime || null; } catch {}
          }
        }
      }

      // dispose and remove the group runtime node (TransformNode)
      const groupRuntime = this.meshMap.get(id);
      if (groupRuntime) {
        try { groupRuntime.dispose(); } catch {}
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

  _createRuntimeMesh(meta) {
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
        try { mesh.parent = pm; } catch {}
      }
    }

    this.meshMap.set(meta.id, mesh);
    this._applyMaterialToMesh(meta);
  }

  _applyMaterialToMesh(meta) {
    if (!this.scene) return;
    const mesh = this.meshMap.get(meta.id);
    if (!mesh) return;

    const c = meta.material?.color ?? { r: 0.9, g: 0.9, b: 0.9 };
    const spec = meta.material?.specularPower ?? 64;

    // special-case for line meshes: set color property on LinesMesh and skip StandardMaterial
    if (meta.kind === "line") {
      // For LinesMesh, Babylon exposes `color` (Color3) property.
      try {
        mesh.color = new Color3(c.r, c.g, c.b);
      } catch {}
      return;
    }

    let mat = this.materialMap.get(meta.id);

    if (!mat) {
      mat = new StandardMaterial(`mat-${meta.id}`, this.scene);
      this.materialMap.set(meta.id, mat);
      mesh.material = mat;
    }

    if (mat.diffuseColor) {
      mat.diffuseColor.set(c.r, c.g, c.b);
    } else {
      mat.diffuseColor = new Color3(c.r, c.g, c.b);
    }
    mat.specularPower = spec;
  }

  // Selection & highlight helpers
  _selectMeshById(id) {
    if (this._selectedId === id) return;
    // clear previous highlight
    if (this.highlightLayer && this._selectedId) {
      const prevMesh = this.meshMap.get(this._selectedId);
      if (prevMesh) {
        try { this.highlightLayer.removeMesh(prevMesh); } catch {}
      }
    }
    this._selectedId = id || null;
    if (id && this.highlightLayer) {
      const m = this.meshMap.get(id);
      if (m) {
        try { this.highlightLayer.addMesh(m, Color3.FromInts(255, 200, 64)); } catch {}
      }
    }
    // call callback
    if (typeof this.onSelect === "function") {
      try { this.onSelect(this._selectedId); } catch {}
    }
  }

  // Public API: allow App to be notified
  setSelectionCallback(fn) { this.onSelect = fn; }

  // Public API: highlight programmatically
  highlightMesh(id) { this._selectMeshById(id); }

  clearAllHighlights() { this._selectMeshById(null); }

  // 축 표시 제어
  setAxesVisible(visible) {
    const want = !!visible;
    this._axesVisible = want;
    if (!this.scene) return;
    if (want) {
      if (!this._axesHelper) {
        try { this._axesHelper = new AxesHelper(this.scene, 8); } catch (e) { this._axesHelper = null; }
      } else {
        this._axesHelper.setVisible(true);
      }
    } else {
      if (this._axesHelper) {
        try { this._axesHelper.dispose(); } catch (e) {}
        this._axesHelper = null;
      }
    }
  }

  // 축 표시 상태 반환
  isAxesVisible() { return !!this._axesVisible; }

  // Grid: create a textured plane with repeated dynamic texture for performance
  _createGrid() {
    if (!this.scene) return;
    if (this._gridMesh) return;

    const size = 200; // world units
    const tile = 1; // tile repetition

    // create dynamic texture that draws grid lines
    const texSize = 1024;
    const dt = new DynamicTexture(`grid-dt-${this.id}`, { width: texSize, height: texSize }, this.scene, false);
    const ctx = dt.getContext();
    // background transparent-ish
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, texSize, texSize);
    // grid line color
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;

    // draw major lines every N pixels and minor lines
    const majorEvery = 64;
    for (let x = 0; x <= texSize; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, texSize);
      ctx.stroke();
    }
    // emphasize major lines
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1.2;
    for (let x = 0; x <= texSize; x += majorEvery) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, texSize);
      ctx.stroke();
    }
    // horizontal lines already drawn above by same loops

    dt.update();

    const mat = new GridMaterial(`grid-mat-${this.id}`, this.scene);
    mat.majorUnitFrequency = 10;    // 큰 눈금 간격 (world units)
    mat.minorUnitVisibility = 0.35; // 작은 눈금 가시성(0..1)
    mat.gridRatio = 1;             // 한 셀의 크기 (1 = 1 world unit)
    mat.backFaceCulling = false;
    mat.opacity = 1;
    // gentler colors: dark background + desaturated lines
    mat.mainColor = new Color3(0.03, 0.03, 0.04); // very dark base
    mat.lineColor = new Color3(0.20, 0.28, 0.30); // muted teal/grayish
    mat.lineColor2 = new Color3(0.14, 0.18, 0.20); // second line tone if supported

    const grid = MeshBuilder.CreateGround(`grid-${this.id}`, { width: size, height: size, subdivisions: 1 }, this.scene);
    grid.material = mat;
    grid.position.y = 0;
    grid.isPickable = false;

    // keep references
    this._gridMesh = grid;
    this._gridMaterial = mat;
  }

  _disposeGrid() {
    if (this._gridMesh) { try { this._gridMesh.dispose(); } catch {} ; this._gridMesh = null; }
    if (this._gridMaterial) { try { this._gridMaterial.dispose(); } catch {} ; this._gridMaterial = null; }
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
      meshes.push({
        id: m.id, name: m.name, kind: m.kind, params: m.params, parent: m.parent,
        position: { ...m.position }, rotation: { ...m.rotation }, scaling: { ...m.scaling },
        material: { ...m.material }
      });
    }
    const camera = this.camera ? { type: "arcRotate", alpha: this.camera.alpha, beta: this.camera.beta, radius: this.camera.radius } : null;
    return { id: this.id, name: this.name, camera, meshes, createdAt: Date.now() };
  }

  _loadMetaFromJSON(json) {
    if (!json || !json.meshes) return;
    for (const m of json.meshes) {
      const meta = createMeta(m.kind, { id: m.id, name: m.name, params: m.params, parent: m.parent, position: m.position, rotation: m.rotation, scaling: m.scaling, material: m.material });
      this.meshMetaMap.set(meta.id, meta);
    }
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

  disposeCompletely() {
    this._shutdownEngineOnly();
    this.meshMetaMap.clear();
    this.meshMap.clear();
  }
}
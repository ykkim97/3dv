// src/babylon/SceneProject.js
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { AdvancedDynamicTexture, StackPanel, TextBlock, Button as GUIButton, Rectangle } from "@babylonjs/gui";
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
    this._modelLoadPromises = new Map();

    this.commandQueue = [];
    this._running = false;

    this.highlightLayer = null; // legacy field kept for compatibility (no longer used)
    this._selectedId = null;
    this._highlightedIds = new Set();
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
    this._toolMode = "move";
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
    this._axesVisible = true; // 기본 on; App에서 툴 상태로 제어

    this._hemisphericLight = null;

    if (initialJSON) {
      this._loadMetaFromJSON(initialJSON);
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

  // Create a 3D panel linked to a mesh's center with a connecting line
  addGuiPanelLinked(targetId, opts = {}) {
    try {
      if (!this.scene) return null;
      const resolved = this._resolveTargetId(targetId);
      if (!resolved) return null;
      const targetMesh = this.meshMap.get(resolved);
      if (!targetMesh) return null;

      const meshCenter = targetMesh.getBoundingInfo().boundingBox.centerWorld;

      // create a small plane and position it offset from mesh center
      const id = `gui-linked-${Date.now()}`;
      const plane = MeshBuilder.CreatePlane(`${id}-plane`, { size: 1.4 }, this.scene);
      const basePlaneSize = 1.4;
      const defaultOffset = new Vector3(1.2, 1.2, 1.2);
      plane.position = meshCenter.add(defaultOffset);
      try { plane.billboardMode = 7; } catch (err) { void err; }
      plane.id = id;
      plane.name = id;
      plane.isPickable = true;
      // register plane so picking/selection works
      this.meshMap.set(id, plane);

      // attach a dynamic texture GUI to the plane
      const adtWidth = 512;
      const adtHeight = 512;
      const adt = AdvancedDynamicTexture.CreateForMesh(plane, adtWidth, adtHeight, false);
      const rect = new Rectangle();
      rect.width = "420px";
      rect.height = "300px";
      rect.cornerRadius = 12;
      rect.background = "rgba(16,16,20,0.95)";
      rect.color = "#ffffff";
      rect.thickness = 1;
      adt.addControl(rect);

      const stack = new StackPanel();
      rect.addControl(stack);

      const title = new TextBlock();
      title.text = opts.title || `GUI: ${resolved}`;
      title.color = "#fff";
      title.fontSize = 14;
      stack.addControl(title);

      const body = new TextBlock();
      body.text = opts.text || "Linked GUI panel";
      body.color = "#cfe3ff";
      body.fontSize = 12;
      body.textWrapping = true;
      stack.addControl(body);

      // create a simple line between mesh center and plane
      const line = MeshBuilder.CreateLines(`gui-line-${Date.now()}`, { points: [meshCenter, plane.position], updatable: true }, this.scene);
      line.color = new Color3(0.6, 0.8, 1.0);

      const rec = { type: "linked", plane, adt, rect, stack, line, targetId: resolved, offset: defaultOffset, lineColor: new Color3(0.6,0.8,1.0), lineStartOffset: new Vector3(0,0,0), titleControl: title, bodyControl: body };
      try {
        if (this.scene && typeof this.scene.onPointerObservable !== 'undefined') {
          const obs = this.scene.onPointerObservable.add((pe) => {
            try {
              if (pe && pe.pickInfo && pe.pickInfo.pickedMesh === plane) {
                try { if (typeof this._guiPanelCallback === 'function') this._guiPanelCallback(id, rec); } catch (err) { void err; }
                try { this._applySelectionState([id], id, 'pick', true); } catch (err) { void err; }
              }
            } catch (err) { void err; }
          }, PointerEventTypes.POINTERPICK);
          rec._pickObs = obs;
        }
      } catch (err) { void err; }

      // store adt/plane sizing metadata so updates can resize the mesh plane
      rec._adtSize = { width: adtWidth, height: adtHeight };
      rec._basePlaneSize = basePlaneSize;

      // ensure initial plane scaling matches rectangle size
      try {
        const pxW = parseInt(String(rect.width || '380px').replace('px',''), 10) || 380;
        const pxH = parseInt(String(rect.height || '220px').replace('px',''), 10) || 220;
        plane.scaling = new Vector3((pxW / adtWidth) * basePlaneSize, (pxH / adtHeight) * basePlaneSize, 1);
      } catch (err) { void err; }

      this._guiPanels.set(id, rec);

      return id;
    } catch (err) {
      console.error("addGuiPanelLinked error:", err);
      return null;
    }
  }

  // remove a gui panel by id
  removeGuiPanel(id) {
    try {
      const rec = this._guiPanels.get(id);
      if (!rec) return false;
      try {
        if (rec._pickObs && this.scene && typeof this.scene.onPointerObservable !== 'undefined') {
          try { this.scene.onPointerObservable.remove(rec._pickObs); } catch { }
        }
      } catch (err) { void err; }
      if (rec.adt && typeof rec.adt.dispose === 'function') rec.adt.dispose();
      if (rec.plane && typeof rec.plane.dispose === 'function') rec.plane.dispose();
      if (rec.line && typeof rec.line.dispose === 'function') rec.line.dispose();
      try { if (rec.plane && rec.plane.id) this.meshMap.delete(rec.plane.id); } catch (err) { void err; }
      this._guiPanels.delete(id);
      try {
        const meta = null;
        for (const l of (this._guiPanelChangeListeners || [])) {
          try { l(id, meta); } catch (err) { void err; }
        }
      } catch (err) { void err; }
      // notify any registered gui-panel-change listeners
      try {
        const meta = this.getGuiPanel(id);
        for (const l of (this._guiPanelChangeListeners || [])) {
          try { l(id, meta); } catch (err) { void err; }
        }
      } catch (err) { void err; }

      return true;
    } catch (err) { void err; return false; }
  }

  // Allow external listeners to be notified when a GUI panel's metadata changes
  addGuiPanelChangeListener(fn) {
    if (!this._guiPanelChangeListeners) this._guiPanelChangeListeners = [];
    if (typeof fn === 'function') this._guiPanelChangeListeners.push(fn);
  }

  removeGuiPanelChangeListener(fn) {
    try {
      if (!this._guiPanelChangeListeners) return;
      const idx = this._guiPanelChangeListeners.indexOf(fn);
      if (idx >= 0) this._guiPanelChangeListeners.splice(idx, 1);
    } catch (err) { void err; }
  }

  // Register a callback invoked when a GUI panel is interacted/selected
  setGuiPanelCallback(cb) {
    this._guiPanelCallback = typeof cb === 'function' ? cb : null;
  }

  // Return a shallow meta object for a panel
  getGuiPanel(id) {
    try {
      const rec = this._guiPanels.get(id);
      if (!rec) return null;
      const meta = { id, type: rec.type };
      if (rec.type === 'linked') {
        meta.targetId = rec.targetId;
        meta.offset = rec.offset ? { x: rec.offset.x, y: rec.offset.y, z: rec.offset.z } : { x: 0, y: 0, z: 0 };
        // normalize lineColor to a single '#rrggbb' string when possible
        try {
          let lc = null;
          if (rec.lineColor) {
            if (typeof rec.lineColor === 'string') {
              lc = rec.lineColor.startsWith('#') ? rec.lineColor : `#${rec.lineColor}`;
            } else if (rec.lineColor && typeof rec.lineColor.toHexString === 'function') {
              const h = rec.lineColor.toHexString();
              lc = h.startsWith('#') ? h : `#${h}`;
            } else if (rec.lineColor && typeof rec.lineColor.r === 'number') {
              const int = ((Math.round(rec.lineColor.r*255) & 255) << 16) | ((Math.round(rec.lineColor.g*255) & 255) << 8) | (Math.round(rec.lineColor.b*255) & 255);
              let hex = int.toString(16).toUpperCase();
              while (hex.length < 6) hex = '0' + hex;
              lc = `#${hex}`;
            }
          }
          meta.lineColor = lc;
        } catch (e) { meta.lineColor = null; }
        meta.lineStartOffset = rec.lineStartOffset ? { x: rec.lineStartOffset.x, y: rec.lineStartOffset.y, z: rec.lineStartOffset.z } : { x:0,y:0,z:0 };
      }
      // rectangle sizes and text content
      try { if (rec.rect) { meta.width = rec.rect.width; meta.height = rec.rect.height; } } catch (e) { meta.width = null; meta.height = null; }
      try {
        if (rec.rect) {
          meta.background = rec.rect.background;
          meta.borderColor = rec.rect.color;
          meta.borderThickness = rec.rect.thickness;
        }
      } catch (e) { /* ignore */ }
      try {
        // prefer explicit controls if available
        meta.title = (rec.titleControl && typeof rec.titleControl.text === 'string') ? rec.titleControl.text : (rec.stack && rec.stack.children && rec.stack.children[0] ? rec.stack.children[0].text : '');
        meta.text = (rec.bodyControl && typeof rec.bodyControl.text === 'string') ? rec.bodyControl.text : (rec.stack && rec.stack.children && rec.stack.children[1] ? rec.stack.children[1].text : '');
      } catch (e) { meta.title = ''; meta.text = ''; }
      // buttons count
      try { if (rec.stack && rec.stack.children) { const buttons = rec.stack.children.slice(2).map((c) => c.text || ''); meta.buttons = buttons; } else meta.buttons = []; } catch (e) { meta.buttons = []; }
      return meta;
    } catch (err) { void err; return null; }
  }

  // Update panel properties (title, text, width, height, fontSize, lineColor, offset, buttons)
  updateGuiPanel(id, props = {}) {
    try {
      const rec = this._guiPanels.get(id);
      if (!rec) return false;
      try { if (typeof console !== 'undefined' && console.log) console.log('SceneProject.updateGuiPanel ->', id, props); } catch (e) { }
      if (props.title !== undefined) {
        try {
          if (rec.titleControl && typeof rec.titleControl.text === 'string') {
            rec.titleControl.text = props.title;
          } else if (rec.stack && rec.stack.children && rec.stack.children[0] && typeof rec.stack.children[0].text === 'string') {
            rec.stack.children[0].text = props.title;
          }
          // attempt to force redraw of ADT if available
          try { if (rec.adt && typeof rec.adt.markDirty === 'function') rec.adt.markDirty(); if (rec.adt && typeof rec.adt.markAsDirty === 'function') rec.adt.markAsDirty(); } catch (e) { }
          try { if (rec.rect && typeof rec.rect.markAsDirty === 'function') rec.rect.markAsDirty(); } catch (e) { }
          try { if (typeof console !== 'undefined' && console.log) console.log('SceneProject.updateGuiPanel: title set', id, props.title); } catch (e) { }
        } catch (err) { void err; }
      }
      if (props.text !== undefined) {
        try {
          if (rec.bodyControl && typeof rec.bodyControl.text === 'string') {
            rec.bodyControl.text = props.text;
          } else if (rec.stack && rec.stack.children && rec.stack.children[1] && typeof rec.stack.children[1].text === 'string') {
            rec.stack.children[1].text = props.text;
          }
          // attempt to force redraw of ADT if available
          try { if (rec.adt && typeof rec.adt.markDirty === 'function') rec.adt.markDirty(); if (rec.adt && typeof rec.adt.markAsDirty === 'function') rec.adt.markAsDirty(); } catch (e) { }
          try { if (rec.rect && typeof rec.rect.markAsDirty === 'function') rec.rect.markAsDirty(); } catch (e) { }
          try { if (typeof console !== 'undefined' && console.log) console.log('SceneProject.updateGuiPanel: text set', id, props.text); } catch (e) { }
        } catch (err) { void err; }
      }
      if (props.width !== undefined && rec.rect) {
        try { rec.rect.width = typeof props.width === 'number' ? `${props.width}px` : props.width; } catch (err) { void err; }
      }
      if (props.height !== undefined && rec.rect) {
        try { rec.rect.height = typeof props.height === 'number' ? `${props.height}px` : props.height; } catch (err) { void err; }
      }
      // if linked panel, also scale the mesh plane so GUI appears larger/smaller in world space
      try {
        if (rec.type === 'linked' && rec.plane && rec._adtSize && rec._basePlaneSize) {
          const adtW = rec._adtSize.width || 512;
          const adtH = rec._adtSize.height || 512;
          const pxW = props.width !== undefined ? (typeof props.width === 'number' ? props.width : parseInt(String(props.width||'').replace('px',''),10)) : (rec.rect && typeof rec.rect.width === 'string' && rec.rect.width.endsWith('px') ? parseInt(rec.rect.width,10) : null);
          const pxH = props.height !== undefined ? (typeof props.height === 'number' ? props.height : parseInt(String(props.height||'').replace('px',''),10)) : (rec.rect && typeof rec.rect.height === 'string' && rec.rect.height.endsWith('px') ? parseInt(rec.rect.height,10) : null);
          if (pxW && pxH) {
            try { rec.plane.scaling = new Vector3((pxW / adtW) * rec._basePlaneSize, (pxH / adtH) * rec._basePlaneSize, 1); } catch (err) { void err; }
          }
        }
      } catch (err) { void err; }
      if (props.background !== undefined && rec.rect) {
        try { rec.rect.background = props.background; } catch (err) { void err; }
      }
      if (props.borderColor !== undefined && rec.rect) {
        try { rec.rect.color = props.borderColor; } catch (err) { void err; }
      }
      if (props.borderThickness !== undefined && rec.rect) {
        try { rec.rect.thickness = Number(props.borderThickness) || 0; } catch (err) { void err; }
      }
      if (props.fontSize !== undefined) {
        try {
          if (rec.titleControl && rec.titleControl.fontSize !== undefined) rec.titleControl.fontSize = props.fontSize;
          if (rec.bodyControl && rec.bodyControl.fontSize !== undefined) rec.bodyControl.fontSize = props.fontSize;
          if (rec.stack && rec.stack.children) for (const c of rec.stack.children) { if (c && c.fontSize !== undefined) c.fontSize = props.fontSize; }
        } catch (err) { void err; }
      }
      if (props.lineColor !== undefined && rec.line) {
        try {
          const hex = String(props.lineColor || "#9ac8ff");
          const cleaned = String(hex).replace(/^#+/, '');
          if (cleaned.length >= 6) {
            const c6 = cleaned.slice(-6);
            const int = parseInt(c6, 16);
            const r = ((int >> 16) & 255) / 255;
            const g = ((int >> 8) & 255) / 255;
            const b = (int & 255) / 255;
            rec.line.color = new Color3(r, g, b);
          }
        } catch (err) { void err; }
        try { rec.lineColor = (typeof props.lineColor === 'string') ? `#${String(props.lineColor).replace(/^#+/, '').slice(-6).toUpperCase()}` : props.lineColor; } catch (e) { }
      }
      if (props.offset && rec.type === 'linked' && rec.plane) {
        try {
          const offset = props.offset;
          const target = this.meshMap.get(rec.targetId);
          if (target) {
            const center = target.getBoundingInfo().boundingBox.centerWorld;
            rec.plane.position = center.add(new Vector3(Number(offset.x||0), Number(offset.y||0), Number(offset.z||0)));
            // store offset so future queries return it
            try { rec.offset = new Vector3(Number(offset.x||0), Number(offset.y||0), Number(offset.z||0)); } catch (e) { }
            try { if (rec.line && rec.line.update && typeof rec.line.update === 'function') rec.line = MeshBuilder.CreateLines(rec.line.name, { points: [center, rec.plane.position], instance: rec.line }, this.scene); } catch { try { rec.line.dispose(); rec.line = MeshBuilder.CreateLines(`gui-line-${Date.now()}`, { points: [center, rec.plane.position], updatable: true }, this.scene); } catch { } }
          }
        } catch (err) { void err; }
      }
      if (Array.isArray(props.buttons) && rec.stack) {
        try {
          // dispose existing controls beyond title/body
          const existing = rec.stack.children.slice(2);
          for (const c of existing) { try { c.dispose && c.dispose(); } catch { } }
          // append new buttons
          for (const bLabel of props.buttons) {
            try {
              const btn = new GUIButton();
              btn.width = "100px";
              btn.height = "28px";
              btn.color = "#fff";
              btn.background = "#2b2f45";
              btn.cornerRadius = 6;
              btn.thickness = 0;
              btn.text = bLabel || "Button";
              rec.stack.addControl(btn);
            } catch (e) { void e; }
          }
        } catch (err) { void err; }
      }

      // overlay placement adjustments
      if (rec.type === 'overlay' && rec.rect && props.screenOffset) {
        try {
          if (props.screenOffset.top !== undefined) rec.rect.top = typeof props.screenOffset.top === 'number' ? `${props.screenOffset.top}px` : props.screenOffset.top;
          if (props.screenOffset.left !== undefined) rec.rect.left = typeof props.screenOffset.left === 'number' ? `${props.screenOffset.left}px` : props.screenOffset.left;
        } catch (err) { void err; }
      }

      return true;
    } catch (err) { void err; return false; }
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

    // Register host-call handler for this scene (RPC from Worker).
    try {
      if (this._scriptEngine && typeof this._scriptEngine.registerHost === 'function') {
        this._scriptEngine.registerHost(this.id, ({ name, args }) => this._handleScriptHostCall(name, args));
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

  _resolveTargetId(target) {
    try {
      if (!target) return null;
      if (typeof target === 'string') {
        if (this.meshMetaMap.has(target)) return target;
        for (const m of this.meshMetaMap.values()) {
          if (m && m.name === target) return m.id;
        }
        return null;
      }
      if (typeof target === 'object') {
        if (typeof target.id === 'string') return this._resolveTargetId(target.id);
        if (typeof target.name === 'string') return this._resolveTargetId(target.name);
      }
      return null;
    } catch (err) {
      void err;
      return null;
    }
  }

  _pickPointAt(x, y) {
    try {
      if (!this.scene) return null;
      const pick = this.scene.pick(
        Number(x || 0),
        Number(y || 0),
        (m) => {
          if (!m) return false;
          if (this._gridMesh && m === this._gridMesh) return false;
          return m.isPickable !== false;
        }
      );

      if (pick && pick.hit && pick.pickedPoint) {
        return { x: pick.pickedPoint.x, y: pick.pickedPoint.y, z: pick.pickedPoint.z };
      }

      return null;
    } catch (err) {
      void err;
      return null;
    }
  }

  _animateViewTo({ alpha, beta }, durationMs = 260) {
    try {
      if (!this.scene || !this.camera) return false;

      // cancel prior view tween if any
      try {
        if (this._viewTweenObs) this.scene.onBeforeRenderObservable.remove(this._viewTweenObs);
      } catch (err) { void err; }
      this._viewTweenObs = null;

      const cam = this.camera;
      const startAlpha = Number(cam.alpha || 0);
      const startBeta = Number(cam.beta || 0);

      const twoPi = Math.PI * 2;
      const targetAlpha = Number(alpha || 0);
      const targetBeta = Number(beta || 0);

      // shortest-path interpolation for alpha (wrap-around)
      const rawDelta = (targetAlpha - startAlpha) % twoPi;
      const deltaAlpha = ((rawDelta + Math.PI) % twoPi) - Math.PI;
      const endAlpha = startAlpha + deltaAlpha;

      const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
      const targetBetaClamped = clamp(targetBeta, 0.01, Math.PI - 0.01);

      const dur = Math.max(1, Number(durationMs || 0));
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

      const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

      this._viewTweenObs = this.scene.onBeforeRenderObservable.add(() => {
        try {
          const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          const t = clamp((now - t0) / dur, 0, 1);
          const k = easeInOut(t);

          cam.alpha = startAlpha + deltaAlpha * k;
          cam.beta = startBeta + (targetBetaClamped - startBeta) * k;

          if (t >= 1) {
            cam.alpha = endAlpha;
            cam.beta = targetBetaClamped;
            try { if (this._viewTweenObs) this.scene.onBeforeRenderObservable.remove(this._viewTweenObs); } catch (err) { void err; }
            this._viewTweenObs = null;
          }
        } catch (err) {
          void err;
          try { if (this._viewTweenObs) this.scene.onBeforeRenderObservable.remove(this._viewTweenObs); } catch { void 0; }
          this._viewTweenObs = null;
        }
      });

      return true;
    } catch (err) {
      void err;
      return false;
    }
  }

  _applyViewPresetAnimated(view, opts = null) {
    try {
      if (!this.camera) return false;
      const v = String(view || '').toLowerCase();
      const presets = {
        iso: { alpha: Math.PI / 4, beta: Math.PI / 3 },
        front: { alpha: Math.PI / 2, beta: Math.PI / 2.3 },
        back: { alpha: -Math.PI / 2, beta: Math.PI / 2.3 },
        left: { alpha: Math.PI, beta: Math.PI / 2.3 },
        right: { alpha: 0, beta: Math.PI / 2.3 },
        top: { alpha: Math.PI / 2, beta: 0.15 },
        bottom: { alpha: Math.PI / 2, beta: Math.PI - 0.15 },
      };
      const p = presets[v] || presets.iso;
      const ms = (opts && typeof opts.durationMs === 'number') ? opts.durationMs : 260;
      return this._animateViewTo(p, ms);
    } catch (err) {
      void err;
      return false;
    }
  }

  setViewPreset(view) {
    // UI convenience: animate by default.
    return this._applyViewPresetAnimated(view);
  }

  // Effect system (minimal) for script convenience APIs
  _ensureEffects() {
    if (!this._effects) this._effects = new Map();
    if (!this._effectSeq) this._effectSeq = 0;
    if (!this._lastEffectTime) this._lastEffectTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  }

  _tickEffects() {
    try {
      this._ensureEffects();
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const dtMs = Math.max(0, now - this._lastEffectTime);
      this._lastEffectTime = now;
      const dt = dtMs / 1000;
      if (!dt) return;

      for (const eff of Array.from(this._effects.values())) {
        try {
          if (!eff || !eff.type) continue;
          const done = this._tickEffectOne(eff, dt, now);
          if (done) this._effects.delete(eff.id);
        } catch (err) {
          void err;
          try { this._effects.delete(eff.id); } catch { void 0; }
        }
      }
    } catch (err) {
      void err;
    }
  }

  _getRuntimeMaterialFor(id) {
    try {
      const mesh = this.meshMap.get(id);
      const mat = mesh ? mesh.material : null;
      return mat || null;
    } catch {
      return null;
    }
  }

  _setRuntimeColor(id, color, useEmissive = false) {
    try {
      const mat = this._getRuntimeMaterialFor(id);
      if (!mat) return false;
      const c = color && typeof color === 'object' ? color : {};
      const r = Number(c.r || 0);
      const g = Number(c.g || 0);
      const b = Number(c.b || 0);
      if (mat instanceof PBRMaterial) {
        // prefer albedoColor
        try { mat.albedoColor = new Color3(r, g, b); } catch { void 0; }
        if (useEmissive) {
          try { mat.emissiveColor = new Color3(r, g, b); } catch { void 0; }
        }
        return true;
      }
      // StandardMaterial or others
      if (useEmissive) {
        try { mat.emissiveColor = new Color3(r, g, b); } catch { void 0; }
      } else {
        try { mat.diffuseColor = new Color3(r, g, b); } catch { void 0; }
      }
      return true;
    } catch (err) {
      void err;
      return false;
    }
  }

  _tickEffectOne(eff, dt) {
    const id = eff.targetId;
    const mesh = this.meshMap.get(id);
    const meta = this.meshMetaMap.get(id);
    if (!id || !mesh || !meta) return true;

    if (eff.type === 'flashColor') {
      const duration = Math.max(0, Number(eff.opts?.duration || 0));
      if (!eff._inited) {
        eff._inited = true;
        eff._t = 0;
        eff._orig = { color: { ...(meta.material?.color || { r: 0.9, g: 0.9, b: 0.9 }) }, alpha: meta.material?.alpha };
        this._setRuntimeColor(id, eff.opts?.color || { r: 1, g: 1, b: 1 }, false);
      }
      eff._t += dt * 1000;
      if (eff._t >= duration) {
        this._setRuntimeColor(id, eff._orig?.color || { r: 0.9, g: 0.9, b: 0.9 }, false);
        return true;
      }
      return false;
    }

    if (eff.type === 'fadeMaterial') {
      const duration = Math.max(1, Number(eff.opts?.duration || 1));
      const toAlpha = Math.max(0, Math.min(1, Number(eff.opts?.toAlpha)));
      const mat = this._getRuntimeMaterialFor(id);
      if (!mat) return true;
      if (!eff._inited) {
        eff._inited = true;
        eff._t = 0;
        eff._from = Number(mat.alpha ?? 1);
      }
      eff._t += dt * 1000;
      const a = Math.max(0, Math.min(1, eff._t / duration));
      const next = eff._from + (toAlpha - eff._from) * a;
      try { mat.alpha = next; } catch { void 0; }
      // keep meta in sync (best-effort)
      try { meta.material = { ...(meta.material || {}), alpha: next }; } catch { void 0; }
      if (a >= 1) return true;
      return false;
    }

    if (eff.type === 'moveTo') {
      const dest = eff.opts?.dest;
      const dx = Number(dest?.x || 0);
      const dy = Number(dest?.y || 0);
      const dz = Number(dest?.z || 0);

      if (!eff._inited) {
        eff._inited = true;
        eff._t = 0;
        eff._from = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
        const speed = Number(eff.opts?.speed || 0);
        const duration = Number(eff.opts?.duration || 0);
        if (duration > 0) eff._duration = duration;
        else if (speed > 0) {
          const dist = Math.sqrt((dx - eff._from.x) ** 2 + (dy - eff._from.y) ** 2 + (dz - eff._from.z) ** 2);
          eff._duration = Math.max(1, (dist / speed) * 1000);
        } else {
          eff._duration = 300;
        }
      }

      eff._t += dt * 1000;
      const a = Math.max(0, Math.min(1, eff._t / eff._duration));
      const nx = eff._from.x + (dx - eff._from.x) * a;
      const ny = eff._from.y + (dy - eff._from.y) * a;
      const nz = eff._from.z + (dz - eff._from.z) * a;
      try { mesh.position.copyFromFloats(nx, ny, nz); } catch { void 0; }
      try { Object.assign(meta.position, { x: nx, y: ny, z: nz }); } catch { void 0; }
      if (a >= 1) return true;
      return false;
    }

    if (eff.type === 'rotate') {
      // opts: { spin: { axis: {x,y,z}, speedDeg } }
      const spin = eff.opts?.spin;
      if (!spin) return true;
      const speedDeg = Number(spin.speedDeg || 0);
      const axis = spin.axis && typeof spin.axis === 'object' ? spin.axis : { x: 0, y: 1, z: 0 };
      const radPerSec = (speedDeg * Math.PI) / 180;
      const inc = radPerSec * dt;
      try {
        // simple axis mapping (dominant component)
        if (Math.abs(axis.x) >= Math.abs(axis.y) && Math.abs(axis.x) >= Math.abs(axis.z)) mesh.rotation.x += inc;
        else if (Math.abs(axis.z) >= Math.abs(axis.y)) mesh.rotation.z += inc;
        else mesh.rotation.y += inc;
      } catch { void 0; }
      try { Object.assign(meta.rotation, { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z }); } catch { void 0; }
      return false;
    }

    if (eff.type === 'pulseColor') {
      const amp = Number(eff.opts?.amp ?? 0.25);
      const freq = Number(eff.opts?.freq ?? 1.5);
      const useEmissive = !!eff.opts?.useEmissive;
      const base = eff.opts?.color && typeof eff.opts.color === 'object'
        ? eff.opts.color
        : (meta.material?.color || { r: 0.9, g: 0.9, b: 0.9 });
      if (!eff._inited) {
        eff._inited = true;
        eff._phase = 0;
      }
      eff._phase += dt * Math.PI * 2 * freq;
      const s = Math.sin(eff._phase);
      const scale = 1 + s * amp;
      const c = { r: base.r * scale, g: base.g * scale, b: base.b * scale };
      this._setRuntimeColor(id, c, useEmissive);
      return false;
    }

    // unknown effect types auto-finish (keeps future expansion safe)
    return true;
  }

  _startEffect({ type, targetId, opts }) {
    this._ensureEffects();
    const id = `eff-${++this._effectSeq}-${Date.now()}`;
    this._effects.set(id, { id, type, targetId, opts: opts || {}, _createdAt: Date.now() });
    return id;
  }

  _stopEffect(id) {
    this._ensureEffects();
    if (!id) return false;
    return this._effects.delete(id);
  }

  _stopEffectsForTarget(targetId, types = null) {
    this._ensureEffects();
    const want = Array.isArray(types) ? new Set(types) : null;
    for (const eff of Array.from(this._effects.values())) {
      if (!eff) continue;
      if (eff.targetId !== targetId) continue;
      if (want && !want.has(eff.type)) continue;
      this._effects.delete(eff.id);
    }
  }

  _handleScriptHostCall(name, args) {
    const n = String(name || '');
    if (n === 'pickScreen') return this._pickPointAt(args?.x, args?.y);
    if (n === 'pickAtPointer') return this._pickPointAt(this.scene?.pointerX, this.scene?.pointerY);
    if (n === 'setView') return this._applyViewPreset(args?.view);
    if (n === 'focus') {
      const tid = this._resolveTargetId(args?.target);
      if (!tid) return false;
      const ok = this.frameMesh(tid);
      try {
        const r = Number(args?.opts?.radius || 0);
        if (ok && this.camera && r > 0) this.camera.radius = r;
      } catch { void 0; }
      return ok;
    }
    if (n === 'startEffect') {
      const tid = this._resolveTargetId(args?.targetId);
      if (!tid) return null;
      return this._startEffect({ type: args?.type, targetId: tid, opts: args?.opts || {} });
    }
    if (n === 'stopEffect') return this._stopEffect(args?.id);
    if (n === 'stopEffectsForTarget') {
      const tid = this._resolveTargetId(args?.targetId);
      if (!tid) return false;
      this._stopEffectsForTarget(tid, args?.types || null);
      return true;
    }
    if (n === 'stopAllEffectsByType') {
      const type = String(args?.type || '');
      this._ensureEffects();
      for (const eff of Array.from(this._effects.values())) {
        if (eff && eff.type === type) this._effects.delete(eff.id);
      }
      return true;
    }
    if (n === 'delay') {
      const ms = Math.max(0, Number(args?.ms || 0));
      const fnOrName = args?.fnOrName;
      const meshId = this._resolveTargetId(args?.meshId) || (typeof args?.meshId === 'string' ? args.meshId : null);
      const id = `delay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      if (!this._delays) this._delays = new Map();
      const t = setTimeout(() => {
        try {
          this._delays.delete(id);
        } catch { void 0; }
        // For now, only supports firing a named event on the same mesh: Util.Delay(ms, 'onClick')
        try {
          if (typeof fnOrName === 'string' && meshId) this._runMeshScriptEvent(meshId, fnOrName, { source: 'delay' });
        } catch { void 0; }
      }, ms);
      this._delays.set(id, t);
      return id;
    }
    if (n === 'cancelDelay') {
      const id = args?.id;
      if (!id || !this._delays) return false;
      const t = this._delays.get(id);
      if (!t) return false;
      try { clearTimeout(t); } catch { void 0; }
      this._delays.delete(id);
      return true;
    }

    // Optional future host services (sound/markers). Keep as safe no-ops for now.
    if (n === 'playSound' || n === 'stopSound' || n === 'fadeSound') {
      return false;
    }
    if (n === 'showMarker' || n === 'removeMarker') {
      return null;
    }

    throw new Error(`Unknown hostCall: ${n}`);
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
    // update GUI panel connector lines each frame so they follow moving targets/panels
    try {
      if (typeof this.scene.onBeforeRenderObservable !== 'undefined') {
        this._guiPanelLineObs = this.scene.onBeforeRenderObservable.add(() => {
          try {
            for (const [pid, rec] of this._guiPanels) {
              try {
                if (rec && rec.type === 'linked' && rec.plane && rec.line && rec.targetId) {
                  const target = this.meshMap.get(rec.targetId);
                  if (!target) continue;
                  const center = target.getBoundingInfo().boundingBox.centerWorld;
                  // recompute plane position if rec.offset exists
                  try {
                    if (rec.offset) {
                      rec.plane.position = center.add(rec.offset);
                    }
                  } catch (e) { void e; }
                  // update line
                  try { MeshBuilder.CreateLines(rec.line.name, { points: [center, rec.plane.position], instance: rec.line }, this.scene); } catch (e) { void e; }
                }
              } catch (err) { void err; }
            }
          } catch (err) { void err; }
        });
      }
    } catch (err) { void err; }

    // apply keyboard control state if needed
    try { if (!this._cameraKeyboardEnabled) this.setCameraKeyboardEnabled(false); } catch (err) { void err; }
    try { if (!this._cameraPointerOrbitEnabled) this.setCameraPointerOrbitEnabled(false); } catch (err) { void err; }

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
            if (!this._runtimeEnabled && !this._suppressPointerPickSelection && this._toolMode !== "cursor" && this._toolMode !== "measure") {
              const ev = pi.event || null;
              if (typeof this.onSelect === "function") {
                try {
                  this.onSelect(mesh.id, {
                    source: "pick",
                    ctrlKey: !!ev?.ctrlKey,
                    metaKey: !!ev?.metaKey,
                    shiftKey: !!ev?.shiftKey,
                    altKey: !!ev?.altKey,
                  });
                } catch { void 0; }
              } else {
                this._selectMeshById(mesh.id, "pick");
              }
            }

            // In runtime mode, clicking a mesh triggers its onClick script.
            if (this._runtimeEnabled) {
              try { this._runMeshScriptEvent(mesh.id, 'onClick', { x: this.scene.pointerX, y: this.scene.pointerY }); } catch { void 0; }
            }
          } else {
            // clicked empty space or untracked mesh
            if (!this._runtimeEnabled && !this._suppressPointerPickSelection && this._toolMode !== "cursor" && this._toolMode !== "measure") {
              const ev = pi.event || null;
              if (typeof this.onSelect === "function") {
                try {
                  this.onSelect(null, {
                    source: "pick",
                    empty: true,
                    ctrlKey: !!ev?.ctrlKey,
                    metaKey: !!ev?.metaKey,
                    shiftKey: !!ev?.shiftKey,
                    altKey: !!ev?.altKey,
                  });
                } catch { void 0; }
              } else {
                this._selectMeshById(null, "pick");
              }
            }
          }
        } else {
          if (!this._runtimeEnabled && !this._suppressPointerPickSelection && this._toolMode !== "cursor" && this._toolMode !== "measure") {
            const ev = pi.event || null;
            if (typeof this.onSelect === "function") {
              try {
                this.onSelect(null, {
                  source: "pick",
                  empty: true,
                  ctrlKey: !!ev?.ctrlKey,
                  metaKey: !!ev?.metaKey,
                  shiftKey: !!ev?.shiftKey,
                  altKey: !!ev?.altKey,
                });
              } catch { void 0; }
            } else {
              this._selectMeshById(null, "pick");
            }
          }
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

      // If the attached mesh has non-uniform scaling, Babylon's rotation gizmo can fail before
      // drag-start observables run. Work around this by temporarily normalizing scaling ONLY
      // when the pointer interaction happens on the rotation gizmo meshes (utility layer).
      try {
        this._tempScalingRotationPre = new Map();
        this._rotationPreNormalizeActive = null; // attached mesh id if active

        const isMeshInRotationGizmo = (pickedMesh) => {
          try {
            if (!pickedMesh) return false;
            const rg = this._gizmoManager && this._gizmoManager.rotationGizmo;
            if (!rg) return false;

            // Prefer Babylon's explicit gizmoMeshes list if present.
            const gizmoMeshes = rg.gizmoMeshes;
            if (Array.isArray(gizmoMeshes) && gizmoMeshes.length) {
              let cur = pickedMesh;
              while (cur) {
                if (gizmoMeshes.includes(cur)) return true;
                cur = cur.parent;
              }
              return false;
            }

            // Fallback heuristic: rotation gizmo meshes usually contain 'rotation' in name/id.
            const name = String(pickedMesh.name || pickedMesh.id || "").toLowerCase();
            if (!name) return false;
            if (name.includes("rotation") && name.includes("gizmo")) return true;
            if (name.includes("rot") && name.includes("gizmo")) return true;
            return false;
          } catch (err) {
            void err;
            return false;
          }
        };

        const normalizeAttachedScaling = () => {
          try {
            const attached = this._gizmoManager.attachedMesh || (this._selectedId ? this.meshMap.get(this._selectedId) : null);
            if (!attached || !attached.scaling) return;

            const sx = attached.scaling.x || 1;
            const sy = attached.scaling.y || 1;
            const sz = attached.scaling.z || 1;
            const eps = 1e-4;
            const nonUniform = (Math.abs(sx - sy) > eps) || (Math.abs(sx - sz) > eps) || (Math.abs(sy - sz) > eps);
            if (!nonUniform) return;

            this._tempScalingRotationPre.set(attached.id, { x: sx, y: sy, z: sz });
            const avg = (sx + sy + sz) / 3;
            try { attached.scaling.copyFromFloats(avg, avg, avg); } catch { attached.scaling = new Vector3(avg, avg, avg); }
            this._rotationPreNormalizeActive = attached.id;
          } catch (err) { void err; }
        };

        const restoreAttachedScaling = () => {
          try {
            const id = this._rotationPreNormalizeActive;
            if (!id) return;
            const attached = (this._gizmoManager && this._gizmoManager.attachedMesh) ? this._gizmoManager.attachedMesh : (this._selectedId ? this.meshMap.get(this._selectedId) : null);
            const orig = this._tempScalingRotationPre.get(id);
            if (attached && orig) {
              try { attached.scaling.copyFromFloats(orig.x, orig.y, orig.z); } catch { attached.scaling = new Vector3(orig.x, orig.y, orig.z); }
            }
            this._tempScalingRotationPre.delete(id);
            this._rotationPreNormalizeActive = null;
          } catch (err) { void err; }
        };

        const utilityScene = this._gizmoManager.gizmoLayer && this._gizmoManager.gizmoLayer.utilityLayerScene;
        if (utilityScene && utilityScene.onPointerObservable) {
          this._gizmoRotationPointerObs = utilityScene.onPointerObservable.add((pi) => {
            try {
              if (!pi) return;
              if (pi.type === PointerEventTypes.POINTERDOWN) {
                const picked = pi.pickInfo && pi.pickInfo.pickedMesh ? pi.pickInfo.pickedMesh : null;
                if (isMeshInRotationGizmo(picked)) {
                  // keep rotation matching disabled to be safe
                  try { this._gizmoManager.updateGizmoRotationToMatchAttachedMesh = false; } catch (err) { void err; }
                  try { if (this._gizmoManager.rotationGizmo) this._gizmoManager.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false; } catch (err) { void err; }
                  normalizeAttachedScaling();
                }
              } else if (pi.type === PointerEventTypes.POINTERUP) {
                restoreAttachedScaling();
              }
            } catch (err) { void err; }
          });
        }
      } catch (err) { void err; }

      // apply current snap settings to gizmos
      try { this._applySnapToGizmos(); } catch (err) { void err; }
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
    // register per-frame highlight thickness updater so outlines/edges remain visible across zoom
    try {
      if (this.scene && typeof this.scene.onBeforeRenderObservable !== "undefined") {
        this._highlightThicknessObs = this.scene.onBeforeRenderObservable.add(() => {
          try {
            if (!this._highlightedIds || !this.camera) return;
            for (const id of this._highlightedIds) {
              const m = this.meshMap.get(id);
              if (m) this._updateHighlightThicknessForMesh(m, id === this._selectedId);
            }
          } catch (err) { void err; }
        });
      }
    } catch (err) { void err; }

    this.engine.runRenderLoop(() => {
      this._processCommands();
      try { this._tickEffects(); } catch (err) { void err; }
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

  _updateHighlightThicknessForMesh(mesh, isPrimary) {
    try {
      if (!mesh || !this.camera) return;
      // determine camera radius and mesh size (bounding sphere radius)
      const camRadius = (this.camera && typeof this.camera.radius === "number") ? this.camera.radius : 50;
      let meshRadius = 0;
      try {
        if (typeof mesh.getBoundingInfo === "function") {
          const bi = mesh.getBoundingInfo();
          if (bi && bi.boundingSphere) meshRadius = bi.boundingSphere.radiusWorld || bi.boundingSphere.radius || 0;
        }
      } catch { void 0; }

      const EPS = 1e-4;
      const apparentFactor = meshRadius > EPS ? (camRadius / meshRadius) : camRadius;

      // Outline rendering (mesh.renderOutline)
      try {
        if (typeof mesh.renderOutline !== "undefined") {
          const base = isPrimary ? 0.02 : 0.015;
          // scale factor tuned to produce reasonable widths across common camera ranges
          const scaled = base * Math.min(Math.max(apparentFactor * 0.0025, 0.5), 8);
          mesh.outlineWidth = Math.max(0.001, Math.min(1.0, scaled));
          return;
        }
      } catch { void 0; }

      // EdgesRenderer style (pixel width)
      try {
        if (typeof mesh.enableEdgesRendering === "function" && typeof mesh.edgesWidth !== "undefined") {
          const basePx = isPrimary ? 4.0 : 3.0;
          const scaledPx = basePx * Math.min(Math.max(apparentFactor * 0.06, 0.5), 40);
          mesh.edgesWidth = Math.max(1.0, Math.min(64.0, scaledPx));
        }
      } catch { void 0; }
    } catch (err) { void err; }
  }

  _shutdownEngineOnly() {
    window.removeEventListener("resize", this._onResize);
    if (this.scene) {
      try { this._disposePlacementPreview(); } catch (err) { void err; }
      // remove highlight thickness observer before disposing scene
      try { if (this._highlightThicknessObs && typeof this.scene.onBeforeRenderObservable !== "undefined") this.scene.onBeforeRenderObservable.remove(this._highlightThicknessObs); } catch (err) { void err; }
      this._highlightThicknessObs = null;
      try { if (this._guiPanelLineObs && typeof this.scene.onBeforeRenderObservable !== 'undefined') this.scene.onBeforeRenderObservable.remove(this._guiPanelLineObs); } catch (err) { void err; }
      this._guiPanelLineObs = null;
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
    if (this._cursorMarker) { try { this._cursorMarker.dispose(); } catch (err) { void err; } this._cursorMarker = null; }
    if (this._cursorMarkerMaterial) { try { this._cursorMarkerMaterial.dispose(); } catch (err) { void err; } this._cursorMarkerMaterial = null; }
    if (this._measurementLine) { try { this._measurementLine.dispose(); } catch (err) { void err; } this._measurementLine = null; }
    try {
      for (const marker of this._measurementMarkers) {
        try { marker.dispose(); } catch (err) { void err; }
      }
    } catch (err) { void err; }
    this._measurementMarkers = [];
    if (this._measurementMaterial) { try { this._measurementMaterial.dispose(); } catch (err) { void err; } this._measurementMaterial = null; }
    
    // remove utility-layer pointer observer if installed
    try {
      if (this._gizmoRotationPointerObs && this._gizmoManager && this._gizmoManager.gizmoLayer && this._gizmoManager.gizmoLayer.utilityLayerScene) {
        try { this._gizmoManager.gizmoLayer.utilityLayerScene.onPointerObservable.remove(this._gizmoRotationPointerObs); } catch (err) { void err; }
      }
    } catch (err) { void err; }
    this._gizmoRotationPointerObs = null;

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

  _clearMeshSelectionVisual(mesh) {
    if (!mesh) return;
    try {
      if (typeof mesh.renderOutline !== "undefined") {
        mesh.renderOutline = false;
      }
      if (typeof mesh.disableEdgesRendering === "function") {
        try { mesh.disableEdgesRendering(); } catch { void 0; }
      }
    } catch { void 0; }
  }

  _applyMeshSelectionVisual(mesh, isPrimary) {
    if (!mesh) return;
    try {
      if (typeof mesh.renderOutline !== "undefined") {
        mesh.renderOutline = true;
        mesh.outlineColor = isPrimary ? new Color3(1.0, 0.62, 0.25) : new Color3(0.36, 0.76, 1.0);
        // thickness adjusted dynamically per-frame to compensate camera zoom
        try { this._updateHighlightThicknessForMesh(mesh, isPrimary); } catch { void 0; }
      } else if (typeof mesh.enableEdgesRendering === "function") {
        try {
          mesh.enableEdgesRendering();
          if (typeof mesh.edgesColor !== "undefined") {
            mesh.edgesColor = isPrimary ? new Color4(1.0, 0.62, 0.25, 1.0) : new Color4(0.36, 0.76, 1.0, 1.0);
            // thickness adjusted dynamically per-frame to compensate camera zoom
            try { this._updateHighlightThicknessForMesh(mesh, isPrimary); } catch { void 0; }
          }
        } catch { void 0; }
      }
    } catch { void 0; }
  }

  _syncGizmoAttachment() {
    try {
      if (!this._gizmoManager) return;
      if (!this._gizmoVisible || this._runtimeEnabled || this._toolMode === "select" || this._toolMode === "cursor" || this._toolMode === "measure") {
        this._gizmoManager.positionGizmoEnabled = false;
        this._gizmoManager.rotationGizmoEnabled = false;
        this._gizmoManager.scaleGizmoEnabled = false;
        try { this._gizmoManager.attachToMesh(null); } catch { void 0; }
        return;
      }

      const attach = this._selectedId ? this.meshMap.get(this._selectedId) : null;
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

      if (attach) {
        try {
          const camRadius = (this.camera && typeof this.camera.radius === "number") ? this.camera.radius : 50;
          const CAM_FACTOR = 0.04;
          let desired = camRadius * CAM_FACTOR;
          let meshRadius = 0;
          try {
            if (typeof attach.getBoundingInfo === "function") {
              const bi = attach.getBoundingInfo();
              if (bi && bi.boundingSphere) meshRadius = bi.boundingSphere.radiusWorld || bi.boundingSphere.radius || 0;
            }
          } catch { void 0; }

          if (meshRadius > 0) desired = Math.min(desired, meshRadius * 0.9);
          const MIN_GIZMO = 0.04;
          const MAX_GIZMO = Math.max(0.12, meshRadius || 0.12);
          const USER_SCALE_FACTOR = 0.5;
          const finalRatio = Math.max(MIN_GIZMO, Math.min(MAX_GIZMO, desired)) * USER_SCALE_FACTOR;
          try { this._gizmoManager.scaleRatio = finalRatio; } catch { void 0; }
        } catch { void 0; }
      }

      if (this._gizmoManager.positionGizmo) {
        try { this._gizmoManager.positionGizmo.snapDistance = this._snapEnabled ? this._snapValue : 0; } catch { void 0; }
      }
    } catch (e) { void e; }
  }

  _applySelectionState(ids = [], activeId = null, source = "unknown", emitCallback = false) {
    const nextIds = new Set(Array.from(ids || []).filter(Boolean));
    const prevIds = this._highlightedIds || new Set();

    for (const id of prevIds) {
      if (!nextIds.has(id)) {
        const prevMesh = this.meshMap.get(id);
        this._clearMeshSelectionVisual(prevMesh);
      }
    }

    this._highlightedIds = nextIds;
    this._selectedId = activeId && nextIds.has(activeId) ? activeId : (nextIds.size ? Array.from(nextIds).at(-1) : null);
    this._selectionSource = source || "unknown";

    for (const id of nextIds) {
      const mesh = this.meshMap.get(id);
      this._applyMeshSelectionVisual(mesh, id === this._selectedId);
    }

    try { this._syncGizmoAttachment(); } catch (e) { void e; }

    if (emitCallback && typeof this.onSelect === "function") {
      try { this.onSelect(this._selectedId, { source: this._selectionSource }); } catch { void 0; }
    }
  }

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

  _snapRotation(rot) {
    if (!this._snapEnabled || !this._snapRotateRad) return rot;
    const s = this._snapRotateRad;
    return { x: Math.round(rot.x / s) * s, y: Math.round(rot.y / s) * s, z: Math.round(rot.z / s) * s };
  }

  _snapScaling(scl) {
    if (!this._snapEnabled || !this._snapScaleValue) return scl;
    const s = this._snapScaleValue;
    return { x: Math.round(scl.x / s) * s, y: Math.round(scl.y / s) * s, z: Math.round(scl.z / s) * s };
  }

  _applySnapToGizmos() {
    try {
      if (!this._gizmoManager) return;
      const move = this._snapEnabled ? (Number(this._snapValue) || 0) : 0;
      const rot = this._snapEnabled ? (Number(this._snapRotateRad) || 0) : 0;
      const scl = this._snapEnabled ? (Number(this._snapScaleValue) || 0) : 0;
      try { if (this._gizmoManager.positionGizmo) this._gizmoManager.positionGizmo.snapDistance = move; } catch (err) { void err; }
      try { if (this._gizmoManager.rotationGizmo) this._gizmoManager.rotationGizmo.snapDistance = rot; } catch (err) { void err; }
      try { if (this._gizmoManager.scaleGizmo) this._gizmoManager.scaleGizmo.snapDistance = scl; } catch (err) { void err; }
    } catch (err) {
      void err;
    }
  }

  setSnapEnabled(enabled) {
    this._snapEnabled = !!enabled;
    this._applySnapToGizmos();
  }

  setSnapValue(v) {
    const val = Math.max(0.0001, Number(v) || 1);
    this._snapValue = val;
    this._applySnapToGizmos();
  }

  setRotateSnapDegrees(deg) {
    const d = Math.max(0.001, Number(deg) || 15);
    this._snapRotateRad = (d * Math.PI) / 180;
    this._applySnapToGizmos();
  }

  setScaleSnapValue(v) {
    const val = Math.max(0.0001, Number(v) || 0.1);
    this._snapScaleValue = val;
    this._applySnapToGizmos();
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
      if (changes.visible !== undefined) meta.visible = changes.visible !== false;
      if (changes.position) Object.assign(meta.position, this._snapPosition(changes.position));
      if (changes.rotation) Object.assign(meta.rotation, this._snapRotation(changes.rotation));
      if (changes.scaling) Object.assign(meta.scaling, this._snapScaling(changes.scaling));
      if (changes.rotation) Object.assign(meta.rotation, changes.rotation);
      if (changes.scaling) Object.assign(meta.scaling, changes.scaling);
      if (changes.material) Object.assign(meta.material, changes.material);
      if (changes.parent !== undefined) meta.parent = changes.parent;
      if (changes.scripts !== undefined) meta.scripts = changes.scripts;
      if (changes.params) meta.params = { ...(meta.params || {}), ...(changes.params || {}) };
      if (changes.material && meta.kind === "model" && meta.params?.importedNode) {
        meta.params = { ...(meta.params || {}), preserveImportedMaterial: false };
      }

      if (changes.scripts !== undefined) this._syncScriptEngineScripts();

      if (this.scene) {
        const mesh = this.meshMap.get(id);
        if (mesh) {
          if (changes.visible !== undefined) {
            try { mesh.setEnabled(meta.visible !== false); } catch (err) { void err; }
            try { mesh.isVisible = meta.visible !== false; } catch (err) { void err; }
          }
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
      this._removeMeshSubtree(id);
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

  setCameraPointerOrbitEnabled(enabled) {
    this._cameraPointerOrbitEnabled = !!enabled;
    try {
      if (!this.camera || !this.camera.inputs || !this.camera.inputs.attached) return;
      const pointers = this.camera.inputs.attached.pointers;
      if (!pointers) return;
      pointers.buttons = this._cameraPointerOrbitEnabled ? [0, 1, 2] : [1, 2];
    } catch (e) { void e; }
  }

  _sanitizeModelToken(value, fallback = "node") {
    const normalized = String(value || fallback)
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return normalized || fallback;
  }

  _inferModelExtension(value) {
    const text = String(value || "").toLowerCase();
    const match = text.match(/\.([a-z0-9]+)(?:$|[?#])/i);
    return match ? `.${match[1]}` : null;
  }

  _normalizeModelSource(params = {}) {
    const source = params?.source;
    const fallbackExtension = params?.extension || null;

    if (typeof source === "string" && source.trim()) {
      return {
        rootUrl: "",
        sceneFilename: source,
        pluginExtension: fallbackExtension || this._inferModelExtension(source),
        label: source,
      };
    }

    if (!source || typeof source !== "object") return null;

    if (typeof source.url === "string" && source.url.trim()) {
      const sceneFilename = source.url;
      return {
        rootUrl: source.rootUrl || "",
        sceneFilename,
        pluginExtension: source.extension || fallbackExtension || this._inferModelExtension(source.fileName || sceneFilename),
        label: source.fileName || sceneFilename,
      };
    }

    if (typeof source.fileName === "string" && source.fileName.trim()) {
      return {
        rootUrl: source.rootUrl || "",
        sceneFilename: source.fileName,
        pluginExtension: source.extension || fallbackExtension || this._inferModelExtension(source.fileName),
        label: source.fileName,
      };
    }

    return null;
  }

  _ensureHiddenRuntimeNode(meta) {
    let mesh = this.meshMap.get(meta.id);
    if (!mesh) {
      mesh = MeshBuilder.CreateBox(meta.id, { size: 0.01 }, this.scene);
      this.meshMap.set(meta.id, mesh);
    }

    mesh.name = meta.name || meta.id;
    try { mesh.position.copyFromFloats(meta.position.x, meta.position.y, meta.position.z); } catch { void 0; }
    try { if (mesh.rotation) mesh.rotation.copyFromFloats(meta.rotation.x, meta.rotation.y, meta.rotation.z); } catch { void 0; }
    try { if (mesh.scaling) mesh.scaling.copyFromFloats(meta.scaling.x, meta.scaling.y, meta.scaling.z); } catch { void 0; }
    try { mesh.isPickable = false; } catch { void 0; }
    try { mesh.visibility = 0; } catch { void 0; }
    try { mesh.alwaysSelectAsActiveMesh = false; } catch { void 0; }
    try { mesh.setEnabled(meta.visible !== false); } catch { void 0; }
    try { mesh.isVisible = false; } catch { void 0; }

    if (meta.parent) {
      const pm = this.meshMap.get(meta.parent);
      if (pm) {
        try { mesh.parent = pm; } catch { void 0; }
      }
    } else {
      try { mesh.parent = null; } catch { void 0; }
    }

    return mesh;
  }

  _collectImportedNodeIds(rootId) {
    const ids = [];
    for (const meta of this.meshMetaMap.values()) {
      if (meta?.kind === "model" && meta?.params?.importedNode && meta?.params?.rootModelId === rootId) {
        ids.push(meta.id);
      }
    }
    return ids;
  }

  _collectImportedModelNodes(container) {
    const ordered = [];
    const seen = new Set();
    const pushAll = (items = []) => {
      for (const item of items) {
        if (!item || seen.has(item)) continue;
        seen.add(item);
        ordered.push(item);
      }
    };

    pushAll(container?.transformNodes || []);
    pushAll(container?.meshes || []);
    return ordered;
  }

  _buildImportedNodeBindings(rootMeta, orderedNodes) {
    const bindings = [];
    const nodeSet = new Set(orderedNodes || []);
    const orderMap = new Map((orderedNodes || []).map((node, index) => [node, index]));
    const childrenByNode = new Map();
    const existingByKey = new Map();

    for (const meta of this.meshMetaMap.values()) {
      if (meta?.kind === "model" && meta?.params?.importedNode && meta?.params?.rootModelId === rootMeta.id && meta?.params?.nodeKey) {
        existingByKey.set(meta.params.nodeKey, meta);
      }
    }

    for (const node of orderedNodes || []) childrenByNode.set(node, []);

    const roots = [];
    for (const node of orderedNodes || []) {
      const parent = node?.parent && nodeSet.has(node.parent) ? node.parent : null;
      if (parent) childrenByNode.get(parent).push(node);
      else roots.push(node);
    }

    const sortNodes = (items) => items.sort((a, b) => (orderMap.get(a) || 0) - (orderMap.get(b) || 0));
    sortNodes(roots);
    for (const items of childrenByNode.values()) sortNodes(items);

    const visit = (node, parentMetaId, keyPrefix = "") => {
      const siblings = parentMetaId === rootMeta.id ? roots : (childrenByNode.get(node.parent) || []);
      const index = Math.max(0, siblings.indexOf(node));
      const label = this._sanitizeModelToken(node?.name || node?.id || `node_${index}`);
      const nodeKey = keyPrefix ? `${keyPrefix}/${index}_${label}` : `${index}_${label}`;

      const existing = existingByKey.get(nodeKey) || null;
      const pos = node?.position ? { x: node.position.x, y: node.position.y, z: node.position.z } : { x: 0, y: 0, z: 0 };
      const rot = node?.rotation ? { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z } : { x: 0, y: 0, z: 0 };
      const scl = node?.scaling ? { x: node.scaling.x, y: node.scaling.y, z: node.scaling.z } : { x: 1, y: 1, z: 1 };

      const meta = existing || createMeta("model", {
        id: `${rootMeta.id}::${nodeKey.replace(/[^a-zA-Z0-9:_-]+/g, "_")}`,
        name: node?.name || node?.id || nodeKey,
        parent: parentMetaId,
        position: pos,
        rotation: rot,
        scaling: scl,
        visible: typeof node?.isEnabled === "function" ? node.isEnabled() : node?.isVisible !== false,
        params: {
          importedNode: true,
          preserveImportedMaterial: true,
          nodeType: node?.getClassName ? node.getClassName() : "Node",
          nodeKey,
          rootModelId: rootMeta.id,
          sourceNodeName: node?.name || node?.id || null,
        },
      });

      if (!existing) {
        this.meshMetaMap.set(meta.id, meta);
      } else {
        meta.parent = parentMetaId;
        meta.params = {
          ...(meta.params || {}),
          importedNode: true,
          preserveImportedMaterial: meta.params?.preserveImportedMaterial !== false,
          nodeType: node?.getClassName ? node.getClassName() : meta.params?.nodeType || "Node",
          nodeKey,
          rootModelId: rootMeta.id,
          sourceNodeName: node?.name || node?.id || meta.params?.sourceNodeName || null,
        };
        if (!meta.name) meta.name = node?.name || node?.id || nodeKey;
      }

      bindings.push({ meta, node, parentMetaId });

      const children = childrenByNode.get(node) || [];
      for (const child of children) visit(child, meta.id, nodeKey);
    };

    for (const rootNode of roots) visit(rootNode, rootMeta.id, "");
    return bindings;
  }

  _syncImportedRuntimeNode(meta, node, parentRuntime) {
    if (!meta || !node) return;

    try { node.id = meta.id; } catch { void 0; }
    try { node.name = meta.name || node.name || meta.id; } catch { void 0; }
    try {
      if (parentRuntime) node.parent = parentRuntime;
      else node.parent = null;
    } catch { void 0; }
    try {
      if (node.position && meta.position) node.position.copyFromFloats(meta.position.x, meta.position.y, meta.position.z);
    } catch { void 0; }
    try {
      if (node.rotation && meta.rotation) node.rotation.copyFromFloats(meta.rotation.x, meta.rotation.y, meta.rotation.z);
    } catch { void 0; }
    try {
      if (node.scaling && meta.scaling) node.scaling.copyFromFloats(meta.scaling.x, meta.scaling.y, meta.scaling.z);
    } catch { void 0; }
    try {
      if (typeof node.setEnabled === "function") node.setEnabled(meta.visible !== false);
      else if (typeof node.isVisible !== "undefined") node.isVisible = meta.visible !== false;
    } catch { void 0; }

    this.meshMap.set(meta.id, node);
  }

  async _loadExternalModel(meta) {
    if (!this.scene || !meta || meta.params?.importedNode) return;
    if (this._modelLoadPromises.has(meta.id)) return this._modelLoadPromises.get(meta.id);

    const run = async () => {
      const source = this._normalizeModelSource(meta.params || {});
      if (!source?.sceneFilename) {
        console.warn("Model import skipped: missing source", meta.id);
        return;
      }

      const rootRuntime = this._ensureHiddenRuntimeNode(meta);

      // Clear prior imported descendants before re-binding a fresh load.
      const priorIds = this._collectImportedNodeIds(meta.id);
      for (const id of priorIds) {
        const runtime = this.meshMap.get(id);
        if (runtime) {
          try { runtime.dispose(); } catch (err) { void err; }
          this.meshMap.delete(id);
        }
        const mat = this.materialMap.get(id);
        if (mat) {
          try { mat.dispose(); } catch (err) { void err; }
          this.materialMap.delete(id);
        }
        const dt = this._textTextureMap.get(id);
        if (dt) {
          try { dt.dispose(); } catch (err) { void err; }
          this._textTextureMap.delete(id);
        }
      }

      const container = await SceneLoader.LoadAssetContainerAsync(
        source.rootUrl || "",
        source.sceneFilename,
        this.scene,
        undefined,
        source.pluginExtension || undefined
      );
      container.addAllToScene();

      const orderedNodes = this._collectImportedModelNodes(container);
      const bindings = this._buildImportedNodeBindings(meta, orderedNodes);
      const runtimeParents = new Map([[meta.id, rootRuntime]]);

      for (const binding of bindings) {
        const parentRuntime = runtimeParents.get(binding.parentMetaId) || rootRuntime;
        this._syncImportedRuntimeNode(binding.meta, binding.node, parentRuntime);
        runtimeParents.set(binding.meta.id, binding.node);
      }

      this._syncScriptEngineScripts();
      if (typeof this._changeCallback === "function") {
        try { this._changeCallback(meta.id); } catch (err) { void err; }
      }
    };

    const promise = run().finally(() => {
      this._modelLoadPromises.delete(meta.id);
    });

    this._modelLoadPromises.set(meta.id, promise);
    return promise;
  }

  _collectSubtreeIds(rootId) {
    if (!rootId) return [];
    const childrenByParent = new Map();
    for (const meta of this.meshMetaMap.values()) {
      const parentId = meta?.parent || null;
      if (!parentId) continue;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(meta.id);
    }

    const out = [];
    const visit = (id) => {
      out.push(id);
      for (const childId of childrenByParent.get(id) || []) visit(childId);
    };
    visit(rootId);
    return out;
  }

  _removeMeshSubtree(rootId) {
    const ids = this._collectSubtreeIds(rootId).reverse();
    let clearedSelection = false;

    for (const id of ids) {
      const mesh = this.meshMap.get(id);
      if (mesh) {
        try { mesh.dispose(); } catch (err) { void err; }
        this.meshMap.delete(id);
      }
      const mat = this.materialMap.get(id);
      if (mat) {
        try { mat.dispose(); } catch (err) { void err; }
        this.materialMap.delete(id);
      }
      const dt = this._textTextureMap.get(id);
      if (dt) {
        try { dt.dispose(); } catch (err) { void err; }
        this._textTextureMap.delete(id);
      }
      this.meshMetaMap.delete(id);
      if (this._selectedId === id) clearedSelection = true;
    }

    if (clearedSelection) this._selectMeshById(null, "api");
    this._syncScriptEngineScripts();
    if (typeof this._changeCallback === "function") {
      try { this._changeCallback(rootId); } catch (err) { void err; }
    }
  }

  _createRuntimeMesh(meta) {
    if (meta.kind === "group") {
      this._ensureHiddenRuntimeNode(meta);
      return;
    }

    if (meta.kind === "model") {
      if (meta.params?.importedNode) return;
      this._ensureHiddenRuntimeNode(meta);
      void this._loadExternalModel(meta);
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
    } else if (meta.kind === "plane") {
      const p = { width: 1, height: 1, ...(meta.params || {}) };
      mesh = MeshBuilder.CreatePlane(meta.id, { width: p.width, height: p.height }, this.scene);
    } else if (meta.kind === "arrow") {
      // Create shaft (cylinder) as main mesh and a cone as head (child)
      const p = { length: 1, shaftDiameter: 0.06, headHeight: 0.18, headDiameter: 0.12, ...(meta.params || {}) };
      const shaftId = meta.id; // use meta.id for main shaft mesh
      mesh = MeshBuilder.CreateCylinder(shaftId, { height: p.length, diameter: p.shaftDiameter, tessellation: 12 }, this.scene);
      try {
        const head = MeshBuilder.CreateCylinder(`${meta.id}-head`, { height: p.headHeight, diameterTop: 0, diameterBottom: p.headDiameter, tessellation: 12 }, this.scene);
        head.parent = mesh;
        head.position.y = p.length / 2 + p.headHeight / 2;
      } catch (err) { void err; }
    } else if (meta.kind === "dome") {
      const p = { diameter: 1, segments: 24, ...(meta.params || {}) };
      mesh = MeshBuilder.CreateSphere(meta.id, { diameter: p.diameter, segments: p.segments }, this.scene);
      try { mesh.scaling.y = 0.5; } catch (err) { void err; }
    } else if (meta.kind === "capsule") {
      const p = { height: 1, radius: 0.25, tessellation: 16, ...(meta.params || {}) };
      // MeshBuilder.CreateCapsule available in modern Babylon; fall back to cylinder if missing
      try {
        if (MeshBuilder.CreateCapsule) mesh = MeshBuilder.CreateCapsule(meta.id, { height: p.height, radius: p.radius, subdivisions: p.tessellation }, this.scene);
        else mesh = MeshBuilder.CreateCylinder(meta.id, { height: p.height, diameter: p.radius * 2, tessellation: p.tessellation }, this.scene);
      } catch (err) { mesh = MeshBuilder.CreateCylinder(meta.id, { height: p.height, diameter: p.radius * 2 }, this.scene); }
    } else if (meta.kind === "tube") {
      const p = { path: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], radius: 0.05, tessellation: 16, ...(meta.params || {}) };
      const pts = (p.path || []).map(pt => new Vector3(pt.x || 0, pt.y || 0, pt.z || 0));
      mesh = MeshBuilder.CreateTube(meta.id, { points: pts, radius: p.radius, tessellation: p.tessellation, updatable: false }, this.scene);
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

    try { mesh.setEnabled(meta.visible !== false); } catch { void 0; }
    try { mesh.isVisible = meta.visible !== false; } catch { void 0; }

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

    if (meta.kind === "model") {
      if (!meta.params?.importedNode) return;
      if (meta.params?.preserveImportedMaterial !== false) return;
    }

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
    this._applySelectionState(id ? [id] : [], id || null, source, true);
  }

  // Public API: allow App to be notified
  setSelectionCallback(fn) { this.onSelect = fn; }

  setHighlightedMeshes(ids = [], activeId = null) {
    this._applySelectionState(ids, activeId, "api", false);
  }

  setPointerPickSelectionSuppressed(suppressed) {
    this._suppressPointerPickSelection = !!suppressed;
  }

  pickMeshIdAt(screenX, screenY) {
    try {
      if (!this.scene) return null;
      const pick = this.scene.pick(
        screenX,
        screenY,
        (m) => {
          if (!m) return false;
          if (this._gridMesh && m === this._gridMesh) return false;
          return m.isPickable !== false;
        }
      );
      if (!pick || !pick.hit || !pick.pickedMesh) return null;
      let mesh = pick.pickedMesh;
      while (mesh && !this.meshMap.has(mesh.id) && mesh.parent) mesh = mesh.parent;
      return (mesh && this.meshMap.has(mesh.id)) ? mesh.id : null;
    } catch (err) {
      void err;
      return null;
    }
  }

  getMeshIdsInScreenRect(x1, y1, x2, y2) {
    try {
      if (!this.scene || !this.engine) return [];
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const top = Math.min(y1, y2);
      const bottom = Math.max(y1, y2);
      const viewport = {
        x: 0,
        y: 0,
        width: this.engine.getRenderWidth(),
        height: this.engine.getRenderHeight(),
      };
      const transform = this.scene.getTransformMatrix();
      const ids = [];

      for (const [id, mesh] of this.meshMap.entries()) {
        if (!mesh || mesh.isVisible === false) continue;
        if (typeof mesh.isEnabled === "function" && !mesh.isEnabled()) continue;
        if (this._gridMesh && mesh === this._gridMesh) continue;
        const bi = typeof mesh.getBoundingInfo === "function" ? mesh.getBoundingInfo() : null;
        const vectors = bi && bi.boundingBox && Array.isArray(bi.boundingBox.vectorsWorld) ? bi.boundingBox.vectorsWorld : null;
        if (!vectors || !vectors.length) continue;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const v of vectors) {
          const projected = Vector3.Project(v, Matrix.Identity(), transform, viewport);
          if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue;
          minX = Math.min(minX, projected.x);
          minY = Math.min(minY, projected.y);
          maxX = Math.max(maxX, projected.x);
          maxY = Math.max(maxY, projected.y);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue;
        const intersects = !(maxX < left || minX > right || maxY < top || minY > bottom);
        if (intersects) ids.push(id);
      }

      return ids;
    } catch (err) {
      void err;
      return [];
    }
  }

  setCursorPoint(point) {
    try {
      if (!point || !this.scene) return false;
      if (!this._cursorMarker) {
        this._cursorMarker = MeshBuilder.CreateSphere(`cursor-${this.id}`, { diameter: 0.35, segments: 10 }, this.scene);
        this._cursorMarker.isPickable = false;
        this._cursorMarkerMaterial = new StandardMaterial(`cursor-mat-${this.id}`, this.scene);
        this._cursorMarkerMaterial.emissiveColor = new Color3(1.0, 0.36, 0.1);
        this._cursorMarkerMaterial.diffuseColor = new Color3(1.0, 0.36, 0.1);
        this._cursorMarkerMaterial.alpha = 0.95;
        this._cursorMarker.material = this._cursorMarkerMaterial;
      }
      try { this._cursorMarker.setEnabled(true); } catch { void 0; }
      try { this._cursorMarker.position.copyFromFloats(Number(point.x) || 0, Number(point.y) || 0, Number(point.z) || 0); } catch { void 0; }
      return true;
    } catch (err) {
      void err;
      return false;
    }
  }

  setMeasurementPoints(points = []) {
    try {
      if (!this.scene) return 0;
      const normalized = Array.isArray(points)
        ? points
            .filter(Boolean)
            .slice(0, 2)
            .map((point) => new Vector3(Number(point.x) || 0, Number(point.y) || 0, Number(point.z) || 0))
        : [];

      if (!this._measurementMaterial) {
        this._measurementMaterial = new StandardMaterial(`measure-mat-${this.id}`, this.scene);
        this._measurementMaterial.emissiveColor = new Color3(0.98, 0.84, 0.24);
        this._measurementMaterial.diffuseColor = new Color3(0.98, 0.84, 0.24);
        this._measurementMaterial.alpha = 0.95;
      }

      while (this._measurementMarkers.length < 2) {
        const marker = MeshBuilder.CreateSphere(`measure-point-${this.id}-${this._measurementMarkers.length}`, { diameter: 0.22, segments: 10 }, this.scene);
        marker.isPickable = false;
        marker.material = this._measurementMaterial;
        this._measurementMarkers.push(marker);
      }

      for (let i = 0; i < this._measurementMarkers.length; i += 1) {
        const marker = this._measurementMarkers[i];
        const point = normalized[i];
        if (!point) {
          try { marker.setEnabled(false); } catch { void 0; }
          continue;
        }
        try { marker.setEnabled(true); } catch { void 0; }
        try { marker.position.copyFrom(point); } catch { void 0; }
      }

      if (normalized.length >= 2) {
        const linePoints = [normalized[0], normalized[1]];
        if (this._measurementLine) {
          try { MeshBuilder.CreateLines(`measure-line-${this.id}`, { points: linePoints, instance: this._measurementLine, updatable: true }); } catch { void 0; }
        } else {
          this._measurementLine = MeshBuilder.CreateLines(`measure-line-${this.id}`, { points: linePoints, updatable: true }, this.scene);
          this._measurementLine.isPickable = false;
          try { this._measurementLine.color = new Color3(0.98, 0.84, 0.24); } catch { void 0; }
        }
        try { this._measurementLine.setEnabled(true); } catch { void 0; }
        return Vector3.Distance(normalized[0], normalized[1]);
      }

      if (this._measurementLine) {
        try { this._measurementLine.setEnabled(false); } catch { void 0; }
      }
      return 0;
    } catch (err) {
      void err;
      return 0;
    }
  }

  clearMeasurement() {
    try {
      for (const marker of this._measurementMarkers) {
        try { marker.setEnabled(false); } catch { void 0; }
      }
      if (this._measurementLine) {
        try { this._measurementLine.setEnabled(false); } catch { void 0; }
      }
    } catch (err) { void err; }
  }

  setViewportToolMode(mode) {
    const next = String(mode || "select").toLowerCase();
    this._toolMode = next;
    if (next === "move") this.setGizmoMode("position");
    else if (next === "rotate") this.setGizmoMode("rotation");
    else if (next === "scale") this.setGizmoMode("scale");
    else this.setGizmoMode("none");
    try { this._syncGizmoAttachment(); } catch (err) { void err; }
  }

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

  importModel(source, opts = {}) {
    const id = opts.id || `model-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const meta = createMeta("model", {
      id,
      name: opts.name || this._sanitizeModelToken(opts.fileName || "model", "model"),
      parent: opts.parent,
      position: opts.position,
      rotation: opts.rotation,
      scaling: opts.scaling,
      visible: opts.visible,
      params: {
        ...(opts.params || {}),
        source,
        extension: opts.extension || this._inferModelExtension(opts.fileName || source?.fileName || source?.url || source),
      },
    });
    this.enqueueCommand({ type: "createMesh", payload: { ...meta } });
    return id;
  }

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
        visible: m.visible !== false,
        position, rotation, scaling,
        material: m.material ? { ...m.material } : null,
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
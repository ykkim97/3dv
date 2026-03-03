// src/App.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { createMeta } from "./babylon/MeshEntities";
import MeshInspector from "./components/MeshInspector.jsx";
import MeshList from "./components/MeshList.jsx";
import MeshPrimitivesToolbar from "./components/MeshPrimitivesToolbar.jsx";
import SceneView from "./components/SceneView.jsx";
import TopBar from "./components/TopBar.jsx";
import { getDemoWasm } from "./wasm/demoWasm";
import ScriptEngine from "./runtime/ScriptEngine";
import ScriptEditorModal from "./components/ScriptEditorModal.jsx";
import { getSceneNameError, normalizeSceneName } from "./utils/sceneName";
import HelpModal from "./components/HelpModal.jsx";
import MeshContextMenu from "./components/MeshContextMenu.jsx";
import MeshPropertiesModal from "./components/MeshPropertiesModal.jsx";
import RenameModal from "./components/RenameModal.jsx";
import { LANGS, makeT } from "./i18n";

function downloadJSON(obj, filename = "scene.json") {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function App() {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem("lumatrix-lang");
      if (saved === LANGS.ko || saved === LANGS.en) return saved;
    } catch (err) { void err; }
    return LANGS.ko;
  });

  useEffect(() => {
    try { localStorage.setItem("lumatrix-lang", lang); } catch (err) { void err; }
  }, [lang]);

  const t = useMemo(() => makeT(lang), [lang]);

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("lumatrix-theme");
      if (saved === "light" || saved === "dark") return saved;
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      }
    } catch (err) { void err; }
    return "dark";
  });

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("lumatrix-theme", theme);
    } catch (err) { void err; }
  }, [theme]);

  const [scenes, setScenes] = useState([]);
  const [currentSceneId, setCurrentSceneId] = useState(null);
  const [newName, setNewName] = useState("");

  const sceneNameError = useMemo(() => getSceneNameError(newName), [newName]);
  const canCreateScene = !sceneNameError;

  const [sceneInstances, setSceneInstances] = useState(() => new Map());
  const [selectedMeshId, setSelectedMeshId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [, forceRerender] = useState(0);

  // Undo / Redo stacks (store simple records)
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const [leftTab, setLeftTab] = useState("scenes"); // 'scenes' | 'meshes'
  const [scenesCollapsed, setScenesCollapsed] = useState(false);
  const [meshesCollapsed, setMeshesCollapsed] = useState(false);

  // grid visibility
  const [gridVisible, setGridVisible] = useState(true);
  // axes visibility
  const [axesVisible, setAxesVisible] = useState(true);
  // gizmo visibility state (moved up to avoid TDZ when used in callbacks)
  const [gizmoVisible, setGizmoVisible] = useState(true);
  const gizmoVisibleBeforeRuntimeRef = useRef(null);
  // scene header visibility (toggle without re-creating the scene)
  const [sceneHeaderVisible, setSceneHeaderVisible] = useState(true);

  // Mode: edit vs runtime
  const [runtimeMode, setRuntimeMode] = useState(false);

  // Mesh placement mode: click a primitive, then click in the viewport to place it.
  const [armedCreateKind, setArmedCreateKind] = useState(null);

  // Script editor modal state
  const [scriptEditorOpen, setScriptEditorOpen] = useState(false);
  const [scriptEditorMeshId, setScriptEditorMeshId] = useState(null);

  const [showHelp, setShowHelp] = useState(false);

  const [meshCtx, setMeshCtx] = useState(null); // { meshId, x, y }
  const [meshPropsOpen, setMeshPropsOpen] = useState(false);
  const [meshPropsId, setMeshPropsId] = useState(null);
  const [meshRenameOpen, setMeshRenameOpen] = useState(false);
  const [meshRenameId, setMeshRenameId] = useState(null);

  const createScene = () => {
    const err = getSceneNameError(newName);
    if (err) return;
    const id = `scene-${Date.now()}`;
    const sceneMeta = { id, name: normalizeSceneName(newName), json: null };
    setScenes((s) => [...s, sceneMeta]);
    setNewName("");
    setCurrentSceneId(id);
  };

  const getCurrentInstance = () => sceneInstances.get(currentSceneId);

  const openScriptEditor = (meshId) => {
    if (!meshId) return;
    setScriptEditorMeshId(meshId);
    setScriptEditorOpen(true);
  };

  const closeScriptEditor = () => {
    setScriptEditorOpen(false);
  };

  const handleSceneReady = useCallback(
    (sceneId, sp) => {
      // store instance
      setSceneInstances((prev) => {
        const next = new Map(prev);
        next.set(sceneId, sp);
        return next;
      });

      // register selection callback (scene -> app)
      sp.setSelectionCallback((id) => {
        setSelectedMeshId(id);
        // keep selectedIds in sync: if single select done in scene, set that as single selection
        setSelectedIds(new Set(id ? [id] : []));
        forceRerender((n) => n + 1);
      });

      // register runtime-change callback so gizmo-driven transforms update the UI
      if (typeof sp.setChangeCallback === 'function') {
        sp.setChangeCallback(() => {
          // if inspector currently showing this mesh, force an update
          forceRerender((n) => n + 1);
        });
      }

      // prevent camera from responding to keyboard arrows (we use arrows for mesh nudge)
      try { if (typeof sp.setCameraKeyboardEnabled === 'function') sp.setCameraKeyboardEnabled(false); } catch (err) { void err; }

      // apply current grid/axes/gizmo visibility to scene
      sp.setGridVisible(gridVisible);
      sp.setAxesVisible(axesVisible);
      if (typeof sp.setGizmoVisible === 'function') sp.setGizmoVisible(runtimeMode ? false : gizmoVisible);

      // inject WASM exports into SceneProject (optional; safe if WASM fails)
      try {
        getDemoWasm()
          .then((wasm) => {
            try { if (sp && typeof sp.setWasm === "function") sp.setWasm(wasm); } catch (err) { void err; }
          })
          .catch((err) => { void err; });
      } catch (err) { void err; }

      // inject script engine (Worker sandbox)
      try {
        const eng = scriptEngineRef.current;
        if (sp && typeof sp.setScriptEngine === "function") sp.setScriptEngine(eng);
      } catch (err) { void err; }

      // apply current mode
      try { if (sp && typeof sp.setRuntimeEnabled === "function") sp.setRuntimeEnabled(runtimeMode); } catch (err) { void err; }

      forceRerender((n) => n + 1);
    },
    [gridVisible, axesVisible, gizmoVisible, runtimeMode]
  );

  const toggleAxes = () => {
    const next = !axesVisible;
    setAxesVisible(next);
    const inst = getCurrentInstance();
    if (inst) inst.setAxesVisible(next);
  };

  const toggleGizmo = () => {
    if (runtimeMode) return;
    const next = !gizmoVisible;
    setGizmoVisible(next);
    const inst = getCurrentInstance();
    if (inst && typeof inst.setGizmoVisible === 'function') inst.setGizmoVisible(next);
  };

  // In runtime mode, gizmo should be forcibly disabled.
  useEffect(() => {
    const inst = sceneInstances.get(currentSceneId);
    if (runtimeMode) {
      if (gizmoVisibleBeforeRuntimeRef.current === null) gizmoVisibleBeforeRuntimeRef.current = gizmoVisible;
      if (gizmoVisible) setGizmoVisible(false);
      try { if (inst && typeof inst.setGizmoVisible === 'function') inst.setGizmoVisible(false); } catch (err) { void err; }
    } else {
      const restore = gizmoVisibleBeforeRuntimeRef.current;
      if (restore !== null && restore !== gizmoVisible) {
        setGizmoVisible(restore);
        try { if (inst && typeof inst.setGizmoVisible === 'function') inst.setGizmoVisible(restore); } catch (err) { void err; }
      }
      gizmoVisibleBeforeRuntimeRef.current = null;
    }
  }, [runtimeMode, currentSceneId, sceneInstances, gizmoVisible]);

  const saveSceneToJSON = (id) => {
    const instance = sceneInstances.get(id);
    if (!instance) {
      alert("Scene not ready or missing");
      return;
    }
    const json = instance.serialize();
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, json } : s)));
    downloadJSON(json, `${json.name || id}.json`);
  };

  const switchScene = (id) => {
    if (id === currentSceneId) return;
    const prev = sceneInstances.get(currentSceneId);
    if (prev) {
      const json = prev.serialize();
      setScenes((prevArr) => prevArr.map((s) => (s.id === currentSceneId ? { ...s, json } : s)));
      prev.detachAndShutdown();
    }
    setSelectedMeshId(null);
    setCurrentSceneId(id);
  };

  const deleteScene = (id) => {
    const inst = sceneInstances.get(id);
    if (inst) {
      try {
        inst.disposeCompletely();
      } catch (err) { void err; }
      setSceneInstances((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
    setScenes((s) => s.filter((sc) => sc.id !== id));
    if (currentSceneId === id) setCurrentSceneId(null);
  };

  // Create mesh with deterministic id/name; initially always top-level (no parent)
  const addMeshToCurrent = (kind, positionOverride = null) => {
    const inst = getCurrentInstance();
    if (!inst) {
      alert("Scene not initialized in view. Click the scene to open it.");
      return;
    }
    const id = `${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const name = `${kind}-${Math.floor(Math.random() * 1000)}`;
    const parent = null;
    const position = positionOverride
      ? { x: Number(positionOverride.x) || 0, y: Number(positionOverride.y) || 0, z: Number(positionOverride.z) || 0 }
      : undefined;
    const meta = createMeta(kind, { id, name, parent, position });
    inst.enqueueCommand({ type: "createMesh", payload: { ...meta } });

    undoStack.current.push({
      undo: () => {
        const i = getCurrentInstance();
        if (i) i.enqueueCommand({ type: "removeMesh", payload: { id } });
      },
      redo: () => {
        const i = getCurrentInstance();
        if (i) i.enqueueCommand({ type: "createMesh", payload: { ...meta } });
      },
    });
    redoStack.current.length = 0;

    setTimeout(() => {
      const i = getCurrentInstance();
      if (i) {
        i.highlightMesh(id);
      }
      setSelectedMeshId(id);
      forceRerender((n) => n + 1);
    }, 60);
  };

  const _mergeSelected = () => {
    const inst = getCurrentInstance();
    if (!inst) {
      alert("No scene active");
      return;
    }
    if (!selectedIds || selectedIds.size < 2) {
      alert("Select at least two meshes to merge");
      return;
    }
    const mergedIds = Array.from(selectedIds);
    const id = `merged-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const name = `Group-${Math.floor(Math.random() * 1000)}`;
    const meta = createMeta("merged", { id, name, params: { mergedIds } });

    inst.enqueueCommand({ type: "createMesh", payload: { ...meta } });

    // push undo/redo entry (split will restore)
    undoStack.current.push({
      undo: () => {
        const i = getCurrentInstance();
        if (i) i.enqueueCommand({ type: "splitMerged", payload: { id } });
      },
      redo: () => {
        const i = getCurrentInstance();
        if (i) i.enqueueCommand({ type: "createMesh", payload: { ...meta } });
      }
    });
    redoStack.current.length = 0;

    // clear selection and select the new group
    setSelectedIds(new Set());
    setSelectedMeshId(id);
    setTimeout(() => forceRerender(n => n + 1), 60);
  };

  const groupSelected = () => {
    const inst = getCurrentInstance();
    if (!inst) return;
    const raw = Array.from(selectedIds || []);
    if (raw.length < 2) return;

    // avoid grouping an existing group node as a child
    const childIds = raw.filter((id) => {
      const m = inst.getMeta ? inst.getMeta(id) : null;
      return m && m.kind !== "group";
    });
    if (childIds.length < 2) return;

    const id = `group-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const name = `Group-${Math.floor(Math.random() * 1000)}`;

    inst.enqueueCommand({ type: "groupMeshes", payload: { id, name, childIds } });

    // basic undo/redo (best-effort)
    undoStack.current.push({
      undo: () => {
        const i = getCurrentInstance();
        if (i) i.enqueueCommand({ type: "ungroup", payload: { id } });
      },
      redo: () => {
        const i = getCurrentInstance();
        if (i) i.enqueueCommand({ type: "groupMeshes", payload: { id, name, childIds } });
      },
    });
    redoStack.current.length = 0;

    setSelectedIds(new Set([id]));
    setSelectedMeshId(id);
    setTimeout(() => {
      const i = getCurrentInstance();
      if (i) i.highlightMesh(id);
      forceRerender((n) => n + 1);
    }, 60);
  };

  const ungroupById = (id) => {
    const inst = getCurrentInstance();
    if (!inst || !id) return;
    inst.enqueueCommand({ type: "ungroup", payload: { id } });
    setSelectedMeshId(null);
    setSelectedIds(new Set());
    setTimeout(() => forceRerender((n) => n + 1), 40);
  };

  const onUnmerge = (id) => {
    const inst = getCurrentInstance();
    if (!inst) return;
    inst.enqueueCommand({ type: "splitMerged", payload: { id } });
    setSelectedMeshId(null);
    setSelectedIds(new Set());
    setTimeout(() => forceRerender(n => n + 1), 30);
    // optionally push undo/redo if desired
  };

  const deleteMeshFromScene = (id) => {
    const inst = getCurrentInstance();
    if (!inst) return;
    const meta = inst.getMeta ? inst.getMeta(id) : null;
    inst.enqueueCommand({ type: "removeMesh", payload: { id } });
    setSelectedMeshId(null);

    if (meta) {
      undoStack.current.push({
        undo: () => {
          const i = getCurrentInstance();
          if (i) i.enqueueCommand({ type: "createMesh", payload: { ...meta } });
        },
        redo: () => {
          const i = getCurrentInstance();
          if (i) i.enqueueCommand({ type: "removeMesh", payload: { id } });
        },
      });
      redoStack.current.length = 0;
    }

    setTimeout(() => forceRerender((n) => n + 1), 40);
  };

    const onMeshSelect = (id, ev) => {
      setSelectedMeshId(id);
      if (ev && (ev.ctrlKey || ev.metaKey)) {
        // toggle in selectedIds
        setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      } else {
        setSelectedIds(new Set(id ? [id] : []));
      }
      const inst = getCurrentInstance();
      if (inst) inst.highlightMesh(id);
      forceRerender((n) => n + 1);
    };

  const openMeshContextMenu = (meshId, ev) => {
    try {
      if (!meshId) return;
      if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
      try {
        // Right-click should not destroy an existing multi-selection.
        if (!(selectedIds && selectedIds.size > 1 && selectedIds.has(meshId))) {
          onMeshSelect(meshId, ev);
        }
      } catch (err) { void err; }
      const x = ev?.clientX ?? 0;
      const y = ev?.clientY ?? 0;
      setMeshCtx({ meshId, x, y });
    } catch (err) {
      void err;
    }
  };

  const closeMeshContextMenu = () => setMeshCtx(null);

  const moveMeshesToGroup = (ids, groupId) => {
    const inst = getCurrentInstance();
    if (!inst) return;
    const list = Array.isArray(ids) ? ids : [];
    if (!groupId || !list.length) return;
    for (const id of list) {
      if (!id || id === groupId) continue;
      inst.enqueueCommand({ type: "updateMesh", payload: { id, changes: { parent: groupId } } });
    }
    setTimeout(() => forceRerender((n) => n + 1), 30);
  };

  const openMeshProperties = (meshId) => {
    setMeshPropsId(meshId);
    setMeshPropsOpen(true);
  };

  const openMeshRename = (meshId) => {
    setMeshRenameId(meshId);
    setMeshRenameOpen(true);
  };

  const onInspectorChange = (updatedMeta) => {
    const inst = getCurrentInstance();
    if (!inst) return;
    const prevMeta = inst.getMeta ? inst.getMeta(updatedMeta.id) : null;

    const changes = {
      position: updatedMeta.position,
      rotation: updatedMeta.rotation,
      scaling: updatedMeta.scaling,
      name: updatedMeta.name,
      material: updatedMeta.material,
      parent: updatedMeta.parent,
      params: updatedMeta.params,
    };
    inst.enqueueCommand({ type: "updateMesh", payload: { id: updatedMeta.id, changes } });

    if (prevMeta) {
      undoStack.current.push({
        undo: () => {
          const i = getCurrentInstance();
          if (i)
            i.enqueueCommand({
              type: "updateMesh",
              payload: {
                id: prevMeta.id,
                changes: {
                  position: prevMeta.position,
                  rotation: prevMeta.rotation,
                  scaling: prevMeta.scaling,
                  name: prevMeta.name,
                  material: prevMeta.material,
                  parent: prevMeta.parent,
                  params: prevMeta.params,
                },
              },
            });
        },
        redo: () => {
          const i = getCurrentInstance();
          if (i) i.enqueueCommand({ type: "updateMesh", payload: { id: updatedMeta.id, changes } });
        },
      });
      redoStack.current.length = 0;
    }

    setTimeout(() => forceRerender((n) => n + 1), 20);
  };

  const undo = () => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    try {
      entry.undo();
      redoStack.current.push(entry);
      setTimeout(() => forceRerender((n) => n + 1), 50);
    } catch (err) {
      console.error("Undo error:", err);
    }
  };
  const redo = () => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    try {
      entry.redo();
      undoStack.current.push(entry);
      setTimeout(() => forceRerender((n) => n + 1), 50);
    } catch (err) {
      console.error("Redo error:", err);
    }
  };

  // nudge helper: safely update selected mesh position
  const nudgeSelectedMesh = (dx, dy, dz) => {
    try {
      const id = selectedMeshId;
      if (!id) return;
      const inst = getCurrentInstance();
      if (!inst) return;
      const meta = inst.getMeta ? inst.getMeta(id) : null;
      if (!meta) return;
      const newPos = { x: (meta.position?.x || 0) + (dx || 0), y: (meta.position?.y || 0) + (dy || 0), z: (meta.position?.z || 0) + (dz || 0) };
      inst.enqueueCommand({ type: 'updateMesh', payload: { id, changes: { position: newPos } } });
      // trigger UI update
      forceRerender(n => n + 1);
    } catch (err) { console.error('nudgeSelectedMesh error', err); }
  };

  useEffect(() => {
    if (runtimeMode) return;
    const onKey = (e) => {
      // ignore shortcuts when typing in inputs/selects/textareas
      try {
        const tg = e.target;
        const tag = tg && tg.tagName && tg.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (tg && tg.isContentEditable)) return;
      } catch (err) { void err; }

      // movement shortcuts: Arrow / PageUp/PageDown
      try {
        const baseStep = e.shiftKey ? 0.1 : (e.altKey ? 2 : 0.5);
        if (!e.ctrlKey && !e.metaKey) {
          let handled = false;
          if (e.key === 'ArrowLeft') {
            nudgeSelectedMesh(-baseStep, 0, 0);
            handled = true;
          } else if (e.key === 'ArrowRight') {
            nudgeSelectedMesh(baseStep, 0, 0);
            handled = true;
          } else if (e.key === 'ArrowUp') {
            nudgeSelectedMesh(0, 0, -baseStep);
            handled = true;
          } else if (e.key === 'ArrowDown') {
            nudgeSelectedMesh(0, 0, baseStep);
            handled = true;
          } else if (e.key === 'PageUp') {
            nudgeSelectedMesh(0, baseStep, 0);
            handled = true;
          } else if (e.key === 'PageDown') {
            nudgeSelectedMesh(0, -baseStep, 0);
            handled = true;
          }
          if (handled) {
            e.preventDefault();
            return;
          }
        }
      } catch (err) { console.error('nudge error', err); }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedMeshId) {
          deleteMeshFromScene(selectedMeshId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runtimeMode, selectedMeshId, deleteMeshFromScene, nudgeSelectedMesh, undo, redo]);

  const toggleGrid = () => {
    const next = !gridVisible;
    setGridVisible(next);
    const inst = getCurrentInstance();
    if (inst) inst.setGridVisible(next);
  };

  const canToggleRuntime = !!currentSceneId;

  const toggleRuntimeMode = () => {
    if (!canToggleRuntime) return;
    setRuntimeMode((prev) => {
      const next = !prev;
      const inst = getCurrentInstance();
      try { if (inst && typeof inst.setRuntimeEnabled === "function") inst.setRuntimeEnabled(next); } catch (err) { void err; }
      return next;
    });
  };

  const currentScene = scenes.find((s) => s.id === currentSceneId);
  const currentInstance = sceneInstances.get(currentSceneId);
  const meshList = currentInstance ? currentInstance.getMeshMetaList() : currentScene?.json?.meshes || [];
  const selectedMeshMeta = meshList ? meshList.find((m) => m.id === selectedMeshId) : null;
  const scriptEditorMeshMeta = meshList ? meshList.find((m) => m.id === scriptEditorMeshId) : null;
  const meshPropsMeta = meshList ? meshList.find((m) => m.id === meshPropsId) : null;
  const meshRenameMeta = meshList ? meshList.find((m) => m.id === meshRenameId) : null;
  const [isDragOver, setIsDragOver] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState(null);
  const [importFileName, setImportFileName] = useState("");
  const [importTarget, setImportTarget] = useState("new"); // 'new' | 'replace'
  const [importDebug, setImportDebug] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // If scene is cleared/unselected, force runtime off and cancel placement.
  useEffect(() => {
    if (!currentSceneId) {
      if (runtimeMode) setRuntimeMode(false);
      if (armedCreateKind) setArmedCreateKind(null);
    }
  }, [currentSceneId, runtimeMode, armedCreateKind]);

  // Cancel placement when switching scenes.
  useEffect(() => {
    setArmedCreateKind(null);
  }, [currentSceneId]);

  const fileInputRef = useRef(null);

  // Script engine (Worker) shared across scenes.
  const scriptEngineRef = useRef(null);
  useEffect(() => {
    scriptEngineRef.current = new ScriptEngine({ timeoutMs: 800 });
    return () => {
      try { scriptEngineRef.current?.dispose(); } catch (err) { void err; }
      scriptEngineRef.current = null;
    };
  }, []);

  // WASM demo: load once on app start.
  useEffect(() => {
    let cancelled = false;
    getDemoWasm()
      .then((wasm) => {
        if (cancelled) return;
        try {
          // eslint-disable-next-line no-console
          console.log("[wasm] demo add(40,2) =", wasm.add(40, 2));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[wasm] demo call failed", err);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[wasm] failed to load", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time data polling (runtime mode only): fetch JSON once per second and push into script engine.
  // Backend should be an API gateway to your DB (browser should not connect to DB directly).
  useEffect(() => {
    if (!runtimeMode) return;
    const inst = currentInstance;
    const engine = scriptEngineRef.current;
    if (!inst || !engine) return;

    const endpoint = import.meta.env.VITE_DATA_ENDPOINT || "/api/data";
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(endpoint, { headers: { "accept": "application/json" } });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        engine.setData(data);
      } catch (err) {
        void err;
      }
    };

    tick();
    const t = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [runtimeMode, currentSceneId, currentInstance]);

  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  const handleImportFile = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        setImportJson(json);
        setImportFileName(f.name || "import.json");
        setImportTarget(currentSceneId ? "replace" : "new");
        setShowImportModal(true);
      } catch (err) {
        console.error(err);
        alert("Failed to parse JSON file. Make sure it's a valid scene export.");
      }
    };
    reader.readAsText(f);
  };

  const handleDrop = (ev) => {
    ev.preventDefault();
    setIsDragOver(false);
    const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!f) return;
    if (!/\.json$/i.test(f.name)) {
      alert("Please drop a JSON file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        setImportJson(json);
        setImportFileName(f.name || "import.json");
        setImportTarget(currentSceneId ? "replace" : "new");
        setShowImportModal(true);
      } catch (err) {
        console.error(err);
        alert("Failed to parse JSON file. Make sure it's a valid scene export.");
      }
    };
    reader.readAsText(f);
  };

  const applyImport = () => {
    if (!importJson) return;
    const json = importJson;
    const id = json.id || `scene-import-${Date.now()}`;
    const name = json.name || importFileName.replace(/\.[^/.]+$/, "") || `Imported Scene`;

    if (importDebug) console.log("applyImport called", { importTarget, importFileName, currentSceneId, jsonMeshes: (json.meshes || []).length });

    if (importTarget === "replace") {
      // Replace meshes of current scene (if instance attached), otherwise replace stored scene JSON
      if (currentSceneId) {
        const inst = sceneInstances.get(currentSceneId);
        if (inst) {
          const importedMeshes = Array.isArray(json.meshes) ? json.meshes : [];
          // remove all existing meshes then create imported ones for a clean replace
          try {
            const existing = inst.getMeshMetaList();
            for (const m of existing) {
              inst.enqueueCommand({ type: "removeMesh", payload: { id: m.id } });
            }
          } catch { void 0; }
          for (const m of importedMeshes) {
            const payload = { kind: m.kind, params: m.params, position: m.position, rotation: m.rotation, scaling: m.scaling, id: m.id, name: m.name || m.id, material: m.material, parent: m.parent, scripts: m.scripts };
            inst.enqueueCommand({ type: "createMesh", payload });
          }

          // update scenes[] json for persistence
          const scenesCopy = [...scenes];
          const sceneIndex = scenesCopy.findIndex(s => s.id === currentSceneId);
          if (sceneIndex >= 0) {
            scenesCopy[sceneIndex] = { ...scenesCopy[sceneIndex], json: { ...(scenesCopy[sceneIndex].json || {}), meshes: importedMeshes } };
            setScenes(scenesCopy);
          }
        } else {
          // instance not attached: update stored scene JSON directly
          const importedMeshes = Array.isArray(json.meshes) ? json.meshes : [];
          const scenesCopy = [...scenes];
          const sceneIndex = scenesCopy.findIndex(s => s.id === currentSceneId);
          if (sceneIndex >= 0) {
            scenesCopy[sceneIndex] = { ...scenesCopy[sceneIndex], json: { ...(scenesCopy[sceneIndex].json || {}), meshes: importedMeshes } };
            setScenes(scenesCopy);
          } else {
            const sceneMeta = { id, name, json };
            setScenes((prev) => [...prev, sceneMeta]);
            setCurrentSceneId(id);
          }
        }
      } else {
        // no current scene: add as new
        const sceneMeta = { id, name, json };
        setScenes((prev) => [...prev, sceneMeta]);
        setCurrentSceneId(id);
      }
    } else {
      // default: add as new scene
      const sceneMeta = { id, name, json };
      setScenes((prev) => [...prev, sceneMeta]);
      setCurrentSceneId(id);
    }

    setShowImportModal(false);
    setImportJson(null);
    setImportFileName("");
  };

  const cancelImport = () => {
    setShowImportModal(false);
    setImportJson(null);
    setImportFileName("");
  };

  const handleDragOver = (ev) => {
    ev.preventDefault();
  };

  const handleDragEnter = (ev) => { ev.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (ev) => { ev.preventDefault(); setIsDragOver(false); };

  return (
    <div
      className="app-shell"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <ScriptEditorModal
        open={scriptEditorOpen}
        meshMeta={scriptEditorMeshMeta}
        onClose={closeScriptEditor}
        onSave={(scripts) => {
          const inst = getCurrentInstance();
          if (!inst || !scriptEditorMeshId) {
            closeScriptEditor();
            return;
          }
          inst.enqueueCommand({ type: "updateMesh", payload: { id: scriptEditorMeshId, changes: { scripts } } });
          closeScriptEditor();
          setTimeout(() => forceRerender((n) => n + 1), 30);
        }}
      />
      <TopBar
        onToggleGrid={toggleGrid}
        gridVisible={gridVisible}
        onToggleHeader={() => setSceneHeaderVisible(v => !v)}
        headerVisible={sceneHeaderVisible}
        onImport={triggerImport}
        onToggleGizmo={toggleGizmo}
        gizmoVisible={gizmoVisible}
        onShowShortcuts={() => setShowShortcuts(true)}
        onShowHelp={() => setShowHelp(true)}
        runtimeMode={runtimeMode}
        onToggleRuntimeMode={toggleRuntimeMode}
        runtimeDisabled={!canToggleRuntime}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        lang={lang}
        onToggleLang={() => setLang((p) => (p === LANGS.ko ? LANGS.en : LANGS.ko))}
        t={t}
      />

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} t={t} />

      <MeshContextMenu
        open={!!meshCtx}
        x={meshCtx?.x || 0}
        y={meshCtx?.y || 0}
        onClose={closeMeshContextMenu}
        t={t}
        onFrame={() => {
          const id = meshCtx?.meshId;
          const inst = getCurrentInstance();
          try { if (inst && typeof inst.frameMesh === "function") inst.frameMesh(id); } catch (err) { void err; }
        }}
        onOpenProperties={() => {
          const id = meshCtx?.meshId;
          if (id) openMeshProperties(id);
        }}
        onRename={() => {
          const id = meshCtx?.meshId;
          if (id) openMeshRename(id);
        }}
        onDelete={() => {
          const id = meshCtx?.meshId;
          if (id) deleteMeshFromScene(id);
        }}
        canGroup={(selectedIds && selectedIds.size >= 2)}
        canUngroup={(() => {
          const id = meshCtx?.meshId;
          const inst = getCurrentInstance();
          const m = (id && inst && typeof inst.getMeta === "function") ? inst.getMeta(id) : null;
          return !!(m && m.kind === "group");
        })()}
        onGroup={() => groupSelected()}
        onUngroup={() => {
          const id = meshCtx?.meshId;
          if (id) ungroupById(id);
        }}
      />

      <MeshPropertiesModal
        open={meshPropsOpen}
        meshMeta={meshPropsMeta}
        onClose={() => { setMeshPropsOpen(false); setMeshPropsId(null); }}
      />

      <RenameModal
        open={meshRenameOpen}
        title="Rename Mesh"
        initialValue={meshRenameMeta?.name || ""}
        onClose={() => { setMeshRenameOpen(false); setMeshRenameId(null); }}
        onSubmit={(nextName) => {
          const id = meshRenameId;
          const inst = getCurrentInstance();
          if (!id || !inst) return;
          try {
            inst.enqueueCommand({ type: "updateMesh", payload: { id, changes: { name: nextName } } });
          } catch (err) {
            void err;
          }
          setMeshRenameOpen(false);
          setMeshRenameId(null);
        }}
      />

      <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportFile} />
      <div className="app-body">
        {isDragOver && (
          <div className="overlay" style={{ zIndex: 60, pointerEvents: "none" }}>
            <div className="modal" style={{ width: 560, pointerEvents: "auto" }}>
              Drop JSON file to import. (OK = Overwrite current scene, Cancel = Add as new scene)
            </div>
          </div>
        )}
        {showImportModal && (
          <div className="overlay overlay-backdrop" style={{ zIndex: 120 }}>
            <div className="modal" style={{ width: 520 }}>
              <div className="modal-header">
                <h3 className="modal-title">Import Scene</h3>
                <button className="btn btn-ghost" type="button" onClick={cancelImport} aria-label="Close">✕</button>
              </div>

              <div className="modal-sub">File: {importFileName}</div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ display: "block", marginBottom: 6 }}>Upload action</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <label><input type="radio" name="importTarget" checked={importTarget === 'new'} onChange={() => setImportTarget('new')} /> Add as new scene</label>
                        <label><input type="radio" name="importTarget" checked={importTarget === 'replace'} onChange={() => setImportTarget('replace')} /> Replace current scene</label>
                      </div>
                    </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={importDebug} onChange={(e) => setImportDebug(e.target.checked)} />
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Verbose import logging</span>
                </label>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" type="button" onClick={cancelImport}>Cancel</button>
                <button className="btn btn-primary" type="button" onClick={applyImport}>Import</button>
              </div>
            </div>
          </div>
        )}
        {showShortcuts && (
          <div className="overlay overlay-backdrop" style={{ zIndex: 140 }}>
            <div className="modal" style={{ width: 560 }}>
              <div className="modal-header">
                <h3 className="modal-title">Keyboard Shortcuts</h3>
                <button className="btn btn-ghost" type="button" onClick={() => setShowShortcuts(false)} aria-label="Close">✕</button>
              </div>
              <div className="modal-sub">
                Use keyboard to quickly move and edit selected mesh. Focus must not be inside an input.
              </div>
              <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', color: 'var(--text)' }}>
                <tbody>
                  <tr><td style={{ padding: 8, width: 220 }}>Arrow Left / Right</td><td style={{ padding: 8 }}>Move selected mesh along X axis (- / +)</td></tr>
                  <tr><td style={{ padding: 8 }}>Arrow Up / Down</td><td style={{ padding: 8 }}>Move selected mesh along Z axis (forward / back)</td></tr>
                  <tr><td style={{ padding: 8 }}>PageUp / PageDown</td><td style={{ padding: 8 }}>Move selected mesh along Y axis (up / down)</td></tr>
                  <tr><td style={{ padding: 8 }}>Shift + Arrow</td><td style={{ padding: 8 }}>Fine movement (small step)</td></tr>
                  <tr><td style={{ padding: 8 }}>Alt + Arrow</td><td style={{ padding: 8 }}>Large step movement</td></tr>
                  <tr><td style={{ padding: 8 }}>Delete / Backspace</td><td style={{ padding: 8 }}>Delete selected mesh</td></tr>
                  <tr><td style={{ padding: 8 }}>Ctrl/Cmd + Z</td><td style={{ padding: 8 }}>Undo</td></tr>
                  <tr><td style={{ padding: 8 }}>Ctrl/Cmd + Y or Shift+Ctrl/Cmd + Z</td><td style={{ padding: 8 }}>Redo</td></tr>
                </tbody>
              </table>
              <div className="modal-actions">
                <button className="btn btn-primary" type="button" onClick={() => setShowShortcuts(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
        {/* LEFT: Icon bar + panel (refactored) */}
        {!runtimeMode && (
        <aside className="sidebar" role="complementary" aria-label="Left sidebar">
          <div className="sidebar-icons" aria-hidden>
            <button title="Scenes" type="button" onClick={() => setLeftTab("scenes")} className={`icon-btn ${leftTab === "scenes" ? "active" : ""}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M3.5 6.5h6l2 2H20a1.5 1.5 0 0 1 1.5 1.5v8A2.5 2.5 0 0 1 19 20.5H5A2.5 2.5 0 0 1 2.5 18V8A1.5 1.5 0 0 1 4 6.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
            </button>
            <button title="Meshes" type="button" onClick={() => setLeftTab("meshes")} className={`icon-btn ${leftTab === "meshes" ? "active" : ""}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2L12 2.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M4 7.2l8 4.4 8-4.4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M12 11.6v9.6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="sidebar-panel">
            {leftTab === "scenes" ? (
              <>
                <div className="panel-header">
                  <h2>{t("panel.scenes")}</h2>
                  <div className="panel-controls">
                    <button onClick={() => setScenesCollapsed((v) => !v)} title={scenesCollapsed ? "Expand" : "Collapse"}>
                      {scenesCollapsed ? "▸" : "▾"}
                    </button>
                  </div>
                </div>

                {!scenesCollapsed && (
                  <>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input
                          placeholder="scene name (A-Z, 0-9, space, _, -)"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="input"
                          style={{ width: "100%" }}
                          aria-invalid={!!sceneNameError}
                        />
                        {sceneNameError ? (
                          <div style={{ marginTop: 6, fontSize: 11, color: "var(--warn)", fontWeight: 700 }}>
                            {sceneNameError}
                          </div>
                        ) : (
                          <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                            씬 이름은 필수이며, 한글은 사용할 수 없습니다.
                          </div>
                        )}
                      </div>
                      <button className="btn btn-primary" type="button" onClick={createScene} disabled={!canCreateScene}>
                        {t("btn.create")}
                      </button>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {scenes.map((s) => (
                        <div key={s.id} className="scene-item" onClick={() => switchScene(s.id)} style={{ cursor: "pointer", background: currentSceneId === s.id ? "rgba(255,255,255,0.03)" : undefined }}>
                          <div className="meta">
                            <div className="title">{s.name}</div>
                            <div className="sub">{s.id}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={(ev) => { ev.stopPropagation(); saveSceneToJSON(s.id); }}>{t("btn.save")}</button>
                            <button type="button" className="btn btn-warn" onClick={(ev) => { ev.stopPropagation(); deleteScene(s.id); }}>{t("btn.delete")}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="panel-header">
                  <h2>{t("panel.meshes")}</h2>
                  <div className="panel-controls">
                    <button onClick={() => setMeshesCollapsed((v) => !v)}>{meshesCollapsed ? "▸" : "▾"}</button>
                  </div>
                </div>

                {!meshesCollapsed && (
                  <>
                    <div className="mesh-panel-body">
                      <div className="mesh-section">
                        <div className="mesh-section-label">
                          <span className="mesh-section-title">{t("panel.addPrimitives")}</span>
                          <span className="mesh-section-line" />
                        </div>

                        <MeshPrimitivesToolbar
                          onAdd={(kind) => {
                            setArmedCreateKind((prev) => (prev === kind ? null : kind));
                          }}
                        />
                      </div>

                      <div className="mesh-section mesh-section-fill">
                        <div className="mesh-section-label">
                          <span className="mesh-section-title">{t("panel.meshTree")}</span>
                          <span className="mesh-section-line" />
                        </div>

                        <div className="mesh-list-card mesh-list-fill">
                          <MeshList
                            meshes={meshList || []}
                            onSelect={onMeshSelect}
                            onDelete={deleteMeshFromScene}
                            onContextMenu={openMeshContextMenu}
                            selectedId={selectedMeshId}
                            selectedIds={selectedIds}
                            onMoveToGroup={moveMeshesToGroup}
                            t={t}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </aside>
        )}

        {/* CENTER */}
        <main className={`center ${runtimeMode ? "runtime-stage" : ""}`}>
          {currentSceneId ? (
            <SceneView
              key={currentSceneId}
              sceneId={currentSceneId}
              sceneMeta={{ id: currentSceneId, name: currentScene?.name }}
              initialJSON={currentScene?.json}
              onReady={handleSceneReady}
              onToggleGrid={toggleGrid}
              gridVisible={gridVisible}
              onToggleAxes={toggleAxes}
              axesVisible={axesVisible}
              onUndo={undo}
              onRedo={redo}
              headerVisible={sceneHeaderVisible && !runtimeMode}
              runtimeMode={runtimeMode}
              placementKind={armedCreateKind}
              t={t}
              onCommitPlacement={(point) => {
                if (!armedCreateKind) return;
                addMeshToCurrent(armedCreateKind, point);
                setArmedCreateKind(null);
              }}
            />
          ) : (
            <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>{t("empty.selectScene")}</div>
          )}
        </main>

        {/* RIGHT (inspector) — reduced width to 300 */}
        {!runtimeMode && (
          <aside className="inspector-panel">
            <div className="inspector-title">{t("inspector.title")}</div>
            <div className="inspector-content">
              <MeshInspector
                key={selectedMeshId || "none"}
                meshMeta={selectedMeshMeta}
                meshes={meshList || []}
                onChange={onInspectorChange}
                onDelete={(id) => { deleteMeshFromScene(id); }}
                onUnmerge={onUnmerge}
                runtimeMode={runtimeMode}
                onOpenScript={(id) => openScriptEditor(id)}
                t={t}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
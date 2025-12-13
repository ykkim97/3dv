// src/App.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { createMeta } from "./babylon/MeshEntities";
import MeshInspector from "./components/MeshInspector.jsx";
import MeshList from "./components/MeshList.jsx";
import SceneView from "./components/SceneView.jsx";
import TopBar from "./components/TopBar.jsx";

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
  const [scenes, setScenes] = useState([]);
  const [currentSceneId, setCurrentSceneId] = useState(null);
  const [newName, setNewName] = useState("");

  const sceneInstanceMap = useRef(new Map());
  const [selectedMeshId, setSelectedMeshId] = useState(null);
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
  // scene header visibility (toggle without re-creating the scene)
  const [sceneHeaderVisible, setSceneHeaderVisible] = useState(true);

  const createScene = () => {
    const id = `scene-${Date.now()}`;
    const sceneMeta = { id, name: newName || "Untitled Scene", json: null };
    setScenes((s) => [...s, sceneMeta]);
    setNewName("");
    setCurrentSceneId(id);
  };

  const getCurrentInstance = () => sceneInstanceMap.current.get(currentSceneId);

  const handleSceneReady = useCallback(
    (sceneId, sp) => {
      // store instance
      sceneInstanceMap.current.set(sceneId, sp);

      // register selection callback (scene -> app)
      sp.setSelectionCallback((meshId) => {
        setSelectedMeshId(meshId);
        // keep selectedIds in sync: if single select done in scene, set that as single selection
        setSelectedIds(new Set(meshId ? [meshId] : []));
        forceRerender((n) => n + 1);
      });

      // apply current grid/axes visibility to scene
      sp.setGridVisible(gridVisible);
      sp.setAxesVisible(axesVisible);

      forceRerender((n) => n + 1);
    },
    [gridVisible, axesVisible]
  );

  const toggleAxes = () => {
    const next = !axesVisible;
    setAxesVisible(next);
    const inst = getCurrentInstance();
    if (inst) inst.setAxesVisible(next);
  };

  const saveSceneToJSON = (id) => {
    const instance = sceneInstanceMap.current.get(id);
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
    const prev = sceneInstanceMap.current.get(currentSceneId);
    if (prev) {
      const json = prev.serialize();
      setScenes((prevArr) => prevArr.map((s) => (s.id === currentSceneId ? { ...s, json } : s)));
      prev.detachAndShutdown();
    }
    setSelectedMeshId(null);
    setCurrentSceneId(id);
  };

  const deleteScene = (id) => {
    const inst = sceneInstanceMap.current.get(id);
    if (inst) {
      try {
        inst.disposeCompletely();
      } catch {}
      sceneInstanceMap.current.delete(id);
    }
    setScenes((s) => s.filter((sc) => sc.id !== id));
    if (currentSceneId === id) setCurrentSceneId(null);
  };

  // Create mesh with deterministic id/name; initially always top-level (no parent)
  const addMeshToCurrent = (kind) => {
    const inst = getCurrentInstance();
    if (!inst) {
      alert("Scene not initialized in view. Click the scene to open it.");
      return;
    }
    const id = `${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const name = `${kind}-${Math.floor(Math.random() * 1000)}`;
    const parent = null;
    const meta = createMeta(kind, { id, name, parent });
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

  const mergeSelected = () => {
    if (!currentInstance) {
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

    currentInstance.enqueueCommand({ type: "createMesh", payload: { ...meta } });

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

  useEffect(() => {
    const onKey = (e) => {
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
  }, [selectedMeshId]);

  const toggleGrid = () => {
    const next = !gridVisible;
    setGridVisible(next);
    const inst = getCurrentInstance();
    if (inst) inst.setGridVisible(next);
  };

  const currentScene = scenes.find((s) => s.id === currentSceneId);
  const currentInstance = sceneInstanceMap.current.get(currentSceneId);
  const meshList = currentInstance ? currentInstance.getMeshMetaList() : currentScene?.json?.meshes || [];
  const selectedMeshMeta = meshList ? meshList.find((m) => m.id === selectedMeshId) : null;
  const [selectedIds, setSelectedIds] = useState(new Set());

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar
        onToggleGrid={toggleGrid}
        gridVisible={gridVisible}
        onToggleHeader={() => setSceneHeaderVisible(v => !v)}
        headerVisible={sceneHeaderVisible}
      />
      <div style={{ flex: 1, display: "flex", alignItems: "stretch" }}>
        {/* LEFT: Icon bar + panel (refactored) */}
        <aside className="sidebar" role="complementary" aria-label="Left sidebar">
          <div className="sidebar-icons" aria-hidden>
            <button title="Scenes" onClick={() => setLeftTab("scenes")} className={`icon-btn ${leftTab === "scenes" ? "active" : ""}`}>
              <span style={{ fontSize: 18 }}>📂</span>
            </button>
            <button title="Meshes" onClick={() => setLeftTab("meshes")} className={`icon-btn ${leftTab === "meshes" ? "active" : ""}`}>
              <span style={{ fontSize: 18 }}>🧱</span>
            </button>
          </div>

          <div className="sidebar-panel">
            {leftTab === "scenes" ? (
              <>
                <div className="panel-header">
                  <h2>Scenes</h2>
                  <div className="panel-controls">
                    <button onClick={() => setScenesCollapsed((v) => !v)} title={scenesCollapsed ? "Expand" : "Collapse"}>
                      {scenesCollapsed ? "▸" : "▾"}
                    </button>
                  </div>
                </div>

                {!scenesCollapsed && (
                  <>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <input placeholder="scene name" value={newName} onChange={(e) => setNewName(e.target.value)} className="input" style={{ flex: 1 }} />
                      <button onClick={createScene} style={{ background: "var(--accent)", borderColor: "transparent" }}>Create</button>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {scenes.map((s) => (
                        <div key={s.id} className="scene-item" onClick={() => switchScene(s.id)} style={{ cursor: "pointer", background: currentSceneId === s.id ? "rgba(255,255,255,0.03)" : undefined }}>
                          <div className="meta">
                            <div className="title">{s.name}</div>
                            <div className="sub">{s.id}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={(ev) => { ev.stopPropagation(); saveSceneToJSON(s.id); }} style={{ background: "#23273b" }}>Save</button>
                            <button onClick={(ev) => { ev.stopPropagation(); deleteScene(s.id); }} style={{ background: "#23273b", color: "#ff8080" }}>Delete</button>
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
                  <h2>Meshes</h2>
                  <div className="panel-controls">
                    <button onClick={() => setMeshesCollapsed((v) => !v)}>{meshesCollapsed ? "▸" : "▾"}</button>
                  </div>
                </div>

                {!meshesCollapsed && (
                  <>
                    <div className="add-collection" role="toolbar" aria-label="Add meshes">
                      <button title="Add Box" onClick={() => addMeshToCurrent("box")} className="icon-btn" style={{ background: "linear-gradient(180deg,#2a6cf0,#1b58d6)", color: "#fff" }}>
                        <svg className="svg" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M3 7.5L12 3l9 4.5v7L12 21 3 14.5v-7z" /></svg>
                      </button>

                      <button title="Add Sphere" onClick={() => addMeshToCurrent("sphere")} className="icon-btn" style={{ background: "linear-gradient(180deg,#34d58f,#16b06a)", color: "#08210f" }}>
                        <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" /></svg>
                      </button>

                      <button title="Add Cylinder" onClick={() => addMeshToCurrent("cylinder")} className="icon-btn" style={{ background: "linear-gradient(180deg,#f7b64a,#f39b14)", color: "#2b1b00" }}>
                        <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="5" rx="7" ry="2" /><path d="M5 5v11c0 1.1 3.1 2 7 2s7-.9 7-2V5" /></svg>
                      </button>

                      <button title="Add Cone" onClick={() => addMeshToCurrent("cone")} className="icon-btn" style={{ background: "linear-gradient(180deg,#f06c9b,#d84a7f)", color: "#fff" }}>
                        <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L20 20 H4 Z" /></svg>
                      </button>

                      <button title="Add Line" onClick={() => addMeshToCurrent("line")} className="icon-btn" style={{ background: "linear-gradient(180deg,#6ad3ff,#2bb6ff)", color: "#022033" }}>
                        <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 12 L10 8 L14 16 L20 12" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
                      </button>
                    </div>

                    <div className="mesh-list-card">
                      <MeshList
                        meshes={meshList || []}
                        onSelect={onMeshSelect}
                        onDelete={deleteMeshFromScene}
                        selectedId={selectedMeshId}
                        selectedIds={selectedIds}
                        onSelectionChange={(nextSet) => setSelectedIds(new Set(nextSet))}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </aside>

        {/* CENTER */}
        <main style={{ flex: 1, background: "var(--bg-1)", display: "flex", alignItems: "stretch" }}>
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
              headerVisible={sceneHeaderVisible}
            />
          ) : (
            <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8cbe0" }}>Select or create a scene</div>
          )}
        </main>

        {/* RIGHT (inspector) — reduced width to 300 */}
        <aside style={{ width: 300, padding: 12, background: "var(--panel)", borderLeft: "1px solid var(--border)" }}>
          <h2 style={{ marginTop: 4, fontSize: 16 }}>Inspector</h2>
          <MeshInspector meshMeta={selectedMeshMeta} meshes={meshList || []} onChange={onInspectorChange} onDelete={(id) => { deleteMeshFromScene(id); }} onUnmerge={onUnmerge} />
        </aside>
      </div>
    </div>
  );
}
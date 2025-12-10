// src/App.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import TopBar from "./components/TopBar.jsx";
import SceneView from "./components/SceneView.jsx";
import MeshList from "./components/MeshList.jsx";
import MeshInspector from "./components/MeshInspector.jsx";
import { createMeta } from "./babylon/MeshEntities";

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

  const createScene = () => {
    const id = `scene-${Date.now()}`;
    const sceneMeta = { id, name: newName || "Untitled Scene", json: null };
    setScenes((s) => [...s, sceneMeta]);
    setNewName("");
    setCurrentSceneId(id);
  };

  const handleSceneReady = useCallback((sceneId, sp) => {
    // store instance
    sceneInstanceMap.current.set(sceneId, sp);

    // register selection callback (scene -> app)
    sp.setSelectionCallback((meshId) => {
      // update app state when selection happens in scene
      setSelectedMeshId(meshId);
      // ensure UI updates
      forceRerender(n => n + 1);
    });

    // apply current grid visibility to scene
    sp.setGridVisible(gridVisible);

    forceRerender(n => n + 1);
  }, [gridVisible]);

  const getCurrentInstance = () => sceneInstanceMap.current.get(currentSceneId);

  const saveSceneToJSON = (id) => {
    const instance = sceneInstanceMap.current.get(id);
    if (!instance) {
      alert("Scene not ready or missing");
      return;
    }
    const json = instance.serialize();
    setScenes(prev => prev.map(s => s.id === id ? { ...s, json } : s));
    downloadJSON(json, `${json.name || id}.json`);
  };

  const switchScene = (id) => {
    if (id === currentSceneId) return;
    const prev = sceneInstanceMap.current.get(currentSceneId);
    if (prev) {
      const json = prev.serialize();
      setScenes(prevArr => prevArr.map(s => s.id === currentSceneId ? { ...s, json } : s));
      prev.detachAndShutdown();
    }
    setSelectedMeshId(null);
    setCurrentSceneId(id);
  };

  const deleteScene = (id) => {
    const inst = sceneInstanceMap.current.get(id);
    if (inst) {
      try { inst.disposeCompletely(); } catch {}
      sceneInstanceMap.current.delete(id);
    }
    setScenes(s => s.filter(sc => sc.id !== id));
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
    const parent = null; // always create as top-level initially
    const meta = createMeta(kind, { id, name, parent });
    inst.enqueueCommand({ type: "createMesh", payload: { ...meta } });

    // push undo action: remove mesh by id
    undoStack.current.push({
      undo: () => {
        const i = getCurrentInstance();
        if (i) i.enqueueCommand({ type: "removeMesh", payload: { id } });
      },
      redo: () => {
        const i = getCurrentInstance();
        if (i) i.enqueueCommand({ type: "createMesh", payload: { ...meta } });
      }
    });
    // clear redo stack on new action
    redoStack.current.length = 0;

    // ensure newly created mesh gets highlighted & selected — we wait briefly for scene to create it
    setTimeout(() => {
      const i = getCurrentInstance();
      if (i) {
        i.highlightMesh(id);
      }
      setSelectedMeshId(id);
      forceRerender(n => n + 1);
    }, 60);
  };

  const deleteMeshFromScene = (id) => {
    const inst = getCurrentInstance();
    if (!inst) return;
    // capture meta for undo
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
        }
      });
      redoStack.current.length = 0;
    }

    setTimeout(() => forceRerender(n => n + 1), 40);
  };

  const onMeshSelect = (id) => {
    setSelectedMeshId(id);
    const inst = getCurrentInstance();
    if (inst) inst.highlightMesh(id);
    forceRerender(n => n + 1);
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
      parent: updatedMeta.parent
    };
    inst.enqueueCommand({ type: "updateMesh", payload: { id: updatedMeta.id, changes } });

    if (prevMeta) {
      undoStack.current.push({
        undo: () => {
          const i = getCurrentInstance();
          if (i) i.enqueueCommand({ type: "updateMesh", payload: { id: prevMeta.id, changes: { position: prevMeta.position, rotation: prevMeta.rotation, scaling: prevMeta.scaling, name: prevMeta.name, material: prevMeta.material, parent: prevMeta.parent } } });
        },
        redo: () => {
          const i = getCurrentInstance();
          if (i) i.enqueueCommand({ type: "updateMesh", payload: { id: updatedMeta.id, changes } });
        }
      });
      redoStack.current.length = 0;
    }

    setTimeout(() => forceRerender(n => n + 1), 20);
  };

  // Undo / Redo handlers
  const undo = () => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    try {
      entry.undo();
      redoStack.current.push(entry);
      setTimeout(() => forceRerender(n => n + 1), 50);
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
      setTimeout(() => forceRerender(n => n + 1), 50);
    } catch (err) {
      console.error("Redo error:", err);
    }
  };

  // Keyboard shortcuts: Delete, Ctrl+Z, Ctrl+Y
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

  // toggle grid visibility (TopBar will call this)
  const toggleGrid = () => {
    const next = !gridVisible;
    setGridVisible(next);
    const inst = getCurrentInstance();
    if (inst) inst.setGridVisible(next);
  };

  // UI state & current lists
  const currentScene = scenes.find(s => s.id === currentSceneId);
  const currentInstance = sceneInstanceMap.current.get(currentSceneId);
  const meshList = currentInstance ? currentInstance.getMeshMetaList() : (currentScene && currentScene.json ? currentScene.json.meshes : []);
  const selectedMeshMeta = meshList ? meshList.find(m => m.id === selectedMeshId) : null;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar onToggleGrid={toggleGrid} gridVisible={gridVisible} />
      <div style={{ flex: 1, display: "flex", alignItems: "stretch" }}>
        {/* LEFT: Icon bar + panel */}
        <aside style={{ display: "flex", width: 360, borderRight: "1px solid var(--border)" }}>
          <div style={{ width: 56, background: "linear-gradient(180deg,#0f1218, #0c0f15)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, gap: 8 }}>
            <button title="Scenes" onClick={() => setLeftTab("scenes")} className="icon-btn" style={{ background: leftTab === "scenes" ? "rgba(100,108,255,0.12)" : "transparent" }}>📂</button>
            <button title="Meshes" onClick={() => setLeftTab("meshes")} className="icon-btn" style={{ background: leftTab === "meshes" ? "rgba(31,191,122,0.12)" : "transparent" }}>🧱</button>
          </div>

          <div style={{ flex: 1, padding: 16, background: "var(--panel)" }}>
            {leftTab === "scenes" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 16 }}>Scenes</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
                    <button onClick={redo} title="Redo (Ctrl+Y)">Redo</button>
                    <button onClick={() => setScenesCollapsed(v => !v)} title={scenesCollapsed ? "Expand" : "Collapse"}>{scenesCollapsed ? "▸" : "▾"}</button>
                  </div>
                </div>

                {!scenesCollapsed && (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <input placeholder="scene name" value={newName} onChange={(e) => setNewName(e.target.value)} className="input" style={{ flex: 1 }} />
                      <button onClick={createScene} style={{ background: "var(--accent)", borderColor: "transparent" }}>Create</button>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      {scenes.map(s => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, background: currentSceneId === s.id ? "rgba(255,255,255,0.04)" : "transparent", borderRadius: 8, marginBottom: 6, cursor: "pointer" }}>
                          <div onClick={() => switchScene(s.id)} style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700 }}>{s.name}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.id}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => saveSceneToJSON(s.id)} style={{ background: "#23273b" }}>Save</button>
                            <button onClick={() => deleteScene(s.id)} style={{ background: "#23273b", color: "#ff8080" }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 16 }}>Meshes</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setMeshesCollapsed(v => !v)}>{meshesCollapsed ? "▸" : "▾"}</button>
                  </div>
                </div>

                {!meshesCollapsed && (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <button title="Add Box" onClick={() => addMeshToCurrent("box")} className="icon-btn" style={{ background: "linear-gradient(180deg,#2a6cf0 0%, #1b58d6 100%)", color: "#fff" }}>
                        <svg className="svg" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M3 7.5L12 3l9 4.5v7L12 21 3 14.5v-7z" /></svg>
                      </button>

                      <button title="Add Sphere" onClick={() => addMeshToCurrent("sphere")} className="icon-btn" style={{ background: "linear-gradient(180deg,#34d58f 0%, #16b06a 100%)", color: "#08210f" }}>
                        <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" /></svg>
                      </button>

                      <button title="Add Cylinder" onClick={() => addMeshToCurrent("cylinder")} className="icon-btn" style={{ background: "linear-gradient(180deg,#f7b64a 0%, #f39b14 100%)", color: "#2b1b00" }}>
                        <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="5" rx="7" ry="2" /><path d="M5 5v11c0 1.1 3.1 2 7 2s7-.9 7-2V5" /></svg>
                      </button>

                      <button title="Add Cone" onClick={() => addMeshToCurrent("cone")} className="icon-btn" style={{ background: "linear-gradient(180deg,#f06c9b 0%, #d84a7f 100%)", color: "#fff" }}>
                        <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L20 20 H4 Z" /></svg>
                      </button>

                      <button title="Add Line" onClick={() => addMeshToCurrent("line")} className="icon-btn" style={{ background: "linear-gradient(180deg,#6ad3ff 0%, #2bb6ff 100%)", color: "#022033" }}>
                        <svg className="svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 12 L10 8 L14 16 L20 12" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
                      </button>
                    </div>

                    <MeshList meshes={meshList || []} onSelect={onMeshSelect} onDelete={deleteMeshFromScene} selectedId={selectedMeshId} />
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
            />
          ) : (
            <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8cbe0" }}>
              Select or create a scene
            </div>
          )}
        </main>

        {/* RIGHT */}
        <aside style={{ width: 340, padding: 12, background: "var(--panel)", borderLeft: "1px solid var(--border)" }}>
          <h2 style={{ marginTop: 4, fontSize: 16 }}>Inspector</h2>
          <MeshInspector meshMeta={selectedMeshMeta} meshes={meshList || []} onChange={onInspectorChange} onDelete={(id) => { deleteMeshFromScene(id); }} />
        </aside>
      </div>
    </div>
  );
}
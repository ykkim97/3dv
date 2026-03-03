// src/components/SceneView.jsx
import { useEffect, useRef, useState } from "react";
import SceneProject from "../babylon/SceneProject";
import PerformanceOverlay from "./PerformanceOverlay";

export default function SceneView({ sceneId, sceneMeta, initialJSON, onReady, onToggleGrid, gridVisible, onToggleAxes, axesVisible, onUndo, onRedo, headerVisible = true }) {
  const canvasRef = useRef(null);
  const [sp] = useState(() => new SceneProject({ id: sceneId, name: sceneMeta.name, initialJSON }));

  useEffect(() => {
    if (!canvasRef.current) return;

    sp.attachCanvas(canvasRef.current);

    if (typeof onReady === "function") onReady(sceneId, sp);

    return () => {
      // detach engine but keep meta for persistence
      sp.detachAndShutdown();
    };
    // SceneView is keyed by sceneId in App, so this effect runs once per scene.
  }, [sceneId, onReady, sp]);

  // keyboard shortcuts for common actions (g/r/s/delete/esc)
  useEffect(() => {
    const onKey = (e) => {
      if (!sp) return;
      // ignore when typing in inputs
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "g") {
        sp.setGizmoMode("position");
      } else if (e.key === "r") {
        sp.setGizmoMode("rotation");
      } else if (e.key === "s") {
        sp.setGizmoMode("scale");
      } else if (e.key === "Escape") {
        sp.clearAllHighlights();
      } else if (e.key === "Delete") {
        sp.removeSelectedMesh();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sp]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Top header placed above the 3D canvas for quick actions */}
      {headerVisible && (
        <div className="scene-header" role="toolbar" aria-label="Scene header controls">
          <button className="scene-btn" title="Undo (Ctrl+Z)" onClick={() => onUndo && onUndo()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 7v6h-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 12a9 9 0 0114.32-7.36L21 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Undo</span>
          </button>

          <button className="scene-btn" title="Redo (Ctrl+Y)" onClick={() => onRedo && onRedo()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 17v-6h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12a9 9 0 01-14.32 7.36L3 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Redo</span>
          </button>

          <div className="scene-divider" />

          <button className={`scene-btn ${gridVisible ? "active" : ""}`} title="Toggle Grid" onClick={() => onToggleGrid && onToggleGrid()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/></svg>
            <span>Grid</span>
          </button>

          <button className={`scene-btn ${axesVisible ? "active" : ""}`} title="Toggle Axes" onClick={() => onToggleAxes && onToggleAxes()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M2 12h20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <span>Axes</span>
          </button>

          <div className="scene-divider" />
          <button className={`scene-btn`} title="Add Directional Light (Sun)" onClick={() => { if (sp) sp.addDirectionalLight(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span>Sun</span>
          </button>

          <button className={`scene-btn`} title="Toggle Hemi Intensity" onClick={() => { if (sp) { const cur = (sp._hemisphericLight && sp._hemisphericLight.intensity) || 0.95; sp.setHemisphericIntensity(cur > 0.5 ? 0.25 : 0.95); } }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M12 3v18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span>Hemi</span>
          </button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <PerformanceOverlay sp={sp} />
    </div>
  );
}
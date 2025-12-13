// src/components/SceneView.jsx
import { useEffect, useRef } from "react";
import SceneProject from "../babylon/SceneProject";

export default function SceneView({ sceneId, sceneMeta, initialJSON, onReady, onToggleGrid, gridVisible, onToggleAxes, axesVisible, onUndo, onRedo, headerVisible = true }) {
  const canvasRef = useRef(null);
  const spRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create a SceneProject that is tied to sceneId
    const sp = new SceneProject({ id: sceneId, name: sceneMeta.name, initialJSON });
    spRef.current = sp;
    sp.attachCanvas(canvasRef.current);

    if (typeof onReady === "function") onReady(sceneId, sp);

    return () => {
      // detach engine but keep meta for persistence
      sp.detachAndShutdown();
    };
    // note: onReady is stable (useCallback in App), sceneId/sceneMeta/initialJSON can change
  }, [sceneId, sceneMeta?.name, initialJSON, onReady]);

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
        </div>
      )}

      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
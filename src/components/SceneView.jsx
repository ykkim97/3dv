// src/components/SceneView.jsx
import React, { useRef, useEffect } from "react";
import SceneProject from "../babylon/SceneProject";

export default function SceneView({ sceneId, sceneMeta, initialJSON, onReady }) {
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
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
// src/components/SceneView.jsx
import { useEffect, useRef, useState } from "react";
import SceneProject from "../babylon/SceneProject";
import PerformanceOverlay from "./PerformanceOverlay";
import ViewportModeToolbar from "./ViewportModeToolbar.jsx";

export default function SceneView({ sceneId, sceneMeta, initialJSON, onReady, runtimeMode = false, toolMode = "select", onToolModeChange = null, onBoxSelect = null, snapEnabled = false, snapMove = 0.5, onToggleSnap = null, onChangeSnapMove = null, placementKind = null, onCommitPlacement = null, onDeleteSelected = null, onSelectAllMeshes = null }) {
  const canvasRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onDeleteSelectedRef = useRef(onDeleteSelected);
  const [sp] = useState(() => new SceneProject({ id: sceneId, name: sceneMeta.name, initialJSON }));
  const dragStateRef = useRef(null);
  const measurePointsRef = useRef([]);
  const [selectionRect, setSelectionRect] = useState(null);
  const [measureDistance, setMeasureDistance] = useState(null);
  const [showPerf, setShowPerf] = useState(() => {
    try {
      const v = localStorage.getItem("showPerfOverlay");
      if (v === null) return true;
      return v === "true";
    } catch { return true; }
  });

  useEffect(() => {
    const onEvt = (e) => {
      try {
        if (typeof e.detail !== "undefined") setShowPerf(Boolean(e.detail));
        else setShowPerf(localStorage.getItem("showPerfOverlay") !== "false");
      } catch { void 0; }
    };
    window.addEventListener("perfOverlayToggle", onEvt);
    window.addEventListener("storage", onEvt);
    return () => { window.removeEventListener("perfOverlayToggle", onEvt); window.removeEventListener("storage", onEvt); };
  }, []);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // keep a ref to the latest onDeleteSelected handler so effect deps remain stable
  useEffect(() => {
    onDeleteSelectedRef.current = onDeleteSelected;
  }, [onDeleteSelected]);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      sp.attachCanvas(canvasRef.current);
    } catch (err) {
      console.error('sp.attachCanvas call failed', err, 'sp:', sp);
      throw err;
    }

    if (typeof onReadyRef.current === "function") onReadyRef.current(sceneId, sp);

    return () => {
      // detach engine but keep meta for persistence
      sp.detachAndShutdown();
    };
    // SceneView is keyed by sceneId in App, so this effect runs once per scene.
  }, [sceneId, sp]);

  // keyboard shortcuts for viewport tools and common actions
  useEffect(() => {
    if (runtimeMode) return;
    const onKey = (e) => {
      if (!sp) return;
      // ignore when typing in inputs
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const key = String(e.key || "").toLowerCase();

      if ((e.ctrlKey || e.metaKey) && key === "a") {
        e.preventDefault();
        e.stopPropagation();
        onSelectAllMeshes && onSelectAllMeshes();
      } else if (key === "q") {
        onToolModeChange && onToolModeChange("select");
      } else if (key === "c") {
        onToolModeChange && onToolModeChange("cursor");
      } else if (key === "g") {
        onToolModeChange && onToolModeChange("move");
      } else if (key === "r") {
        onToolModeChange && onToolModeChange("rotate");
      } else if (key === "s") {
        onToolModeChange && onToolModeChange("scale");
      } else if (e.key === "Escape") {
        sp.clearAllHighlights?.();
      } else if (e.key === "Delete") {
        // Prefer parent-provided multi-delete handler (via ref); fall back to single selection remove
        try {
          const fn = onDeleteSelectedRef.current;
          if (typeof fn === 'function') fn();
          else sp.removeSelectedMesh();
        } catch (err) { void err; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sp, runtimeMode, onToolModeChange, onSelectAllMeshes]);

  // Click-to-place mesh creation: armed in App, committed on canvas click.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (runtimeMode) return;
    if (!sp) return;

    // keep a ghost preview mesh following the cursor while placement mode is active
    try {
      if (placementKind) sp.setPlacementPreviewKind?.(placementKind);
      else sp.clearPlacementPreview?.();
    } catch (err) { void err; }

    if (!placementKind) return;

    const getLocal = (ev) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    // For path-based placement (line / tube) support drag-to-create (start -> end)
    const isPathKind = placementKind === "line" || placementKind === "tube";
    if (isPathKind) {
      let dragStart = null;

      const onPointerMovePath = (ev) => {
        try {
          const p = getLocal(ev);
          const point = sp.getPlacementPoint?.(p.x, p.y);
          if (!point) return;
          if (dragStart) {
            // show 2-point preview using measurement helpers
            try { sp.setMeasurementPoints?.([dragStart, point]); } catch { void 0; }
          } else {
            // move preview to cursor when not dragging
            try { sp.updatePlacementPreview?.(p.x, p.y); } catch { void 0; }
          }
        } catch (err) { void err; }
      };

      const onPointerLeave = () => {
        try { sp.clearPlacementPreview?.(); } catch (err) { void err; }
        try { sp.clearMeasurement?.(); } catch (err) { void err; }
      };

      const onPointerDownPath = (ev) => {
        try {
          const p = getLocal(ev);
          const point = sp.getPlacementPoint?.(p.x, p.y);
          if (!point) return;
          ev.preventDefault();
          dragStart = point;
          try { sp.setMeasurementPoints?.([dragStart]); } catch { void 0; }
          try { canvas.setPointerCapture(ev.pointerId); } catch { void 0; }
        } catch (err) { void err; }
      };

      const onPointerUpPath = (ev) => {
        try {
          if (!dragStart) return;
          const p = getLocal(ev);
          const point = sp.getPlacementPoint?.(p.x, p.y);
          if (!point) {
            dragStart = null;
            try { sp.clearMeasurement?.(); } catch (err) { void err; }
            return;
          }
          ev.preventDefault();
          const path = [dragStart, point];
          if (typeof onCommitPlacement === "function") onCommitPlacement(path);
        } catch (err) { void err; }
        try { dragStart = null; } catch (err) { void err; }
        try { canvas.releasePointerCapture(ev.pointerId); } catch { void 0; }
        try { sp.clearMeasurement?.(); } catch (err) { void err; }
        try { sp.clearPlacementPreview?.(); } catch (err) { void err; }
      };

      canvas.addEventListener("pointermove", onPointerMovePath);
      canvas.addEventListener("pointerleave", onPointerLeave);
      canvas.addEventListener("pointerdown", onPointerDownPath);
      canvas.addEventListener("pointerup", onPointerUpPath);
      return () => {
        canvas.removeEventListener("pointermove", onPointerMovePath);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        canvas.removeEventListener("pointerdown", onPointerDownPath);
        canvas.removeEventListener("pointerup", onPointerUpPath);
        try { sp.clearMeasurement?.(); } catch (err) { void err; }
        try { sp.clearPlacementPreview?.(); } catch (err) { void err; }
      };
    }

    // default single-click placement
    const onPointerMove = (ev) => {
      try {
        const p = getLocal(ev);
        sp.updatePlacementPreview?.(p.x, p.y);
      } catch (err) {
        void err;
      }
    };

    const onPointerLeave = () => {
      try { sp.clearPlacementPreview?.(); } catch (err) { void err; }
    };

    const onPointerDown = (ev) => {
      try {
        const p = getLocal(ev);
        const point = sp.getPlacementPoint?.(p.x, p.y);
        if (point) {
          ev.preventDefault();
          if (typeof onCommitPlacement === "function") onCommitPlacement(point);
        }
      } catch (err) {
        void err;
      }
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      try { sp.clearPlacementPreview?.(); } catch (err) { void err; }
    };
  }, [sp, placementKind, onCommitPlacement, runtimeMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (runtimeMode) return;
    if (!sp) return;
    if (placementKind) return;
    if (toolMode !== "cursor") return;

    const getLocal = (ev) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    const onPointerDown = (ev) => {
      if (ev.button !== 0) return;
      try {
        const p = getLocal(ev);
        const point = sp.getPlacementPoint?.(p.x, p.y);
        if (!point) return;
        ev.preventDefault();
        sp.setCursorPoint?.(point);
      } catch (err) {
        void err;
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, [sp, runtimeMode, toolMode, placementKind]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (runtimeMode) return;
    if (!sp) return;
    if (placementKind) return;
    if (toolMode !== "select") return;

    const getLocal = (ev) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    const stopDragSelection = () => {
      dragStateRef.current = null;
      setSelectionRect(null);
      try {
        try { sp.setCameraPointerOrbitEnabled?.(true); } catch (err) { void err; }
        setTimeout(() => {
          try { sp.setPointerPickSelectionSuppressed?.(false); } catch (err) { void err; }
        }, 0);
        try { const c = canvasRef.current; if (c && c.classList) c.classList.remove('dragging'); } catch { void 0; }
      } catch (err) { void err; }
    };

    const onPointerDown = (ev) => {
      if (ev.button !== 0) return;
      try {
        const p = getLocal(ev);
        dragStateRef.current = {
          startX: p.x,
          startY: p.y,
          currentX: p.x,
          currentY: p.y,
          ctrlKey: !!ev.ctrlKey,
          metaKey: !!ev.metaKey,
          shiftKey: !!ev.shiftKey,
        };
        try { const c = canvasRef.current; if (c && c.classList) c.classList.add('dragging'); } catch { void 0; }
        try { sp.setCameraPointerOrbitEnabled?.(false); } catch (err) { void err; }
        try { sp.setPointerPickSelectionSuppressed?.(true); } catch (err) { void err; }
        try { canvas.setPointerCapture(ev.pointerId); } catch (err) { void err; }
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      } catch (err) {
        void err;
      }
    };

    const onPointerMove = (ev) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      try {
        const p = getLocal(ev);
        drag.currentX = p.x;
        drag.currentY = p.y;
        setSelectionRect({
          left: Math.min(drag.startX, p.x),
          top: Math.min(drag.startY, p.y),
          width: Math.abs(p.x - drag.startX),
          height: Math.abs(p.y - drag.startY),
        });
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      } catch (err) {
        void err;
      }
    };

    const onPointerUp = (ev) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      try {
        const p = getLocal(ev);
        const width = Math.abs(p.x - drag.startX);
        const height = Math.abs(p.y - drag.startY);
        if (width < 4 && height < 4) {
          const hitId = sp.pickMeshIdAt?.(p.x, p.y);
          onBoxSelect && onBoxSelect(hitId ? [hitId] : [], {
            empty: !hitId,
            ctrlKey: drag.ctrlKey,
            metaKey: drag.metaKey,
            shiftKey: drag.shiftKey,
          });
        } else {
          const ids = sp.getMeshIdsInScreenRect?.(drag.startX, drag.startY, p.x, p.y) || [];
          onBoxSelect && onBoxSelect(ids, {
            ctrlKey: drag.ctrlKey,
            metaKey: drag.metaKey,
            shiftKey: drag.shiftKey,
          });
        }
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      } catch (err) {
        void err;
      } finally {
        try { canvas.releasePointerCapture(ev.pointerId); } catch (err) { void err; }
        // ensure dragging class removed
        try { const c = canvasRef.current; if (c && c.classList) c.classList.remove('dragging'); } catch { void 0; }
        stopDragSelection();
      }
    };

    const onPointerCancel = (ev) => {
      try {
        ev.preventDefault();
        ev.stopPropagation();
      } catch (err) { void err; }
      stopDragSelection();
    };

    canvas.addEventListener("pointerdown", onPointerDown, true);
    canvas.addEventListener("pointermove", onPointerMove, true);
    canvas.addEventListener("pointerup", onPointerUp, true);
    canvas.addEventListener("pointercancel", onPointerCancel, true);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown, true);
      canvas.removeEventListener("pointermove", onPointerMove, true);
      canvas.removeEventListener("pointerup", onPointerUp, true);
      canvas.removeEventListener("pointercancel", onPointerCancel, true);
      stopDragSelection();
    };
  }, [sp, runtimeMode, toolMode, placementKind, onBoxSelect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (runtimeMode) return;
    if (!sp) return;
    if (placementKind) return;
    if (toolMode !== "measure") {
      measurePointsRef.current = [];
      setMeasureDistance(null);
      try { sp.clearMeasurement?.(); } catch (err) { void err; }
      return;
    }

    const getLocal = (ev) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    const onPointerDown = (ev) => {
      if (ev.button !== 0) return;
      try {
        const p = getLocal(ev);
        const point = sp.getPlacementPoint?.(p.x, p.y);
        if (!point) return;
        ev.preventDefault();

        const current = measurePointsRef.current || [];
        const next = current.length >= 2 ? [point] : [...current, point];
        measurePointsRef.current = next;
        const distance = sp.setMeasurementPoints?.(next) || 0;
        setMeasureDistance(next.length >= 2 ? distance : null);
      } catch (err) {
        void err;
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      measurePointsRef.current = [];
      setMeasureDistance(null);
      try { sp.clearMeasurement?.(); } catch (err) { void err; }
    };
  }, [sp, runtimeMode, toolMode, placementKind]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Quick Start removed per user request */}
      {!runtimeMode && (
        <ViewportModeToolbar
          activeMode={toolMode}
          onChange={onToolModeChange}
          snapEnabled={snapEnabled}
          snapMove={snapMove}
          onToggleSnap={onToggleSnap}
          onChangeSnapMove={onChangeSnapMove}
        />
      )}
      <canvas
        ref={canvasRef}
        className={`scene-canvas app-custom-cursor ${( !runtimeMode && (placementKind || toolMode === "cursor" || toolMode === "select") ) ? 'crosshair-mode' : ''}`}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 ? (
        <div
          className="viewport-selection-box"
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        />
      ) : null}
      {toolMode === "measure" ? (
        <div className="viewport-measure-overlay" aria-live="polite">
          <div className="viewport-measure-title">MEASURE</div>
          <div className="viewport-measure-value">
            {measureDistance == null ? "Pick 2 points" : `${measureDistance.toFixed(3)} units`}
          </div>
        </div>
      ) : null}
      {showPerf ? <PerformanceOverlay sp={sp} /> : null}
    </div>
  );
}

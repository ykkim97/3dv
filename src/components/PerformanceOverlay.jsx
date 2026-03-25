import { useEffect, useState } from "react";

export default function PerformanceOverlay({ sp }) {
  const [stats, setStats] = useState({ fps: 0, meshes: 0, active: 0, materials: 0, drawCalls: 0 });

  useEffect(() => {
    let raf = null;
    let mounted = true;
    const update = () => {
      try {
        if (!sp) return;
        const engine = sp.getEngine();
        const scene = sp.getScene();
        const toNumber = (v) => {
          if (v == null) return 0;
          if (typeof v === "number") return v;
          if (typeof v === "string") return Number(v) || 0;
          if (typeof v === "object") {
            try {
              if (typeof v.current !== "undefined") return Number(v.current) || 0;
              if (typeof v._current !== "undefined") return Number(v._current) || 0;
              if (typeof v.average !== "undefined") return Number(v.average) || 0;
              if (typeof v._average !== "undefined") return Number(v._average) || 0;
              if (typeof v.getAverage === "function") return Number(v.getAverage()) || 0;
              if (typeof v.getValue === "function") return Number(v.getValue()) || 0;
            } catch { return 0; }
          }
          return 0;
        };

        const rawFps = engine ? (typeof engine.getFps === "function" ? engine.getFps() : engine.getFps) : 0;
        const fps = Math.round(toNumber(rawFps));
        const meshes = scene && Array.isArray(scene.meshes) ? scene.meshes.length : 0;
        const active = scene && typeof scene.getActiveMeshes === "function" ? (toNumber(scene.getActiveMeshes().length) || 0) : 0;
        const materials = scene && Array.isArray(scene.materials) ? scene.materials.length : 0;
        // try common engine drawCalls field with graceful fallback and coerce monitor objects
        let drawCalls = 0;
        try { drawCalls = toNumber(engine && (engine.drawCalls || engine._drawCalls || engine._perfDrawCalls || 0)); } catch { drawCalls = 0; }

        if (mounted) {
          setStats((prev) => {
            if (
              prev.fps === fps &&
              prev.meshes === meshes &&
              prev.active === active &&
              prev.materials === materials &&
              prev.drawCalls === drawCalls
            ) {
              return prev;
            }
            return { fps, meshes, active, materials, drawCalls };
          });
        }
      } catch { void 0; }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => { mounted = false; if (raf) cancelAnimationFrame(raf); };
  }, [sp]);

  const style = {
    position: "absolute",
    right: 12,
    top: 12,
    background: "rgba(10,10,12,0.7)",
    color: "#e6edf3",
    padding: "8px 10px",
    borderRadius: 8,
    fontSize: 12,
    lineHeight: "14px",
    zIndex: 40,
    boxShadow: "0 2px 10px rgba(0,0,0,0.6)",
    minWidth: 120,
  };

  return (
    <div style={style} aria-hidden>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong>Perf</strong>
        <span style={{ opacity: 0.8 }}>{stats.fps} FPS</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ opacity: 0.85 }}>Meshes</span>
        <span style={{ opacity: 0.9 }}>{stats.meshes}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ opacity: 0.85 }}>Active</span>
        <span style={{ opacity: 0.9 }}>{stats.active}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ opacity: 0.85 }}>Mats</span>
        <span style={{ opacity: 0.9 }}>{stats.materials}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ opacity: 0.85 }}>Draw</span>
        <span style={{ opacity: 0.9 }}>{stats.drawCalls}</span>
      </div>
    </div>
  );
}

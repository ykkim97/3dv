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
        try {
          if (scene && scene.meshes && scene.meshes.length <= 1 && typeof sp.ensureViewportGuides === "function") {
            sp.ensureViewportGuides();
          }
        } catch { void 0; }
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

  return (
    <div className="perf-overlay" aria-hidden>
      <div className="perf-row header">
        <strong>Perf</strong>
        <span className="muted-val">{stats.fps} FPS</span>
      </div>
      <div className="perf-row"><span className="label">Meshes</span><span className="value">{stats.meshes}</span></div>
      <div className="perf-row"><span className="label">Active</span><span className="value">{stats.active}</span></div>
      <div className="perf-row"><span className="label">Mats</span><span className="value">{stats.materials}</span></div>
      <div className="perf-row"><span className="label">Draw</span><span className="value">{stats.drawCalls}</span></div>
    </div>
  );
}

// src/components/Tools.jsx
import { useEffect, useState } from "react";
import ModalShell from "./ModalShell.jsx";
import { Color4 } from "@babylonjs/core/Maths/math.color";

function MenuItem({ children, onClick }) {
  return (
    <div className="tools-item" onClick={onClick} onKeyDown={() => {}} role="button" tabIndex={0}>
      {children}
    </div>
  );
}

export default function Tools({ open, onClose, getInstance, t = (s) => s }) {
  const [activeTool, setActiveTool] = useState(null); // 'lighting' | 'shadows' | 'camera' | 'utils'

  useEffect(() => {
    if (!open) setActiveTool(null);
  }, [open]);

  // compute anchor position (near TopBar Tools button) for dropdown placement
  const [anchorRect, setAnchorRect] = useState(null);
  useEffect(() => {
    if (!open) return;
    const btn = document.getElementById("topbar-tools-btn");
    if (btn && typeof btn.getBoundingClientRect === "function") {
      setAnchorRect(btn.getBoundingClientRect());
    } else {
      setAnchorRect({ top: 46, left: 120, width: 120, height: 36 });
    }

    const onResize = () => {
      const b = document.getElementById("topbar-tools-btn");
      if (b && typeof b.getBoundingClientRect === "function") setAnchorRect(b.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  // close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const drop = document.getElementById("tools-dropdown-panel");
      const btn = document.getElementById("topbar-tools-btn");
      if (!drop) return;
      if (drop.contains(e.target) || (btn && btn.contains(e.target))) return;
      try { onClose && onClose(); } catch (err) { console.error('Tools.jsx:onDoc', err); }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  // Lighting modal
  const LightingModal = ({ open, onClose: c }) => {
    const [hemi, setHemi] = useState(1);
    const [lights, setLights] = useState([]);

    const refresh = () => {
      try {
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return;
        setLights(inst.listLights ? inst.listLights() : []);
        try { setHemi((inst._hemisphericLight && inst._hemisphericLight.intensity) || 0); } catch (e) { }
      } catch (err) { console.error('Tools.jsx:refreshLighting', err); }
    };

    useEffect(() => { if (open) refresh(); }, [open]);

    const setHemiIntensity = (v) => {
      try {
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return;
        inst.setHemisphericIntensity && inst.setHemisphericIntensity(Number(v));
        setHemi(Number(v));
      } catch (err) { void err; }
    };

    const addDir = () => {
      try { const inst = typeof getInstance === "function" ? getInstance() : null; if (!inst) return; inst.addDirectionalLight && inst.addDirectionalLight({ intensity: 1 }); refresh(); } catch (err) { console.error('Tools.jsx:addDir', err); }
    };

    const rm = (id) => { try { const inst = typeof getInstance === "function" ? getInstance() : null; if (!inst) return; inst.removeLight && inst.removeLight(id); refresh(); } catch (err) { console.error('Tools.jsx:removeLight', err); } };

    return (
      <ModalShell open={open} title={t("tools.lighting") || "Lighting"} width={520} zIndex={220} onClose={c}>
        <div style={{ paddingBottom: 6 }}>
          <div style={{ marginBottom: 8, fontWeight: 800 }}>Hemispheric intensity</div>
          <input type="range" min="0" max="2" step="0.05" value={hemi} onChange={(e) => setHemiIntensity(e.target.value)} />
          <div style={{ marginTop: 12 }}>
            <button className="btn" type="button" onClick={addDir}>Add Directional Light</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Lights</div>
            <div style={{ maxHeight: 160, overflow: "auto" }}>
              {lights.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 6 }}>
                  <div style={{ fontSize: 13 }}>{l.name || l.id} ({l.type})</div>
                  <div><button className="btn btn-ghost" onClick={() => rm(l.id)}>Remove</button></div>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 14 }}>
            <button className="btn" type="button" onClick={c}>Close</button>
          </div>
        </div>
      </ModalShell>
    );
  };

  // Camera modal
  const CameraModal = ({ open, onClose: c }) => {
    const [pan, setPan] = useState(100);
    const [zoom, setZoom] = useState(3);

    useEffect(() => {
      if (!open) return;
      try {
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return;
        const cam = inst.camera || null;
        if (cam) {
          if (typeof cam.panningSensibility !== "undefined") setPan(cam.panningSensibility);
          if (typeof cam.wheelPrecision !== "undefined") setZoom(cam.wheelPrecision);
        }
      } catch (err) { console.error('Tools.jsx:CameraModal:useEffect', err); }
    }, [open]);

    const applyPan = (v) => {
      try { const inst = typeof getInstance === "function" ? getInstance() : null; if (!inst) return; const cam = inst.camera || null; if (cam && typeof cam.panningSensibility !== "undefined") cam.panningSensibility = Number(v); setPan(Number(v)); } catch (err) { console.error('Tools.jsx:applyPan', err); }
    };

    const applyZoom = (v) => {
      try { const inst = typeof getInstance === "function" ? getInstance() : null; if (!inst) return; const cam = inst.camera || null; if (cam && typeof cam.wheelPrecision !== "undefined") cam.wheelPrecision = Number(v); setZoom(Number(v)); } catch (err) { console.error('Tools.jsx:applyZoom', err); }
    };

    return (
      <ModalShell open={open} title={t("tools.camera") || "Camera"} width={520} zIndex={220} onClose={c}>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 800 }}>Pan sensitivity</div>
          <input type="range" min="1" max="400" step="1" value={pan} onChange={(e) => applyPan(e.target.value)} />
          <div style={{ marginTop: 12, fontWeight: 800 }}>Zoom (wheel) precision</div>
          <input type="range" min="0.5" max="8" step="0.1" value={zoom} onChange={(e) => applyZoom(e.target.value)} />

          <div className="modal-actions" style={{ marginTop: 14 }}>
            <button className="btn" type="button" onClick={c}>Close</button>
          </div>
        </div>
      </ModalShell>
    );
  };

  // Utilities modal (screenshot, scene info)
  const UtilsModal = ({ open, onClose: c }) => {
    const [sceneInfo, setSceneInfo] = useState(null);

    const screenshot = () => {
      try {
        const inst = typeof getInstance === "function" ? getInstance() : null;
        const canvas = (inst && inst.canvas) ? inst.canvas : document.querySelector(".scene-canvas");
        if (!canvas) return;
        const data = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = data;
        a.download = `${(inst && inst.name) ? inst.name.replace(/[^a-z0-9_-]+/gi, "_") : "scene"}_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) { console.error('Tools.jsx:Utils:screenshot', err); }
    };

    const gather = () => {
      try {
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return setSceneInfo(null);
        const info = {
          id: inst.id,
          name: inst.name,
          meshes: inst.meshMap ? Array.from(inst.meshMap.keys()).length : (inst.scene && inst.scene.meshes ? inst.scene.meshes.length : 0),
          lights: inst.listLights ? inst.listLights().length : (inst._lights ? inst._lights.size : 0),
          camera: !!inst.camera,
          grid: !!inst._gridVisible,
        };
        setSceneInfo(info);
        try { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(info, null, 2)); } catch (e) { }
      } catch (err) { console.error('Tools.jsx:Utils:gather', err); }
    };

    useEffect(() => { if (open) gather(); }, [open]);

    return (
      <ModalShell open={open} title={t("tools.utils") || "Utilities"} width={520} zIndex={220} onClose={c}>
        <div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={screenshot}>Screenshot</button>
            <button className="btn" onClick={gather}>Copy Scene Info</button>
            <button className="btn" onClick={() => { gather(); }}>Refresh</button>
          </div>

          {sceneInfo ? <pre style={{ whiteSpace: "pre-wrap", marginTop: 10, background: "rgba(255,255,255,0.02)", padding: 10, borderRadius: 6 }}>{JSON.stringify(sceneInfo, null, 2)}</pre> : null}

          <div className="modal-actions" style={{ marginTop: 14 }}>
            <button className="btn" type="button" onClick={c}>Close</button>
          </div>
        </div>
      </ModalShell>
    );
  };

  // Shadows modal
  const ShadowsModal = ({ open, onClose: c }) => {
    const [enabled, setEnabled] = useState(false);
    const [quality, setQuality] = useState(1024);

    const refresh = () => {
      try {
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return;
        const scene = inst.scene || null;
        if (!scene) return;
        // best-effort: try several flags
        const val = !!(inst._shadowsEnabled || scene._shadowsEnabled || scene.shadowsEnabled);
        setEnabled(val);
        setQuality((inst._shadowQuality) || (scene._shadowMapSize && scene._shadowMapSize) || 1024);
      } catch (err) { console.error('Tools.jsx:Shadows:refresh', err); }
    };

    useEffect(() => { if (open) refresh(); }, [open]);

    const applyEnabled = (v) => {
      try {
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return;
        const scene = inst.scene || null;
        if (inst.setShadowsEnabled) inst.setShadowsEnabled(Boolean(v));
        try { if (scene) scene.shadowsEnabled = Boolean(v); } catch (e) { }
        // attempt to toggle known shadowGenerators
        try {
          if (scene && scene.lights) {
            scene.lights.forEach((L) => {
              try {
                if (L.getShadowGenerator) {
                  const g = L.getShadowGenerator && L.getShadowGenerator();
                  if (g) g._renderList && (g.isReady && (g.isReady = Boolean(v)));
                }
              } catch (e) { }
            });
          }
        } catch (e) { }
        setEnabled(Boolean(v));
      } catch (err) { console.error('Tools.jsx:Shadows:applyEnabled', err); }
    };

    const applyQuality = (q) => {
      try {
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return;
        const scene = inst.scene || null;
        setQuality(Number(q));
        // adjust known shadow generator map size if available
        try {
          if (scene && scene.lights) {
            scene.lights.forEach((L) => {
              try {
                if (L.getShadowGenerator) {
                  const g = L.getShadowGenerator && L.getShadowGenerator();
                  if (g && g.mapSize) {
                    g.mapSize = Number(q);
                  }
                }
              } catch (e) { }
            });
          }
        } catch (e) { console.error('Tools.jsx:Shadows:applyEnabled:inner', e); }
      } catch (err) { void err; }
    };

    return (
      <ModalShell open={open} title={t("tools.shadows") || "Shadows"} width={520} zIndex={220} onClose={c}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Shadows</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>Enable
              <input type="checkbox" checked={enabled} onChange={(e) => applyEnabled(e.target.checked)} />
            </label>
            <div style={{ marginLeft: 12 }}>
              <div style={{ fontWeight: 700 }}>Quality</div>
              <select value={quality} onChange={(e) => applyQuality(e.target.value)}>
                <option value={512}>512</option>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
              </select>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 14 }}>
            <button className="btn" type="button" onClick={c}>Close</button>
          </div>
        </div>
      </ModalShell>
    );
  };

  // Rendering modal (background, grid)
  const RenderingModal = ({ open, onClose: c }) => {
    const [bg, setBg] = useState('#000000');
    const [gridVisible, setGridVisible] = useState(true);

    useEffect(() => {
      if (!open) return;
      try {
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return;
        const scene = inst.scene || null;
        if (scene && scene.clearColor) {
          try {
            const cc = scene.clearColor;
            setBg(`#${((1 << 24) + (Math.floor(cc.r * 255) << 16) + (Math.floor(cc.g * 255) << 8) + Math.floor(cc.b * 255)).toString(16).slice(1)}`);
          } catch (e) { console.error('Tools.jsx:Shadows:applyQuality:inner', e); }
        }
        setGridVisible(!!(inst._gridVisible || inst.gridVisible));
      } catch (err) { console.error('Tools.jsx:Rendering:useEffect', err); }
    }, [open]);

    const applyBg = (hex) => {
      try {
        setBg(hex);
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return;
        const scene = inst.scene || null;
        if (!scene) return;
        const c = hex.replace('#','');
        const r = parseInt(c.substring(0,2),16)/255;
        const g = parseInt(c.substring(2,4),16)/255;
        const b = parseInt(c.substring(4,6),16)/255;
        scene.clearColor = new Color4(r,g,b,1);
      } catch (err) { console.error('Tools.jsx:Rendering:applyBg', err); }
    };

    const applyGrid = (v) => {
      try {
        setGridVisible(Boolean(v));
        const inst = typeof getInstance === "function" ? getInstance() : null;
        if (!inst) return;
        if (inst.setGridVisible) inst.setGridVisible(Boolean(v));
      } catch (err) { console.error('Tools.jsx:Rendering:applyGrid', err); }
    };

    return (
      <ModalShell open={open} title={t("tools.rendering") || "Rendering"} width={520} zIndex={220} onClose={c}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Background Color</div>
          <input type="color" value={bg} onChange={(e) => applyBg(e.target.value)} />

          <div style={{ marginTop: 12, fontWeight: 800 }}>Grid</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={gridVisible} onChange={(e) => applyGrid(e.target.checked)} /> Show Grid
          </label>

          <div className="modal-actions" style={{ marginTop: 14 }}>
            <button className="btn" type="button" onClick={c}>Close</button>
          </div>
        </div>
      </ModalShell>
    );
  };

  if (!open) return null;

  // dropdown ref placeholder (no-op)
  const dropdownRef = (el) => {
    if (!el) return;
  };

  // When no specific tool active, show dropdown (non-modal)
  if (!activeTool) {
    const style = anchorRect ? { position: "fixed", top: (anchorRect.top + anchorRect.height + 8) + "px", left: (anchorRect.left) + "px" } : { position: "fixed", top: 56, left: 120 };
    return (
      <div id="tools-dropdown-panel" ref={dropdownRef} className="tools-dropdown" style={style}>
        <div className="tools-header">Tools</div>
            <div className="tools-list">
              <MenuItem onClick={() => setActiveTool("lighting")}>Lighting</MenuItem>
              <MenuItem onClick={() => setActiveTool("shadows")}>Shadows</MenuItem>
              <MenuItem onClick={() => setActiveTool("camera")}>Camera Sensitivity</MenuItem>
              <MenuItem onClick={() => setActiveTool("rendering")}>Rendering</MenuItem>
              <MenuItem onClick={() => setActiveTool("utils")}>Utilities <span className="muted">(Screenshot / Info)</span></MenuItem>
              <MenuItem onClick={() => { try { const inst = typeof getInstance === "function" ? getInstance() : null; if (inst) inst.setAxesVisible && inst.setAxesVisible(!inst.isAxesVisible()); } catch (e) {} }}>Toggle Axes</MenuItem>
            </div>
        <div className="tools-footer">
          <button className="btn tools-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // Active tool rendering
  if (activeTool === "lighting") return <LightingModal open={true} onClose={() => setActiveTool(null)} />;
  if (activeTool === "camera") return <CameraModal open={true} onClose={() => setActiveTool(null)} />;
  if (activeTool === "utils") return <UtilsModal open={true} onClose={() => setActiveTool(null)} />;
  if (activeTool === "shadows") return <ShadowsModal open={true} onClose={() => setActiveTool(null)} />;
  if (activeTool === "rendering") return <RenderingModal open={true} onClose={() => setActiveTool(null)} />;

  return null;
}

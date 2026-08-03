import ModalShell from "./ModalShell";
import SceneCodeModal from "./SceneCodeModal";
import { useState } from "react";

export default function SceneDetailModal({ open, scene = null, onClose }) {
  const [showJson, setShowJson] = useState(false);
  if (!open || !scene) return null;

  const handleCopyId = async () => {
    try { await navigator.clipboard.writeText(scene.id); } catch { void 0; }
  };

  return (
    <>
      <ModalShell open={open} title={`Scene — ${scene.name || scene.id}`} onClose={onClose} width={720}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>{scene.name}</div>
            <div style={{ color: "var(--muted)", marginBottom: 12 }}>ID: <span style={{ fontFamily: "monospace" }}>{scene.id}</span></div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Preview</div>
            <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)", maxHeight: 220, overflow: "auto" }}>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(scene.json || {}, null, 2)}</pre>
            </div>
          </div>
          <div style={{ width: 140, display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn" type="button" onClick={handleCopyId}>Copy ID</button>
            <button className="btn" type="button" onClick={() => setShowJson(true)}>Show JSON</button>
            <button className="btn btn-warn" type="button" onClick={() => { onClose && onClose(); }}>Close</button>
          </div>
        </div>
      </ModalShell>
      {showJson ? <SceneCodeModal open={true} onClose={() => setShowJson(false)} sceneJson={scene.json} /> : null}
    </>
  );
}

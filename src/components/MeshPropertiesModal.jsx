// src/components/MeshPropertiesModal.jsx
import ModalShell from "./ModalShell.jsx";

function KV({ k, v }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 900 }}>{k}</div>
      <div style={{ color: "var(--text)", fontSize: 12, fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace)" }}>{v}</div>
    </div>
  );
}

function fmtVec3(vec) {
  if (!vec) return "(none)";
  const x = Number(vec.x ?? 0).toFixed(3);
  const y = Number(vec.y ?? 0).toFixed(3);
  const z = Number(vec.z ?? 0).toFixed(3);
  return `(${x}, ${y}, ${z})`;
}

export default function MeshPropertiesModal({ open, meshMeta, onClose }) {
  const title = meshMeta ? `Mesh Properties — ${meshMeta.name || meshMeta.id}` : "Mesh Properties";

  return (
    <ModalShell open={open} title={title} subtitle={meshMeta ? meshMeta.id : ""} width={720} zIndex={210} onClose={onClose}>
      {!meshMeta ? (
        <div style={{ color: "var(--muted)", padding: 10 }}>No mesh selected.</div>
      ) : (
        <div style={{ maxHeight: "68vh", overflow: "auto", paddingRight: 8 }}>
          <KV k="id" v={meshMeta.id} />
          <KV k="name" v={meshMeta.name || ""} />
          <KV k="kind" v={meshMeta.kind} />
          <KV k="parent" v={meshMeta.parent || "(none)"} />
          <KV k="position" v={fmtVec3(meshMeta.position)} />
          <KV k="rotation" v={fmtVec3(meshMeta.rotation)} />
          <KV k="scaling" v={fmtVec3(meshMeta.scaling)} />
          <KV k="material" v={meshMeta.material ? JSON.stringify(meshMeta.material) : "(none)"} />
          <KV k="params" v={meshMeta.params ? JSON.stringify(meshMeta.params) : "(none)"} />
          <KV k="scripts" v={meshMeta.scripts ? "(configured)" : "(none)"} />
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 14 }}>
        <button className="btn btn-primary" type="button" onClick={() => onClose && onClose()}>Close</button>
      </div>
    </ModalShell>
  );
}

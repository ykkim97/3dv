import React, { useState, useEffect } from "react";

function NumberInput({ label, value, onChange, step = 0.1 }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label className="inspector-label">{label}</label>
      <input className="input inspector-input" type="number" value={value} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function color3ToHex(c) {
  const r = Math.max(0, Math.min(255, Math.round((c.r ?? 0) * 255)));
  const g = Math.max(0, Math.min(255, Math.round((c.g ?? 0) * 255)));
  const b = Math.max(0, Math.min(255, Math.round((c.b ?? 0) * 255)));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hexToColor3(hex) {
  const parsed = hex.replace("#", "");
  const int = parseInt(parsed, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  return { r, g, b };
}

// 컴포넌트 시그니처: meshes prop 추가
export default function MeshInspector({ meshMeta, meshes = [], onChange, onDelete }) {
  const [local, setLocal] = useState(meshMeta || null);
  useEffect(() => setLocal(meshMeta ? { ...meshMeta } : null), [meshMeta]);
  if (!local) return <div style={{ padding: 12, color: "#ddd" }}>Select a mesh to edit</div>;

  const apply = (patch) => {
    const updated = { ...local };
    if (patch.name !== undefined) updated.name = patch.name;
    if (patch.position) updated.position = { ...updated.position, ...patch.position };
    if (patch.rotation) updated.rotation = { ...updated.rotation, ...patch.rotation };
    if (patch.scaling) updated.scaling = { ...updated.scaling, ...patch.scaling };
    if (patch.material) updated.material = { ...updated.material, ...patch.material };
    if (patch.parent !== undefined) updated.parent = patch.parent;
    setLocal(updated);
    onChange && onChange(updated);
  };

  return (
    <div style={{ padding: 12, color: "#eee" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>{local.name}</h3>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{local.id}</div>
        </div>
        <button onClick={() => onDelete && onDelete(local.id)} style={{ padding: "6px 10px", background: "#ff6b6b", border: "none", color: "#fff", borderRadius: 8 }}>Delete</button>
      </div>

      <div className="inspector-section">
        <label className="inspector-label">Name</label>
        <input className="input" value={local.name} onChange={(e) => apply({ name: e.target.value })} />
      </div>

      <div className="inspector-section">
        <strong style={{ color: "#fff", display: "block", marginBottom: 8 }}>Position</strong>
        <div className="inspector-group">
          <input className="input" style={{ width: "33%" }} value={local.position.x} onChange={(e) => apply({ position: { x: Number(e.target.value) } })} />
          <input className="input" style={{ width: "33%" }} value={local.position.y} onChange={(e) => apply({ position: { y: Number(e.target.value) } })} />
          <input className="input" style={{ width: "33%" }} value={local.position.z} onChange={(e) => apply({ position: { z: Number(e.target.value) } })} />
        </div>
      </div>

      <div className="inspector-section">
        <strong style={{ color: "#fff", display: "block", marginBottom: 8 }}>Rotation (radians)</strong>
        <div className="inspector-group">
          <input className="input" style={{ width: "33%" }} value={local.rotation.x} onChange={(e) => apply({ rotation: { x: Number(e.target.value) } })} />
          <input className="input" style={{ width: "33%" }} value={local.rotation.y} onChange={(e) => apply({ rotation: { y: Number(e.target.value) } })} />
          <input className="input" style={{ width: "33%" }} value={local.rotation.z} onChange={(e) => apply({ rotation: { z: Number(e.target.value) } })} />
        </div>
      </div>

      <div className="inspector-section">
        <strong style={{ color: "#fff", display: "block", marginBottom: 8 }}>Scale</strong>
        <div className="inspector-group">
          <input className="input" style={{ width: "33%" }} value={local.scaling.x} onChange={(e) => apply({ scaling: { x: Number(e.target.value) } })} />
          <input className="input" style={{ width: "33%" }} value={local.scaling.y} onChange={(e) => apply({ scaling: { y: Number(e.target.value) } })} />
          <input className="input" style={{ width: "33%" }} value={local.scaling.z} onChange={(e) => apply({ scaling: { z: Number(e.target.value) } })} />
        </div>
      </div>

      <div className="inspector-section">
        <strong style={{ color: "#fff", display: "block", marginBottom: 8 }}>Material</strong>
        <div style={{ marginBottom: 8 }}>
          <label className="inspector-label">Color</label>
          <input className="input" type="color" value={color3ToHex(local.material.color)} onChange={(e) => apply({ material: { color: hexToColor3(e.target.value) } })} />
        </div>
      </div>

      <div className="inspector-section">
        <label className="inspector-label">Parent</label>
        <select className="input" value={local.parent || ""} onChange={(e) => {
          const v = e.target.value === "" ? null : e.target.value;
          apply({ parent: v });
        }}>
          <option value="">(None)</option>
          {meshes.filter(m => m.id !== local.id).map(m => (
            <option key={m.id} value={m.id}>{m.name || m.id}</option>
          ))}
        </select>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          Pick a parent to attach this mesh. Choose "(None)" to make it top-level.
        </div>
      </div>
    </div>
  );
}
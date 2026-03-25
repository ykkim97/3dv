import { useState } from "react";
import Tooltip from "./Tooltip.jsx";

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
export default function MeshInspector({ meshMeta, meshes = [], onChange, onDelete, onUnmerge, onOpenScript, runtimeMode = false, t = (s) => s }) {
  const [local, setLocal] = useState(() => (meshMeta ? { ...meshMeta } : null));
  if (!local) return <div style={{ padding: 12, color: "var(--muted)" }}>{t("inspector.select")}</div>;

  const matType = (local.material && typeof local.material.type === "string") ? local.material.type : "standard";

  const clamp01 = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  };

  const apply = (patch) => {
    const updated = { ...local };
    if (patch.name !== undefined) updated.name = patch.name;
    if (patch.position) updated.position = { ...updated.position, ...patch.position };
    if (patch.rotation) updated.rotation = { ...updated.rotation, ...patch.rotation };
    if (patch.scaling) updated.scaling = { ...updated.scaling, ...patch.scaling };
    if (patch.material) updated.material = { ...updated.material, ...patch.material };
    if (patch.parent !== undefined) updated.parent = patch.parent;
    if (patch.params) updated.params = { ...(updated.params || {}), ...(patch.params || {}) };
    setLocal(updated);
    onChange && onChange(updated);
  };

  return (
    <div className="inspector-root">
      <div className="inspector-header">
        <div className="inspector-titleblock">
          <div className="inspector-name">{local.name}</div>
          <div className="inspector-id">{local.id}</div>
        </div>
        <div className="inspector-actions">
          <Tooltip text={runtimeMode ? "Script editing is disabled in runtime mode" : "Edit scripts"}>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => onOpenScript && onOpenScript(local.id)}
              disabled={runtimeMode}
            >
              {t("inspector.script")}
            </button>
          </Tooltip>
          {local.kind === "merged" && typeof onUnmerge === "function" ? (
            <button className="btn btn-primary" type="button" onClick={() => onUnmerge(local.id)}>Unmerge</button>
          ) : null}
          <button className="btn btn-warn" type="button" onClick={() => onDelete && onDelete(local.id)}>{t("inspector.delete")}</button>
        </div>
      </div>

      <div className="inspector-form" aria-label="Mesh properties">
        <div className="inspector-row">
          <label className="inspector-label">Name</label>
          <input className="input" value={local.name} onChange={(e) => apply({ name: e.target.value })} />
        </div>

        <div className="inspector-row">
          <label className="inspector-label">Position</label>
          <div className="inspector-vector">
            <input className="input" type="number" step="0.1" value={local.position.x} onChange={(e) => apply({ position: { x: Number(e.target.value) } })} aria-label="Position X" />
            <input className="input" type="number" step="0.1" value={local.position.y} onChange={(e) => apply({ position: { y: Number(e.target.value) } })} aria-label="Position Y" />
            <input className="input" type="number" step="0.1" value={local.position.z} onChange={(e) => apply({ position: { z: Number(e.target.value) } })} aria-label="Position Z" />
          </div>
        </div>

        <div className="inspector-row">
          <label className="inspector-label">Rotation</label>
          <div className="inspector-vector">
            <input className="input" type="number" step="0.05" value={local.rotation.x} onChange={(e) => apply({ rotation: { x: Number(e.target.value) } })} aria-label="Rotation X" />
            <input className="input" type="number" step="0.05" value={local.rotation.y} onChange={(e) => apply({ rotation: { y: Number(e.target.value) } })} aria-label="Rotation Y" />
            <input className="input" type="number" step="0.05" value={local.rotation.z} onChange={(e) => apply({ rotation: { z: Number(e.target.value) } })} aria-label="Rotation Z" />
          </div>
        </div>

        <div className="inspector-row">
          <label className="inspector-label">Scale</label>
          <div className="inspector-vector">
            <input className="input" type="number" step="0.05" value={local.scaling.x} onChange={(e) => apply({ scaling: { x: Number(e.target.value) } })} aria-label="Scale X" />
            <input className="input" type="number" step="0.05" value={local.scaling.y} onChange={(e) => apply({ scaling: { y: Number(e.target.value) } })} aria-label="Scale Y" />
            <input className="input" type="number" step="0.05" value={local.scaling.z} onChange={(e) => apply({ scaling: { z: Number(e.target.value) } })} aria-label="Scale Z" />
          </div>
        </div>

        <div className="inspector-row">
          <label className="inspector-label">Color</label>
          <input className="input" type="color" value={color3ToHex(local.material.color)} onChange={(e) => apply({ material: { color: hexToColor3(e.target.value) } })} />
        </div>

        <div className="inspector-row">
          <label className="inspector-label">Material</label>
          <Tooltip text={runtimeMode ? "Disabled in runtime mode" : "Material type"}>
            <select
              className="input"
              value={matType}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "pbr") {
                  apply({ material: { type: "pbr", metallic: local.material?.metallic ?? 0, roughness: local.material?.roughness ?? 0.4, alpha: local.material?.alpha ?? 1 } });
                } else {
                  apply({ material: { type: "standard", specularPower: local.material?.specularPower ?? 64, alpha: local.material?.alpha ?? 1 } });
                }
              }}
              disabled={runtimeMode}
            >
              <option value="standard">Standard</option>
              <option value="pbr">PBR</option>
            </select>
          </Tooltip>
        </div>

        {matType === "standard" ? (
          <div className="inspector-row">
            <label className="inspector-label">Specular Power</label>
            <input
              className="input"
              type="number"
              step="1"
              value={Number(local.material?.specularPower ?? 64)}
              onChange={(e) => apply({ material: { specularPower: Math.max(0, Number(e.target.value) || 0) } })}
              disabled={runtimeMode}
            />
          </div>
        ) : null}

        {matType === "pbr" ? (
          <>
            <div className="inspector-row">
              <label className="inspector-label">Metallic (0..1)</label>
              <input
                className="input"
                type="number"
                step="0.05"
                value={Number(local.material?.metallic ?? 0)}
                onChange={(e) => apply({ material: { metallic: clamp01(e.target.value) } })}
                disabled={runtimeMode}
              />
            </div>

            <div className="inspector-row">
              <label className="inspector-label">Roughness (0..1)</label>
              <input
                className="input"
                type="number"
                step="0.05"
                value={Number(local.material?.roughness ?? 0.4)}
                onChange={(e) => apply({ material: { roughness: clamp01(e.target.value) } })}
                disabled={runtimeMode}
              />
            </div>
          </>
        ) : null}

        <div className="inspector-row">
          <label className="inspector-label">Alpha (0..1)</label>
          <input
            className="input"
            type="number"
            step="0.05"
            value={Number(local.material?.alpha ?? 1)}
            onChange={(e) => apply({ material: { alpha: clamp01(e.target.value) } })}
            disabled={runtimeMode}
          />
        </div>

        {local.kind === "textbox" ? (
          <div className="inspector-row">
            <label className="inspector-label">Text</label>
            <input
              className="input"
              value={(local.params && typeof local.params.text === 'string') ? local.params.text : ""}
              onChange={(e) => apply({ params: { text: e.target.value } })}
              placeholder="Text"
            />
          </div>
        ) : null}

        <div className="inspector-row">
          <label className="inspector-label">Parent</label>
          <select className="input" value={local.parent || ""} onChange={(e) => {
            const v = e.target.value === "" ? null : e.target.value;
            apply({ parent: v });
          }}>
            <option value="">(None)</option>
            {meshes.filter((m) => m.id !== local.id).map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.id}</option>
            ))}
          </select>
        </div>

        <div className="inspector-help">
          Parent를 지정하면 해당 메쉬에 종속됩니다.
        </div>
      </div>
    </div>
  );
}
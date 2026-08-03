import { useEffect, useState } from "react";
import { CONTOUR_COLOR_PRESETS, DEFAULT_CONTOUR_COLOR_PRESET } from "../ui/contourColorPresets";
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

function flattenNumericValues(input) {
  const out = [];
  const visit = (item) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
    } else {
      const n = Number(item);
      out.push(Number.isFinite(n) ? n : 0);
    }
  };
  visit(input);
  return out;
}

function inferContourDimensions(input) {
  if (!Array.isArray(input) || !input.length) return null;
  if (!Array.isArray(input[0])) return null;
  if (Array.isArray(input[0][0])) {
    const z = input.length;
    let y = 0;
    let x = 0;
    input.forEach((plane) => {
      if (!Array.isArray(plane)) return;
      y = Math.max(y, plane.length);
      plane.forEach((row) => {
        if (Array.isArray(row)) x = Math.max(x, row.length);
      });
    });
    return x && y && z ? { x, y, z } : null;
  }
  const y = input.length;
  const x = input.reduce((max, row) => Array.isArray(row) ? Math.max(max, row.length) : max, 0);
  return x && y ? { x, y, z: 1 } : null;
}

function parseContourValues(text) {
  const raw = String(text || "").trim();
  if (!raw) return { values: [], dimensions: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      values: flattenNumericValues(parsed),
      dimensions: inferContourDimensions(parsed),
    };
  } catch {
    return {
      values: raw
        .split(/[\s,;]+/)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item)),
      dimensions: null,
    };
  }
}

function getContourAutoRange(values) {
  const active = flattenNumericValues(Array.isArray(values) ? values : []).filter((value) => Number.isFinite(value) && value !== 0);
  if (!active.length) return { min: 0, max: 1 };
  const min = Math.min(...active);
  const max = Math.max(...active);
  if (max === min) return { min: min < 0 ? min : 0, max: min < 0 ? 0 : min };
  return { min, max };
}

function clampIndex(value, max) {
  return Math.max(0, Math.min(Math.max(0, max), Math.floor(Number(value) || 0)));
}

function getSliceMaxIndex(dimensions, axis) {
  const dim = dimensions || {};
  return Math.max(0, Number(dim[axis || "z"] || 1) - 1);
}

// 컴포넌트 시그니처: meshes prop 추가
export default function MeshInspector({ meshMeta, meshes = [], onChange, onDelete, onUnmerge, onOpenScript, runtimeMode = false, t = (s) => s }) {
  const [local, setLocal] = useState(() => (meshMeta ? { ...meshMeta } : null));
  const [contourValuesText, setContourValuesText] = useState("");

  useEffect(() => {
    setLocal(meshMeta ? { ...meshMeta } : null);
    if (meshMeta?.kind === "contour") {
      setContourValuesText(JSON.stringify(meshMeta.params?.values || []));
    } else {
      setContourValuesText("");
    }
  }, [meshMeta]);

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

  const applyContourSlice = (slicePatch) => {
    const prev = local.params?.slice || {};
    const axis = slicePatch.axis || prev.axis || "z";
    const max = getSliceMaxIndex(local.params?.dimensions, axis);
    const next = {
      enabled: prev.enabled === true,
      axis,
      index: clampIndex(prev.index ?? max, max),
      cumulative: prev.cumulative === true,
      quadMode: prev.quadMode === true,
      quadrants: Array.isArray(prev.quadrants) ? prev.quadrants.slice(0, 4) : [max, max, max, max],
      ...slicePatch,
    };
    next.index = clampIndex(next.index, max);
    next.quadrants = [0, 1, 2, 3].map((i) => clampIndex(next.quadrants?.[i] ?? next.index, max));
    apply({ params: { slice: next } });
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

        {local.kind !== "contour" ? (
          <div className="inspector-row">
            <label className="inspector-label">Color</label>
            <input className="input" type="color" value={color3ToHex(local.material.color)} onChange={(e) => apply({ material: { color: hexToColor3(e.target.value) } })} />
          </div>
        ) : null}

        {local.kind !== "contour" ? (
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
        ) : null}

        {local.kind !== "contour" && matType === "standard" ? (
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

        {local.kind !== "contour" && matType === "pbr" ? (
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

        {local.kind !== "contour" ? (
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
        ) : null}

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

        {local.kind === "plane" ? (
          <>
            <div className="inspector-row">
              <label className="inspector-label">Width</label>
              <input className="input" type="number" step="0.1" value={Number(local.params?.width ?? 1)} onChange={(e) => apply({ params: { width: Number(e.target.value) } })} />
            </div>
            <div className="inspector-row">
              <label className="inspector-label">Height</label>
              <input className="input" type="number" step="0.1" value={Number(local.params?.height ?? 1)} onChange={(e) => apply({ params: { height: Number(e.target.value) } })} />
            </div>
          </>
        ) : null}

        {local.kind === "contour" ? (
          <>
            <div className="inspector-row">
              <label className="inspector-label">Subdivision</label>
              <div className="inspector-vector">
                <input className="input" type="number" min="1" max="64" step="1" value={Number(local.params?.dimensions?.x ?? 5)} onChange={(e) => apply({ params: { autoDimensions: false, dimensions: { ...(local.params?.dimensions || {}), x: Number(e.target.value) || 1 } } })} aria-label="Contour X cells" />
                <input className="input" type="number" min="1" max="64" step="1" value={Number(local.params?.dimensions?.y ?? 5)} onChange={(e) => apply({ params: { autoDimensions: false, dimensions: { ...(local.params?.dimensions || {}), y: Number(e.target.value) || 1 } } })} aria-label="Contour Y cells" />
                <input className="input" type="number" min="1" max="64" step="1" value={Number(local.params?.dimensions?.z ?? 5)} onChange={(e) => apply({ params: { autoDimensions: false, dimensions: { ...(local.params?.dimensions || {}), z: Number(e.target.value) || 1 } } })} aria-label="Contour Z cells" />
              </div>
            </div>

            <label className="inspector-check-row">
              <input
                type="checkbox"
                checked={local.params?.autoDimensions !== false}
                onChange={(e) => {
                  const parsed = parseContourValues(contourValuesText);
                  apply({
                    params: {
                      autoDimensions: e.target.checked,
                      ...(e.target.checked && parsed.dimensions ? { dimensions: parsed.dimensions } : {}),
                    },
                  });
                }}
              />
              <span>Auto subdivision from data array</span>
            </label>

            <div className="inspector-row">
              <label className="inspector-label">Volume Size</label>
              <div className="inspector-vector">
                <input className="input" type="number" min="0.01" step="0.1" value={Number(local.params?.size?.x ?? 5)} onChange={(e) => apply({ params: { size: { ...(local.params?.size || {}), x: Number(e.target.value) || 5 } } })} aria-label="Contour width" />
                <input className="input" type="number" min="0.01" step="0.1" value={Number(local.params?.size?.y ?? 5)} onChange={(e) => apply({ params: { size: { ...(local.params?.size || {}), y: Number(e.target.value) || 5 } } })} aria-label="Contour height" />
                <input className="input" type="number" min="0.01" step="0.1" value={Number(local.params?.size?.z ?? 5)} onChange={(e) => apply({ params: { size: { ...(local.params?.size || {}), z: Number(e.target.value) || 5 } } })} aria-label="Contour depth" />
              </div>
            </div>

            <div className="inspector-row">
              <label className="inspector-label">Auto Range</label>
              <div className="inspector-vector">
                <input className="input" type="number" value={getContourAutoRange(local.params?.values).min} readOnly aria-label="Contour auto min value" />
                <input className="input" type="number" value={getContourAutoRange(local.params?.values).max} readOnly aria-label="Contour auto max value" />
                <input className="input" type="number" min="0.05" max="1" step="0.05" value={Number(local.params?.opacity ?? 0.78)} onChange={(e) => apply({ params: { opacity: clamp01(e.target.value) || 0.05 } })} aria-label="Contour opacity" />
              </div>
            </div>

            <div className="inspector-row">
              <label className="inspector-label">Color Preset</label>
              <select
                className="input"
                value={local.params?.colorPreset || DEFAULT_CONTOUR_COLOR_PRESET}
                onChange={(e) => apply({ params: { colorPreset: e.target.value } })}
              >
                {CONTOUR_COLOR_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </div>

            <div className="inspector-row">
              <label className="inspector-label">Slice</label>
              <div className="contour-slice-panel">
                <label className="inspector-check-row compact">
                  <input
                    type="checkbox"
                    checked={local.params?.slice?.enabled === true}
                    onChange={(e) => applyContourSlice({ enabled: e.target.checked })}
                  />
                  <span>Enable slicing</span>
                </label>

                <div className="contour-slice-grid">
                  <select
                    className="input"
                    value={local.params?.slice?.axis || "z"}
                    onChange={(e) => {
                      const axis = e.target.value;
                      const max = getSliceMaxIndex(local.params?.dimensions, axis);
                      applyContourSlice({ enabled: true, axis, index: max, quadrants: [max, max, max, max] });
                    }}
                    aria-label="Slice axis"
                  >
                    <option value="z">Z Slice</option>
                    <option value="x">X Slice</option>
                    <option value="y">Y Slice</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max={getSliceMaxIndex(local.params?.dimensions, local.params?.slice?.axis || "z")}
                    step="1"
                    value={Number(local.params?.slice?.index ?? getSliceMaxIndex(local.params?.dimensions, local.params?.slice?.axis || "z"))}
                    onChange={(e) => applyContourSlice({ enabled: true, index: Number(e.target.value) })}
                    aria-label="Slice index"
                    disabled={local.params?.slice?.quadMode === true}
                  />
                </div>

                {local.params?.slice?.quadMode !== true ? (
                  <input
                    className="contour-slice-slider"
                    type="range"
                    min="0"
                    max={getSliceMaxIndex(local.params?.dimensions, local.params?.slice?.axis || "z")}
                    step="1"
                    value={Number(local.params?.slice?.index ?? getSliceMaxIndex(local.params?.dimensions, local.params?.slice?.axis || "z"))}
                    onChange={(e) => applyContourSlice({ enabled: true, index: Number(e.target.value) })}
                    aria-label="Slice index slider"
                  />
                ) : null}

                <div className="contour-slice-options">
                  <label className="inspector-check-row compact">
                    <input
                      type="checkbox"
                      checked={local.params?.slice?.cumulative === true}
                      onChange={(e) => applyContourSlice({ enabled: true, cumulative: e.target.checked })}
                    />
                    <span>Cumulative</span>
                  </label>
                  <label className="inspector-check-row compact">
                    <input
                      type="checkbox"
                      checked={local.params?.slice?.quadMode === true}
                      onChange={(e) => {
                        const max = getSliceMaxIndex(local.params?.dimensions, local.params?.slice?.axis || "z");
                        const current = clampIndex(local.params?.slice?.index ?? max, max);
                        applyContourSlice({ enabled: true, quadMode: e.target.checked, quadrants: [current, current, current, current] });
                      }}
                    />
                    <span>4-quad slice</span>
                  </label>
                </div>

                {local.params?.slice?.quadMode === true ? (
                  <div className="contour-quad-grid">
                    {["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
                      const max = getSliceMaxIndex(local.params?.dimensions, local.params?.slice?.axis || "z");
                      const quadrants = Array.isArray(local.params?.slice?.quadrants) ? local.params.slice.quadrants : [max, max, max, max];
                      return (
                        <label key={label} className="contour-quad-field">
                          <span>{label}</span>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            max={max}
                            step="1"
                            value={Number(quadrants[i] ?? max)}
                            onChange={(e) => {
                              const next = quadrants.slice(0, 4);
                              next[i] = Number(e.target.value);
                              applyContourSlice({ enabled: true, quadrants: next });
                            }}
                          />
                          <input
                            className="contour-slice-slider"
                            type="range"
                            min="0"
                            max={max}
                            step="1"
                            value={Number(quadrants[i] ?? max)}
                            onChange={(e) => {
                              const next = quadrants.slice(0, 4);
                              next[i] = Number(e.target.value);
                              applyContourSlice({ enabled: true, quadrants: next });
                            }}
                            aria-label={`${label} slice slider`}
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="inspector-row">
              <label className="inspector-label">Cell Gap</label>
              <input className="input" type="number" min="0" max="0.45" step="0.01" value={Number(local.params?.cellGap ?? 0)} onChange={(e) => apply({ params: { cellGap: Math.max(0, Math.min(0.45, Number(e.target.value) || 0)) } })} />
            </div>

            <div className="inspector-row">
              <label className="inspector-label">Data Array</label>
              <textarea
                className="input contour-data-input"
                value={contourValuesText}
                rows={7}
                spellCheck={false}
                onChange={(e) => {
                  const text = e.target.value;
                  setContourValuesText(text);
                  const parsed = parseContourValues(text);
                  if (parsed.values.length) {
                    apply({
                      params: {
                        values: parsed.values,
                        ...(local.params?.autoDimensions !== false && parsed.dimensions ? { dimensions: parsed.dimensions } : {}),
                      },
                    });
                  }
                }}
                placeholder="[0, 0.2, 1, ...]"
              />
            </div>
          </>
        ) : null}

        {local.kind === "arrow" ? (
          <>
            <div className="inspector-row">
              <label className="inspector-label">Length</label>
              <input className="input" type="number" step="0.05" value={Number(local.params?.length ?? 1)} onChange={(e) => apply({ params: { length: Number(e.target.value) } })} />
            </div>
            <div className="inspector-row">
              <label className="inspector-label">Shaft Diameter</label>
              <input className="input" type="number" step="0.01" value={Number(local.params?.shaftDiameter ?? 0.06)} onChange={(e) => apply({ params: { shaftDiameter: Number(e.target.value) } })} />
            </div>
            <div className="inspector-row">
              <label className="inspector-label">Head Height</label>
              <input className="input" type="number" step="0.01" value={Number(local.params?.headHeight ?? 0.18)} onChange={(e) => apply({ params: { headHeight: Number(e.target.value) } })} />
            </div>
            <div className="inspector-row">
              <label className="inspector-label">Head Diameter</label>
              <input className="input" type="number" step="0.01" value={Number(local.params?.headDiameter ?? 0.12)} onChange={(e) => apply({ params: { headDiameter: Number(e.target.value) } })} />
            </div>
          </>
        ) : null}

        {local.kind === "dome" ? (
          <>
            <div className="inspector-row">
              <label className="inspector-label">Diameter</label>
              <input className="input" type="number" step="0.05" value={Number(local.params?.diameter ?? 1)} onChange={(e) => apply({ params: { diameter: Number(e.target.value) } })} />
            </div>
            <div className="inspector-row">
              <label className="inspector-label">Segments</label>
              <input className="input" type="number" step="1" value={Number(local.params?.segments ?? 24)} onChange={(e) => apply({ params: { segments: Number(e.target.value) } })} />
            </div>
          </>
        ) : null}

        {local.kind === "capsule" ? (
          <>
            <div className="inspector-row">
              <label className="inspector-label">Height</label>
              <input className="input" type="number" step="0.05" value={Number(local.params?.height ?? 1)} onChange={(e) => apply({ params: { height: Number(e.target.value) } })} />
            </div>
            <div className="inspector-row">
              <label className="inspector-label">Radius</label>
              <input className="input" type="number" step="0.01" value={Number(local.params?.radius ?? 0.25)} onChange={(e) => apply({ params: { radius: Number(e.target.value) } })} />
            </div>
          </>
        ) : null}

        {local.kind === "tube" ? (
          <>
            <div className="inspector-row">
              <label className="inspector-label">Length</label>
              <input className="input" type="number" step="0.05" value={Number((local.params?.path && local.params.path[1]?.y) || 1)} onChange={(e) => {
                const l = Number(e.target.value);
                apply({ params: { path: [{ x: 0, y: 0, z: 0 }, { x: 0, y: l, z: 0 }] } });
              }} />
            </div>
            <div className="inspector-row">
              <label className="inspector-label">Radius</label>
              <input className="input" type="number" step="0.01" value={Number(local.params?.radius ?? 0.05)} onChange={(e) => apply({ params: { radius: Number(e.target.value) } })} />
            </div>
          </>
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

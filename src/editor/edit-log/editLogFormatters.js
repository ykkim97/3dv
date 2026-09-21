export function formatLogTime(date = new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function formatMeshLabel(metaOrId) {
  if (!metaOrId) return "unknown";
  if (typeof metaOrId === "string") return metaOrId;
  const name = metaOrId.name || metaOrId.id || "unnamed";
  return metaOrId.id && metaOrId.id !== name ? `${name} (${metaOrId.id})` : name;
}

export function formatVector(vector = {}) {
  const number = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00";
  return `(${number(vector.x)}, ${number(vector.y)}, ${number(vector.z)})`;
}

function sameJSON(left, right) {
  try { return JSON.stringify(left ?? null) === JSON.stringify(right ?? null); } catch { return left === right; }
}

function vectorChanged(left = {}, right = {}) {
  return ["x", "y", "z"].some((key) => Number(left?.[key] ?? 0) !== Number(right?.[key] ?? 0));
}

function colorChanged(left = {}, right = {}) {
  return ["r", "g", "b"].some((key) => Number(left?.[key] ?? 0) !== Number(right?.[key] ?? 0));
}

export function describeMeshEdit(previousMeta, nextMeta) {
  const changed = [];
  if ((previousMeta?.name || "") !== (nextMeta?.name || "")) changed.push("name");
  if (vectorChanged(previousMeta?.position, nextMeta?.position)) changed.push("position");
  if (vectorChanged(previousMeta?.rotation, nextMeta?.rotation)) changed.push("rotation");
  if (vectorChanged(previousMeta?.scaling, nextMeta?.scaling)) changed.push("scale");
  if ((previousMeta?.parent || "") !== (nextMeta?.parent || "")) changed.push("parent");
  if (!sameJSON(previousMeta?.params, nextMeta?.params)) changed.push("params");
  if (!sameJSON(previousMeta?.material, nextMeta?.material)) changed.push("material");

  if (colorChanged(previousMeta?.material?.color, nextMeta?.material?.color)) return { action: "COLOR", message: `${formatMeshLabel(nextMeta)} color changed` };
  if (vectorChanged(previousMeta?.position, nextMeta?.position)) return { action: "MOVE", message: `${formatMeshLabel(nextMeta)} moved to ${formatVector(nextMeta.position)}` };
  if (vectorChanged(previousMeta?.rotation, nextMeta?.rotation)) return { action: "ROTATE", message: `${formatMeshLabel(nextMeta)} rotation set to ${formatVector(nextMeta.rotation)}` };
  if (vectorChanged(previousMeta?.scaling, nextMeta?.scaling)) return { action: "SCALE", message: `${formatMeshLabel(nextMeta)} scale set to ${formatVector(nextMeta.scaling)}` };
  return changed.length ? { action: "EDIT", message: `${formatMeshLabel(nextMeta)} updated: ${changed.join(", ")}` } : null;
}

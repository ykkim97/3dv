const JSON_FILTER = [{ name: "Lumatrix scene", extensions: ["json"] }];
const MODEL_FILTER = [{ name: "3D model", extensions: ["glb", "gltf", "obj"] }];

export function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

async function loadDesktopApis() {
  const [{ invoke }, dialog] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/plugin-dialog"),
  ]);
  return { invoke, ...dialog };
}

function fileNameFromPath(path) {
  return String(path).split(/[\\/]/).pop() || "file";
}

export async function saveSceneOnDesktop(scene, suggestedName) {
  const { invoke, save } = await loadDesktopApis();
  const path = await save({
    defaultPath: suggestedName,
    filters: JSON_FILTER,
  });
  if (!path) return false;

  await invoke("save_scene_file", {
    path,
    contents: JSON.stringify(scene, null, 2),
  });
  return true;
}

export async function openSceneOnDesktop() {
  const { invoke, open } = await loadDesktopApis();
  const path = await open({ multiple: false, directory: false, filters: JSON_FILTER });
  if (!path || Array.isArray(path)) return null;
  const contents = await invoke("read_scene_file", { path });
  return { fileName: fileNameFromPath(path), contents };
}

export async function openModelOnDesktop() {
  const { invoke, open } = await loadDesktopApis();
  const path = await open({ multiple: false, directory: false, filters: MODEL_FILTER });
  if (!path || Array.isArray(path)) return null;

  const payload = await invoke("read_asset_file", { path });
  const bytes = payload instanceof ArrayBuffer ? new Uint8Array(payload) : new Uint8Array(payload);
  const fileName = fileNameFromPath(path);
  const extension = fileName.split(".").pop()?.toLowerCase();
  const mimeType = extension === "glb" ? "model/gltf-binary" : extension === "gltf" ? "model/gltf+json" : "text/plain";
  return new File([bytes], fileName, { type: mimeType });
}

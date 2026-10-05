const JSON_FILTER = [{ name: "Lumatrix scene", extensions: ["json"] }];

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

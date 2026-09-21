export function downloadSceneJson(scene, filename = "scene.json") {
  const href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(scene, null, 2))}`;
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  anchor.setAttribute("download", filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

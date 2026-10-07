import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';

// Fit all eight corners in the unobstructed rectangle, at the current viewing angle.
export function selectionFrame(bounds, camera, viewport) {
  const { width, height, left = 0, right = 0, top = 0, bottom = 0 } = viewport;
  const usableWidth = Math.max(1, width - left - right), usableHeight = Math.max(1, height - top - bottom);
  const aspect = width / height, tangent = Math.tan(camera.fov / 2);
  const tanX = camera.fovMode === 1 ? tangent : tangent * aspect;
  const tanY = camera.fovMode === 1 ? tangent / aspect : tangent;
  const a = camera.alpha, b = camera.beta;
  const side = new Vector3(-Math.sin(a), 0, Math.cos(a));
  const up = new Vector3(-Math.cos(a) * Math.cos(b), Math.sin(b), -Math.sin(a) * Math.cos(b));
  const towardCamera = new Vector3(Math.cos(a) * Math.sin(b), Math.cos(b), Math.sin(a) * Math.sin(b));
  const center = bounds.min.add(bounds.max).scale(0.5);
  const shiftX = (right - left) / width * tanX, shiftY = (top - bottom) / height * tanY;
  let radius = 2;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const relative = new Vector3(x, y, z).subtract(center);
    const depth = Vector3.Dot(relative, towardCamera);
    const horizontal = Vector3.Dot(relative, side), vertical = Vector3.Dot(relative, up);
    // Shift the projection, keeping the orbit target at the actual selection centre.
    const halfX = tanX * usableWidth / width / 1.12, halfY = tanY * usableHeight / height / 1.12;
    radius = Math.max(radius, depth + Math.abs(horizontal - depth * shiftX) / halfX, depth + Math.abs(vertical - depth * shiftY) / halfY);
  }
  return { radius, target: center, screenOffset: { x: -radius * shiftX, y: -radius * shiftY } };
}

export function editorFrameViewport(canvas) {
  const rect = canvas.getBoundingClientRect(), root = canvas.closest('.city-app');
  const viewport = { width: rect.width, height: rect.height, left: 52, right: 12, top: 12, bottom: 28 };
  for (const [selector, edge] of [['.city-header', 'top'], ['.world-summary', 'top'], ['.bottom-workspace', 'bottom'], ['.right-information-dock', 'right']]) {
    const element = root?.querySelector(selector), box = element?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) continue;
    viewport[edge] = Math.max(viewport[edge], edge === 'top' ? box.bottom - rect.top + 12 : edge === 'bottom' ? rect.bottom - box.top + 12 : rect.right - box.left + 12);
  }
  return viewport;
}

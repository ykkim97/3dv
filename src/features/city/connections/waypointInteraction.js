import { Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Plane } from '@babylonjs/core/Maths/math.plane.js';
import { connectionIdFromPick } from './connectionRendering.js';
import { editWaypoint } from './connectionModel.js';

export function waypointInsertionIndex(city, line, point) {
  const from = city.objects.find(o => o.id === line.from), to = city.objects.find(o => o.id === line.to);
  const points = [from, ...(line.waypoints || []), to];
  let best = Infinity, index = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    const distance = Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
    if (distance < best) { best = distance; index = i - 1; }
  }
  return index;
}

export const waypointInteraction = {
  waypointPlanePoint(event, height) {
    const rect = this.canvas.getBoundingClientRect();
    const ray = this.scene.createPickingRay(event.clientX - rect.left, event.clientY - rect.top, Matrix.Identity(), this.camera);
    const distance = ray.intersectsPlane(new Plane(0, 1, 0, -height));
    return distance == null || distance < 0 ? null : ray.origin.add(ray.direction.scale(distance));
  },
  beginWaypointPointer(event) {
    const id = this.waypointConnectionId;
    if (!id) return false;
    const rect = this.canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    // Prioritize handles even when a tube crosses in front of the sphere.
    const hit = this.scene.pick(x, y, mesh => mesh.metadata?.waypointConnectionId === id);
    if (hit.hit) {
      const index = hit.pickedMesh.metadata.waypointIndex, height = hit.pickedMesh.position.y;
      const point = this.waypointPlanePoint(event, height);
      if (!point) return true;
      const original = this.city, waypoint = original.connections.find(c => c.id === id).waypoints[index];
      this.waypointDrag = { id, index, height, original, pointerId: event.pointerId, offset: { x: waypoint.x - point.x, z: waypoint.z - point.z }, startX: event.clientX, startY: event.clientY, moved: false };
      this.camera.detachControl(); this.canvas.setPointerCapture(event.pointerId);
      return true;
    }
    if (this.options.mode !== 'waypoint') return false;
    const lineHit = this.scene.pick(x, y, mesh => !!mesh.metadata?.connectionRanges || !!mesh.metadata?.connectionId);
    if (connectionIdFromPick(lineHit) !== id) { this.onMessage('선택한 연결선을 클릭해 점을 추가하거나, 경유점 구슬을 드래그하세요.'); return true; }
    const line = this.city.connections.find(c => c.id === id);
    const point = { x: lineHit.pickedPoint.x, z: lineHit.pickedPoint.z };
    try { this.onChange(editWaypoint(this.city, id, 'insert', waypointInsertionIndex(this.city, line, point), point)); }
    catch (error) { this.onMessage(error.message); }
    return true;
  },
  updateWaypointPointer(event) {
    const drag = this.waypointDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3 && !drag.moved) return;
    const point = this.waypointPlanePoint(event, drag.height);
    if (!point) return;
    try {
      this.city = editWaypoint(drag.original, drag.id, 'move', drag.index, { x: Math.round((point.x + drag.offset.x) * 10) / 10, z: Math.round((point.z + drag.offset.z) * 10) / 10 });
      drag.moved = true;
      this.updateConnections(); this.showConnectionWaypoints(drag.id, drag.index);
    } catch { /* Keep the last valid position when the pointer leaves the map. */ }
  },
  finishWaypointPointer(event, cancel = false) {
    const drag = this.waypointDrag;
    if (!drag || event && event.pointerId !== drag.pointerId) return;
    this.waypointDrag = null;
    const next = this.city;
    if (cancel || !drag.moved) { this.city = drag.original; this.updateConnections(); }
    this.showConnectionWaypoints(drag.id, -1);
    if (this.canvas.hasPointerCapture(drag.pointerId)) this.canvas.releasePointerCapture(drag.pointerId);
    this.camera.attachControl(this.canvas, true);
    if (!cancel && drag.moved) this.onChange(next); // One undo/autosave entry for the entire drag.
  },
};

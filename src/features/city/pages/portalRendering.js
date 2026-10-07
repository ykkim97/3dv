import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { portalPosition } from './portalModel.js';

export const portalRendering = {
  clearPortalHover() {
    const mesh = this.portalMeshes?.get(this.hoveredPortalId);
    if (mesh) mesh.renderOverlay = false;
    this.hoveredPortalId = null;
    this.onPortalHover?.(null);
  },
  updatePortalHover(event) {
    if (!this.portalHoverEnabled || this.options.mode !== 'select' || event.buttons || this.waypointDrag || this.roadEdit || this.plotEdit || this.boxSelection || this.options.boxSelect || !this.portalMeshes?.size) {
      if (this.hoveredPortalId) this.clearPortalHover();
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    // Most mouse moves miss a marker: only inspect detailed geometry near a portal.
    const candidate = this.scene.pick(x, y, mesh => !!mesh.metadata?.portalId && mesh.isPickable && mesh.isVisible && mesh.isEnabled());
    // Include foreground geometry so hidden portals do not show a tooltip.
    const hit = candidate?.pickedMesh?.metadata?.portalId ? this.scene.pick(x, y, mesh => mesh.isPickable && mesh.isVisible && mesh.isEnabled()) : null;
    const id = hit?.pickedMesh?.metadata?.portalId;
    if (id !== this.hoveredPortalId) {
      this.clearPortalHover();
      this.hoveredPortalId = id || null;
      const mesh = this.portalMeshes?.get(id);
      if (mesh) { mesh.renderOverlay = true; mesh.overlayColor = Color3.FromHexString('#baffee'); mesh.overlayAlpha = .3; }
    }
    this.portalHoverPickedAt = performance.now();
    this.portalHoverMatrixFlag = this.scene.getTransformMatrix().updateFlag;
    this.refreshPortalHover();
  },
  refreshPortalHover() {
    if (!this.hoveredPortalId) return;
    if (!this.portalHoverEnabled || this.options.mode !== 'select') { this.clearPortalHover(); return; }
    const matrix = this.scene.getTransformMatrix();
    if (this.lastPointer && matrix.updateFlag !== this.portalHoverMatrixFlag && performance.now() - this.portalHoverPickedAt > 120) {
      this.updatePortalHover(this.lastPointer); return;
    }
    const mesh = this.portalMeshes?.get(this.hoveredPortalId);
    if (!mesh || mesh.isDisposed()) { this.clearPortalHover(); return; }
    const rect = this.canvas.getBoundingClientRect();
    const point = mesh.getAbsolutePosition().add(new Vector3(0, 2.2, 0));
    const projected = Vector3.Project(point, Matrix.IdentityReadOnly, matrix, this.camera.viewport.toGlobal(rect.width, rect.height));
    if (projected.z < 0 || projected.z > 1 || projected.x < 0 || projected.x > rect.width || projected.y < 0 || projected.y > rect.height) { this.onPortalHover?.(null); return; }
    this.onPortalHover?.({ id: this.hoveredPortalId, x: rect.left + projected.x, y: rect.top + projected.y - 10 });
  },
  updatePortals() {
    const portals = this.city.portals || [], signature = JSON.stringify(portals.map(p => [p.id, portalPosition(this.city, p)]));
    if (signature === this.portalSignature) return;
    this.portalSignature = signature;
    this.portalMeshes ||= new Map();
    if (!this.portalMaterial && portals.length) {
      this.portalMaterial = new StandardMaterial('portal-shared', this.scene);
      this.portalMaterial.diffuseColor = Color3.FromHexString('#8fe9de');
      this.portalMaterial.emissiveColor = Color3.FromHexString('#387d87');
      this.portalMaterial.specularColor = Color3.Black();
    }
    for (const [id, mesh] of this.portalMeshes) if (!portals.some(p => p.id === id)) { mesh.dispose(); this.portalMeshes.delete(id); }
    for (const portal of portals) {
      let mesh = this.portalMeshes.get(portal.id);
      if (!mesh) {
        mesh = MeshBuilder.CreateCylinder(`portal:${portal.id}`, { diameterTop: 0, diameterBottom: 2.4, height: 3, tessellation: 4 }, this.scene);
        mesh.rotation.z = Math.PI; mesh.material = this.portalMaterial; mesh.metadata = { portalId: portal.id };
        this.portalMeshes.set(portal.id, mesh);
      }
      const p = portalPosition(this.city, portal); mesh.position.set(p.x, p.y, p.z);
    }
  },
};

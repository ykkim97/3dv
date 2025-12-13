// src/babylon/AxesHelper.js
import { MeshBuilder, Color3, Vector3, StandardMaterial, Mesh, Quaternion } from "@babylonjs/core";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

export default class AxesHelper {
  constructor(scene, size = 8, opts = {}) {
    this.scene = scene;
    this.size = size;
    const defaultTickSpacing = Math.max(1, Math.round(size / 20));
    this.opts = Object.assign({ tickSpacing: defaultTickSpacing, tickSize: 0.3, label: true }, opts);

    this._meshes = [];
    this._materials = [];

    // create three axes spanning -size .. +size with arrowheads at positive ends
    this._createAxis("axis-x", new Vector3(-size, 0, 0), new Vector3(size, 0, 0), new Color3(1, 0.2, 0.2), "x");
    this._createAxis("axis-y", new Vector3(0, -size, 0), new Vector3(0, size, 0), new Color3(0.2, 1, 0.2), "y");
    this._createAxis("axis-z", new Vector3(0, 0, -size), new Vector3(0, 0, size), new Color3(0.2, 0.4, 1), "z");
  }

  _createAxis(name, from, to, color) {
    // line
    const line = MeshBuilder.CreateLines(name, { points: [from, to], updatable: false }, this.scene);
    line.isPickable = false;
    if (line.color) {
      line.color = color;
    }
    this._meshes.push(line);

    // arrow head: small cone at 'to' end pointing outward
    const dir = to.subtract(from);
    const len = dir.length();
    if (len > 0.001) {
      const coneHeight = Math.min(0.15 * this.size, 0.6);
      const coneDiameter = coneHeight * 0.6;
      const cone = MeshBuilder.CreateCylinder(`${name}-arrow`, {
        height: coneHeight,
        diameterTop: 0,
        diameterBottom: coneDiameter,
        tessellation: 18
      }, this.scene);
      cone.isPickable = false;

      // orient + position: make cone base at 'to' and point outward along dir
      cone.rotation = this._directionToRotation(dir.normalize());
      // move cone so its base sits at 'to' (cylinder is centered), shift by half-height along direction
      const shift = dir.normalize().scale(-coneHeight / 2);
      cone.position = to.add(shift);

      // simple emissive material
      const mat = new StandardMaterial(`${name}-arrow-mat`, this.scene);
      mat.emissiveColor = color;
      mat.specularColor = Color3.Black();
      cone.material = mat;
      this._meshes.push(cone);
      this._materials.push(mat);
    }

    // create tick marks along the axis at configured spacing
    try {
      this._createTicksAndLabels(from, to, color);
    } catch (e) {}
  }

  _createTicksAndLabels(from, to, color) {
    const spacing = Math.max(1, this.opts.tickSpacing);
    const tickSize = this.opts.tickSize || 0.25;
    // axis direction
    const dir = to.subtract(from).normalize();
    const fullLen = to.subtract(from).length();
    const halfLen = fullLen / 2;
    // center origin
    const origin = from.add(to).scale(0.5);

    // compute number of ticks on each side from center and batch into single lines mesh
    const max = Math.floor(halfLen / spacing);
    const pts = [];
    for (let i = -max; i <= max; i++) {
      if (i === 0) continue; // skip origin
      const pos = origin.add(dir.scale(i * spacing));
      // draw small perpendicular tick in Y direction (for X/Z axes) or X direction (for Y axis)
      let p0, p1;
      if (Math.abs(dir.x) > 0.5) {
        p0 = pos.add(new Vector3(0, -tickSize / 2, 0));
        p1 = pos.add(new Vector3(0, tickSize / 2, 0));
      } else if (Math.abs(dir.y) > 0.5) {
        p0 = pos.add(new Vector3(-tickSize / 2, 0, 0));
        p1 = pos.add(new Vector3(tickSize / 2, 0, 0));
      } else {
        p0 = pos.add(new Vector3(0, -tickSize / 2, 0));
        p1 = pos.add(new Vector3(0, tickSize / 2, 0));
      }
      pts.push(p0, p1);
    }
    if (pts.length > 0) {
      const ticks = MeshBuilder.CreateLines(`${name}-ticks`, { points: pts }, this.scene);
      ticks.isPickable = false;
      if (ticks.color) ticks.color = color;
      this._meshes.push(ticks);
    }

    // simple labels at -end, origin, +end
    if (this.opts.label) {
      const labels = [ { pos: from, txt: `-${halfLen}` }, { pos: origin, txt: `0` }, { pos: to, txt: `${halfLen}` } ];
      for (const L of labels) {
        try {
          const dt = new DynamicTexture(`${name}-lbl-${L.txt}`, { width: 256, height: 64 }, this.scene, true);
          const ctx = dt.getContext();
          ctx.clearRect(0,0,256,64);
          dt.drawText(L.txt, null, 40, "20px Arial", "#FFFFFF", "transparent", true);
          dt.update();
          const mat = new StandardMaterial(`${name}-lbl-mat-${L.txt}`, this.scene);
          mat.diffuseTexture = dt;
          mat.emissiveColor = Color3.White();
          mat.backFaceCulling = false;
          const plane = MeshBuilder.CreatePlane(`${name}-lbl-plane-${L.txt}`, { width: 1, height: 0.25 }, this.scene);
          plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
          plane.position = L.pos.add(new Vector3(0, 0.4, 0));
          plane.isPickable = false;
          plane.material = mat;
          this._meshes.push(plane);
          this._materials.push(mat);
        } catch (e) {}
      }
    }
  }

  _directionToRotation(dir) {
    // dir is a Vector3 normalized
    // compute rotation that aligns +Y (Babylon's cylinder default axis) to dir
    // we'll construct a simple look rotation: rotate from +Y to dir
    const up = new Vector3(0, 1, 0);
    const axis = Vector3.Cross(up, dir);
    const dot = Vector3.Dot(up, dir);
    const eps = 1e-6;
    if (axis.lengthSquared() < eps) {
      // parallel or anti-parallel
      if (dot > 0) return new Vector3(0, 0, 0);
      // opposite: rotate 180deg around X
      return new Vector3(Math.PI, 0, 0);
    }
    axis.normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    // convert axis-angle to Euler approx: use quaternion then get Euler
    const q = Quaternion.RotationAxis(axis, angle);
    const e = q.toEulerAngles();
    return e;
  }

  setVisible(visible) {
    for (const m of this._meshes) {
      try { m.setEnabled(!!visible); } catch (e) {}
    }
  }

  dispose() {
    for (const m of this._meshes) {
      try { m.dispose(); } catch (e) {}
    }
    for (const mat of this._materials) {
      try { mat.dispose(); } catch (e) {}
    }
    this._meshes = [];
    this._materials = [];
  }
}
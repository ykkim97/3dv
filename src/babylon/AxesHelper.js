// src/babylon/AxesHelper.js
import { MeshBuilder, Color3, Vector3, StandardMaterial, Mesh, Quaternion } from "@babylonjs/core";

export default class AxesHelper {
  constructor(scene, size = 8) {
    this.scene = scene;
    this.size = size;

    this._meshes = [];
    this._materials = [];

    // create three axes with arrowheads
    this._createAxis("axis-x", new Vector3(0, 0, 0), new Vector3(size, 0, 0), new Color3(1, 0.2, 0.2));
    this._createAxis("axis-y", new Vector3(0, 0, 0), new Vector3(0, size, 0), new Color3(0.2, 1, 0.2));
    this._createAxis("axis-z", new Vector3(0, 0, 0), new Vector3(0, 0, size), new Color3(0.2, 0.4, 1));
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
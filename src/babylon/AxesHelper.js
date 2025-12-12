// src/babylon/AxesHelper.js
import { MeshBuilder, Color3, Vector3, StandardMaterial } from "@babylonjs/core";

export default class AxesHelper {
  constructor(scene, size = 2) {
    this.scene = scene;
    this.size = size;

    this._meshes = [];
    this._materials = [];

    this._createAxis("axis-x", new Vector3(0, 0, 0), new Vector3(size, 0, 0), new Color3(1, 0, 0));
    this._createAxis("axis-y", new Vector3(0, 0, 0), new Vector3(0, size, 0), new Color3(0, 1, 0));
    this._createAxis("axis-z", new Vector3(0, 0, 0), new Vector3(0, 0, size), new Color3(0, 0, 1));
  }

  _createAxis(name, from, to, color) {
    const points = [from, to];
    const line = MeshBuilder.CreateLines(name, { points }, this.scene);
    line.isPickable = false;
    line.alwaysSelectAsActiveMesh = false;
    // set color property on LinesMesh
    if (line.color) {
      line.color = color;
    } else {
      // fallback: make a thin tube-like mesh using a material (less ideal)
      const mat = new StandardMaterial(`${name}-mat`, this.scene);
      mat.emissiveColor = color;
      mat.diffuseColor = color;
      this._materials.push(mat);
      try {
        line.material = mat;
      } catch (e) {
        // ignore
      }
    }
    this._meshes.push(line);
  }

  setVisible(visible) {
    for (const m of this._meshes) m.setEnabled(!!visible);
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
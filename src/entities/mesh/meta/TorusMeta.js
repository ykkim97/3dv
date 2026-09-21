// src/babylon/meshes/meta/TorusMeta.js

import { MeshMeta } from "./MeshMeta";

export class TorusMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "torus", params: { diameter: 1, thickness: 0.25, tessellation: 32, ...opts.params }, ...opts });
  }
}

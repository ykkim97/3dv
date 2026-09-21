// src/babylon/meshes/meta/CapsuleMeta.js

import { MeshMeta } from "./MeshMeta";

export class CapsuleMeta extends MeshMeta {
  constructor(opts = {}) {
    // params: height (cylinder section), radius
    super({ kind: "capsule", params: { height: 1, radius: 0.25, tessellation: 16, ...opts.params }, ...opts });
  }
}

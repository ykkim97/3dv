// src/babylon/meshes/meta/SphereMeta.js

import { MeshMeta } from "./MeshMeta";

export class SphereMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "sphere", params: { diameter: 1, ...opts.params }, ...opts });
  }
}

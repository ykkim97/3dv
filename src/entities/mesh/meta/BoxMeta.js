// src/babylon/meshes/meta/BoxMeta.js

import { MeshMeta } from "./MeshMeta";

export class BoxMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "box", params: { size: 1, ...opts.params }, ...opts });
  }
}

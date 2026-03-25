// src/babylon/meshes/meta/PlaneMeta.js

import { MeshMeta } from "./MeshMeta";

export class PlaneMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "plane", params: { width: 1, height: 1, ...opts.params }, ...opts });
  }
}

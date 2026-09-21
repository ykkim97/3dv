// src/babylon/meshes/meta/CylinderMeta.js

import { MeshMeta } from "./MeshMeta";

export class CylinderMeta extends MeshMeta {
  constructor(opts = {}) {
    super({
      kind: "cylinder",
      params: { height: 1, diameterTop: 1, diameterBottom: 1, tessellation: 16, ...opts.params },
      ...opts,
    });
  }
}

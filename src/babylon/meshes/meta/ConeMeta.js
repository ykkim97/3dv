// src/babylon/meshes/meta/ConeMeta.js

import { MeshMeta } from "./MeshMeta";

// cone: a cylinder with diameterTop = 0 by default
export class ConeMeta extends MeshMeta {
  constructor(opts = {}) {
    super({
      kind: "cone",
      params: { height: 1, diameterBottom: 1, diameterTop: 0, tessellation: 16, ...opts.params },
      ...opts,
    });
  }
}

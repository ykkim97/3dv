// src/babylon/meshes/meta/TubeMeta.js

import { MeshMeta } from "./MeshMeta";

export class TubeMeta extends MeshMeta {
  constructor(opts = {}) {
    // params: path (array of {x,y,z}), radius, tessellation
    super({ kind: "tube", params: { path: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], radius: 0.05, tessellation: 16, ...opts.params }, ...opts });
  }
}

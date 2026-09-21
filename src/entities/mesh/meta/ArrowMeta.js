// src/babylon/meshes/meta/ArrowMeta.js

import { MeshMeta } from "./MeshMeta";

export class ArrowMeta extends MeshMeta {
  constructor(opts = {}) {
    // params: length, shaftDiameter, headHeight, headDiameter
    super({ kind: "arrow", params: { length: 1, shaftDiameter: 0.06, headHeight: 0.18, headDiameter: 0.12, ...opts.params }, ...opts });
  }
}

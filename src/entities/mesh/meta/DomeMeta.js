// src/babylon/meshes/meta/DomeMeta.js

import { MeshMeta } from "./MeshMeta";

export class DomeMeta extends MeshMeta {
  constructor(opts = {}) {
    // diameter -> sphere diameter, will be scaled to look like a dome
    super({ kind: "dome", params: { diameter: 1, segments: 24, ...opts.params }, ...opts });
  }
}

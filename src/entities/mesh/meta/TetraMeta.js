// src/babylon/meshes/meta/TetraMeta.js

import { MeshMeta } from "./MeshMeta";

// tetrahedron: implemented via Babylon Polyhedron (type 0) at runtime
export class TetraMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "tetra", params: { size: 1, ...opts.params }, ...opts });
  }
}

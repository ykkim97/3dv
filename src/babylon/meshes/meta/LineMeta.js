// src/babylon/meshes/meta/LineMeta.js

import { MeshMeta } from "./MeshMeta";

// line: store an array of points (each {x,y,z}) in params.points
export class LineMeta extends MeshMeta {
  constructor(opts = {}) {
    const defaultPoints = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    super({ kind: "line", params: { points: defaultPoints, ...opts.params }, ...opts });
  }
}

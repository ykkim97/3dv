// src/babylon/meshes/meta/MergedMeta.js

import { MeshMeta } from "./MeshMeta";

export class MergedMeta extends MeshMeta {
  constructor(opts = {}) {
    // params should contain: { mergedIds: [...], originalParents: { id: parentId|null } }
    const params = {
      mergedIds: (opts.params && opts.params.mergedIds) || [],
      originalParents: (opts.params && opts.params.originalParents) || {},
      ...((opts.params) || {}),
    };
    super({ kind: "merged", params, ...opts });
  }
}

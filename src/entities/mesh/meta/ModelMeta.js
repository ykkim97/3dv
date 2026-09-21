import { MeshMeta } from "./MeshMeta";

export class ModelMeta extends MeshMeta {
  constructor(opts = {}) {
    super({
      kind: "model",
      params: {
        source: null,
        extension: null,
        importedNode: false,
        preserveImportedMaterial: true,
        nodeType: "mesh",
        nodeKey: null,
        rootModelId: null,
        sourceNodeName: null,
        ...opts.params,
      },
      ...opts,
    });
  }
}
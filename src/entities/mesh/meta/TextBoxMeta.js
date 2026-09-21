// src/babylon/meshes/meta/TextBoxMeta.js

import { MeshMeta } from "./MeshMeta";

// textbox: rendered as a plane with DynamicTexture text
export class TextBoxMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "textbox", params: { width: 2, height: 1, text: "Text", fontSize: 64, ...opts.params }, ...opts });
  }
}

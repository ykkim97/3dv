// src/babylon/meshes/meta/createMeta.js

import { MeshMeta } from "./MeshMeta";
import { BoxMeta } from "./BoxMeta";
import { SphereMeta } from "./SphereMeta";
import { CylinderMeta } from "./CylinderMeta";
import { ConeMeta } from "./ConeMeta";
import { TetraMeta } from "./TetraMeta";
import { TorusMeta } from "./TorusMeta";
import { TextBoxMeta } from "./TextBoxMeta";
import { LineMeta } from "./LineMeta";
import { MergedMeta } from "./MergedMeta";

// Small factory
export function createMeta(kind, opts = {}) {
  const id = opts.id || `${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const base = {
    id,
    name: opts.name,
    params: opts.params,
    parent: opts.parent,
    position: opts.position,
    rotation: opts.rotation,
    scaling: opts.scaling,
    material: opts.material,
    scripts: opts.scripts,
  };

  if (kind === "box") return new BoxMeta(base);
  if (kind === "sphere") return new SphereMeta(base);
  if (kind === "cylinder") return new CylinderMeta(base);
  if (kind === "cone") return new ConeMeta(base);
  if (kind === "tetra") return new TetraMeta(base);
  if (kind === "torus") return new TorusMeta(base);
  if (kind === "textbox") return new TextBoxMeta(base);
  if (kind === "line") return new LineMeta(base);
  if (kind === "merged") return new MergedMeta(base);

  return new MeshMeta({ kind, ...base });
}

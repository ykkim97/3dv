// src/babylon/MeshEntities.js
// Barrel module: keeps existing imports stable while splitting each shape meta into its own file.

export { MeshMeta } from "./meshes/meta/MeshMeta";

export { BoxMeta } from "./meshes/meta/BoxMeta";
export { SphereMeta } from "./meshes/meta/SphereMeta";
export { CylinderMeta } from "./meshes/meta/CylinderMeta";
export { ConeMeta } from "./meshes/meta/ConeMeta";
export { TetraMeta } from "./meshes/meta/TetraMeta";
export { TorusMeta } from "./meshes/meta/TorusMeta";
export { TextBoxMeta } from "./meshes/meta/TextBoxMeta";
export { LineMeta } from "./meshes/meta/LineMeta";
export { MergedMeta } from "./meshes/meta/MergedMeta";

export { createMeta } from "./meshes/meta/createMeta";
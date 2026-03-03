// src/babylon/meshes/meta/MeshMeta.js

export class MeshMeta {
  constructor({
    id,
    name = null,
    kind,
    params = {},
    parent = null,
    position = { x: 0, y: 0, z: 0 },
    rotation = { x: 0, y: 0, z: 0 },
    scaling = { x: 1, y: 1, z: 1 },
    material = null,
    scripts = null,
  }) {
    this.id = id;
    this.name = name || id;
    this.kind = kind; // 'box' | 'sphere' | ...
    this.params = params;
    this.parent = parent; // parent mesh id or null
    this.position = { ...position };
    this.rotation = { ...rotation };
    this.scaling = { ...scaling };

    // material: { color: {r,g,b} (0..1), specularPower: number }
    this.material = material || { color: { r: 0.9, g: 0.9, b: 0.9 }, specularPower: 64 };

    // scripts: { onLoad?: string, onClick?: string, onTaskView?: string, custom?: Record<string,string> }
    this.scripts = scripts || null;
  }
}

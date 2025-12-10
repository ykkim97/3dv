// src/babylon/MeshEntities.js
export class MeshMeta {
  constructor({ id, name = null, kind, params = {}, parent = null, position = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0 }, scaling = { x: 1, y: 1, z: 1 }, material = null }) {
    this.id = id;
    this.name = name || id;
    this.kind = kind; // 'box' | 'sphere' | 'cylinder' | 'cone' | 'line' | ...
    this.params = params;
    this.parent = parent; // parent mesh id or null
    this.position = { ...position };
    this.rotation = { ...rotation };
    this.scaling = { ...scaling };
    // material: { color: {r,g,b} (0..1), specularPower: number }
    this.material = material || { color: { r: 0.9, g: 0.9, b: 0.9 }, specularPower: 64 };
  }
}

export class BoxMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "box", params: { size: 1, ...opts.params }, ...opts });
  }
}

export class SphereMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "sphere", params: { diameter: 1, ...opts.params }, ...opts });
  }
}

export class CylinderMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "cylinder", params: { height: 1, diameterTop: 1, diameterBottom: 1, tessellation: 16, ...opts.params }, ...opts });
  }
}

// cone: a cylinder with diameterTop = 0 by default
export class ConeMeta extends MeshMeta {
  constructor(opts = {}) {
    super({ kind: "cone", params: { height: 1, diameterBottom: 1, diameterTop: 0, tessellation: 16, ...opts.params }, ...opts });
  }
}

// line: store an array of points (each {x,y,z}) in params.points
export class LineMeta extends MeshMeta {
  constructor(opts = {}) {
    const defaultPoints = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }];
    super({ kind: "line", params: { points: defaultPoints, ...opts.params }, ...opts });
  }
}

// Small factory
export function createMeta(kind, opts = {}) {
  const id = opts.id || `${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const base = { id, name: opts.name, params: opts.params, parent: opts.parent, position: opts.position, rotation: opts.rotation, scaling: opts.scaling, material: opts.material };
  if (kind === "box") return new BoxMeta(base);
  if (kind === "sphere") return new SphereMeta(base);
  if (kind === "cylinder") return new CylinderMeta(base);
  if (kind === "cone") return new ConeMeta(base);
  if (kind === "line") return new LineMeta(base);
  return new MeshMeta({ kind, ...base });
}
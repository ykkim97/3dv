import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';

const FACADES = {
  front: { x: 0, z: -1, rotation: 0 },
  back: { x: 0, z: 1, rotation: Math.PI },
  left: { x: -1, z: 0, rotation: Math.PI / 2 },
  right: { x: 1, z: 0, rotation: -Math.PI / 2 },
};

// Only the exposed face is needed: buried box faces can compete with the wall.
// Physical clearance and a small depth bias also keep distant facades stable.
export function facadeWindow(editor, name, width, height, x, y, z, face, material, parent) {
  const direction = FACADES[face];
  const key = `facade:${material.name}`;
  if (!editor.materials.has(key)) {
    const facadeMaterial = material.clone(key);
    facadeMaterial.zOffset = -1;
    facadeMaterial.zOffsetUnits = -2;
    editor.materials.set(key, facadeMaterial);
  }
  const mesh = MeshBuilder.CreatePlane(name, { width, height }, editor.scene);
  mesh.position.set(x + direction.x * 0.08, y, z + direction.z * 0.08);
  mesh.rotation.y = direction.rotation;
  mesh.material = editor.materials.get(key);
  mesh.parent = parent;
  mesh.receiveShadows = true;
  return mesh;
}

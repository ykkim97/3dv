import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { facadeWindow } from './facadeWindows.js';

// Shared materials and low tessellation keep these demonstration presets inexpensive.
export function buildEnergyDemoAsset(editor, asset, root) {
  const steel = editor.material('energy-demo-steel', '#8ea3a8');
  const concrete = editor.material('energy-demo-concrete', '#d3dcd3');
  const dark = editor.material('energy-demo-dark', '#40565f');
  const blue = editor.material('energy-demo-solar', '#3c789b');
  const box = (name, w, h, d, x, y, z, mat) => editor.box(name, w, h, d, x, y, z, mat, root);
  const attach = (mesh, x, y, z, material) => {
    mesh.parent = root; mesh.position.set(x, y, z); mesh.material = material;
    editor.shadows.addShadowCaster(mesh); return mesh;
  };
  box('energy-campus-pad', asset.width, .18, asset.depth, 0, .09, 0, steel);
  if (asset.id === 'nuclear-plant') {
    for (const x of [-8, 1]) {
      attach(MeshBuilder.CreateCylinder('reactor-containment', { diameter: 7, height: 7, tessellation: 20 }, editor.scene), x, 3.7, -5, concrete);
      const dome = attach(MeshBuilder.CreateSphere('reactor-dome', { diameter: 7, segments: 12 }, editor.scene), x, 7, -5, concrete);
      dome.scaling.y = .65;
      box('reactor-access', 2, 2.6, 1.2, x, 1.6, -8.7, dark);
    }
    for (const x of [-7, 5]) {
      const shape = [[0, 0], [4.3, 0], [4.1, 2], [3.1, 7], [2.6, 12], [3.4, 18], [3.15, 18], [2.4, 12], [2.9, 7], [3.9, 2], [4.1, 0]].map(([r, y]) => new Vector3(r, y, 0));
      attach(MeshBuilder.CreateLathe('cooling-tower', { shape, tessellation: 24, sideOrientation: 2 }, editor.scene), x, .2, 6, concrete);
      attach(MeshBuilder.CreateCylinder('cooling-tower-opening', { diameter: 6.2, height: .12, tessellation: 24 }, editor.scene), x, 17.9, 6, dark);
    }
    box('nuclear-turbine-hall', 5, 5, 16, 10, 2.7, -2, concrete);
    box('nuclear-turbine-roof', 5.2, .25, 16.2, 10, 5.3, -2, dark);
    for (const z of [-8, -4, 0, 4]) facadeWindow(editor, 'turbine-glazing', 2, 1.3, 12.5, 3.6, z, 'right', blue, root);
  } else {
    box('factory-production-hall', 15, 5.6, 12, -1.5, 3, 1, editor.material('factory-wall', asset.color));
    box('factory-roof', 15.4, .3, 12.4, -1.5, 5.95, 1, dark);
    box('factory-office', 4, 7, 8, 6.8, 3.7, 2, concrete);
    for (const x of [-6, -1, 4]) {
      box('factory-loading-bay', 3, 3, .1, x, 1.85, -5.05, steel);
      box('factory-bay-header', 3.2, .25, .2, x, 3.5, -5.15, blue);
    }
    for (const x of [-6, -2, 2]) for (const z of [-2, 2, 5]) box('factory-rooftop-solar', 3.2, .12, 2.2, x, 6.18, z, blue).rotation.x = -.15;
    for (const z of [-1, 2, 5]) facadeWindow(editor, 'factory-office-window', 1.5, 1.2, 8.8, 5.7, z, 'right', blue, root);
    for (const x of [-5, 0]) attach(MeshBuilder.CreateCylinder('factory-vent', { diameter: .8, height: 1.2, tessellation: 8 }, editor.scene), x, 6.6, 0, steel);
  }
}

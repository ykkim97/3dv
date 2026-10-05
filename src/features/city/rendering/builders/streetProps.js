import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';

export function buildStreetProp(editor, asset, root) {
  const stone = editor.material('prop-stone', '#bdc6ba'), steel = editor.material('prop-steel', '#526763');
  const wood = editor.material('prop-wood', '#ba9366'), paint = editor.material('prop-paint', '#ecebd7');
  const lamp = editor.material('city-lamp', '#eee1b6'), sign = editor.material('city-sign', '#b1dfd7');
  const box = (name, w, h, d, x, y, z, mat) => editor.box(name, w, h, d, x, y, z, mat, root);
  const seat = (x, z) => {
    for (const side of [-1, 1]) box('bench-leg', 0.12, 0.5, 0.65, x + side * 0.72, 0.25, z, steel);
    for (const offset of [-0.24, 0, 0.24]) box('bench-slat', 1.9, 0.09, 0.19, x, 0.54, z + offset, wood);
    for (const y of [0.8, 1]) box('bench-back', 1.9, 0.14, 0.08, x, y, z + 0.34, wood);
  };
  if (asset.id === 'sidewalk') {
    box('sidewalk-base', 2, 0.16, 8, 0, 0.08, 0, stone);
    for (let z = -3; z <= 3; z++) box('paving-joint', 1.94, 0.008, 0.025, 0, 0.164, z, steel);
  } else if (asset.id === 'crosswalk') {
    for (let x = -1.65; x < 2; x += 0.66) box('crosswalk-stripe', 0.4, 0.025, 2.8, x, 0.02, 0, paint);
  } else if (asset.id === 'bench') seat(0, 0);
  else if (asset.id === 'street-lamp') {
    const pole = MeshBuilder.CreateCylinder('lamp-pole', { height: 4.65, diameter: 0.14, tessellation: 6 }, editor.scene);
    pole.parent = root; pole.position.y = 2.325; pole.material = steel;
    box('lamp-base', 0.35, 0.15, 0.35, 0, 0.075, 0, stone);
    box('lamp-arm', 0.7, 0.1, 0.12, 0.28, 4.6, 0, steel);
    box('lamp-head', 0.65, 0.12, 0.38, 0.28, 4.69, 0, steel);
    box('lamp-emitter', 0.52, 0.035, 0.3, 0.28, 4.61, 0, lamp);
    box('lamp-pool', 1, 0.008, 1, 0, 0.01, 0, editor.material('city-light-pool', '#827347'));
  } else if (asset.id === 'bus-stop') {
    box('stop-platform', 4, 0.12, 2, 0, 0.06, 0, stone);
    for (const x of [-1.8, 1.8]) box('stop-column', 0.1, 2.7, 0.1, x, 1.4, 0.7, steel);
    box('stop-canopy', 4, 0.16, 2, 0, 2.82, 0, steel);
    box('stop-back', 3.6, 1.65, 0.06, 0, 1.6, 0.76, editor.material('prop-panel', '#87aeb3'));
    seat(-0.5, 0.2);
    box('stop-sign', 0.65, 1.3, 0.08, 1.45, 1.7, 0.68, sign);
    box('stop-light', 3.5, 0.035, 0.12, 0, 2.72, 0, lamp);
  }
}

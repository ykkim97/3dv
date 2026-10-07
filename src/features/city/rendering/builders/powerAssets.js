import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { buildEnergyDemoAsset } from './energyDemoAssets.js';
import { facadeWindow } from './facadeWindows.js';

// Static parts are merged by material in buildObject, then shared as instances.
// No textures, per-facility lights, particles or frame-time animations are needed.
export function buildPowerAsset(editor, asset, root) {
  const concrete = editor.material('power-concrete', '#b4beb5');
  const steel = editor.material('power-steel', '#c3d2d1');
  const dark = editor.material('power-dark', '#3b515b');
  const porcelain = editor.material('power-porcelain', '#d9c8a2');
  const accent = editor.material('power-accent', '#e6b656');
  const white = editor.material('power-shell', '#e5ebe5');
  const blue = editor.material('power-glass', '#416e8b');
  const box = (name, w, h, d, x, y, z, material = steel, parent = root) => editor.box(name, w, h, d, x, y, z, material, parent);
  const cylinder = (name, diameter, height, x, y, z, material = steel, top = diameter, sides = 12) => {
    const mesh = MeshBuilder.CreateCylinder(name, { diameterBottom: diameter, diameterTop: top, height, tessellation: sides }, editor.scene);
    mesh.position.set(x, y, z); mesh.parent = root; mesh.material = material;
    return mesh;
  };
  const beam = (name, a, b, thickness = 0.12, material = steel) => {
    const start = Vector3.FromArray(a), end = Vector3.FromArray(b), delta = end.subtract(start);
    const direction = delta.normalizeToNew(), axis = Vector3.Cross(Vector3.Up(), direction);
    const mesh = box(name, thickness, delta.length(), thickness, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, material);
    mesh.rotationQuaternion = axis.lengthSquared() > 1e-8
      ? Quaternion.RotationAxis(axis.normalize(), Math.acos(Math.max(-1, Math.min(1, direction.y))))
      : Quaternion.RotationAxis(Vector3.Right(), direction.y < 0 ? Math.PI : 0);
    return mesh;
  };
  const insulator = (x, y, z, height = 0.8) => {
    cylinder('insulator-core', 0.14, height, x, y, z, dark, 0.14, 8);
    for (const offset of [-0.3, 0, 0.3]) cylinder('insulator-disc', 0.32, height * 0.14, x, y + offset * height, z, porcelain, 0.25, 8);
    cylinder('insulator-terminal', 0.16, 0.12, x, y + height / 2 + 0.06, z, accent, 0.16, 8);
  };
  const bolt = (x, y, z, scale = 1) => {
    box('power-symbol-upper', 0.12 * scale, 0.48 * scale, 0.045, x - 0.08 * scale, y + 0.13 * scale, z, accent).rotation.z = -0.48;
    box('power-symbol-center', 0.36 * scale, 0.1 * scale, 0.045, x, y, z, accent);
    box('power-symbol-lower', 0.12 * scale, 0.48 * scale, 0.045, x + 0.08 * scale, y - 0.13 * scale, z, accent).rotation.z = -0.48;
  };
  const fence = (width, depth, y = 0.95) => {
    const x = width / 2, z = depth / 2;
    for (const sx of [-x, x]) for (const sz of [-z, 0, z]) box('fence-post', 0.1, 1.4, 0.1, sx, y, sz, dark);
    for (const sx of [-x, x]) for (const height of [y - 0.35, y + 0.4]) box('fence-side-rail', 0.075, 0.075, depth, sx, height, 0, steel);
    for (const height of [y - 0.35, y + 0.4]) {
      box('fence-back-rail', width, 0.075, 0.075, 0, height, z, steel);
      for (const sign of [-1, 1]) box('fence-front-rail', (width - 1.6) / 2, 0.075, 0.075, sign * (width + 1.6) / 4, height, -z, steel);
    }
  };

  if (asset.id === 'nuclear-plant') {
    buildEnergyDemoAsset(editor, asset, root);
    for (const x of [-8, 1]) {
      cylinder('containment-plinth', 7.3, 0.5, x, 0.45, -5, dark, 7.3, 20);
      cylinder('containment-collar', 7.1, 0.22, x, 6.9, -5, steel, 7.1, 20);
      box('containment-entry-frame', 2.25, 2.8, 0.18, x, 1.65, -9.38, steel);
      box('containment-entry-door', 1.7, 2.3, 0.1, x, 1.5, -9.53, dark);
      bolt(x, 1.7, -9.62, 1.5);
      beam('steam-transfer', [x + 3.5, 4.4, -4], [7.4, 4.4, -4], 0.28, steel);
    }
    for (const x of [-7, 5]) {
      cylinder('cooling-tower-foot', 8.8, 0.4, x, 0.4, 6, dark, 8.8, 24);
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5;
        box('cooling-air-intake', 0.3, 0.85, 0.18, x + Math.sin(angle) * 4.2, 1.05, 6 + Math.cos(angle) * 4.2, dark).rotation.y = angle;
      }
    }
    for (const z of [-7, -2, 3]) {
      box('nuclear-roof-vent', 1.8, 0.45, 1.5, 10, 5.66, z, steel);
      box('nuclear-vent-grille', 1.5, 0.08, 1.2, 10, 5.94, z, dark);
    }
    fence(27, 23, 0.95);
    return;
  }

  box('power-pad', asset.width + 0.3, 0.18, asset.depth + 0.3, 0, 0.09, 0, concrete);
  if (['fast-charger', 'slow-charger', 'solar-carport'].includes(asset.id)) {
    const solar = asset.id === 'solar-carport', slow = asset.id === 'slow-charger';
    const bays = solar ? [-3.7, 0, 3.7] : slow ? [0] : [-2.4, 2.4];
    // Painted markings sit above the slab. All details are static, material-merged.
    for (const x of bays) {
      for (const side of [-1, 1]) box('parking-bay-mark', 0.07, 0.025, slow ? 4.5 : 5.1, x + side * (slow ? 1.4 : 1.55), 0.2, 0.4, white);
      box('wheel-stop', 1.6, 0.12, 0.22, x, 0.27, -1.9, accent);
      if (!solar) {
        const h = slow ? 1.5 : 2.15, z = slow ? -2.5 : -2.8;
        box('charger-pedestal', slow ? 0.42 : 0.85, h, 0.45, x, h / 2 + 0.2, z, white);
        box('charger-screen', slow ? 0.23 : 0.54, 0.38, 0.055, x, h - 0.2, z + 0.25, blue);
        box('charger-status-strip', slow ? 0.25 : 0.6, 0.07, 0.055, x, h + 0.08, z + 0.25, accent);
        bolt(x, 0.75, z + 0.27, slow ? 0.55 : 0.75);
        beam('charging-cable', [x + 0.35, h - 0.2, z], [x + 0.7, 0.55, z + 0.3], 0.07, dark);
        beam('charging-cable-return', [x + 0.7, 0.55, z + 0.3], [x + 0.38, 1.05, z + 0.3], 0.07, dark);
        box('charging-plug', 0.12, 0.25, 0.16, x + 0.38, 1.1, z + 0.3, dark);
      }
    }
    if (!slow) {
      const w = asset.width - 0.8, d = solar ? 8.6 : 6.6;
      for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) for (const z of [-d / 2 + 0.3, d / 2 - 0.3]) box('carport-column', 0.18, 3.35, 0.18, x, 1.87, z, steel);
      box('carport-roof', w, 0.18, d, 0, 3.62, 0, solar ? dark : white);
      if (solar) {
        for (const x of [-4.1, -2.05, 0, 2.05, 4.1]) for (const z of [-2.9, 0, 2.9]) {
          box('carport-panel-frame', 1.95, 0.08, 2.7, x, 3.75, z, steel);
          box('carport-solar-panel', 1.8, 0.045, 2.55, x, 3.815, z, blue);
          for (const dz of [-0.8, 0, 0.8]) box('solar-cell-divider', 1.8, 0.012, 0.025, x, 3.845, z + dz, steel);
        }
        box('carport-inverter', 0.7, 1.25, 0.4, 5.1, 0.85, 0, white);
        bolt(5.1, 0.85, -0.23, 0.7);
      } else {
        box('charging-canopy-band', w, 0.25, 0.12, 0, 3.58, -d / 2 - 0.04, blue);
        bolt(0, 3.57, -d / 2 - 0.12, 0.5);
      }
    }
    return;
  }
  if (asset.id === 'power-plant') {
    box('turbine-hall', 6, 4.5, 6, -2, 2.43, 0, white);
    box('hall-roof', 6.3, 0.25, 6.3, -2, 4.83, 0, dark);
    for (const x of [-4.3, -2.8, -1.3]) {
      facadeWindow(editor, 'hall-window', 0.95, 1.1, x, 3.15, -3, 'front', blue, root);
      box('hall-wall-column', 0.12, 4.3, 0.12, x + 0.65, 2.4, -3.08, steel);
      for (const y of [1.1, 1.3, 1.5]) box('hall-louver', 0.95, 0.08, 0.09, x, y, -3.12, dark);
    }
    for (const z of [-1.5, 1.5]) {
      box('roof-vent', 2.6, 0.4, 0.8, -2, 5.15, z, steel);
      box('roof-vent-cap', 2.8, 0.12, 1, -2, 5.43, z, dark);
    }
    for (const x of [2.1, 4.1]) {
      box('stack-plinth', 1.6, 0.5, 1.6, x, 0.43, 1.1, dark);
      cylinder('exhaust-stack', 1.05, 6.8, x, 3.83, 1.1, steel, 0.85);
      for (const y of [5.6, 6.4]) cylinder('stack-safety-band', 1.06, 0.24, x, y, 1.1, accent, 1.06);
      cylinder('stack-opening', 0.68, 0.08, x, 7.27, 1.1, dark);
    }
    box('generator', 3.6, 2.25, 2.4, 2.6, 1.33, -2.7, dark);
    for (const x of [1.3, 2.05, 2.8, 3.55]) box('generator-fin', 0.1, 1.65, 0.18, x, 1.4, -4, steel);
    box('generator-badge', 0.75, 0.9, 0.08, 4, 1.4, -3.97, dark);
    bolt(4, 1.4, -4.05);
    beam('steam-header', [-0.2, 5.15, 0], [2.6, 5.15, 0], 0.32);
    beam('steam-drop', [2.6, 5.15, 0], [2.6, 2.6, -2], 0.32);
    box('service-step', 1.6, 0.18, 0.65, -0.4, 0.28, -3.55, dark);
  } else if (asset.id === 'solar-farm') {
    for (const x of [-3, 0, 3]) for (const z of [-1.8, 1.65]) {
      for (const dx of [-0.85, 0.85]) box('solar-leg', 0.12, 0.95, 0.12, x + dx, 0.65, z, steel);
      box('solar-support', 2.5, 0.12, 0.12, x, 1.1, z, dark);
      const rack = new TransformNode('solar-rack', editor.scene);
      rack.parent = root; rack.position.set(x, 1.38, z); rack.rotation.x = -0.28;
      box('solar-frame', 2.65, 0.12, 2.5, 0, 0, 0, steel, rack);
      const glazing = facadeWindow(editor, 'solar-glass', 2.45, 2.3, 0, 0, 0, 'front', blue, rack);
      glazing.position.set(0, 0.11, 0); glazing.rotation.x = Math.PI / 2;
      for (const dx of [-0.81, 0, 0.81]) box('solar-cell-divider', 0.018, 0.025, 2.26, dx, 0.16, 0, steel, rack);
      for (const dz of [-0.75, 0, 0.75]) box('solar-cell-divider', 2.4, 0.025, 0.018, 0, 0.16, dz, steel, rack);
    }
    box('solar-inverter', 1.15, 0.95, 0.75, 0, 0.66, 3.25, white);
    box('inverter-door', 0.85, 0.7, 0.08, 0, 0.65, 2.81, dark);
    bolt(0, 0.68, 2.74, 0.7);
    box('solar-cable-trench', 7.8, 0.07, 0.15, 0, 0.24, 2.98, dark);
  } else if (asset.id === 'wind-turbine') {
    cylinder('wind-foundation', 1.9, 0.35, 0, 0.36, 0, dark);
    cylinder('wind-mast', 0.95, 12.8, 0, 6.91, 0, white, 0.45, 16);
    for (const y of [0.7, 4.8, 9]) cylinder('mast-joint', 1 - y * 0.038, 0.07, 0, y, 0, steel, 1 - y * 0.038, 16);
    box('wind-nacelle', 1.05, 1.05, 2.6, 0, 13.3, 0.65, white);
    box('nacelle-vent', 1.12, 0.35, 0.9, 0, 13.35, 1.2, dark);
    box('nacelle-roof', 1.1, 0.15, 2.5, 0, 13.9, 0.65, steel);
    cylinder('wind-hub', 0.75, 0.55, 0, 13.3, -0.86, steel).rotation.x = Math.PI / 2;
    const nose = cylinder('wind-spinner', 0.75, 0.55, 0, 13.3, -1.35, white, 0.1);
    nose.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      const blade = MeshBuilder.CreateCylinder('wind-blade', { diameterBottom: 0.58, diameterTop: 0.12, height: 4.15, tessellation: 4 }, editor.scene);
      blade.parent = root; blade.material = white;
      blade.scaling.z = 0.24; blade.rotation.z = -angle;
      blade.position.set(Math.sin(angle) * 2.32, 13.3 + Math.cos(angle) * 2.32, -1);
      box('blade-tip', 0.16, 0.34, 0.14, Math.sin(angle) * 4.22, 13.3 + Math.cos(angle) * 4.22, -1, accent).rotation.z = -angle;
    }
    box('mast-access', 0.38, 1.05, 0.12, 0, 1.08, -0.51, dark);
    box('mast-step', 0.75, 0.18, 0.5, 0, 0.28, -0.85, steel);
  } else if (asset.id === 'transmission-tower') {
    const levels = [[0.4, 1.65], [4.4, 1.2], [8.4, 0.8], [12.8, 0.45]];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box('tower-foot', 0.65, 0.4, 0.65, sx * 1.65, 0.38, sz * 1.65, dark);
      for (let i = 0; i < levels.length - 1; i++) {
        const [y, span] = levels[i], [nextY, nextSpan] = levels[i + 1];
        beam('tower-leg', [sx * span, y, sz * span], [sx * nextSpan, nextY, sz * nextSpan], 0.18);
      }
    }
    for (let i = 0; i < levels.length - 1; i++) {
      const [y, span] = levels[i], [nextY, nextSpan] = levels[i + 1];
      for (const sign of [-1, 1]) {
        beam('tower-x-brace', [-span, y, sign * span], [nextSpan, nextY, sign * nextSpan], 0.09, dark);
        beam('tower-x-brace', [span, y, sign * span], [-nextSpan, nextY, sign * nextSpan], 0.09, dark);
        beam('tower-x-brace', [sign * span, y, -span], [sign * nextSpan, nextY, nextSpan], 0.09, dark);
        beam('tower-x-brace', [sign * span, y, span], [sign * nextSpan, nextY, -nextSpan], 0.09, dark);
      }
    }
    for (const [y, width] of [[9, 6.5], [12.2, 5.5]]) {
      box('tower-crossarm', width, 0.2, 0.3, 0, y, 0);
      for (const sign of [-1, 1]) {
        beam('crossarm-brace', [0, y + 1.1, 0], [sign * (width / 2 - 0.15), y, 0], 0.12);
        for (const x of [sign * (width / 2 - 0.3), sign * 1.6]) insulator(x, y - 0.6, 0, 0.85);
      }
    }
    beam('tower-peak', [0, 12.8, 0], [0, 14.4, 0], 0.14);
    cylinder('tower-beacon', 0.24, 0.22, 0, 14.5, 0, accent, 0.24, 8);
  } else if (asset.id === 'ess') {
    for (const x of [-2.3, 0, 2.3]) {
      box('battery-plinth', 1.95, 0.25, 4.4, x, 0.3, 0, dark);
      box('battery-cabinet', 1.85, 2.35, 4.25, x, 1.6, 0, white);
      box('battery-roof', 1.95, 0.12, 4.35, x, 2.85, 0, steel);
      box('battery-door', 1.6, 1.95, 0.08, x, 1.55, -2.21, dark);
      box('battery-status', 0.7, 0.2, 0.08, x, 2.15, -2.31, blue);
      for (const y of [0.75, 0.95, 1.15]) box('battery-louver', 1.2, 0.075, 0.08, x, y, -2.32, steel);
      box('battery-handle', 0.08, 0.3, 0.1, x + 0.55, 1.6, -2.34, steel);
      bolt(x - 0.32, 1.65, -2.34, 0.8);
      box('battery-cooling', 0.22, 1.45, 1.6, x + 0.88, 1.5, 0.5, steel);
      for (const z of [0.1, 0.5, 0.9]) box('cooling-grille', 0.08, 1.05, 0.18, x + 1.04, 1.5, z, dark);
    }
    box('battery-cable-trench', 6.8, 0.1, 0.35, 0, 0.26, 2.5, dark);
  } else if (asset.id === 'substation') {
    fence(9.4, 7.4);
    for (const x of [-3.4, 3.4]) for (const z of [-2.4, 2.4]) {
      box('gantry-foot', 0.65, 0.4, 0.65, x, 0.4, z, dark);
      box('gantry-post', 0.22, 5.5, 0.22, x, 3, z);
      beam('gantry-knee', [x, 4.8, z], [x - Math.sign(x) * 0.75, 5.6, z], 0.12);
    }
    for (const z of [-2.4, 2.4]) box('gantry-beam', 7.1, 0.28, 0.28, 0, 5.75, z);
    for (const x of [-2, 0, 2]) {
      for (const z of [-2.4, 2.4]) insulator(x, 6.35, z, 0.7);
      beam('substation-busbar', [x, 6.85, -2.4], [x, 6.85, 2.4], 0.12, accent);
    }
    for (const x of [-2, 2]) {
      box('transformer-plinth', 3.05, 0.3, 2.8, x, 0.35, 0, steel);
      box('transformer-tank', 2.25, 1.85, 2.35, x, 1.42, 0, dark);
      for (const side of [-1, 1]) for (const z of [-0.8, -0.4, 0, 0.4, 0.8]) box('radiator-fin', 0.3, 1.45, 0.12, x + side * 1.3, 1.42, z, steel);
      cylinder('conservator-tank', 0.52, 1.7, x, 2.6, 0.65, steel).rotation.z = Math.PI / 2;
      for (const dx of [-0.65, 0, 0.65]) insulator(x + dx, 2.85, -0.45, 0.85);
      beam('transformer-feeder', [x, 3.4, -0.45], [x, 6.85, -2.4], 0.09, accent);
      box('transformer-badge', 0.9, 0.9, 0.08, x, 1.4, -1.25, dark);
      bolt(x, 1.4, -1.32);
    }
  } else if (asset.id === 'distribution') {
    box('switchgear-base', 4.5, 0.3, 3.5, -0.6, 0.35, 0, dark);
    box('switchgear-house', 4.2, 2.6, 3.3, -0.6, 1.8, 0, white);
    box('switchgear-roof', 4.5, 0.2, 3.6, -0.6, 3.22, 0, steel);
    for (const x of [-1.85, -0.6, 0.65]) {
      box('switchgear-door', 1.05, 2.1, 0.1, x, 1.7, -1.75, dark);
      for (const y of [2.3, 2.47, 2.64]) box('switchgear-louver', 0.8, 0.06, 0.08, x, y, -1.88, steel);
      box('switchgear-handle', 0.08, 0.27, 0.08, x + 0.32, 1.6, -1.88, steel);
      bolt(x - 0.12, 1.4, -1.88, 0.9);
    }
    cylinder('distribution-pole', 0.22, 4, 2.15, 2.2, 1, steel, 0.18, 8);
    box('distribution-crossarm', 1.7, 0.16, 0.2, 2.05, 3.8, 1, dark);
    for (const x of [1.4, 2.1, 2.8]) insulator(x, 4.03, 1, 0.38);
    cylinder('pole-transformer', 0.65, 1.1, 2.15, 2.8, 1.4, dark);
    cylinder('pole-transformer-lid', 0.73, 0.12, 2.15, 3.4, 1.4, steel);
    beam('distribution-conduit', [1.1, 1.1, 1.4], [2.15, 1.1, 1.4], 0.16, accent);
    beam('distribution-conduit', [2.15, 1.1, 1.4], [2.15, 2.3, 1.4], 0.16, accent);
  }
}

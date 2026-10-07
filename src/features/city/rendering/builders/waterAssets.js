import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { facadeWindow } from './facadeWindows.js';

// Static, low-sided equipment shares materials and is merged/instanced by buildObject.
export function buildWaterAsset(editor, asset, root) {
  const concrete = editor.material('water-concrete', '#bbc8c0');
  const shell = editor.material('water-shell', '#deebe5');
  const steel = editor.material('water-steel', '#abc6ca');
  const dark = editor.material('water-dark', '#405c65');
  const pipe = editor.material('water-pipe', '#388caa');
  const water = editor.material('water-clean-surface', '#67b9c6');
  const process = editor.material('water-process-surface', '#829e87');
  const brass = editor.material('water-valve', '#d9b569');
  const box = (name, w, h, d, x, y, z, material = steel) => editor.box(name, w, h, d, x, y, z, material, root);
  const attach = (mesh, x, y, z, material) => {
    mesh.position.set(x, y, z); mesh.parent = root; mesh.material = material;
    return mesh;
  };
  const cylinder = (name, diameter, height, x, y, z, material = steel, top = diameter, sides = 16) =>
    attach(MeshBuilder.CreateCylinder(name, { diameterBottom: diameter, diameterTop: top, height, tessellation: sides }, editor.scene), x, y, z, material);
  const beam = (name, a, b, thickness = 0.1, material = steel) => {
    const delta = Vector3.FromArray(b).subtract(Vector3.FromArray(a)), direction = delta.normalizeToNew();
    const axis = Vector3.Cross(Vector3.Up(), direction);
    const mesh = box(name, thickness, delta.length(), thickness, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, material);
    mesh.rotationQuaternion = axis.lengthSquared() > 1e-8
      ? Quaternion.RotationAxis(axis.normalize(), Math.acos(Math.max(-1, Math.min(1, direction.y))))
      : Quaternion.RotationAxis(Vector3.Right(), direction.y < 0 ? Math.PI : 0);
    return mesh;
  };
  const tube = (a, b, diameter = 0.28) => {
    const delta = Vector3.FromArray(b).subtract(Vector3.FromArray(a));
    const mesh = cylinder('water-conduit', diameter, delta.length(), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, pipe, diameter, 10);
    const direction = delta.normalizeToNew(), axis = Vector3.Cross(Vector3.Up(), direction);
    mesh.rotationQuaternion = axis.lengthSquared() > 1e-8
      ? Quaternion.RotationAxis(axis.normalize(), Math.acos(Math.max(-1, Math.min(1, direction.y))))
      : Quaternion.RotationAxis(Vector3.Right(), direction.y < 0 ? Math.PI : 0);
    return mesh;
  };
  const rail = (x1, x2, z, deckY) => {
    for (const x of [x1, (x1 + x2) / 2, x2]) box('guardrail-post', 0.065, 0.7, 0.065, x, deckY + 0.35, z, dark);
    for (const y of [deckY + 0.35, deckY + 0.7]) box('guardrail', x2 - x1, 0.055, 0.055, (x1 + x2) / 2, y, z);
  };
  const ringRail = (x, z, radius, deckY) => {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      box('tank-rail-post', 0.06, 0.55, 0.06, x + Math.sin(angle) * radius, deckY + 0.275, z + Math.cos(angle) * radius, dark);
    }
    attach(MeshBuilder.CreateTorus('tank-guardrail', { diameter: radius * 2, thickness: 0.055, tessellation: 16 }, editor.scene), x, deckY + 0.55, z, steel);
  };
  const ladder = (x, z, bottom, top, width = 0.48) => {
    for (const dx of [-width / 2, width / 2]) box('ladder-side', 0.06, top - bottom, 0.06, x + dx, (top + bottom) / 2, z, dark);
    for (let y = bottom + 0.2; y < top; y += 0.55) box('ladder-rung', width, 0.06, 0.08, x, y, z, steel);
  };
  const valve = (x, y, z) => {
    cylinder('valve-body', 0.5, 0.45, x, y, z, steel, 0.5, 10).rotation.x = Math.PI / 2;
    cylinder('valve-stem', 0.09, 0.35, x, y + 0.32, z, dark, 0.09, 8);
    attach(MeshBuilder.CreateTorus('valve-wheel', { diameter: 0.47, thickness: 0.07, tessellation: 12 }, editor.scene), x, y + 0.53, z, brass);
    box('valve-spoke', 0.42, 0.06, 0.06, x, y + 0.53, z, brass);
    box('valve-spoke', 0.06, 0.06, 0.42, x, y + 0.53, z, brass);
  };
  const droplet = (x, y, z) => {
    attach(MeshBuilder.CreateSphere('water-symbol', { diameter: 0.36, segments: 4 }, editor.scene), x, y - 0.07, z, pipe);
    cylinder('water-symbol-tip', 0.32, 0.33, x, y + 0.13, z, pipe, 0, 8);
  };
  const building = (name, w, h, d, x, z) => {
    box(`${name}-body`, w, h, d, x, h / 2 + 0.2, z, shell);
    box(`${name}-roof`, w + 0.25, 0.2, d + 0.25, x, h + 0.35, z, dark);
    for (const dx of [-w * 0.26, w * 0.26]) facadeWindow(editor, `${name}-window`, w * 0.28, 0.85, x + dx, h * 0.65, z - d / 2, 'front', pipe, root);
    box(`${name}-door`, 0.85, 1.65, 0.1, x, 1.05, z - d / 2 - 0.1, dark);
    droplet(x, 1.15, z - d / 2 - 0.25);
    box(`${name}-vent`, 1.1, 0.3, 0.85, x, h + 0.6, z + 0.7, steel);
    for (const dx of [-w * 0.4, w * 0.4]) box(`${name}-wall-trim`, 0.12, h, 0.12, x + dx, h / 2 + 0.2, z - d / 2 - 0.08, steel);
  };
  const basin = (x, z, w, d) => {
    box('basin-floor', w, 0.2, d, x, 0.28, z, concrete);
    for (const dx of [-(w - 0.2) / 2, (w - 0.2) / 2]) box('basin-wall', 0.2, 0.95, d, x + dx, 0.85, z, concrete);
    for (const dz of [-(d - 0.2) / 2, (d - 0.2) / 2]) box('basin-wall', w - 0.4, 0.95, 0.2, x, 0.85, z + dz, concrete);
    // The surface sits inside a hollow basin, above the floor and below its rim.
    box('basin-water', w - 0.44, 0.035, d - 0.44, x, 1.03, z, water);
    for (const dz of [-d / 2, d / 2]) box('basin-rim', w, 0.1, 0.22, x, 1.38, z + dz, steel);
  };

  box('water-facility-pad', asset.width + 0.3, 0.18, asset.depth + 0.3, 0, 0.09, 0, concrete);
  if (asset.id === 'water-treatment') {
    building('filter-house', 3.8, 3.5, 7, -3.65, 0);
    for (const z of [-2.15, 2.15]) {
      basin(2.25, z, 5.6, 3.3);
      for (const x of [0.65, 2.25, 3.85]) box('filter-divider', 0.12, 0.2, 2.85, x, 1.12, z, steel);
      tube([-1.55, 0.7, z], [-0.6, 0.7, z]);
      valve(-1.1, 0.7, z);
    }
    box('filter-service-bridge', 5.65, 0.16, 0.65, 2.25, 1.48, 0, dark);
    for (const z of [-0.3, 0.3]) rail(-0.55, 5.05, z, 1.57);
    box('filter-control-panel', 0.55, 0.95, 0.32, -0.8, 0.75, -0.4, dark);
    box('filter-control-display', 0.35, 0.25, 0.06, -0.8, 1, -0.6, pipe);
  } else if (asset.id === 'intake-station') {
    building('intake-house', 4, 3.5, 4.6, -2.5, 0.7);
    basin(2.25, 0, 4.3, 6);
    for (const z of [-2.2, -1.45, -0.7, 0.05, 0.8, 1.55, 2.3]) box('intake-screen-bar', 0.12, 1.15, 0.085, 0.45, 1.02, z, dark);
    box('screen-header', 0.3, 0.15, 5.1, 0.45, 1.66, 0, steel);
    box('screen-lifting-beam', 0.15, 0.15, 5.1, 0.45, 3.05, 0, steel);
    for (const z of [-2.45, 2.45]) box('screen-lifting-post', 0.15, 1.6, 0.15, 0.45, 2.25, z, steel);
    box('screen-hoist', 0.42, 0.5, 0.6, 0.45, 2.7, 0, dark);
    for (const z of [-1.4, 1.4]) {
      tube([-0.35, 1.3, z], [1.7, 1.3, z], 0.32);
      tube([1.7, 1.3, z], [1.7, 0.6, z], 0.32);
    }
    box('intake-walkway', 4.3, 0.16, 0.65, 2.25, 1.55, -3.1, dark);
    rail(0.12, 4.38, -3.37, 1.63);
  } else if (asset.id === 'reservoir') {
    for (const x of [-2.35, 2.35]) {
      cylinder('tank-plinth', 4.4, 0.3, x, 0.33, 0, dark);
      cylinder('storage-tank', 4.1, 3.75, x, 2.36, 0, shell, 4.1, 20);
      for (const y of [0.75, 2.35, 3.9]) cylinder('tank-band', 4.18, 0.12, x, y, 0, steel, 4.18, 20);
      cylinder('tank-roof', 4.2, 0.28, x, 4.37, 0, steel, 3.75, 20);
      cylinder('tank-hatch', 0.55, 0.14, x, 4.58, 0.45, dark);
      ringRail(x, 0, 1.8, 4.42);
      ladder(x, -2.2, 0.45, 4.45);
      tube([x, 0.65, -1.9], [x, 0.65, -3.15], 0.35);
      valve(x, 0.65, -2.85);
      box('tank-sign', 0.8, 0.8, 0.12, x + 0.75, 2.3, -1.98, dark);
      droplet(x + 0.75, 2.3, -2.18);
    }
    tube([-2.35, 0.65, -3.15], [2.35, 0.65, -3.15], 0.35);
  } else if (asset.id === 'pump-station') {
    building('pump-house', 5.1, 2.9, 3.4, -0.5, 0.55);
    tube([-2.5, 0.65, -2.6], [2.5, 0.65, -2.6], 0.32);
    for (const x of [-1.85, 0, 1.85]) {
      box('pump-plinth', 0.95, 0.2, 0.85, x, 0.3, -1.9, dark);
      cylinder('pump-motor', 0.55, 0.8, x, 0.8, -1.65, steel, 0.55, 12).rotation.x = Math.PI / 2;
      tube([x, 0.65, -1.4], [x, 0.65, -2.6]);
      valve(x, 0.65, -2.35);
      cylinder('pressure-gauge', 0.26, 0.08, x + 0.32, 1.3, -2.3, shell, 0.26, 10).rotation.x = Math.PI / 2;
      box('gauge-needle', 0.025, 0.13, 0.05, x + 0.32, 1.3, -2.38, dark).rotation.z = -0.45;
    }
  } else if (asset.id === 'wastewater') {
    building('process-house', 3.4, 2.9, 7.2, -3.75, 0);
    for (const z of [-2.3, 2.3]) {
      const shape = [[0, 0], [1.9, 0], [1.9, 1.15], [1.72, 1.15], [1.72, 0.18], [0, 0.18]].map(([radius, y]) => new Vector3(radius, y, 0));
      attach(MeshBuilder.CreateLathe('clarifier-basin', { shape, tessellation: 20 }, editor.scene), 2.2, 0.22, z, concrete);
      cylinder('clarifier-water', 3.4, 0.035, 2.2, 1.13, z, process, 3.4, 20);
      cylinder('clarifier-hub', 0.5, 0.5, 2.2, 1.53, z, dark);
      box('clarifier-scraper', 3.35, 0.08, 0.14, 2.2, 1.27, z, steel);
      box('clarifier-bridge', 3.85, 0.16, 0.45, 2.2, 1.7, z, dark);
      for (const dz of [-0.2, 0.2]) rail(0.3, 4.1, z + dz, 1.78);
      tube([-1.9, 0.6, z], [0.4, 0.6, z]);
    }
    box('process-service-path', 3.4, 0.12, 0.55, 2.2, 0.27, 0, steel);
  } else if (asset.id === 'water-tower') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box('tower-foot', 0.65, 0.35, 0.65, sx * 1.65, 0.35, sz * 1.65, dark);
      beam('tower-leg', [sx * 1.65, 0.5, sz * 1.65], [sx * 1.25, 8.25, sz * 1.25], 0.22, steel);
    }
    for (const [y, nextY, span, nextSpan] of [[0.65, 4.4, 1.64, 1.45], [4.4, 8.1, 1.45, 1.26]]) {
      for (const sign of [-1, 1]) {
        beam('tower-diagonal', [-span, y, sign * span], [nextSpan, nextY, sign * nextSpan], 0.1, dark);
        beam('tower-diagonal', [span, y, sign * span], [-nextSpan, nextY, sign * nextSpan], 0.1, dark);
        beam('tower-diagonal', [sign * span, y, -span], [sign * nextSpan, nextY, nextSpan], 0.1, dark);
      }
    }
    cylinder('tank-underbody', 3.4, 0.8, 0, 8.1, 0, steel, 4.6, 20);
    cylinder('elevated-tank', 4.6, 2.3, 0, 9.6, 0, shell, 4.6, 20);
    for (const y of [8.5, 10.55]) cylinder('tank-band', 4.7, 0.13, 0, y, 0, pipe, 4.7, 20);
    cylinder('tank-roof', 4.8, 0.32, 0, 10.97, 0, steel, 4.25, 20);
    ringRail(0, 0, 2.04, 11.15);
    cylinder('tank-roof-vent', 0.45, 0.35, 0, 11.34, 0, dark);
    tube([0, 0.55, -2], [0, 8.5, -2], 0.3);
    tube([0, 0.55, -2], [0, 0.55, -2.95], 0.3);
    valve(0, 0.55, -2.7);
    ladder(1, -1.55, 0.5, 8.3);
    box('tower-sign', 1.25, 0.95, 0.16, 0, 9.65, -2.35, dark);
    droplet(0, 9.65, -2.53);
  }
}

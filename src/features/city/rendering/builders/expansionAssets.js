import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { facadeWindow } from './facadeWindows.js';

// Static geometry only: buildObject merges by material and shares templates.
export function buildExpansionAsset(editor, asset, root) {
  const slab = editor.material('expansion-pavement', '#8e9b99');
  const wall = editor.material(`expansion-wall-${asset.color}`, asset.color);
  const steel = editor.material('expansion-steel', '#c9d5d2');
  const dark = editor.material('expansion-dark', '#42565d');
  const glass = editor.material('expansion-glass', '#5b889b');
  const accent = editor.material('expansion-accent', '#debc73');
  const green = editor.material('expansion-green', '#7fae94');
  const box = (name, w, h, d, x, y, z, material = wall) => editor.box(name, w, h, d, x, y, z, material, root);
  const cylinder = (name, diameter, h, x, y, z, material = steel) => {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter, height: h, tessellation: 10 }, editor.scene);
    mesh.position.set(x, y, z); mesh.parent = root; mesh.material = material;
    return mesh;
  };
  const building = (w, h, d, x = 0, z = 1, flatRoof = true) => {
    box('main-building', w, h, d, x, h / 2 + 0.18, z);
    if (flatRoof) box('roof-cap', w + 0.25, 0.22, d + 0.25, x, h + 0.29, z, dark);
  };
  const beam = (name, a, b, thickness = 0.12, material = steel) => {
    const start = Vector3.FromArray(a), end = Vector3.FromArray(b), delta = end.subtract(start);
    const mesh = box(name, thickness, delta.length(), thickness, ...start.add(end).scale(0.5).asArray(), material);
    const direction = delta.normalize(), axis = Vector3.Cross(Vector3.Up(), direction);
    mesh.rotationQuaternion = axis.lengthSquared() > 1e-8 ? Quaternion.RotationAxis(axis.normalize(), Math.acos(Math.max(-1, Math.min(1, direction.y)))) : Quaternion.Identity();
    return mesh;
  };
  const pitchedRoof = (w, d, x, y, z, rise, material = dark) => {
    const half = w / 2, length = Math.hypot(half, rise), angle = Math.atan2(rise, half);
    for (const sign of [-1, 1]) box('pitched-roof-slope', length, 0.14, d, x + sign * half / 2, y + rise / 2, z, material).rotation.z = -sign * angle;
    box('roof-ridge-cap', 0.18, 0.14, d, x, y + rise + 0.04, z, steel);
    // End rafters emphasize the roof shape without dense curved geometry.
    for (const end of [-1, 1]) for (const sign of [-1, 1]) beam('gable-rafter', [x + sign * half, y, z + end * d / 2], [x, y + rise, z + end * d / 2], 0.14, steel);
  };
  const planter = (x, z, w = 1.5) => {
    box('planter', w, 0.35, 0.65, x, 0.37, z, wall);
    box('hedge', w - 0.14, 0.38, 0.48, x, 0.71, z, green);
  };
  const window = (w, h, x, y, z) => facadeWindow(editor, 'facade-window', w, h, x, y, z, 'front', glass, root);
  const door = (x, z, w = 2.1, h = 2.8) => {
    box('door-frame', w + 0.22, h + 0.2, 0.16, x, h / 2 + 0.2, z - 0.09, steel);
    box('loading-shutter', w, h, 0.11, x, h / 2 + 0.2, z - 0.19, dark);
    for (let y = 0.65; y < h; y += 0.55) box('shutter-seam', w - 0.12, 0.045, 0.04, x, y, z - 0.27, steel);
  };
  const vent = (x, y, z) => {
    box('rooftop-vent', 1.5, 0.55, 1.3, x, y, z, steel);
    for (const dx of [-0.45, 0, 0.45]) box('vent-grille', 0.13, 0.045, 1.05, x + dx, y + 0.3, z, dark);
  };
  const bollard = (x, z) => { cylinder('safety-bollard', 0.16, 0.9, x, 0.63, z, accent); };
  const parkingBay = (x, z, w = 2.6, d = 4.6) => {
    for (const sign of [-1, 1]) box('parking-line', 0.07, 0.025, d, x + sign * w / 2, 0.205, z, steel);
    box('wheel-stop', w * 0.55, 0.13, 0.2, x, 0.265, z + d / 2 - 0.35, accent);
  };
  const signP = (x, y, z) => {
    box('parking-sign', 1.2, 1.4, 0.1, x, y, z, glass);
    box('parking-p-stem', 0.1, 0.88, 0.05, x - 0.2, y, z - 0.08, steel);
    for (const dy of [0, 0.38]) box('parking-p-bar', 0.4, 0.09, 0.05, x, y + dy, z - 0.08, steel);
    box('parking-p-edge', 0.09, 0.4, 0.05, x + 0.2, y + 0.19, z - 0.08, steel);
  };
  box('facility-pad', asset.width + 0.3, 0.18, asset.depth + 0.3, 0, 0.09, 0, slab);

  if (['logistics-center', 'warehouse', 'cold-storage'].includes(asset.id)) {
    const cold = asset.id === 'cold-storage', large = asset.id === 'logistics-center';
    const w = asset.width - 2, d = asset.depth - 6, h = asset.height - (large ? 2.1 : 1.1), z = 2;
    building(w, h, d, 0, z, asset.id !== 'warehouse');
    if (asset.id === 'warehouse') pitchedRoof(w + 0.2, d + 0.2, 0, h + 0.2, z, 0.7);
    const front = z - d / 2;
    const docks = large ? [-7.8, -3.9, 0, 3.9, 7.8] : [-4, 0, 4];
    for (const x of docks) {
      door(x, front);
      box('loading-platform', 2.5, 0.5, 1.15, x, 0.43, front - 0.62, dark);
      bollard(x - 1.35, front - 1.4); bollard(x + 1.35, front - 1.4);
      box('dock-number-plate', 0.55, 0.25, 0.08, x, 3.45, front - 0.12, accent);
    }
    box('dock-canopy', w - 0.7, 0.18, 1.8, 0, 3.95, front - 0.7, steel);
    for (const x of [-w / 2 + 0.7, w / 2 - 0.7]) box('wall-column', 0.16, h, 0.12, x, h / 2 + 0.18, front - 0.1, steel);
    if (cold) {
      for (const x of [-5, 0, 5]) {
        box('refrigeration-skid', 2.8, 0.15, 2.3, x, h + 0.5, 2.5, dark);
        for (const dx of [-0.7, 0.7]) {
          cylinder('condenser-fan', 1.05, 0.35, x + dx, h + 0.75, 2.5, steel);
          cylinder('fan-inset', 0.85, 0.035, x + dx, h + 0.947, 2.5, dark);
          box('fan-blade', 0.65, 0.025, 0.11, x + dx, h + 0.98, 2.5, steel);
        }
      }
      for (let x = -w / 2 + 1; x < w / 2; x += 1.2) box('insulated-panel-seam', 0.04, h - 0.6, 0.06, x, h / 2 + 0.18, front - 0.055, steel);
      box('cold-chain-blue-band', w - 0.4, 0.4, 0.1, 0, h - 0.75, front - 0.13, glass);
      // Six simple spokes form a snowflake sign on the insulated facade.
      for (let i = 0; i < 3; i++) box('cold-storage-snowflake', 0.07, 0.75, 0.08, 0, 4.55, front - 0.17, steel).rotation.z = i * Math.PI / 3;
    } else {
      if (large) {
        vent(-3, h + 0.65, 2.5); vent(3, h + 0.65, 2.5);
        box('dispatch-office', 5.2, 1.5, 3, 7.5, h + 1.05, 4.5, steel);
        window(4.4, 0.8, 7.5, h + 1.05, 3);
        box('dispatch-fascia', 5.4, 0.12, 3.2, 7.5, h + 1.86, 4.5, dark);
        for (const x of [-7.8, -3.9, 0, 3.9, 7.8]) box('truck-lane-guide', 0.075, 0.025, 2.4, x + 1.5, 0.205, -6.9, steel);
        box('freight-trailer', 2.4, 1.7, 3.2, -7.8, 1.25, -6.35, steel);
        box('truck-cab', 2.35, 1.5, 1.3, -7.8, 1.15, -8.2, glass);
        for (const x of [-8.95, -6.65]) for (const tz of [-7.9, -5.4]) box('truck-wheel', 0.25, 0.55, 0.6, x, 0.48, tz, dark);
      } else {
        for (const x of [-4.5, 4.5]) window(1.4, 0.65, x, 4.2, front);
        for (const side of [-1, 1]) for (const tz of [0, 2, 4]) box('warehouse-side-rib', 0.11, h, 0.12, side * (w / 2 + 0.04), h / 2 + 0.18, tz, steel);
      }
      for (const x of [-w / 2 + 1, w / 2 - 1]) box('freight-pallet', 1.25, 0.6, 1, x, 0.48, -asset.depth / 2 + 1.2, accent);
    }
    return;
  }
  if (['small-factory', 'assembly-plant'].includes(asset.id)) {
    const w = asset.width - 2, d = asset.depth - 4, h = asset.height - 1.5;
    building(w, h, d, 0, 1, false);
    if (asset.id === 'small-factory') pitchedRoof(w + 0.2, d + 0.2, 0, h + 0.2, 1, 0.9, steel);
    else {
      // Repeated roof monitors make a long assembly hall distinct at city scale.
      box('assembly-roof-deck', w + 0.2, 0.18, d + 0.2, 0, h + 0.25, 1, dark);
      for (const tz of [-2.7, 1, 4.7]) {
        box('assembly-roof-monitor', w - 1, 0.7, 1.7, 0, h + 0.65, tz, steel);
        box('monitor-glazing', w - 1.4, 0.4, 0.08, 0, h + 0.67, tz - 0.9, glass);
        box('monitor-cap', w - 0.8, 0.12, 1.9, 0, h + 1.05, tz, dark);
      }
    }
    const front = 1 - d / 2;
    for (const x of [-w / 3, 0, w / 3]) { window(2.2, 0.85, x, h - 0.8, front); door(x, front, 2, 2.5); }
    for (const x of [-w / 4, w / 4]) vent(x, h + 0.95, 2);
    for (const x of [-w / 2 + 0.8, w / 2 - 0.8]) box('factory-front-pier', 0.25, h, 0.18, x, h / 2 + 0.18, front - 0.13, steel);
    if (asset.id === 'small-factory') { cylinder('extractor-stack', 0.65, 2, 4.5, h, 3.4, steel); cylinder('stack-cap', 0.85, 0.15, 4.5, h + 1.05, 3.4, dark); }
    else { box('material-canopy', 4.5, 0.18, 2, 6, 3.3, front - 0.6, steel); for (const x of [5, 7]) box('material-crate', 1.3, 1.2, 1.2, x, 0.78, front - 1.05, accent); }
    return;
  }
  if (asset.id === 'parking-lot') {
    for (const z of [-3.5, 3.5]) for (const x of [-5.3, -2.65, 0, 2.65, 5.3]) parkingBay(x, z);
    box('entry-barrier-post', 0.3, 1, 0.3, -7.2, 0.68, 0, dark);
    box('entry-barrier-arm', 2.6, 0.1, 0.12, -5.9, 1.12, 0, accent);
    cylinder('sign-post', 0.12, 1, 7, 0.68, -5.7, steel); signP(7, 1.42, -5.7);
    for (const x of [-5, 0, 5]) planter(x, 0, 2);
    for (const x of [-1.2, 1.2]) box('parking-travel-arrow', 0.1, 0.025, 1.2, x, 0.205, 0, steel).rotation.y = x > 0 ? -0.6 : 0.6;
    for (const [x, z] of [[-2.65, -3.5], [2.65, 3.5]]) {
      box('parked-car', 1.6, 0.6, 3.4, x, 0.76, z, glass);
      box('car-cabin', 1.35, 0.5, 1.6, x, 1.3, z, steel);
      for (const dx of [-0.78, 0.78]) for (const dz of [-1.1, 1.1]) box('car-wheel', 0.2, 0.4, 0.5, x + dx, 0.5, z + dz, dark);
    }
    return;
  }
  if (asset.id === 'parking-tower') {
    for (const y of [0.3, 3.2, 6.1, 9]) {
      box('parking-floor', 11, 0.22, 10, -0.7, y, 0.5, slab);
      for (const x of [-5.7, 4.3]) box('deck-guardrail', 0.14, 0.7, 10, x, y + 0.65, 0.5, steel);
      box('rear-guardrail', 10.2, 0.7, 0.14, -0.7, y + 0.65, 5.3, steel);
      box('parking-level-color-band', 10.6, 0.28, 0.12, -0.7, y + 0.6, -4.6, y > 5 ? glass : accent);
      for (const x of [-4, -0.7, 2.6]) box('deck-parking-mark', 0.07, 0.025, 3.5, x, y + 0.13, 2.8, steel);
    }
    for (const x of [-5.5, -0.7, 4.1]) for (const z of [-4, 4.8]) box('parking-structure-column', 0.32, 11.1, 0.32, x, 5.75, z, wall);
    box('parking-top-roof', 11.3, 0.23, 10.3, -0.7, 11.5, 0.5, dark);
    box('entry-ramp', 1.6, 0.16, 8, 5.4, 1.67, -0.2, slab).rotation.x = -0.36;
    signP(-4.8, 2, -4.65);
    for (const z of [-4, 4.8]) for (const y of [0.5, 6.2]) beam('parking-cross-brace', [-5.5, y, z], [-0.7, y + 4.9, z], 0.12, dark);
    for (const z of [-3, -1, 1, 3]) box('ramp-safety-post', 0.12, 0.85, 0.12, 6.22, 2.4 + z * 0.36, z, steel);
    beam('ramp-handrail', [6.22, 1.75, -3.9], [6.22, 4.5, 3.9], 0.1, steel);
    return;
  }
  if (asset.id === 'bus-depot') {
    building(21, 4.7, 7, 0, 4.7);
    for (const x of [-7, 0, 7]) { door(x, 1.2, 4, 3.5); parkingBay(x, -4, 4.3, 7); }
    for (const x of [-7, 7]) {
      box('parked-bus-body', 2.3, 1.8, 5.7, x, 1.35, -4, green);
      box('bus-roof', 2.35, 0.15, 5.8, x, 2.33, -4, steel);
      window(1.85, 0.75, x, 1.8, -6.85);
      for (const side of [-1, 1]) for (const z of [-5.8, -4.5, -3.2]) facadeWindow(editor, 'bus-side-window', 0.9, 0.7, x + side * 1.15, 1.85, z, side < 0 ? 'left' : 'right', glass, root);
      for (const side of [-1, 1]) for (const z of [-5.7, -2.3]) { const wheel = cylinder('bus-wheel', 0.65, 0.22, x + side * 1.13, 0.55, z, dark); wheel.rotation.z = Math.PI / 2; }
    }
    box('depot-control-office', 4.2, 2.4, 3, 8.5, 5, 5.5, steel);
    window(3.5, 1, 8.5, 5.3, 4);
    for (const x of [-7, 0, 7]) box('service-bay-fascia', 4.6, 0.35, 0.12, x, 4.3, 1.02, accent);
    return;
  }
  if (['recycling-center', 'resource-recovery'].includes(asset.id)) {
    const recovery = asset.id === 'resource-recovery', w = asset.width - 4, d = asset.depth - 6, h = recovery ? 7 : 4.8;
    building(w, h, d, -1, 2);
    door(-4, 2 - d / 2, 3, 3.5); door(2, 2 - d / 2, 3, 3.5);
    for (const [i, x] of [-5, -1, 3].entries()) {
      box('sorting-container', 2.7, 1.5, 2, x, 0.93, -asset.depth / 2 + 1.7, [green, glass, accent][i]);
      box('container-rim', 2.85, 0.1, 2.1, x, 1.73, -asset.depth / 2 + 1.7, dark);
    }
    if (recovery) {
      for (const z of [1, 4]) { cylinder('exhaust-scrubber', 1.6, 5.2, 10, 2.8, z, steel); cylinder('scrubber-band', 1.75, 0.18, 10, 3.7, z, dark); }
      cylinder('exhaust-stack', 1.1, 11.4, 8.5, 5.9, 6.8, steel);
      cylinder('stack-warning-band', 1.14, 0.7, 8.5, 10.1, 6.8, accent);
      box('filter-duct', 3, 0.65, 0.65, 8.5, 4.6, 1, dark);
      cylinder('process-silo', 2.8, 6.8, -7.5, 3.6, 6.5, steel);
      for (const y of [1.1, 4.4, 6.8]) cylinder('silo-band', 2.9, 0.12, -7.5, y, 6.5, dark);
      beam('process-transfer-pipe', [-7.5, 6, 6.5], [-3, 6, 6.5], 0.3, steel);
      for (const y of [2, 4, 6]) box('process-wall-louver', 4, 0.18, 0.12, 4.5, y, -4.12, steel);
    } else {
      vent(-3, 5.45, 2); vent(3, 5.45, 2);
      box('sorting-conveyor', 1.7, 0.35, 3.9, 5.4, 1.6, -2.9, dark).rotation.x = -0.3;
      for (const x of [4.8, 6]) beam('conveyor-rail', [x, 1.2, -4.7], [x, 2.3, -1.1], 0.1, steel);
      for (const tz of [-4, -2]) box('conveyor-support', 0.2, 1.3, 1.3, 5.4, 0.85, tz, steel);
      box('sorting-roof-monitor', 5.5, 0.6, 2, -1, 5.6, 2, green);
      box('sorting-monitor-cap', 5.7, 0.12, 2.2, -1, 5.97, 2, dark);
    }
    return;
  }
  // Civic facilities have distinct massing, entrances and roof details.
  if (asset.id === 'gymnasium') {
    building(15.6, 7.2, 10.5, 0, 1, false);
    const arch = z => Array.from({ length: 13 }, (_, i) => {
      const angle = i * Math.PI / 12;
      return new Vector3(-8 + i * 16 / 12, 7.4 + Math.sin(angle) * 1.35, z);
    });
    const roof = MeshBuilder.CreateRibbon('gym-barrel-roof', { pathArray: [arch(-4.4), arch(6.4)], sideOrientation: 2 }, editor.scene);
    roof.parent = root; roof.material = steel;
    for (const tz of [-4.35, 1, 6.35]) {
      const points = arch(tz);
      for (let i = 0; i < points.length - 1; i++) beam('gym-roof-rib', points[i].asArray(), points[i + 1].asArray(), 0.08, dark);
    }
    for (const x of [-7, -3.5, 3.5, 7]) box('gym-wall-buttress', 0.24, 6.8, 0.28, x, 3.6, -4.35, steel);
    for (const x of [-6, -3, 0, 3, 6]) window(1.9, 1.2, x, 5.8, -4.25);
    box('gym-entry', 5.5, 3, 1.7, 0, 1.68, -5.2, steel); window(4.3, 2.2, 0, 1.55, -6.05);
    for (const x of [-3.8, 3.8]) planter(x, -5.7, 1.8);
    cylinder('gym-ball-sign', 0.75, 0.07, 0, 3.95, -4.38, accent).rotation.x = Math.PI / 2;
  } else {
    const library = asset.id === 'library', h = library ? 5.8 : 4.8;
    building(10.2, h, 7.2, 0, 1);
    for (const y of [1.7, 3.9]) for (const x of [-3.7, -1.25, 1.25, 3.7]) window(1.7, 1.2, x, y, -2.6);
    box('entrance-frame', 3.1, 2.7, 0.5, 0, 1.53, -3.05, steel); window(2.6, 2.3, 0, 1.5, -3.3);
    box('entrance-canopy', 4.4, 0.18, 1.8, 0, 3.1, -3.2, library ? accent : green);
    box('entry-step', 4.2, 0.15, 1.2, 0, 0.26, -3.9, slab);
    if (library) {
      for (const [i, x] of [-0.75, -0.25, 0.25, 0.75].entries()) box('book-sign-spine', 0.32, 0.8 + i * 0.12, 0.12, x, 5.25, -2.78, i % 2 ? green : accent);
      pitchedRoof(3.6, 2.5, 1.8, 6.2, 1.5, 0.55, glass);
      for (const x of [-4.7, -4.35, -4]) box('library-shading-fin', 0.1, 5.4, 0.5, x, 3, -2.85, accent);
      box('roof-reading-terrace', 3, 0.15, 4, -3.3, 6.27, 1.5, slab);
      for (const x of [-4.65, -1.95]) box('terrace-planter', 0.3, 0.3, 3.4, x, 6.5, 1.5, green);
      for (const z of [0.3, 2.4]) box('terrace-reading-bench', 1.4, 0.32, 0.45, -3.3, 6.52, z, accent);
      box('library-entry-bench', 1.5, 0.4, 0.55, -3.8, 0.65, -4, accent);
      planter(3.8, -4, 1.7);
    } else {
      box('civic-nameplate', 2.2, 0.5, 0.12, 0, 4.7, -2.78, green);
      cylinder('flagpole', 0.08, 5.5, 4.9, 2.95, -3.8, steel);
      box('flag', 0.95, 0.6, 0.06, 4.45, 5.25, -3.8, steel);
      vent(2, 5.45, 2);
      for (const x of [-1.8, 1.8]) box('community-portico-column', 0.23, 2.8, 0.23, x, 1.58, -3.7, steel);
      for (const y of [0.28, 0.42, 0.56]) box('community-entry-stair', 3.3, 0.14, 0.6, 0, y, -4.55 + (y - 0.28) * 3, steel);
      box('accessible-entry-ramp', 1.1, 0.14, 2.1, 2.8, 0.43, -3.65, slab).rotation.x = -0.18;
      beam('accessible-ramp-rail', [3.42, 1, -4.7], [3.42, 1.4, -2.6], 0.07, steel);
      cylinder('community-clock-face', 0.7, 0.07, -3.8, 4.85, -2.72, steel).rotation.x = Math.PI / 2;
      box('clock-hour-hand', 0.035, 0.22, 0.04, -3.8, 4.94, -2.78, dark);
      box('clock-minute-hand', 0.25, 0.035, 0.04, -3.68, 4.85, -2.78, dark);
      planter(-4, -4, 1.7);
    }
  }
}

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { bridgeById } from './bridgePresets.js';
import { terrainHeight } from './cityModel.js';
import { createRoadStrip } from './roadGeometry.js';

export function buildBridgeDetails(editor, road, profile, root, preview, problem, lift) {
  const preset = bridgeById[road.bridge];
  if (!preset) return;
  const tint = material => preview ? editor.material(problem ? 'bridge-preview-invalid' : 'bridge-preview-valid', problem ? '#d8776d' : '#a0d8bb') : material;
  const concrete = tint(editor.material('bridge-concrete', '#aebdb8'));
  const steel = tint(editor.material(preset.id === 'footbridge' ? 'bridge-wood' : 'bridge-steel', preset.id === 'footbridge' ? '#a48259' : '#718a89'));
  const cable = tint(editor.material('bridge-cable', '#d3c69b'));
  const tower = tint(editor.material('bridge-tower', '#c4d1ca'));
  const strip = (name, width, offset, y, thickness, material) => {
    const mesh = createRoadStrip(editor.scene, name, profile, width, offset, y, thickness); mesh.parent = root; mesh.material = material; mesh.receiveShadows = !preview; return mesh;
  };
  const box = (name, width, height, depth, point, material, rotate = true) => {
    const mesh = MeshBuilder.CreateBox(name, { width, height: Math.max(0.1, height), depth }, editor.scene);
    mesh.parent = root; mesh.position.copyFrom(point); mesh.material = material; mesh.receiveShadows = !preview;
    if (rotate) mesh.rotation.y = -Math.atan2(road.b.z - road.a.z, road.b.x - road.a.x);
    return mesh;
  };
  const at = (t, side = 0, y = 0) => {
    const distance = t * profile.length;
    let i = 0; while (i < profile.samples.length - 2 && profile.samples[i + 1].distance < distance) i++;
    const a = profile.samples[i], b = profile.samples[i + 1] || a;
    const weight = b.distance > a.distance ? (distance - a.distance) / (b.distance - a.distance) : 0;
    return new Vector3(a.x + (b.x - a.x) * weight + profile.nx * side, a.height + (b.height - a.height) * weight + lift + y, a.z + (b.z - a.z) * weight + profile.nz * side);
  };
  const tube = (name, path, radius, material) => {
    const mesh = MeshBuilder.CreateTube(name, { path, radius, tessellation: 8, cap: 3 }, editor.scene);
    mesh.parent = root; mesh.material = material; mesh.receiveShadows = !preview; return mesh;
  };
  strip('bridge-deck', profile.width + 0.8, 0, lift + 0.01, preset.id === 'footbridge' ? 0.28 : 0.55, concrete);
  for (const side of [-1, 1]) {
    const lateral = side * (profile.width / 2 + 0.3);
    strip('bridge-guardrail', 0.1, lateral, lift + 1.1, 0.1, steel);
    strip('bridge-lower-rail', 0.07, lateral, lift + 0.55, 0.08, steel);
    strip('bridge-underbeam', 0.2, side * profile.width * 0.32, lift - 0.24, 0.4, steel);
    const posts = Math.max(2, Math.ceil(profile.length / 3));
    for (let i = 0; i <= posts; i++) box('bridge-rail-post', 0.11, 0.94, 0.11, at(i / posts, lateral, 0.59), steel);
  }
  const towers = preset.style === 'suspension' ? [0.22, 0.78] : [0.27, 0.73];
  const pierCount = Math.max(2, Math.ceil(profile.length / 18));
  const piers = preset.style === 'cable' || preset.style === 'suspension' ? towers : preset.style === 'arch' ? [0.06, 0.94] : profile.length < 12 ? [0.5] : Array.from({ length: pierCount }, (_, i) => (i + 0.5) / pierCount);
  for (const t of piers) {
    const center = at(t), bottom = terrainHeight(editor.city.heights, center.x, center.z) - 0.3;
    const top = center.y - 0.5;
    if (top - bottom < 0.3) continue;
    box('bridge-foundation', 2, 0.5, profile.width + 1.3, new Vector3(center.x, bottom + 0.25, center.z), concrete);
    for (const side of [-1, 1]) {
      const point = at(t, side * profile.width * 0.32); point.y = (bottom + top) / 2;
      box('bridge-pier', 0.9, top - bottom, 0.9, point, concrete);
    }
    box('bridge-pier-cap', 1.3, 0.38, profile.width + 0.65, new Vector3(center.x, top, center.z), concrete);
  }
  if (preset.style === 'arch') {
    const height = Math.min(10, profile.length * 0.17);
    for (const side of [-1, 1]) {
      const lateral = side * (profile.width / 2 + 0.48);
      const path = Array.from({ length: 33 }, (_, i) => at(i / 32, lateral, 0.45 + Math.sin(Math.PI * i / 32) * height));
      tube('bridge-arch', path, 0.2, tower);
      for (let i = 1; i < 12; i++) tube('bridge-arch-hanger', [at(i / 12, lateral, 0.3), at(i / 12, lateral, 0.45 + Math.sin(Math.PI * i / 12) * height)], 0.055, cable);
    }
  }
  if (preset.style === 'cable' || preset.style === 'suspension') {
    const height = Math.min(24, Math.max(10, profile.length * 0.16));
    const lateral = profile.width / 2 + 0.57;
    for (const t of towers) {
      for (const side of [-1, 1]) box('bridge-tower', 0.65, height, 0.7, at(t, side * lateral, height / 2), tower);
      box('bridge-tower-crossbeam', 0.65, 0.65, lateral * 2 + 0.7, at(t, 0, height - 0.7), tower);
    }
    for (const side of [-1, 1]) {
      if (preset.style === 'cable') {
        for (const [index, t] of towers.entries()) for (let i = 0; i <= 10; i++) {
          const target = index * 0.5 + i * 0.05;
          if (Math.abs(target - t) < 0.03) continue;
          tube('bridge-stay-cable', [at(t, side * lateral, height - 0.5), at(target, side * lateral, 0.5)], 0.055, cable);
        }
      } else {
        const cableHeight = t => {
          if (t <= towers[0]) return 0.8 + (height - 0.8) * t / towers[0];
          if (t >= towers[1]) return 0.8 + (height - 0.8) * (1 - t) / (1 - towers[1]);
          const u = (t - towers[0]) / (towers[1] - towers[0]);
          return height * (0.4 + 0.6 * (2 * u - 1) ** 2);
        };
        const fractions = [...new Set([...Array.from({ length: 49 }, (_, i) => i / 48), ...towers])].sort((a, b) => a - b);
        tube('bridge-main-cable', fractions.map(t => at(t, side * lateral, cableHeight(t))), 0.11, cable);
        for (let i = 1; i < 24; i++) tube('bridge-suspension-hanger', [at(i / 24, side * lateral, 0.5), at(i / 24, side * lateral, cableHeight(i / 24))], 0.04, cable);
      }
    }
  }
}

import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { assetById } from '../presets/catalog.js';
import { objectBaseHeight } from '../plots/plotModel.js';

// Model-local openings. Rotate them with the facility, including on raised plots.
const STEAM_OPENINGS = {
  'nuclear-plant': [[-7, 18, 6], [5, 18, 6]],
  'power-plant': [[2.1, 7.32, 1.1], [4.1, 7.32, 1.1]],
  'small-factory': [[4.5, 6.63, 3.4]],
  'resource-recovery': [[8.5, 11.6, 6.8]],
};
export const AMBIENT_LIMITS = { birds: 6, garden: 12, steam: 24 };

// Spread a small number of actors across the scenery, rather than the first sites.
export function spreadSites(objects, limit) {
  if (!objects.length) return [];
  const chosen = [objects.reduce((a, b) => a.x < b.x ? a : b)];
  while (chosen.length < Math.min(limit, objects.length)) {
    let best, distance = 0;
    for (const object of objects) {
      const nearest = chosen.reduce((min, site) => Math.min(min, (object.x - site.x) ** 2 + (object.z - site.z) ** 2), Infinity);
      if (nearest > distance) { best = object; distance = nearest; }
    }
    if (!best || distance < 36) break;
    chosen.push(best);
  }
  return chosen;
}

// A single small, reusable alpha texture: soft lobes with deterministic wisps.
export function steamPixels(size = 64) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size * 2 - 1, v = (y + .5) / size * 2 - 1;
    const lobes = [[-.22, .05, .68], [.26, -.15, .57], [.05, .3, .52]];
    let density = 0;
    for (const [cx, cy, r] of lobes) density = Math.max(density, Math.max(0, 1 - ((u - cx) ** 2 + (v - cy) ** 2) / (r * r)));
    const wisp = .8 + .1 * Math.sin(u * 19 + Math.sin(v * 12)) + .1 * Math.cos(v * 23 + u * 7);
    const index = (y * size + x) * 4;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = Math.round(220 + density * 35);
    pixels[index + 3] = Math.round(density ** 1.5 * wisp * 255);
  }
  return pixels;
}

export class AmbientLife {
  constructor(editor, parent, city, settings) {
    this.editor = editor; this.settings = settings; this.elapsed = 0; this.enabled = undefined;
    this.root = new TransformNode('ambient-life', editor.scene); this.root.parent = parent;
    this.groups = {}; this.actors = []; this.templates = new Map();
    for (const key of Object.keys(AMBIENT_LIMITS)) { this.groups[key] = new TransformNode(`ambient-${key}`, editor.scene); this.groups[key].parent = this.root; }
    if (settings.birds && city.objects.length) {
      const ceiling = city.objects.reduce((max, o) => Math.max(max, objectBaseHeight(city, o) + assetById[o.asset].height), 0) + 8;
      const centers = spreadSites(city.objects, 3);
      for (const center of centers) for (let i = 0; i < 2; i++) {
        const root = this.actor('birds');
        this.part('bird-body', root, '#d8e6e3', .18, .15, .6);
        const left = this.part('bird-wing', root, '#8ca7b1', .7, .06, .25), right = this.part('bird-wing', root, '#8ca7b1', .7, .06, .25);
        left.position.x = -.4; right.position.x = .4;
        this.actors.push({ kind: 'birds', root, left, right, x: center.x, y: ceiling + i * .25, z: center.z, phase: i * .55, radius: 12 + i * 3 });
      }
    }
    const greenery = city.objects.filter(o => ['park', 'playground', 'tree', 'pine'].includes(o.asset));
    if (settings.garden) for (const garden of spreadSites(greenery, 6)) for (let i = 0; i < 2; i++) {
      const root = this.actor('garden');
      const left = this.part('garden-wing', root, '#efc478', .28, .04, .24), right = this.part('garden-wing', root, '#efc478', .28, .04, .24);
      left.position.x = -.14; right.position.x = .14;
      this.actors.push({ kind: 'garden', root, left, right, x: garden.x, y: objectBaseHeight(city, garden) + 1.6, z: garden.z, phase: i * 2.6, radius: Math.max(2, Math.min(assetById[garden.asset].width, assetById[garden.asset].depth) * .35) });
    }
    if (settings.steam) {
      let count = 0;
      for (const object of spreadSites(city.objects.filter(o => STEAM_OPENINGS[o.asset]), 4)) for (const [x, y, z] of STEAM_OPENINGS[object.asset]) {
        if (count++ >= 4) break;
        const cos = Math.cos(object.rotation || 0), sin = Math.sin(object.rotation || 0);
        const anchor = { x: object.x + x * cos + z * sin, y: objectBaseHeight(city, object) + y, z: object.z - x * sin + z * cos };
        for (let i = 0; i < 6; i++) {
          const root = this.actor('steam'), puff = this.part(`steam-puff-${i}`, root, '#dbe6e5', 1, 1, 1, true);
          puff.billboardMode = Mesh.BILLBOARDMODE_ALL;
          this.actors.push({ kind: 'steam', root, puff, ...anchor, phase: i / 6 });
        }
      }
    }
    this.setNight(editor.night); this.tick(0);
  }
  actor(kind) { const root = new TransformNode(`ambient-${kind}-actor`, this.editor.scene); root.parent = this.groups[kind]; return root; }
  part(name, parent, color, width, height, depth, smoke = false) {
    let source = this.templates.get(name);
    if (!source) {
      source = smoke ? MeshBuilder.CreatePlane(name, { size: 1, sideOrientation: Mesh.DOUBLESIDE }, this.editor.scene) : MeshBuilder.CreateBox(name, { width, height, depth }, this.editor.scene);
      source.parent = this.root; source.isVisible = false; source.isPickable = false;
      source.material = this.editor.material(`ambient-${name}`, color);
      if (smoke) {
        const shared = this.editor.material('ambient-steam-texture', '#dbe6e5');
        if (!shared.diffuseTexture) {
          shared.diffuseTexture = RawTexture.CreateRGBATexture(steamPixels(), 64, 64, this.editor.scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
          shared.diffuseTexture.hasAlpha = true;
          shared.diffuseTexture.wrapU = shared.diffuseTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
        }
        source.material.diffuseTexture = shared.diffuseTexture;
        source.material.useAlphaFromDiffuseTexture = true;
        source.material.alpha = .32; source.material.disableLighting = true;
        source.material.emissiveColor = Color3.FromHexString('#dbe6e5').scale(.8);
      }
      this.templates.set(name, source);
    }
    const mesh = source.createInstance(name); mesh.parent = parent; mesh.isVisible = true; mesh.isPickable = false;
    return mesh;
  }
  setNight(night) {
    this.night = !!night;
    for (const actor of this.actors) if (actor.kind === 'steam') actor.puff.material.emissiveColor = Color3.FromHexString('#dbe6e5').scale(night ? .35 : .8);
    const material = this.templates.get('garden-wing')?.material;
    if (material) {
      material.diffuseColor = Color3.FromHexString(night ? '#d9ef92' : '#efc478');
      material.emissiveColor = night ? Color3.FromHexString('#b3d86c').scale(.8) : Color3.Black();
    }
    this.refreshVisibility();
  }
  refreshVisibility() {
    for (const key of Object.keys(this.groups)) this.groups[key].setEnabled(this.settings.enabled && this.settings[key] && (key !== 'birds' || !this.night));
  }
  tick(delta) {
    if (this.enabled !== this.settings.enabled) { this.refreshVisibility(); this.enabled = this.settings.enabled; }
    if (!this.settings.enabled) return;
    this.elapsed += delta;
    for (const actor of this.actors) {
      if (!this.groups[actor.kind].isEnabled()) continue;
      const t = this.elapsed, angle = t * (actor.kind === 'birds' ? .18 : .65) + actor.phase;
      if (actor.kind === 'steam') {
        const progress = (t * .18 + actor.phase) % 1;
        actor.root.position.set(actor.x + progress * 2 + Math.sin(t * .6 + actor.phase) * progress * .35, actor.y + progress * 6, actor.z + Math.sin(progress * 2 + actor.phase) * progress * .7);
        // Grow and shrink existing instances; no particles or materials allocated per frame.
        const scale = 1 + progress * 3;
        actor.root.scaling.setAll(scale);
        actor.puff.rotation.z = actor.phase * 2 + t * .04;
        actor.puff.material.alpha = Math.sin(progress * Math.PI) ** .8 * .36;
      } else {
        actor.root.position.set(actor.x + Math.cos(angle) * actor.radius, actor.y + Math.sin(angle * 2) * .35, actor.z + Math.sin(angle) * actor.radius);
        actor.root.rotation.y = -angle;
        const flap = Math.sin(t * (actor.kind === 'birds' ? 5 : 14) + actor.phase) * (this.night && actor.kind === 'garden' ? .1 : .65);
        actor.left.rotation.z = flap; actor.right.rotation.z = -flap;
        if (actor.kind === 'garden') actor.root.scaling.setAll(this.night ? .5 : 1);
      }
    }
  }
}

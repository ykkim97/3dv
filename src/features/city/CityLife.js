import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { roadProfile } from './roadGeometry.js';

export function roadTravel(profile, distance, direction = 1) {
  distance = Math.max(0, Math.min(profile.length, distance));
  let i = 0;
  while (i < profile.samples.length - 2 && profile.samples[i + 1].distance < distance) i++;
  const a = profile.samples[i], b = profile.samples[i + 1] || a;
  const t = b.distance > a.distance ? (distance - a.distance) / (b.distance - a.distance) : 0;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.height + (b.height - a.height) * t + 0.2, angle: Math.atan2((b.x - a.x) * direction, (b.z - a.z) * direction) };
}
export class CityLife {
  constructor(editor) { this.editor = editor; this.elapsed = 0; }
  update(city) {
    this.root?.dispose(); this.root = new TransformNode('city-life', this.editor.scene); this.actors = []; this.lamps = [];
    this.settings = { enabled: true, cars: true, people: true, ...city.lifeSettings };
    const roads = city.roads.filter(road => Math.hypot(road.b.x - road.a.x, road.b.z - road.a.z) >= 2);
    this.routes = new Map(roads.map(road => [road.id, roadProfile(city, road, this.editor.roadConnections || [])]));
    this.roads = roads;
    const part = (parent, name, width, height, depth, x, y, z, color) => {
      const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, this.editor.scene);
      mesh.parent = parent; mesh.position.set(x, y, z); mesh.isPickable = false; mesh.material = this.editor.material(`life-${color}`, color); return mesh;
    };
    const seen = new Set(), starts = roads.filter(road => { const key = road.chainId || road.id; if (seen.has(key)) return false; seen.add(key); return true; });
    for (let i = 0; i < Math.min(60, starts.length); i++) {
      const road = starts[i], profile = this.routes.get(road.id);
      if (road.type !== 'path' && this.settings.cars) {
        const car = new TransformNode('city-car', this.editor.scene); car.parent = this.root;
        part(car, 'car-body', 0.9, 0.4, 1.7, 0, 0.24, 0, ['#b6d2c8', '#d89c7a', '#86a6b9', '#dbca8a'][i % 4]);
        part(car, 'car-roof', 0.75, 0.28, 0.8, 0, 0.56, -0.1, '#516b72');
        for (const x of [-0.27, 0.27]) part(car, 'car-headlight', 0.17, 0.12, 0.03, x, 0.33, 0.86, '#fff2c1');
        this.actors.push({ root: car, roadId: road.id, distance: profile.length * (i % 7) / 7, direction: i % 2 ? -1 : 1, speed: 4 + i % 3, person: false });
      }
      if (this.settings.people) {
        const person = new TransformNode('city-pedestrian', this.editor.scene); person.parent = this.root;
        part(person, 'pedestrian-body', 0.28, 0.65, 0.24, 0, 0.5, 0, ['#b59f86', '#7fa98d', '#bd8685'][i % 3]);
        const head = MeshBuilder.CreateSphere('pedestrian-head', { diameter: 0.27, segments: 6 }, this.editor.scene);
        head.parent = person; head.position.y = 0.97; head.material = this.editor.material('life-skin', '#d5b89e'); head.isPickable = false;
        this.actors.push({ root: person, roadId: road.id, distance: profile.length * (i % 5) / 5, direction: i % 2 ? 1 : -1, speed: 0.9 + i % 3 * 0.1, person: true });
      }
    }
    const phases = new Map();
    for (const road of roads) {
      if (road.type === 'path' || road.bridge) continue;
      const profile = this.routes.get(road.id);
      const chain = road.chainId || road.id;
      let d = phases.get(chain) ?? 8;
      for (; d < profile.length; d += 22) {
        if (this.lamps.length >= 120) break;
        const point = roadTravel(profile, d), lamp = new TransformNode('streetlight', this.editor.scene); lamp.parent = this.root;
        lamp.position.set(point.x + profile.nx * (profile.width / 2 + 0.55), point.y, point.z + profile.nz * (profile.width / 2 + 0.55));
        part(lamp, 'streetlight-pole', 0.1, 3, 0.1, 0, 1.5, 0, '#72867d');
        const bulb = part(lamp, 'streetlight-lamp', 0.5, 0.13, 0.35, 0, 3, 0, '#ffe5a0'); this.lamps.push(bulb);
      }
      phases.set(chain, d - profile.length);
    }
    this.setNight(this.editor.night); this.tick(0);
  }
  setNight(night) {
    for (const color of ['#ffe5a0', '#fff2c1']) this.editor.material(`life-${color}`, color).emissiveColor = night ? Color3.FromHexString(color).scale(0.85) : Color3.Black();
  }
  tick(delta) {
    if (!this.root) return;
    this.elapsed += delta;
    for (const actor of this.actors) {
      actor.root.setEnabled(this.settings.enabled);
      if (!this.settings.enabled) continue;
      let profile = this.routes.get(actor.roadId);
      actor.distance += delta * actor.speed * actor.direction;
      if (actor.distance > profile.length || actor.distance < 0) {
        const road = this.roads.find(item => item.id === actor.roadId), end = actor.direction > 0 ? road.b : road.a;
        const candidates = this.roads.filter(item => item.id !== road.id && (actor.person || item.type !== 'path') && [item.a, item.b].some(p => Math.hypot(p.x - end.x, p.z - end.z) < 0.05));
        if (candidates.length) {
          const next = candidates[Math.floor(this.elapsed + actor.speed) % candidates.length];
          actor.roadId = next.id; profile = this.routes.get(next.id);
          actor.direction = Math.hypot(next.a.x - end.x, next.a.z - end.z) < 0.05 ? 1 : -1;
          actor.distance = actor.direction > 0 ? 0 : profile.length;
        } else { actor.direction *= -1; actor.distance = Math.max(0, Math.min(profile.length, actor.distance)); }
      }
      const point = roadTravel(profile, actor.distance, actor.direction);
      const road = this.roads.find(item => item.id === actor.roadId);
      const walkway = road.bridge ? road.type === 'path' ? profile.width * 0.2 : profile.width / 2 - 0.42 : profile.width / 2 + 0.58;
      const offset = actor.person ? walkway : profile.width / 4 * actor.direction;
      actor.root.position.set(point.x + profile.nx * offset, point.y + (actor.person ? Math.sin(this.elapsed * 8) * 0.025 : 0.015), point.z + profile.nz * offset);
      actor.root.rotation.y = point.angle;
    }
  }
}

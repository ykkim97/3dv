import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { daylightAt, advanceHour } from './dayLighting.js';

export const lightingSystem = {
  setNight(night) {
    this.setTimeOfDay(night ? 0 : 12);
  },
  previewTimeOfDay(hour) {
    if (this.environment) this.environment.autoCycle = false;
    this.setTimeOfDay(hour);
  },
  tickDaylight(seconds) {
    if (this.environment?.autoCycle) this.hour = advanceHour(this.hour ?? 12, seconds, this.environment.cycleMinutes);
    this.lightingElapsed = (this.lightingElapsed || 0) + seconds;
    if (this.lightingElapsed < 0.25) return;
    this.lightingElapsed = 0;
    if (this.environment?.autoCycle) this.setTimeOfDay(this.hour);
    else this.updateLocalLights();
  },
  updateLocalLights() {
    if (!this.city || !this.camera) return;
    // Every lamp emits visually, but only two nearby lamps illuminate surfaces.
    // Keep the total at four lights (sky, sun, two local), without local shadows.
    this.localLights ||= Array.from({ length: 2 }, (_, i) => {
      const light = new PointLight(`nearby-street-light-${i}`, Vector3.Zero(), this.scene);
      light.diffuse = new Color3(1, 0.79, 0.43); light.range = 12; light.intensity = 0;
      return light;
    });
    const lamps = [];
    if (this.night) for (const node of this.propLightNodes || []) {
      const candidate = { node, distance: Vector3.DistanceSquared(node.position, this.camera.position) };
      if (!lamps[0] || candidate.distance < lamps[0].distance) { lamps[1] = lamps[0]; lamps[0] = candidate; }
      else if (!lamps[1] || candidate.distance < lamps[1].distance) lamps[1] = candidate;
    }
    for (let i = 0; i < this.localLights.length; i++) {
      const light = this.localLights[i], node = lamps[i]?.node;
      light.intensity = node ? 2.5 : 0;
      if (node) light.position.copyFrom(node.position.add(new Vector3(0, 3.5, 0)));
    }
  },
  setTimeOfDay(hour) {
    const previousHour = this.shadowHour;
    if (previousHour === undefined || Math.abs(hour - previousHour) >= 0.025) {
      this.shadowHour = hour;
      this.invalidateShadows();
    }
    this.hour = hour;
    const { elevation, daylight, lamps, night } = daylightAt(hour);
    if (this.night !== night) this.life?.setNight(night);
    this.night = night;
    for (const root of this.waterNodes || []) for (const mesh of root.getChildMeshes()) mesh.material.setFloat('daylight', daylight);
    this.ambient.intensity = 0.32 + daylight * 0.53; this.sun.intensity = 0.15 + daylight * 1.35;
    const angle = (hour - 6) / 24 * Math.PI * 2;
    this.sun.direction.set(-Math.cos(angle) * 0.7, -Math.max(0.16, Math.abs(elevation)), 0.45);
    this.sun.position.copyFrom(this.sun.direction.scale(-150));
    const dusk = daylight * (1 - daylight) * 4;
    this.sun.diffuse = new Color3(1, 1 - dusk * 0.3, 1 - dusk * 0.5);
    this.scene.clearColor = new Color4(0.09 + daylight * 0.57 + dusk * 0.06, 0.16 + daylight * 0.61 - dusk * 0.06, 0.23 + daylight * 0.55 - dusk * 0.1, 1);
    this.scene.fogColor = new Color3(this.scene.clearColor.r, this.scene.clearColor.g, this.scene.clearColor.b);
    for (const key of ['glass', 'neighborhood-glass', 'utility-glass']) {
      const mat = this.materials.get(key); if (mat) mat.emissiveColor = new Color3(0.8, 0.64, 0.3).scale(lamps);
    }
    for (const key of ['city-lamp', 'city-sign', 'city-light-pool', 'bridge-light']) {
      const mat = this.materials.get(key); if (mat) mat.emissiveColor = new Color3(1, 0.78, 0.38).scale(lamps * (key === 'city-light-pool' ? 0.3 : 0.9));
    }
    this.updateLocalLights();
  }
};

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { assetById, ROAD_TYPES } from '../../presets/catalog.js';
import { objectBaseHeight } from '../../plots/plotModel.js';
import { roadProfile } from '../../roads/roadGeometry.js';
import { buildStreetProp } from './streetProps.js';
import { closestRoadPoint } from '../../roads/roadModel.js';
import { buildEnergyDemoAsset } from './energyDemoAssets.js';

export const assetBuilders = {
  tree(x, z, pine, parent) {
    const trunk = MeshBuilder.CreateCylinder('trunk', { height: 2.3, diameter: 0.45, tessellation: 5 }, this.scene);
    trunk.position.set(x, 1.15, z); trunk.parent = parent; trunk.material = this.material('bark', '#82735a');
    const crown = pine ? MeshBuilder.CreateCylinder('pine', { height: 5, diameterTop: 0, diameterBottom: 3.7, tessellation: 7 }, this.scene)
      : MeshBuilder.CreateSphere('leaves', { diameter: 3.8, segments: 3 }, this.scene);
    crown.position.set(x, pine ? 4 : 3.3, z); crown.scaling.y = pine ? 1 : 1.2;
    crown.parent = parent; crown.material = this.material(pine ? 'pine' : 'leaf', pine ? '#4d7960' : '#6e965e');
    this.shadows.addShadowCaster(crown);
  },
  buildUtility(asset, root) {
    if (asset.id === 'nuclear-plant') { buildEnergyDemoAsset(this, asset, root); return; }
    const { width: w, depth: d } = asset;
    const concrete = this.material('utility-concrete', '#8c9993');
    const steel = this.material('utility-steel', '#b7c8c4');
    const dark = this.material('utility-dark', '#435a61');
    const blue = this.material('utility-water', '#4d9ca6');
    const copper = this.material('utility-copper', '#d8aa68');
    const glass = this.material('utility-glass', '#77b8bd');
    const warning = this.material('utility-warning', '#d98658');
    this.box('utility-pad', w + 0.3, 0.18, d + 0.3, 0, 0.08, 0, concrete, root);
    const cylinder = (name, diameter, height, x, y, z, material) => {
      const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 16 }, this.scene);
      mesh.position.set(x, y, z);
      mesh.material = material;
      mesh.parent = root;
      return mesh;
    };
    if (asset.id === 'power-plant') {
      this.box('turbine-hall', 6, 4.6, 6, -2, 2.4, 0, this.material('power-hall', asset.color), root);
      this.box('turbine-roof', 6.4, 0.3, 6.3, -2, 4.85, 0, dark, root);
      for (const x of [-4.3, -2.8, -1.3]) {
        this.box('turbine-window', 0.9, 1.15, 0.08, x, 3.1, -3.04, glass, root);
        this.box('turbine-vent', 0.95, 0.18, 0.1, x, 1.4, -3.05, dark, root);
      }
      for (const x of [2.3, 4]) {
        cylinder('exhaust-stack', 1.25, 6.2, x, 3.2, 1, steel);
        cylinder('stack-rim', 1.35, 0.2, x, 6.35, 1, copper);
        for (const y of [4.65, 5.4]) cylinder('stack-safety-band', 1.29, 0.18, x, y, 1, warning);
      }
      this.box('generator', 3.5, 2.4, 2.2, 2.5, 1.3, -2.6, dark, root);
      this.box('steam-header', 4.4, 0.26, 0.26, 0.2, 5.15, 0, steel, root);
      this.box('steam-drop', 0.26, 2.5, 0.26, 2.3, 3.85, 0, steel, root);
      this.box('generator-safety-stripe', 3.55, 0.18, 0.08, 2.5, 1.25, -3.74, warning, root);
    } else if (asset.id === 'solar-farm') {
      for (const x of [-3, 0, 3]) for (const z of [-2, 1.8]) {
        this.box('solar-stand', 0.15, 1.2, 0.15, x, 0.7, z, steel, root);
        const panel = this.box('solar-panel', 2.65, 0.12, 2.5, x, 1.42, z, dark, root);
        panel.rotation.x = -0.28;
        this.box('solar-cell', 2.35, 0.035, 2.15, x, 1.48, z, this.material('solar-glass', '#477e9b'), root).rotation.x = -0.28;
        for (const offset of [-0.58, 0, 0.58]) this.box('solar-cell-seam', 0.035, 0.04, 2.1, x + offset, 1.51, z, steel, root).rotation.x = -0.28;
      }
      this.box('solar-inverter', 1.1, 1.1, 0.9, 0, 0.68, 3.15, steel, root);
      this.box('solar-inverter-face', 0.75, 0.42, 0.06, 0, 0.92, 2.66, dark, root);
    } else if (asset.id === 'wind-turbine') {
      cylinder('wind-mast', 0.8, 12.6, 0, 6.4, 0, this.material('wind-mast', asset.color));
      cylinder('wind-base', 1.4, 0.5, 0, 0.35, 0, concrete);
      this.box('wind-nacelle', 2.4, 0.85, 1.25, 0, 13.15, 0.25, steel, root);
      const hub = cylinder('wind-hub', 0.8, 0.45, 0, 13.15, -0.58, dark);
      hub.rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const angle = i * Math.PI * 2 / 3;
        const blade = this.box('wind-blade', 0.44, 4.3, 0.13, Math.sin(angle) * 2.05, 13.15 + Math.cos(angle) * 2.05, -0.85, this.material('wind-blade', '#ecf3eb'), root);
        blade.rotation.z = -angle;
      }
      this.box('wind-access-door', 0.48, 1.25, 0.1, 0, 0.8, -0.42, dark, root);
    } else if (asset.id === 'transmission-tower') {
      for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) this.box('tower-leg', 0.23, 13.6, 0.23, x, 6.9, z, steel, root);
      for (const y of [1.6, 4.5, 7.4, 10.3, 13.4]) {
        this.box('tower-front-brace', 3.25, 0.18, 0.18, 0, y, -1.5, dark, root);
        this.box('tower-back-brace', 3.25, 0.18, 0.18, 0, y, 1.5, dark, root);
        this.box('tower-side-brace', 0.18, 0.18, 3.25, -1.5, y, 0, dark, root);
        this.box('tower-side-brace', 0.18, 0.18, 3.25, 1.5, y, 0, dark, root);
      }
      for (const y of [10.8, 13.1]) {
        this.box('tower-crossarm', 6.5, 0.24, 0.24, 0, y, -0.15, steel, root);
        for (const x of [-2.8, -1.8, 1.8, 2.8]) cylinder('tower-insulator', 0.22, 0.8, x, y - 0.5, -0.15, copper);
      }
      cylinder('tower-beacon', 0.35, 0.35, 0, 14.05, 0, warning);
    } else if (asset.id === 'ess') {
      for (const x of [-2.3, 0, 2.3]) {
        this.box('battery-cabinet', 1.85, 2.65, 4.3, x, 1.47, 0, this.material('battery-cabinet', asset.color), root);
        this.box('battery-door', 1.65, 2.15, 0.08, x, 1.45, -2.2, dark, root);
        for (const y of [0.8, 1.3, 1.8]) this.box('battery-vent', 1.15, 0.06, 0.1, x, y, -2.27, steel, root);
        this.box('battery-indicator', 0.18, 0.18, 0.12, x + 0.56, 2.35, -2.3, glass, root);
        this.box('battery-warning', 0.48, 0.16, 0.12, x - 0.3, 2.35, -2.3, warning, root);
        this.box('battery-cooling-unit', 1.2, 0.28, 1.6, x, 2.98, 1.1, dark, root);
      }
      this.box('ess-cable-trench', 6.7, 0.12, 0.26, 0, 0.3, 2.5, copper, root);
    } else if (asset.id === 'substation') {
      for (const x of [-3.4, 3.4]) for (const z of [-2.4, 2.4]) this.box('gantry-post', 0.23, 5.7, 0.23, x, 2.95, z, steel, root);
      for (const z of [-2.4, 2.4]) this.box('gantry-beam', 7.1, 0.24, 0.24, 0, 5.7, z, steel, root);
      for (const x of [-3.4, 3.4]) this.box('gantry-side-beam', 0.22, 0.22, 5, x, 5.7, 0, steel, root);
      for (const x of [-2, 0, 2]) {
        for (const z of [-2.4, 2.4]) cylinder('line-insulator', 0.26, 0.6, x, 6.1, z, copper);
        this.box('busbar', 0.12, 0.12, 4.8, x, 6.48, 0, dark, root);
      }
      for (const x of [-2, 2]) {
        this.box('transformer', 2.5, 1.9, 2.4, x, 1.1, 0, dark, root);
        for (const z of [-0.7, 0, 0.7]) cylinder('insulator', 0.28, 1.1, x, 2.6, z, copper);
        for (const z of [-0.8, -0.3, 0.2, 0.7]) this.box('transformer-fin', 0.22, 1.35, 0.12, x + 1.35, 1.18, z, steel, root);
      }
    } else if (asset.id === 'distribution') {
      this.box('switchgear-house', 4.2, 2.8, 3.3, -0.6, 1.5, 0, this.material('distribution-house', asset.color), root);
      this.box('switchgear-roof', 4.6, 0.25, 3.7, -0.6, 3.02, 0, dark, root);
      for (const x of [-1.8, -0.6, 0.6]) this.box('switchgear-door', 0.8, 1.8, 0.08, x, 1.35, -1.69, steel, root);
      for (const x of [-1.8, -0.6, 0.6]) this.box('switchgear-vent', 0.55, 0.16, 0.1, x, 2.55, -1.73, dark, root);
      cylinder('distribution-pole', 0.22, 4.2, 2.15, 2.2, 1, steel);
      this.box('distribution-crossarm', 2.2, 0.16, 0.2, 2.15, 4.1, 1, dark, root);
      for (const x of [1.4, 2.15, 2.9]) cylinder('distribution-insulator', 0.2, 0.38, x, 4.38, 1, copper);
      this.box('distribution-conduit', 1.15, 0.14, 0.14, 1.45, 1.1, 1, dark, root);
    } else if (asset.id === 'water-treatment') {
      this.box('filter-building', 4, 3.8, 7.2, -3.4, 2, 0, this.material('filter-building', asset.color), root);
      this.box('filter-roof', 4.3, 0.25, 7.5, -3.4, 4.05, 0, dark, root);
      for (const z of [-2.3, 0, 2.3]) this.box('filter-window', 0.1, 1.05, 1.1, -5.45, 2.4, z, glass, root);
      for (const z of [-2, 2]) {
        this.box('filter-basin', 5.8, 0.9, 3.2, 2.45, 0.55, z, concrete, root);
        this.box('clean-water', 5.3, 0.05, 2.7, 2.45, 1.04, z, blue, root);
        for (const x of [-0.3, 5.2]) this.box('basin-edge', 0.16, 0.24, 3.25, x, 1.13, z, steel, root);
        for (const offset of [-1.5, 1.5]) this.box('basin-edge', 5.8, 0.24, 0.16, 2.45, 1.13, z + offset, steel, root);
      }
      this.box('filter-walkway', 5.8, 0.16, 0.65, 2.45, 1.3, 0, steel, root);
      for (const z of [-0.32, 0.32]) this.box('filter-rail', 5.8, 0.08, 0.08, 2.45, 2.1, z, dark, root);
    } else if (asset.id === 'intake-station') {
      this.box('intake-house', 4.3, 3.7, 4.8, -2.35, 2, 0.55, this.material('intake-house', asset.color), root);
      this.box('intake-roof', 4.55, 0.24, 5.05, -2.35, 3.98, 0.55, dark, root);
      this.box('intake-door', 1, 2.1, 0.09, -2.25, 1.25, -1.9, steel, root);
      this.box('intake-channel', 4.4, 0.7, 6, 2.45, 0.45, 0, concrete, root);
      this.box('intake-water', 3.95, 0.06, 5.55, 2.45, 0.85, 0, blue, root);
      for (const z of [-2.25, -1.5, -0.75, 0, 0.75, 1.5, 2.25]) this.box('intake-screen', 0.12, 1.25, 0.12, 0.3, 1.35, z, steel, root);
      for (const z of [-1.45, 1.45]) this.box('intake-pipe', 3.7, 0.35, 0.35, 0.2, 1.3, z, dark, root);
      this.box('intake-walkway', 4.4, 0.16, 0.7, 2.45, 1.12, 0, steel, root);
    } else if (asset.id === 'water-tower') {
      for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) this.box('water-tower-leg', 0.25, 8.2, 0.25, x, 4.2, z, steel, root);
      for (const y of [2.1, 5.3, 8.1]) {
        this.box('water-tower-brace', 3.25, 0.16, 0.16, 0, y, -1.5, dark, root);
        this.box('water-tower-brace', 3.25, 0.16, 0.16, 0, y, 1.5, dark, root);
      }
      cylinder('elevated-tank', 4.7, 2.85, 0, 9.65, 0, this.material('elevated-tank', asset.color));
      cylinder('elevated-tank-cap', 4.85, 0.2, 0, 11.2, 0, dark);
      for (const y of [8.4, 10.6]) cylinder('elevated-tank-band', 4.75, 0.12, 0, y, 0, steel);
      this.box('tower-supply-pipe', 0.28, 8.3, 0.28, 0, 4.3, -2.15, blue, root);
      this.box('tower-ladder', 0.1, 7.7, 0.1, 1.55, 4.1, -1.6, dark, root);
    } else if (asset.id === 'reservoir') {
      for (const x of [-2.35, 2.35]) {
        cylinder('water-tank', 4.1, 4.2, x, 2.25, 0, this.material('water-tank', asset.color));
        cylinder('tank-cap', 4.25, 0.2, x, 4.45, 0, dark);
        for (const y of [0.75, 2.65, 3.9]) cylinder('tank-band', 4.16, 0.12, x, y, 0, steel);
        this.box('tank-ladder', 0.12, 3.7, 0.1, x, 2.25, -2.09, dark, root);
        for (const y of [1, 1.7, 2.4, 3.1, 3.8]) this.box('ladder-rung', 0.65, 0.09, 0.1, x, y, -2.13, dark, root);
        this.box('tank-pipe', 0.26, 0.26, 2.4, x, 0.5, -3.1, steel, root);
      }
    } else if (asset.id === 'pump-station') {
      this.box('pump-house', 5.3, 3.1, 4.1, -0.5, 1.65, 0, this.material('pump-house', asset.color), root);
      this.box('pump-roof', 5.6, 0.25, 4.4, -0.5, 3.3, 0, dark, root);
      this.box('pump-door', 1.1, 2.05, 0.1, 2.2, 1.3, -0.3, dark, root);
      this.box('pump-window', 0.9, 0.75, 0.1, -1.8, 2.25, -2.1, glass, root);
      for (const x of [-1.8, 0, 1.8]) {
        this.box('pump-pipe', 0.38, 0.38, 1.8, x, 0.65, -2.05, blue, root);
        this.box('pump-valve', 0.7, 0.55, 0.4, x, 0.9, -2.75, steel, root);
        const wheel = cylinder('pump-valve-wheel', 0.65, 0.09, x, 1.23, -2.75, copper);
        wheel.rotation.x = Math.PI / 2;
      }
      this.box('main-water-pipe', 5.4, 0.3, 0.3, -0.4, 0.45, -3, blue, root);
    } else if (asset.id === 'wastewater') {
      this.box('process-house', 3.5, 3.1, 7.4, -3.8, 1.65, 0, this.material('process-house', asset.color), root);
      this.box('process-roof', 3.7, 0.2, 7.6, -3.8, 3.28, 0, dark, root);
      for (const z of [-2.6, 0, 2.6]) this.box('process-window', 0.1, 0.8, 1.1, -5.6, 2.2, z, glass, root);
      for (const z of [-2.25, 2.25]) {
        cylinder('settling-tank', 3.7, 1.25, 2.2, 0.75, z, concrete);
        cylinder('settling-water', 3.35, 0.05, 2.2, 1.4, z, blue);
        cylinder('clarifier-hub', 0.55, 0.3, 2.2, 1.58, z, dark);
        this.box('clarifier-arm', 3.5, 0.09, 0.12, 2.2, 1.47, z, steel, root);
        this.box('clarifier-walkway', 3.8, 0.16, 0.52, 2.2, 1.62, z, steel, root);
      }
      this.box('process-pipe', 3.1, 0.22, 0.22, -0.25, 0.7, 0, blue, root);
    }
  },
  buildNeighborhoodAsset(asset, root) {
    const pavement = this.material('neighborhood-pavement', '#b8b8a6');
    const steel = this.material('neighborhood-steel', '#afc2bd');
    const glass = this.material('neighborhood-glass', '#5b8990');
    const dark = this.material('neighborhood-dark', '#52635f');
    const accent = this.material('neighborhood-accent', '#bb705c');
    this.box('facility-pad', asset.width + 0.3, 0.18, asset.depth + 0.3, 0, 0.08, 0, pavement, root);
    if (asset.id === 'townhouses') {
      for (const [index, x] of [-2.9, 0, 2.9].entries()) {
        const wall = this.material(`townhouse-wall-${index}`, ['#e2d6c5', '#d0d6cc', '#d9c7b7'][index]);
        this.box('townhouse-unit', 2.7, 4.5, 4.7, x, 2.34, 0.4, wall, root);
        this.box('townhouse-roof', 2.85, 0.26, 4.95, x, 4.7, 0.4, index === 1 ? dark : accent, root);
        this.box('townhouse-door', 0.73, 1.75, 0.09, x + 0.62, 1, -1.99, dark, root);
        for (const y of [1.55, 3.32]) this.box('townhouse-window', 0.82, 0.84, 0.1, x - 0.53, y, -2, glass, root);
        this.box('townhouse-step', 0.95, 0.14, 0.5, x + 0.62, 0.18, -2.48, pavement, root);
      }
    } else if (asset.id === 'cafe') {
      this.box('cafe-room', 4.5, 3.3, 4.3, -1, 1.75, 0.55, this.material('cafe-wall', asset.color), root);
      this.box('cafe-roof', 4.85, 0.23, 4.6, -1, 3.53, 0.55, dark, root);
      this.box('cafe-shopfront', 2.25, 2.4, 0.1, -1.7, 1.55, -1.65, glass, root);
      this.box('cafe-door', 0.95, 2.15, 0.1, 0.45, 1.22, -1.65, dark, root);
      this.box('cafe-awning', 4.8, 0.16, 1.05, -1, 3.12, -2.02, accent, root);
      for (const x of [-2.6, -1.4, -0.2]) this.box('awning-stripe', 0.36, 0.17, 1.06, x, 3.13, -2.02, pavement, root);
      for (const z of [-1.2, 1.2]) {
        this.box('cafe-table-top', 1.05, 0.12, 1.05, 2.25, 0.8, z, dark, root);
        this.box('cafe-table-leg', 0.14, 0.72, 0.14, 2.25, 0.42, z, steel, root);
        for (const x of [1.35, 3.12]) this.box('cafe-chair', 0.48, 0.42, 0.48, x, 0.32, z, accent, root);
      }
    } else if (asset.id === 'fire-station') {
      const red = this.material('fire-station-red', '#c95448');
      this.box('fire-garage', 8.2, 4.35, 6.2, -1.25, 2.26, 0.45, this.material('fire-station-wall', asset.color), root);
      this.box('fire-roof', 8.45, 0.26, 6.45, -1.25, 4.57, 0.45, dark, root);
      this.box('fire-fascia', 8.3, 0.72, 0.11, -1.25, 3.9, -2.71, red, root);
      for (const x of [-3.6, -0.55]) {
        this.box('fire-bay-door', 2.45, 2.82, 0.1, x, 1.56, -2.72, this.material('fire-bay', '#82989a'), root);
        for (const y of [0.7, 1.35, 2, 2.65]) this.box('fire-door-seam', 2.4, 0.055, 0.12, x, y, -2.79, dark, root);
      }
      this.box('fire-watchtower', 1.75, 6.2, 2.5, 4.2, 3.2, 1.8, red, root);
      this.box('fire-watch-window', 1.55, 0.85, 0.1, 4.2, 5.4, 0.5, glass, root);
      this.box('fire-beacon', 0.5, 0.32, 0.5, 4.2, 6.46, 1.8, accent, root);
    } else if (asset.id === 'playground') {
      const timber = this.material('playground-timber', '#b98e61');
      const play = this.material('playground-play', '#dfa35b');
      this.box('playground-surface', 9.4, 0.12, 7.4, 0, 0.19, 0, this.material('playground-rubber', '#86a795'), root);
      for (const x of [-3.5, -0.8]) for (const z of [-1.5, 1.5]) this.box('swing-post', 0.2, 2.5, 0.2, x, 1.52, z, timber, root);
      this.box('swing-crossbar', 3, 0.2, 0.2, -2.15, 2.8, 0, dark, root);
      for (const x of [-2.9, -1.45]) {
        for (const z of [-0.45, 0.45]) this.box('swing-rope', 0.05, 1.45, 0.05, x, 1.98, z, steel, root);
        this.box('swing-seat', 0.65, 0.12, 1.2, x, 1.2, 0, play, root);
      }
      this.box('slide-platform', 2.15, 0.22, 1.8, 2.05, 2.05, 1.15, timber, root);
      for (const x of [1.15, 2.95]) for (const z of [0.45, 1.85]) this.box('slide-leg', 0.16, 1.85, 0.16, x, 1.05, z, timber, root);
      const slide = this.box('slide-ramp', 1.2, 0.12, 3.35, 2.05, 1.15, -0.9, play, root);
      slide.rotation.x = -0.52;
      for (const x of [1.42, 2.68]) this.box('slide-rail', 0.12, 0.28, 3.35, x, 1.28, -0.9, accent, root).rotation.x = -0.52;
      this.box('sandbox', 2.4, 0.2, 1.4, 0, 0.34, 2.7, this.material('playground-sand', '#d8c596'), root);
    }
  },
  buildObject(object) {
    const asset = assetById[object.asset];
    const root = new TransformNode(object.id, this.scene);
    root.metadata = { objectId: object.id };
    this.nodes.push(root);
    const prop = asset.category === 'streetscape', preview = object.id === '__placement-preview';
    this.propTemplates ||= new Map();
    const template = this.propTemplates.get(asset.id);
    if (template) {
      for (const source of template) {
        const mesh = preview ? source.clone(`preview-${asset.id}`, root) : source.createInstance(`${asset.id}-${object.id}`);
        mesh.parent = root; mesh.isVisible = true; mesh.metadata = { objectId: object.id }; mesh.receiveShadows = true;
        if (!prop && !preview) this.shadows.addShadowCaster(mesh);
      }
    } else if (prop) buildStreetProp(this, asset, root);
    else if (object.asset === 'tree' || object.asset === 'pine') this.tree(0, 0, object.asset === 'pine', root);
    else if (object.asset === 'park') {
      this.box('lawn', 10, 0.15, 10, 0, 0.08, 0, this.material('lawn', '#7a9f65'), root);
      this.box('walk', 1.3, 0.18, 10, 0, 0.12, 0, this.material('walk', '#d0c6a8'), root);
      this.box('walk', 10, 0.18, 1.3, 0, 0.12, 0, this.material('walk', '#d0c6a8'), root);
      for (const x of [-3, 3]) for (const z of [-3, 3]) this.tree(x, z, false, root);
    } else if (asset.id === 'smart-factory') {
      buildEnergyDemoAsset(this, asset, root);
    } else if (asset.category === 'power' || asset.category === 'water') {
      this.buildUtility(asset, root);
    } else if (['townhouses', 'cafe', 'fire-station', 'playground'].includes(asset.id)) {
      this.buildNeighborhoodAsset(asset, root);
    } else {
      const { width: w, height: h, depth: d } = asset;
      this.box('foundation', w + 1, 0.25, d + 1, 0, 0.1, 0, this.material('pavement', '#c3c5b8'), root);
      this.box('building', w, h, d, 0, h / 2 + 0.2, 0, this.material(asset.id, asset.color), root);
      const glass = this.material('glass', '#5c7d87');
      for (let y = 1.6; y < h; y += 2.4) {
        this.box('windows', w * 0.8, 0.85, d + 0.03, 0, y, 0, glass, root);
        this.box('windows', w + 0.03, 0.85, d * 0.76, 0, y, 0, glass, root);
      }
      if (object.asset === 'house') {
        const roof = MeshBuilder.CreateCylinder('roof', { diameter: w * 1.5, height: d + 0.8, tessellation: 3 }, this.scene);
        roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
        roof.position.y = h + 0.6; roof.scaling.x = 0.55;
        roof.material = this.material('roof', asset.roof); roof.parent = root; this.shadows.addShadowCaster(roof);
      } else {
        this.box('roof', w + 0.3, 0.4, d + 0.3, 0, h + 0.4, 0, this.material('roof-slab', '#bdc6bd'), root);
        this.box('rooftop', w * 0.38, 0.8, d * 0.4, 0, h + 0.95, 0, this.material('equipment', '#93a29f'), root);
      }
      if (object.asset === 'hospital') {
        const red = this.material('medical', '#ba655f');
        this.box('cross', 2, 0.6, 0.12, 0, h - 1, -d / 2 - 0.03, red, root);
        this.box('cross', 0.6, 2, 0.13, 0, h - 1, -d / 2 - 0.03, red, root);
      }
    }
    if (!template) this.compact(root, { objectId: object.id }, !prop && !preview);
    if (!preview && !template) {
      this.propTemplates.set(asset.id, root.getChildMeshes().map(mesh => {
        const source = mesh.clone(`template-${asset.id}`, null);
        source.parent = null; source.isVisible = false; source.isPickable = false; source.metadata = null;
        source.freezeWorldMatrix();
        const instance = source.createInstance(`${asset.id}-${object.id}`);
        instance.parent = root; instance.isVisible = true; instance.metadata = { objectId: object.id }; instance.receiveShadows = true;
        this.shadows.removeShadowCaster(mesh); mesh.dispose();
        if (!prop) this.shadows.addShadowCaster(instance);
        return source;
      }));
    }
    root.position.set(object.x, this.placementBaseHeight(object), object.z);
    root.rotation.y = object.rotation;
    if (!preview) for (const mesh of root.getChildMeshes()) mesh.freezeWorldMatrix();
    return root;
  },
  placementBaseHeight(object) {
    let height = objectBaseHeight(this.city, object);
    const asset = assetById[object.asset];
    if (asset.id === 'crosswalk') {
      const road = this.city.roads.find(road => {
        const point = closestRoadPoint(road, object);
        const width = ROAD_TYPES.find(type => type.id === road.type).width;
        return Math.hypot(point.x - object.x, point.z - object.z) < width / 2;
      });
      if (road) height = Math.max(height, ...roadProfile(this.city, road, this.roadConnections || []).samples
        .filter(p => Math.hypot(p.x - object.x, p.z - object.z) < 5).map(p => p.height + 0.24));
    }
    return height;
  }
};

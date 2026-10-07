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
import { facadeWindow } from './facadeWindows.js';
import { buildPowerAsset } from './powerAssets.js';
import { buildWaterAsset } from './waterAssets.js';
import { buildExpansionAsset } from './expansionAssets.js';

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
    if (asset.category === 'power') buildPowerAsset(this, asset, root);
    else if (asset.category === 'water') buildWaterAsset(this, asset, root);
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
        for (const y of [1.55, 3.32]) facadeWindow(this, 'townhouse-window', 0.82, 0.84, x - 0.53, y, -1.95, 'front', glass, root);
        this.box('townhouse-step', 0.95, 0.14, 0.5, x + 0.62, 0.18, -2.48, pavement, root);
      }
    } else if (asset.id === 'cafe') {
      this.box('cafe-room', 4.5, 3.3, 4.3, -1, 1.75, 0.55, this.material('cafe-wall', asset.color), root);
      this.box('cafe-roof', 4.85, 0.23, 4.6, -1, 3.53, 0.55, dark, root);
      facadeWindow(this, 'cafe-shopfront', 2.25, 2.4, -1.7, 1.55, -1.6, 'front', glass, root);
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
      facadeWindow(this, 'fire-watch-window', 1.55, 0.85, 4.2, 5.4, 0.55, 'front', glass, root);
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
    } else if (asset.model === 'expansion') {
      buildExpansionAsset(this, asset, root);
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
        facadeWindow(this, 'windows', w * 0.8, 0.85, 0, y, -d / 2, 'front', glass, root);
        facadeWindow(this, 'windows', w * 0.8, 0.85, 0, y, d / 2, 'back', glass, root);
        facadeWindow(this, 'windows', d * 0.76, 0.85, -w / 2, y, 0, 'left', glass, root);
        facadeWindow(this, 'windows', d * 0.76, 0.85, w / 2, y, 0, 'right', glass, root);
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

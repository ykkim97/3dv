import { Color3 } from '@babylonjs/core/Maths/math.color.js';
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
import { terrainHeight } from '../../terrain/terrainModel.js';
import { createPlotTextures } from '../../plots/plotMaterials.js';
import { roadProfile, createRoadStrip, roadJunctions, createJunctionSurface } from '../../roads/roadGeometry.js';
import { buildBridgeDetails } from '../../roads/bridgeGeometry.js';

export const roadBuilder = {
  buildRoad(road, preview = false, problem = null) {
    const root = new TransformNode(road.id, this.scene);
    const network = preview ? this.previewNetwork || { ...this.city, roads: [...this.city.roads.filter(item => item.id !== this.roadEdit?.id), road] } : this.city;
    const connections = preview ? this.previewConnections || roadJunctions(network) : this.roadConnections || roadJunctions(network);
    const profile = roadProfile(network, road, connections), lift = preview ? 0.23 : 0.15;
    const addStrip = (name, width, offset, height, thickness, material, first, last) => {
      const mesh = createRoadStrip(this.scene, name, profile, width, offset, height, thickness, first, last);
      mesh.parent = root; mesh.material = material; mesh.receiveShadows = !preview;
      return mesh;
    };
    const asphalt = preview ? this.material(problem ? 'road-preview-invalid' : 'road-preview-valid', problem ? '#ae554b' : '#577d6b') : this.roadMaterial(road.type);
    const curb = this.material(preview ? problem ? 'road-preview-edge-invalid' : 'road-preview-edge-valid' : 'road-curb', preview ? problem ? '#ff8b80' : '#a5f4cb' : '#b8c6bd');
    const outside = (first, last) => !profile.samples.slice(first, last + 1).some(point => point.junction);
    const runs = [];
    let start = null;
    for (let i = 0; i < profile.samples.length - 1; i++) {
      if (outside(i, i + 1)) { if (start === null) start = i; }
      else if (start !== null) { runs.push([start, i]); start = null; }
    }
    if (start !== null) runs.push([start, profile.samples.length - 1]);
    for (const side of [-1, 1]) {
      for (const [first, last] of runs) {
        addStrip('road-curb', 0.32, side * (profile.width / 2 + 0.16), lift + 0.09, 0.18, curb, first, last);
        if (road.type !== 'path') addStrip('road-edge-line', 0.09, side * (profile.width / 2 - 0.23), lift + 0.067, 0.01, this.material('road-edge-paint', '#e6e9d9'), first, last);
      }
    }
    addStrip('road-asphalt', profile.width, 0, lift + 0.05, 0.12, asphalt);
    if (road.type !== 'path') {
      const offsets = road.type === 'avenue' ? [-profile.width / 4, profile.width / 4] : [0];
      for (const offset of offsets) for (let i = 0; i < profile.samples.length - 1; i += 4) {
        const last = Math.min(i + 2, profile.samples.length - 1);
        if (outside(i, last)) addStrip('road-lane', 0.11, offset, lift + 0.069, 0.01, this.material(road.type === 'street' ? 'road-center-paint' : 'road-edge-paint', road.type === 'street' ? '#edc974' : '#e6e9d9'), i, last);
      }
      if (road.type === 'avenue') for (const offset of [-0.13, 0.13]) for (const [first, last] of runs) addStrip('road-center-line', 0.08, offset, lift + 0.069, 0.01, this.material('road-center-paint', '#edc974'), first, last);
    }
    if (road.bridge) buildBridgeDetails(this, road, profile, root, preview, problem, lift);
    if (preview) {
      root.name = 'road-preview';
      for (const connection of connections.filter(item => item.roadIds.includes(road.id))) {
        const surface = createJunctionSurface(this.scene, connection);
        surface.parent = root; surface.material = asphalt; surface.position.y = 0.08;
      }
      for (const mesh of root.getChildMeshes()) { mesh.isPickable = false; mesh.material.backFaceCulling = false; }
    } else {
      root.metadata = { roadId: road.id }; this.nodes.push(root);
      this.compact(root, { roadId: road.id });
      for (const [endpoint, point] of Object.entries({ a: road.a, b: road.b })) {
        const handle = MeshBuilder.CreateSphere('road-endpoint', { diameter: 1.8, segments: 8 }, this.scene);
        handle.parent = root;
        handle.position.set(point.x, Math.max(0.25, terrainHeight(this.city.heights, point.x, point.z)) + 0.8, point.z);
        handle.material = this.material('road-handle', '#61ff83');
        handle.material.emissiveColor = Color3.FromHexString('#61ff83');
        handle.metadata = { roadId: road.id, endpoint };
        handle.setEnabled(this.selectedId === road.id);
      }
    }
    return root;
  },
  roadMaterial(type = 'street') {
    const path = type === 'path';
    const material = this.material(path ? 'road-path-surface' : 'road-asphalt-surface', path ? '#d0c4a6' : '#65736f');
    if (!material.diffuseTexture) {
      const textures = createPlotTextures(this.scene, path ? 'dirt' : 'asphalt');
      material.diffuseTexture = textures.diffuse; material.bumpTexture = textures.normal;
      material.bumpTexture.level = 0.22;
      material.specularColor = new Color3(0.025, 0.025, 0.025);
    }
    return material;
  },
  updateJunctions() {
    this.junctions?.forEach(mesh => mesh.dispose());
    this.junctions = [];
    for (const junction of this.roadConnections || roadJunctions(this.city)) {
      const surface = createJunctionSurface(this.scene, junction);
      const road = this.city.roads.find(item => junction.roadIds.includes(item.id) && item.type !== 'path') || this.city.roads.find(item => item.id === junction.roadIds[0]);
      surface.material = this.roadMaterial(road?.type);
      surface.metadata = { roadId: road?.id }; surface.receiveShadows = true;
      this.junctions.push(surface);
      for (let i = 0; i < junction.boundary.length; i++) {
        const a = junction.boundary[i], b = junction.boundary[(i + 1) % junction.boundary.length];
        if (a.mouth === b.mouth) continue; // Leave every road entrance open.
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const curb = MeshBuilder.CreateBox('junction-curb', { width: length, height: 0.14, depth: 0.25 }, this.scene);
        curb.position.set((a.x + b.x) / 2, junction.height + 0.2, (a.z + b.z) / 2);
        curb.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        curb.material = this.material('road-curb', '#b8c6bd'); curb.isPickable = false; curb.receiveShadows = true;
        this.junctions.push(curb);
      }
    }
  }
};

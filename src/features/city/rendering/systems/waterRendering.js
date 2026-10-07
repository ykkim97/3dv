import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { waterRegions, waterSettings } from '../../water/waterModel.js';
import { waterGeometry } from '../../water/waterModel.js';
import { createWaterMaterial } from '../../water/waterMaterial.js';

export const waterRendering = {
  updateWater() {
    for (const root of this.waterNodes || []) { for (const mesh of root.getChildMeshes()) mesh.material?.dispose(); root.dispose(); }
    this.waterNodes = [];
    this.waterRegions = waterRegions(this.city);
    for (const region of this.waterRegions) {
      const settings = waterSettings(this.city, region);
      if (this.city.waterSettings?.enabled === false || !settings.enabled) continue;
      const data = waterGeometry(this.city, region), root = new TransformNode(region.id, this.scene);
      root.metadata = { waterId: region.id };
      const mesh = new Mesh('water-surface', this.scene), vertices = new VertexData();
      vertices.positions = data.positions; vertices.indices = data.indices; vertices.applyToMesh(mesh);
      mesh.setVerticesData('waterDepth', data.depths, false, 1);
      mesh.parent = root; mesh.metadata = { waterId: region.id };
      mesh.material = createWaterMaterial(this.scene, region.id, { ...settings, flowing: this.city.waterSettings?.flowing === false ? false : settings.flowing }, this.camera, this.night, () => this.flowTime || 0);
      this.waterNodes.push(root);
    }
  }
};

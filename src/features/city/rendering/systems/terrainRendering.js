import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { mapDimensions } from '../../core/mapDimensions.js';
import { terrainHeight } from '../../terrain/terrainModel.js';
import { terrainVertexColor } from '../../terrain/terrainPaint.js';

export const terrainRendering = {
  updateGrid() {
    const { half } = mapDimensions(this.city);
    const lines = [];
    for (let axis = 0; axis < 2; axis++) for (let i = -half; i <= half; i += 4) {
      const line = [];
      for (let j = -half; j <= half; j += 2) {
        const x = axis ? j : i, z = axis ? i : j;
        line.push(new Vector3(x, Math.max(-0.08, terrainHeight(this.city.heights, x, z)) + 0.09, z));
      }
      lines.push(line);
    }
    if (this.grid && this.grid.getTotalVertices() !== lines.reduce((count, line) => count + line.length, 0)) { this.grid.dispose(); this.grid = null; }
    if (this.grid) MeshBuilder.CreateLineSystem('construction-grid', { lines, instance: this.grid });
    else { this.grid = MeshBuilder.CreateLineSystem('construction-grid', { lines, updatable: true }, this.scene); this.grid.color = Color3.FromHexString('#718e80'); this.grid.alpha = 0.44; this.grid.isPickable = false; }
    this.grid.setEnabled(this.gridVisible);
  },
  setGridVisible(visible) { this.gridVisible = visible; this.grid?.setEnabled(visible); },
  updateTerrain() {
    const positions = this.terrain.getVerticesData(VertexBuffer.PositionKind);
    for (let i = 0; i < this.city.heights.length; i++) positions[i * 3 + 1] = this.city.heights[i];
    const normals = [];
    VertexData.ComputeNormals(positions, this.terrain.getIndices(), normals);
    this.terrain.updateVerticesData(VertexBuffer.PositionKind, positions, true);
    this.terrain.updateVerticesData(VertexBuffer.NormalKind, normals);
    this.terrain.refreshBoundingInfo();
    this.terrain.updateCoordinateHeights();
    this.updateTerrainColors();
    this.updateTerrainSides(positions);
    for (const node of this.nodes) if (node.metadata?.objectId) {
      const object = this.city.objects.find(item => item.id === node.metadata.objectId);
      if (object) {
        node.position.y = this.placementBaseHeight(object);
        for (const mesh of node.getChildMeshes()) { mesh.unfreezeWorldMatrix(); mesh.freezeWorldMatrix(); }
      }
    }
  },
  updateTerrainColors() {
    const colors = [];
    for (let index = 0; index < this.city.heights.length; index++) {
      colors.push(...terrainVertexColor(this.city, index).map(value => value / 255), 1);
    }
    this.terrain.material.diffuseColor = Color3.White();
    this.terrain.material.backFaceCulling = false;
    this.terrain.hasVertexAlpha = false;
    if (this.terrain.isVerticesDataPresent(VertexBuffer.ColorKind)) this.terrain.updateVerticesData(VertexBuffer.ColorKind, colors);
    else this.terrain.setVerticesData(VertexBuffer.ColorKind, colors, true);
  },
  updateTerrainSides(surfacePositions) {
    // Close the heightfield at the map perimeter; its lower base stays below every editable height.
    const { resolution, size } = mapDimensions(this.city);
    const row = resolution + 1, perimeter = [];
    for (let col = 0; col < resolution; col++) perimeter.push(col);
    for (let r = 0; r < resolution; r++) perimeter.push(r * row + resolution);
    for (let col = resolution; col > 0; col--) perimeter.push(resolution * row + col);
    for (let r = resolution; r > 0; r--) perimeter.push(r * row);
    const positions = [], indices = [], normals = [];
    for (let i = 0; i < perimeter.length; i++) {
      const a = perimeter[i] * 3, b = perimeter[(i + 1) % perimeter.length] * 3, offset = positions.length / 3;
      positions.push(surfacePositions[a], surfacePositions[a + 1], surfacePositions[a + 2], surfacePositions[b], surfacePositions[b + 1], surfacePositions[b + 2], surfacePositions[b], -31, surfacePositions[b + 2], surfacePositions[a], -31, surfacePositions[a + 2]);
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
    VertexData.ComputeNormals(positions, indices, normals);
    if (!this.terrainSides) {
      this.terrainSides = new Mesh('terrain-sides', this.scene);
      const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals;
      data.applyToMesh(this.terrainSides, true);
      this.terrainSides.material = this.material('terrain-earth', '#8b7860');
      this.terrainSides.material.backFaceCulling = false;
      this.terrainSides.isPickable = false;
      this.terrainSides.receiveShadows = true;
      this.terrainBottom = MeshBuilder.CreateGround('terrain-bottom', { width: size, height: size }, this.scene);
      this.terrainBottom.position.y = -31;
      this.terrainBottom.material = this.terrainSides.material;
      this.terrainBottom.isPickable = false;
    } else {
      this.terrainSides.updateVerticesData(VertexBuffer.PositionKind, positions, true);
      this.terrainSides.updateVerticesData(VertexBuffer.NormalKind, normals);
      this.terrainSides.refreshBoundingInfo();
    }
  }
};

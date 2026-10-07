import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { PLOT_ELEVATION, plotSurface, plotTopHeight } from '../../plots/plotModel.js';
import { PLOT_TEXTURE_METERS } from '../../plots/plotMaterials.js';
import { createCurbStone } from '../../plots/plotGeometry.js';

export const plotBuilder = {
  buildPlot(plot) {
    const root = new TransformNode(plot.id, this.scene);
    root.metadata = { plotId: plot.id }; this.nodes.push(root);
    const y = plotTopHeight(this.city, plot);
    const finish = plotSurface(plot.surface);
    const natural = finish.id === 'grass' || finish.id === 'soil';
    const base = this.box('plot-base', plot.width, PLOT_ELEVATION - 0.015, plot.depth, plot.x, y - PLOT_ELEVATION / 2 - 0.0075, plot.z, this.material(natural ? 'plot-earth-base' : 'plot-stone-base', natural ? '#514431' : '#575c58'), root);
    // The textured ground is the only top face. A second nearly coplanar
    // box cap competes for depth at distant or grazing camera angles.
    const normals = base.getVerticesData(VertexBuffer.NormalKind), indices = base.getIndices(), sides = [];
    for (let i = 0; i < indices.length; i += 3) {
      if ([indices[i], indices[i + 1], indices[i + 2]].every(vertex => normals[vertex * 3 + 1] > 0.9)) continue;
      sides.push(indices[i], indices[i + 1], indices[i + 2]);
    }
    base.setIndices(sides);
    base.metadata = { plotId: plot.id };
    const surface = MeshBuilder.CreateGround('plot', { width: plot.width, height: plot.depth }, this.scene);
    surface.position.set(plot.x, y, plot.z); surface.parent = root;
    surface.material = this.plotMaterial(finish);
    const uvs = surface.getVerticesData(VertexBuffer.UVKind);
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i] *= plot.width / PLOT_TEXTURE_METERS;
      uvs[i + 1] *= plot.depth / PLOT_TEXTURE_METERS;
    }
    surface.setVerticesData(VertexBuffer.UVKind, uvs);
    surface.receiveShadows = true;
    surface.metadata = { plotId: plot.id };
    const w = plot.width / 2, d = plot.depth / 2;
    const curb = this.material('plot-curb', '#93988c');
    const stones = [], rimWidth = 0.26, rimHeight = 0.18;
    const addSide = (length, alongX, offset) => {
      const count = Math.ceil(length / 2), step = length / count;
      for (let i = 0; i < count; i++) {
        const position = -length / 2 + (i + 0.5) * step;
        const stone = createCurbStone(this.scene, alongX ? step - 0.025 : rimWidth, alongX ? rimWidth : step - 0.025, rimHeight);
        stone.position.set(plot.x + (alongX ? position : offset), y - 0.015, plot.z + (alongX ? offset : position));
        stone.material = curb;
        stones.push(stone);
      }
    };
    for (const z of [-d + rimWidth / 2, d - rimWidth / 2]) addSide(plot.width, true, z);
    for (const x of [-w + rimWidth / 2, w - rimWidth / 2]) addSide(plot.depth - rimWidth * 2, false, x);
    const rim = Mesh.MergeMeshes(stones, true, true);
    rim.name = 'plot-rim'; rim.parent = root; rim.receiveShadows = true;
    rim.metadata = { plotId: plot.id };
    this.shadows.addShadowCaster(rim);
    const points = [[-w,-d],[w,-d],[w,d],[-w,d],[-w,-d]].map(([x,z]) => new Vector3(plot.x + x, y + 0.035, plot.z + z));
    const edge = MeshBuilder.CreateLines('plot-boundary', { points }, this.scene);
    edge.color = Color3.FromHexString('#d6e6ad'); edge.alpha = 0.8; edge.parent = root; edge.isPickable = false;
    edge.setEnabled(false);
    // Handles are editor affordances; show them only on the selected site.
    for (const [corner, [x,z]] of [[-w,-d],[w,-d],[w,d],[-w,d]].entries()) {
      const marker = this.box('plot-corner', 0.4, 0.14, 0.4, plot.x + x, y + 0.13, plot.z + z, this.material('plot-marker', '#e7efc1'), root);
      marker.metadata = { plotId: plot.id, corner }; this.shadows.removeShadowCaster(marker);
      marker.setEnabled(false);
    }
  }
};

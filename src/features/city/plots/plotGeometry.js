import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';

// Three rings create a small chamfer that catches light above the vertical face.
export function createCurbStone(scene, width, depth, height) {
  const positions = [], indices = [], normals = [];
  const bevel = 0.035;
  const rings = [[width / 2, depth / 2, -height / 2], [width / 2, depth / 2, height / 2 - bevel], [width / 2 - bevel, depth / 2 - bevel, height / 2]];
  const corners = rings.map(([w, d, y]) => [[-w, y, -d], [w, y, -d], [w, y, d], [-w, y, d]]);
  const quad = (a, b, c, d) => {
    const offset = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(offset, offset + 2, offset + 1, offset, offset + 3, offset + 2);
  };
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    quad(corners[ring][i], corners[ring + 1][i], corners[ring + 1][next], corners[ring][next]);
  }
  quad(corners[2][0], corners[2][3], corners[2][2], corners[2][1]);
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions; data.indices = indices; data.normals = normals;
  const mesh = new Mesh('plot-curbstone', scene);
  data.applyToMesh(mesh);
  return mesh;
}

import fs from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { CityEngine } from '../src/features/city/rendering/CityEngine.js';
import { CityLife } from '../src/features/city/simulation/CityLife.js';

const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
editor.scene = new Scene(graphics);
editor.city = JSON.parse(fs.readFileSync('artifacts/smart-grid-demo/Electric_Smart_Grid.city.json', 'utf8'));
editor.nodes = []; editor.materials = new Map();
editor.shadows = { addShadowCaster() {}, removeShadowCaster() {} };
try {
  for (const object of editor.city.objects) editor.buildObject(object);
  editor.updateConnections();
  const life = new CityLife(editor); life.update(editor.city);
  const visible = editor.scene.meshes.filter(mesh => mesh.isVisible && mesh.isEnabled());
  const batches = new Set(visible.map(mesh => mesh.sourceMesh || mesh));
  const report = {
    scope: 'Facilities, connections, traffic and streetlights; excludes terrain, roads, water and overlays. NullEngine structural counts, not GPU FPS.',
    visibleMeshes: visible.length,
    geometryBatches: batches.size,
    geometries: editor.scene.geometries.length,
    materials: editor.scene.materials.length,
    connectionMeshes: new Set([...editor.flowNodes.values()].map(node => node.mesh)).size,
    connectionMaterials: new Set([...editor.flowNodes.values()].map(node => node.material)).size,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
} finally { editor.scene.dispose(); graphics.dispose(); }

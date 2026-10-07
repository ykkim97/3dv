import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { CityEngine } from '../src/features/city/rendering/CityEngine.js';
import { validateCity } from '../src/features/city/core/cityValidation.js';

const city = validateCity(JSON.parse(await readFile(new URL('../artifacts/smart-grid-demo/Electric_Smart_Grid.city.json', import.meta.url), 'utf8')));
const graphics = new NullEngine(), editor = Object.create(CityEngine.prototype);
editor.scene = new Scene(graphics); editor.city = city;
const reports = [];
try {
  for (const count of [city.connections.length, 2000]) {
    editor.city = { ...city, connections: Array.from({ length: count }, (_, i) => ({ ...city.connections[i % city.connections.length], id: `benchmark-${i}` })) };
    const started = performance.now(); editor.updateConnections(true); const buildMS = performance.now() - started;
    const geometry = new Map([...editor.flowNodes].map(([id, node]) => [id, node.geometry]));
    editor.city = { ...editor.city, connections: editor.city.connections.map(line => ({ ...line, effect: 'pulse' })) };
    const edit = performance.now(); editor.updateConnections(); const styleEditMS = performance.now() - edit;
    const reusedGeometry = [...editor.flowNodes].filter(([id, node]) => node.geometry === geometry.get(id)).length;
    reports.push({ connections: count, visibleConnections: editor.flowNodes.size, batches: editor.flowBatches.size, materials: editor.scene.materials.length, buildMS, styleEditMS, reusedGeometry });
  }
} finally { editor.scene.dispose(); graphics.dispose(); }
const result = { measuredAt: new Date().toISOString(), type: 'CPU and resource counts in Babylon NullEngine; not GPU FPS', reports };
await mkdir(new URL('../artifacts/performance/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/performance/connection-editing.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

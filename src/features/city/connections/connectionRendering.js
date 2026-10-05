import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { connectionPath, FLOW_EFFECTS } from './connectionModel.js';
import { objectBaseHeight } from '../plots/plotModel.js';

const vertexSource = `precision highp float;
attribute vec3 position; attribute vec3 normal; attribute vec2 uv;
attribute vec3 flowColor; attribute vec4 flowParams; attribute vec2 flowPhase;
uniform mat4 worldViewProjection;
varying vec2 vUV; varying float shade; varying vec3 tint; varying vec4 params; varying vec2 phase;
void main(){vUV=uv;shade=0.7+0.3*abs(normal.y);tint=flowColor;params=flowParams;phase=flowPhase;
gl_Position=worldViewProjection*vec4(position,1.0);}`;
const fragmentSource = `precision highp float;
varying vec2 vUV; varying float shade; varying vec3 tint; varying vec4 params; varying vec2 phase;
uniform float time;
void main(){float distance=(1.0-vUV.y)*params.x;
float travel=params.z==0.0?abs(distance-params.x*0.5):distance*params.z;
float position=(travel-(time*phase.x+phase.y)*params.y)/6.0;
float cycle=fract(position); float band=step(0.72,cycle);
if(params.w>0.5&&params.w<1.5){
  float edge=abs(fract(vUV.x*2.0)-0.5)*0.65;
  band=1.0-smoothstep(0.08,0.14,abs(cycle-0.5+edge));
}else if(params.w<2.5&&params.w>1.5){
  float d=min(cycle,1.0-cycle);band=exp(-d*d*70.0);
}else if(params.w<3.5&&params.w>2.5){
  float d=length(vec2((cycle-0.5)*3.0,(fract(vUV.x*4.0)-0.5)*2.0));
  band=1.0-smoothstep(0.25,0.4,d);
}else if(params.w>3.5){band=0.5+0.5*sin(position*6.2831853);band*=band;}
gl_FragColor=vec4(mix(tint*shade,vec3(0.9,1.0,0.95),band*0.85),1.0);}`;

// Bounded batches retain frustum culling and limit rebuild cost. Per-link
// attributes share one material and one time update per frame across all styles.
const BATCH_SIZE = 32;
export function connectionIdFromPick(hit) {
  const metadata = hit?.pickedMesh?.metadata;
  if (metadata?.connectionId) return metadata.connectionId;
  return metadata?.connectionRanges?.find(range => hit.faceId >= range.start && hit.faceId < range.end)?.id;
}

export const connectionRendering = {
  setConnectionPickHandler(handler) { this.onConnectionPick = handler; },
  updateConnections(terrainChanged = false) {
    this.flowNodes ||= new Map(); this.flowBatches ||= new Map(); this.flowTime ||= 0;
    const objects = new Map(this.city.objects.map(o => [o.id, o])), keep = new Set();
    for (const connection of this.city.connections || []) {
      if (!connection.visible) continue;
      const from = objects.get(connection.from), to = objects.get(connection.to);
      if (!from || !to) continue;
      const endpointGeometry = object => [object.asset, object.x, object.z, object.rotation, objectBaseHeight(this.city, object)];
      const signature = JSON.stringify([connection, endpointGeometry(from), endpointGeometry(to)]);
      const previous = this.flowNodes.get(connection.id);
      if (!terrainChanged && previous?.signature === signature) { keep.add(connection.id); continue; }
      const points = connectionPath(this.city, connection, objects).map(p => new Vector3(p.x, p.y, p.z));
      if (points.length < 2 || Vector3.Distance(points[0], points.at(-1)) < 0.01) continue;
      const tube = MeshBuilder.CreateTube('flow-geometry', { path: points, radius: connection.radius, tessellation: 8, cap: 3 }, this.scene);
      const geometry = VertexData.ExtractFromMesh(tube); tube.dispose();
      let length = 0;
      for (let i = 1; i < points.length; i++) length += Vector3.Distance(points[i - 1], points[i]);
      const elapsed = previous?.elapsed || 0, clock = this;
      const node = { geometry, signature, connection: { ...connection }, length, phase: elapsed, startTime: this.flowTime,
        get elapsed() { return this.phase + (this.connection.animated ? clock.flowTime - this.startTime : 0); } };
      this.flowNodes.set(connection.id, node); keep.add(connection.id);
    }
    for (const id of this.flowNodes.keys()) if (!keep.has(id)) this.flowNodes.delete(id);
    const nodes = [...this.flowNodes.values()], batchCount = Math.ceil(nodes.length / BATCH_SIZE);
    if (nodes.length && !this.flowMaterial) {
      this.flowMaterial = new ShaderMaterial('flow-material-shared', this.scene, { vertexSource, fragmentSource }, {
        attributes: ['position', 'normal', 'uv', 'flowColor', 'flowParams', 'flowPhase'], uniforms: ['worldViewProjection', 'time'],
      });
      this.flowMaterial.setFloat('time', this.flowTime);
    }
    for (let i = 0; i < batchCount; i++) {
      const members = nodes.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE), previous = this.flowBatches.get(i);
      if (previous && members.length === previous.members.length && members.every((node, j) => node === previous.members[j])) continue;
      previous?.mesh.dispose();
      const data = new VertexData(), colors = [], params = [], phases = [], ranges = [];
      data.positions = []; data.normals = []; data.uvs = []; data.indices = [];
      for (const node of members) {
        const { geometry, connection } = node, offset = data.positions.length / 3, start = data.indices.length / 3;
        for (const kind of ['positions', 'normals', 'uvs']) for (const value of geometry[kind]) data[kind].push(value);
        for (const index of geometry.indices) data.indices.push(index + offset);
        ranges.push({ id: connection.id, start, end: data.indices.length / 3 });
        const color = Color3.FromHexString(connection.color);
        const direction = connection.direction === 'both' ? 0 : connection.direction === 'reverse' ? -1 : 1;
        const effect = Math.max(0, FLOW_EFFECTS.findIndex(effect => effect.id === connection.effect));
        for (let v = 0; v < geometry.positions.length / 3; v++) {
          colors.push(color.r, color.g, color.b); params.push(node.length, connection.speed, direction, effect);
          phases.push(connection.animated ? 1 : 0, node.phase - (connection.animated ? node.startTime : 0));
        }
      }
      const mesh = new Mesh(`flow-batch-${i}`, this.scene); data.applyToMesh(mesh);
      mesh.setVerticesData('flowColor', colors, false, 3); mesh.setVerticesData('flowParams', params, false, 4); mesh.setVerticesData('flowPhase', phases, false, 2);
      mesh.material = this.flowMaterial; mesh.metadata = { connectionRanges: ranges }; mesh.freezeWorldMatrix();
      for (const node of members) { node.mesh = mesh; node.material = this.flowMaterial; }
      this.flowBatches.set(i, { mesh, members });
    }
    for (const [i, batch] of this.flowBatches) if (i >= batchCount) { batch.mesh.dispose(); this.flowBatches.delete(i); }
    if (!nodes.length) { this.flowMaterial?.dispose(); this.flowMaterial = null; }
  },
  tickConnections(delta) {
    this.flowTime = (this.flowTime || 0) + Math.max(0, Math.min(delta, 0.1));
    this.flowMaterial?.setFloat('time', this.flowTime);
  },
};

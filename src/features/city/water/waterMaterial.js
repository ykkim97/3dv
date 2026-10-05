import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';

const vertexSource = `precision highp float;
attribute vec3 position;
attribute float waterDepth;
uniform mat4 worldViewProjection;
varying vec3 vPosition;
varying float vDepth;
void main() { vPosition = position; vDepth = waterDepth; gl_Position = worldViewProjection * vec4(position, 1.0); }`;
const fragmentSource = `precision highp float;
varying vec3 vPosition;
varying float vDepth;
uniform vec3 cameraPosition;
uniform vec3 waterColor;
uniform float time;
uniform float opacity;
uniform float daylight;
void main() {
  vec2 p = vPosition.xz;
  float waveA = dot(p, vec2(0.85, 0.42)) * 1.8 + time * 0.75;
  float waveB = dot(p, vec2(-0.32, 0.95)) * 3.1 - time * 1.15;
  float waveC = dot(p, vec2(0.63, -0.77)) * 5.2 + time * 0.5;
  vec2 slope = vec2(0.85, 0.42) * cos(waveA) * 0.10 + vec2(-0.32, 0.95) * cos(waveB) * 0.06 + vec2(0.63, -0.77) * cos(waveC) * 0.025;
  vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 view = normalize(cameraPosition - vPosition);
  float fresnel = 0.05 + 0.7 * pow(1.0 - max(dot(normal, view), 0.0), 4.0);
  vec3 shallow = mix(waterColor, vec3(0.48, 0.78, 0.69), 0.32);
  vec3 deep = waterColor * 0.57;
  vec3 base = mix(shallow, deep, 1.0 - exp(-vDepth * 0.16));
  vec3 sky = mix(vec3(0.30, 0.48, 0.57), vec3(0.77, 0.88, 0.88), max(view.y, 0.0));
  float sparkle = pow(max(dot(reflect(-normalize(vec3(0.5, 1.0, -0.45)), normal), view), 0.0), 110.0);
  float shore = (1.0 - smoothstep(0.0, 0.65, vDepth)) * (0.1 + 0.06 * sin(waveA + waveB));
  vec3 color = mix(base, sky, fresnel) + vec3(1.0, 0.95, 0.78) * sparkle * 0.65 + shore * vec3(0.48, 0.7, 0.63);
  color *= mix(0.38, 1.0, daylight);
  gl_FragColor = vec4(color, opacity * mix(0.65, 1.0, smoothstep(0.0, 3.0, vDepth)));
}`;

export function createWaterMaterial(scene, name, settings, camera, night = false) {
  const material = new ShaderMaterial(name, scene, { vertexSource, fragmentSource }, {
    attributes: ['position', 'waterDepth'],
    uniforms: ['worldViewProjection', 'cameraPosition', 'waterColor', 'time', 'opacity', 'daylight'],
    needAlphaBlending: true,
  });
  material.backFaceCulling = false;
  material.setColor3('waterColor', Color3.FromHexString(settings.color));
  material.setFloat('opacity', settings.opacity);
  material.setFloat('daylight', night ? 0 : 1);
  material.onBindObservable.add(() => {
    material.setVector3('cameraPosition', camera.globalPosition);
    material.setFloat('time', settings.flowing ? performance.now() / 1000 : 0);
  });
  return material;
}

// src/runtime/scriptApi/preamble.js

import { isValidIdentifier } from './meshProxy.js';

const RESERVED = new Set([
  'break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally','for','function','if','import','in','instanceof','new','return','super','switch','this','throw','try','typeof','var','void','while','with','yield','await','let','enum','implements','interface','package','private','protected','public','static'
]);

export function buildGlobalsPreamble({ meshIdsByName } = {}) {
  let out = '';
  out += '\n// --- Lumatrix Script Globals ---\n';
  out += 'const Meshes = api.meshes;\n';
  out += 'const View = api.View;\n';
  out += 'const Mesh = api.Mesh;\n';
  out += 'const Motion = api.Motion;\n';
  out += 'const Util = api.Util;\n';

  const names = meshIdsByName ? Object.keys(meshIdsByName) : [];
  for (const name of names) {
    if (!isValidIdentifier(name)) continue;
    if (RESERVED.has(name)) continue;
    out += `const ${name} = Meshes.byName[${JSON.stringify(name)}];\n`;
  }
  out += '// --- End Globals ---\n';
  return out;
}

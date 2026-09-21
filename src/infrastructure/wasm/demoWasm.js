let _exportsPromise;

async function instantiate(url) {
  // Prefer streaming when possible (faster startup), fallback for older browsers.
  if ("instantiateStreaming" in WebAssembly) {
    try {
      const res = await fetch(url);
      // Some servers may not send application/wasm; fallback if streaming fails.
      return await WebAssembly.instantiateStreaming(res, {});
    } catch {
      // ignore and retry with ArrayBuffer
    }
  }

  const res = await fetch(url);
  const bytes = await res.arrayBuffer();
  return await WebAssembly.instantiate(bytes, {});
}

export function getDemoWasm() {
  if (_exportsPromise) return _exportsPromise;
  _exportsPromise = (async () => {
    const { instance } = await instantiate("/wasm/demo.wasm");
    const base = instance.exports || {};

    // Provide JS-side generator fallbacks so the app can always call generate_<kind>.
    const wrap = { ...base };

    // simple box generator: returns positions, normals, indices
    wrap.generate_box = wrap.generate_box || function (params = {}) {
      const size = (params.size || params.width || 1) / 2;
      const positions = new Float32Array([
        -size, -size, -size,  size, -size, -size,  size,  size, -size, -size,  size, -size,
        -size, -size,  size,  size, -size,  size,  size,  size,  size, -size,  size,  size,
      ]);
      const indices = new Uint16Array([
        0,1,2, 0,2,3, 4,6,5, 4,7,6,
        0,4,5, 0,5,1, 3,2,6, 3,6,7,
        0,3,7, 0,7,4, 1,5,6, 1,6,2
      ]);
      return { positions, indices };
    };

    // basic UV sphere generator (lat/lon)
    wrap.generate_sphere = wrap.generate_sphere || function (params = {}) {
      const radius = params.diameter ? params.diameter / 2 : (params.radius || 0.5);
      const segments = Math.max(8, Math.min(64, params.segments || 16));
      const rings = Math.max(6, Math.min(64, params.segments || 16));
      const positions = [];
      const indices = [];
      for (let y = 0; y <= rings; y++) {
        const v = y / rings;
        const theta = v * Math.PI;
        for (let x = 0; x <= segments; x++) {
          const u = x / segments;
          const phi = u * Math.PI * 2;
          const px = -radius * Math.cos(phi) * Math.sin(theta);
          const py = radius * Math.cos(theta);
          const pz = radius * Math.sin(phi) * Math.sin(theta);
          positions.push(px, py, pz);
        }
      }
      for (let y = 0; y < rings; y++) {
        for (let x = 0; x < segments; x++) {
          const a = y * (segments + 1) + x;
          const b = a + segments + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
    };

    // tube generator fallback (simple extruded cylinder along two points)
    wrap.generate_tube = wrap.generate_tube || function (params = {}) {
      const path = Array.isArray(params.path) && params.path.length >= 2 ? params.path : [{x:0,y:0,z:0},{x:0,y:1,z:0}];
      const radius = params.radius || 0.05;
      const tess = Math.max(3, Math.min(64, params.tessellation || 12));
      // For simplicity, create a cylinder between first and last points
      const p0 = path[0]; const p1 = path[path.length-1];
      const positions = [];
      const indices = [];
      for (let i = 0; i <= tess; i++) {
        const theta = (i / tess) * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        positions.push(p0.x + x, p0.y, p0.z + z);
        positions.push(p1.x + x, p1.y, p1.z + z);
      }
      for (let i = 0; i < tess; i++) {
        const a = i*2; const b = a+1; const c = ((i+1)*2); const d = c+1;
        indices.push(a, c, b, c, d, b);
      }
      return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
    };

    return wrap;
  })();
  return _exportsPromise;
}

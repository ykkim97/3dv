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
    return instance.exports;
  })();
  return _exportsPromise;
}

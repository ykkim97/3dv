// Runs user-provided scripts in an isolated Worker context.
// Protocol:
// - { type: 'setScripts', scriptsById: { [id]: any } }
// - { type: 'setData', data: any }
// - { type: 'run', reqId: string, eventName: string, meshId: string, scene: { id: string, name: string }, payload?: any }
// Responds:
// - { type: 'result', reqId, ok: true, commands: any[] }
// - { type: 'result', reqId, ok: false, error: { message, stack? } }

/** @type {Record<string, any>} */
const scriptsById = Object.create(null);
/** @type {Record<string, Record<string, Function>>} */
const compiledById = Object.create(null);
let latestData = null;

function getEventsObject(scripts) {
  if (!scripts || typeof scripts !== 'object') return {};
  if (scripts.events && typeof scripts.events === 'object') return scripts.events;
  // Backward compatibility: legacy shape { onLoad, onClick, ... }
  return scripts;
}

function getFunctionsObject(scripts) {
  if (!scripts || typeof scripts !== 'object') return {};
  const f = scripts.functions;
  return (f && typeof f === 'object') ? f : {};
}

function buildFunctionsPreamble(scripts) {
  const fns = getFunctionsObject(scripts);
  let out = '';
  for (const [name, code] of Object.entries(fns)) {
    const src = typeof code === 'string' ? code.trim() : '';
    if (!src) continue;
    out += `\n// fn:${name}\n${src}\n`;
  }
  return out;
}

function compileHandler({ preamble = '', code }) {
  if (!code || typeof code !== 'string') return null;
  const src = String(code);

  // The handler runs as an async function body. Available objects:
  // - ctx: { mesh, scene, payload, data }
  // - api: { fetch, log, sleep, enqueue }
  // Note: this is not a perfect security boundary; isolation is via Worker.
  const fn = new Function('ctx', 'api',
    '"use strict";\n' +
    String(preamble || '') + '\n' +
    'return (async (ctx, api) => {\n' +
    src + '\n' +
    '})(ctx, api);\n'
  );
  return fn;
}

function ensureCompiled(meshId, eventName) {
  if (!meshId) return;
  if (!compiledById[meshId]) compiledById[meshId] = Object.create(null);
  if (compiledById[meshId][eventName]) return;

  const s = scriptsById[meshId] || {};
  const events = getEventsObject(s);
  const preamble = buildFunctionsPreamble(s);
  const code = events && typeof events[eventName] === 'string' ? events[eventName] : '';
  compiledById[meshId][eventName] = compileHandler({ preamble, code });
}

function toErrorObject(err) {
  if (!err) return { message: 'Unknown error' };
  if (typeof err === 'string') return { message: err };
  return { message: err.message || String(err), stack: err.stack };
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'setScripts') {
    const next = msg.scriptsById && typeof msg.scriptsById === 'object' ? msg.scriptsById : {};
    // replace caches
    for (const k of Object.keys(scriptsById)) delete scriptsById[k];
    for (const k of Object.keys(compiledById)) delete compiledById[k];
    for (const [id, s] of Object.entries(next)) scriptsById[id] = s;
    return;
  }

  if (msg.type === 'setData') {
    latestData = msg.data;
    return;
  }

  if (msg.type === 'run') {
    const { reqId, eventName, meshId, scene, payload } = msg;
    const commands = [];

    try {
      ensureCompiled(meshId, eventName);
      const compiled = compiledById[meshId] || {};
      const handler = compiled[eventName];
      if (typeof handler !== 'function') {
        self.postMessage({ type: 'result', reqId, ok: true, commands: [] });
        return;
      }

      const ctx = {
        mesh: { id: meshId },
        scene: scene || null,
        payload: payload ?? null,
        data: latestData,
      };

      const api = {
        fetch,
        log: (...args) => {
          try { self.postMessage({ type: 'log', reqId, args }); } catch { /* ignore */ }
        },
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        enqueue: (cmd) => { commands.push(cmd); },
      };

      await handler(ctx, api);
      self.postMessage({ type: 'result', reqId, ok: true, commands });
    } catch (err) {
      self.postMessage({ type: 'result', reqId, ok: false, error: toErrorObject(err) });
    }
  }
};

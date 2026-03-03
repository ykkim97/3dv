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

/** @type {Record<string, any>} */
const meshMetasById = Object.create(null);
/** @type {Record<string, string>} */
const meshIdsByName = Object.create(null);

import { makeMeshRegistry } from './scriptApi/meshProxy.js';
import { makeApi } from './scriptApi/catalog.js';
import { buildGlobalsPreamble } from './scriptApi/preamble.js';

let _callSeq = 0;
/** @type {Map<string, {resolve:Function, reject:Function}>} */
const _pendingHostCalls = new Map();

function hostCall(sceneId, name, args) {
  const callId = String(++_callSeq) + '-' + Date.now();
  return new Promise((resolve, reject) => {
    _pendingHostCalls.set(callId, { resolve, reject });
    try {
      self.postMessage({ type: 'hostCall', callId, sceneId, name, args });
    } catch (err) {
      _pendingHostCalls.delete(callId);
      reject(err);
    }
  });
}

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

function buildLumatrixPreamble() {
  return buildGlobalsPreamble({ meshIdsByName });
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
  const preamble = buildFunctionsPreamble(s) + '\n' + buildLumatrixPreamble();
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

  if (msg.type === 'hostCallResult') {
    const pending = _pendingHostCalls.get(msg.callId);
    if (!pending) return;
    _pendingHostCalls.delete(msg.callId);
    if (msg.ok) pending.resolve(msg.result);
    else pending.reject(Object.assign(new Error(msg.error?.message || 'HostCall error'), { stack: msg.error?.stack }));
    return;
  }

  if (msg.type === 'setScripts') {
    const next = msg.scriptsById && typeof msg.scriptsById === 'object' ? msg.scriptsById : {};
    const nextMetas = msg.meshMetasById && typeof msg.meshMetasById === 'object' ? msg.meshMetasById : {};
    const nextNames = msg.meshIdsByName && typeof msg.meshIdsByName === 'object' ? msg.meshIdsByName : {};
    // replace caches
    for (const k of Object.keys(scriptsById)) delete scriptsById[k];
    for (const k of Object.keys(compiledById)) delete compiledById[k];
    for (const k of Object.keys(meshMetasById)) delete meshMetasById[k];
    for (const k of Object.keys(meshIdsByName)) delete meshIdsByName[k];
    for (const [id, s] of Object.entries(next)) scriptsById[id] = s;
    for (const [id, m] of Object.entries(nextMetas)) meshMetasById[id] = m;
    for (const [name, id] of Object.entries(nextNames)) meshIdsByName[name] = id;
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

      const baseApi = {
        fetch,
        log: (...args) => {
          try { self.postMessage({ type: 'log', reqId, args }); } catch { /* ignore */ }
        },
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        enqueue: (cmd) => { commands.push(cmd); },
      };

      const meshes = makeMeshRegistry({ meshMetasById, meshIdsByName, enqueue: baseApi.enqueue });
      const sceneId = (scene && typeof scene === 'object') ? scene.id : null;
      const hc = (name, args) => hostCall(sceneId, name, args);
      const lumatrixApi = makeApi({ ctx, baseApi, meshes, hostCall: hc });

      const api = {
        ...baseApi,
        meshes,
        ...lumatrixApi,
        hostCall: hc,
      };

      await handler(ctx, api);
      self.postMessage({ type: 'result', reqId, ok: true, commands });
    } catch (err) {
      self.postMessage({ type: 'result', reqId, ok: false, error: toErrorObject(err) });
    }
  }
};

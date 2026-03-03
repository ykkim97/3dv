// A small bridge that runs user scripts in a WebWorker.
// - Isolation: Worker (no DOM access)
// - Network: allowed via fetch inside Worker
// - Safety: per-call timeout; on timeout we restart the worker

export default class ScriptEngine {
  constructor({ timeoutMs = 500 } = {}) {
    this.timeoutMs = Math.max(50, Number(timeoutMs) || 500);
    this._worker = null;
    this._reqSeq = 0;
    this._pending = new Map();
    this._scriptsById = {};
    this._data = null;
    this._ensureWorker();
  }

  dispose() {
    try {
      if (this._worker) this._worker.terminate();
    } catch { /* ignore */ }
    this._worker = null;
    this._pending.clear();
  }

  setScripts(meshMetas = []) {
    const scriptsById = {};
    for (const m of Array.isArray(meshMetas) ? meshMetas : []) {
      if (!m || !m.id) continue;
      if (m.scripts && typeof m.scripts === 'object') scriptsById[m.id] = m.scripts;
    }
    this._scriptsById = scriptsById;
    this._post({ type: 'setScripts', scriptsById });
  }

  setData(data) {
    this._data = data;
    this._post({ type: 'setData', data });
  }

  async run({ eventName, meshId, scene, payload } = {}) {
    if (!eventName || !meshId) return [];
    const reqId = String(++this._reqSeq) + '-' + Date.now();

    const p = new Promise((resolve, reject) => {
      this._pending.set(reqId, { resolve, reject });
    });

    this._post({ type: 'run', reqId, eventName, meshId, scene, payload });

    const timeout = new Promise((_, reject) => {
      const t = setTimeout(() => {
        clearTimeout(t);
        reject(new Error(`script timeout after ${this.timeoutMs}ms (${eventName})`));
      }, this.timeoutMs);
    });

    try {
      const res = await Promise.race([p, timeout]);
      return Array.isArray(res) ? res : [];
    } catch (err) {
      // hard reset worker on timeout/hang risk
      this._restartWorker();
      throw err;
    } finally {
      this._pending.delete(reqId);
    }
  }

  _ensureWorker() {
    if (this._worker) return;
    this._worker = new Worker(new URL('./scriptWorker.js', import.meta.url), { type: 'module' });
    this._worker.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'log') {
        try {
          // eslint-disable-next-line no-console
          console.log('[script]', ...(msg.args || []));
        } catch { /* ignore */ }
        return;
      }

      if (msg.type === 'result') {
        const pending = this._pending.get(msg.reqId);
        if (!pending) return;
        if (msg.ok) pending.resolve(msg.commands || []);
        else pending.reject(Object.assign(new Error(msg.error?.message || 'Script error'), { stack: msg.error?.stack }));
      }
    };

    // prime with latest state
    try { this._post({ type: 'setScripts', scriptsById: this._scriptsById || {} }); } catch { /* ignore */ }
    try { this._post({ type: 'setData', data: this._data }); } catch { /* ignore */ }
  }

  _restartWorker() {
    try {
      if (this._worker) this._worker.terminate();
    } catch { /* ignore */ }
    this._worker = null;
    this._ensureWorker();
  }

  _post(msg) {
    this._ensureWorker();
    try {
      this._worker.postMessage(msg);
    } catch {
      this._restartWorker();
      this._worker.postMessage(msg);
    }
  }
}

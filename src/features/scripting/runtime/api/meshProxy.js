// src/runtime/scriptApi/meshProxy.js

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function isObject(x) {
  return !!x && typeof x === 'object';
}

export function isValidIdentifier(name) {
  return typeof name === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

export function makeMeshRegistry({ meshMetasById, meshIdsByName, enqueue }) {
  const byId = Object.create(null);
  const byName = Object.create(null);

  const getMeta = (id) => (id && meshMetasById && meshMetasById[id]) ? meshMetasById[id] : null;

  const updateMetaAndEnqueue = (id, changes) => {
    const meta = getMeta(id);
    if (!meta) return;

    // Update local cached meta for read-after-write inside the same script run.
    try {
      if (changes.position && isObject(meta.position)) Object.assign(meta.position, changes.position);
      if (changes.rotation && isObject(meta.rotation)) Object.assign(meta.rotation, changes.rotation);
      if (changes.scaling && isObject(meta.scaling)) Object.assign(meta.scaling, changes.scaling);
      if (changes.material && isObject(meta.material)) Object.assign(meta.material, changes.material);
      if (changes.visible !== undefined) meta.visible = !!changes.visible;
      if (changes.name !== undefined) meta.name = String(changes.name);
      if (changes.parent !== undefined) meta.parent = changes.parent;
    } catch { /* ignore */ }

    enqueue({ type: 'updateMesh', payload: { id, changes } });
  };

  const makeVec3Proxy = (id, key) => {
    return new Proxy(
      {},
      {
        get(_t, prop) {
          const meta = getMeta(id);
          const v = meta && meta[key] ? meta[key] : { x: 0, y: 0, z: 0 };
          if (prop === 'x' || prop === 'y' || prop === 'z') return Number(v[prop] || 0);
          if (prop === Symbol.toStringTag) return 'Vector3';
          if (prop === 'toJSON') return () => ({ x: Number(v.x || 0), y: Number(v.y || 0), z: Number(v.z || 0) });
          return undefined;
        },
        set(_t, prop, value) {
          if (prop !== 'x' && prop !== 'y' && prop !== 'z') return false;
          const meta = getMeta(id);
          const cur = meta && meta[key] ? meta[key] : { x: 0, y: 0, z: 0 };
          const next = { x: Number(cur.x || 0), y: Number(cur.y || 0), z: Number(cur.z || 0) };
          next[prop] = Number(value || 0);
          updateMetaAndEnqueue(id, { [key]: next });
          return true;
        },
      }
    );
  };

  const makeColorProxy = (id) => {
    return new Proxy(
      {},
      {
        get(_t, prop) {
          const meta = getMeta(id);
          const c = meta && meta.material && meta.material.color ? meta.material.color : { r: 1, g: 1, b: 1 };
          if (prop === 'r' || prop === 'g' || prop === 'b') return Number(c[prop] || 0);
          if (prop === Symbol.toStringTag) return 'Color3';
          if (prop === 'toJSON') return () => ({ r: Number(c.r || 0), g: Number(c.g || 0), b: Number(c.b || 0) });
          return undefined;
        },
        set(_t, prop, value) {
          if (prop !== 'r' && prop !== 'g' && prop !== 'b') return false;
          const meta = getMeta(id);
          const cur = meta && meta.material && meta.material.color ? meta.material.color : { r: 1, g: 1, b: 1 };
          const nextColor = { r: Number(cur.r || 0), g: Number(cur.g || 0), b: Number(cur.b || 0) };
          nextColor[prop] = clamp01(value);
          updateMetaAndEnqueue(id, { material: { color: nextColor } });
          return true;
        },
      }
    );
  };

  const makeMaterialProxy = (id) => {
    return new Proxy(
      {},
      {
        get(_t, prop) {
          const meta = getMeta(id);
          const m = meta && meta.material ? meta.material : {};
          if (prop === 'alpha') return Number(m.alpha ?? 1);
          if (prop === 'color') return makeColorProxy(id);
          if (prop === 'type') return m.type;
          return undefined;
        },
        set(_t, prop, value) {
          if (prop === 'alpha') {
            updateMetaAndEnqueue(id, { material: { alpha: clamp01(value) } });
            return true;
          }
          if (prop === 'type') {
            updateMetaAndEnqueue(id, { material: { type: String(value || 'standard') } });
            return true;
          }
          return false;
        },
      }
    );
  };

  const makeMeshProxy = (id) => {
    return new Proxy(
      { id },
      {
        get(_t, prop) {
          const meta = getMeta(id);
          if (prop === 'id') return id;
          if (prop === 'name') return meta ? meta.name : id;
          if (prop === 'kind') return meta ? meta.kind : undefined;
          if (prop === 'position') return makeVec3Proxy(id, 'position');
          if (prop === 'rotation') return makeVec3Proxy(id, 'rotation');
          if (prop === 'scaling') return makeVec3Proxy(id, 'scaling');
          if (prop === 'visible') return meta ? (meta.visible !== false) : true;
          if (prop === 'material') return makeMaterialProxy(id);
          if (prop === Symbol.toStringTag) return 'Mesh';
          return undefined;
        },
        set(_t, prop, value) {
          if (prop === 'visible') {
            updateMetaAndEnqueue(id, { visible: !!value });
            return true;
          }
          if (prop === 'name') {
            updateMetaAndEnqueue(id, { name: String(value || '') });
            return true;
          }
          if (prop === 'parent') {
            updateMetaAndEnqueue(id, { parent: value ?? null });
            return true;
          }
          return false;
        },
      }
    );
  };

  for (const [id, meta] of Object.entries(meshMetasById || {})) {
    if (!id || !meta) continue;
    byId[id] = makeMeshProxy(id);
  }

  for (const [name, id] of Object.entries(meshIdsByName || {})) {
    if (!name || !id) continue;
    if (byId[id]) byName[name] = byId[id];
  }

  const get = (target) => {
    if (!target) return null;
    if (typeof target === 'string') {
      return byName[target] || byId[target] || null;
    }
    if (isObject(target)) {
      if (typeof target.id === 'string') return byId[target.id] || null;
      if (typeof target.name === 'string') return byName[target.name] || null;
    }
    return null;
  };

  return { byId, byName, get };
}

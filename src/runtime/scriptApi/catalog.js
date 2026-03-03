// src/runtime/scriptApi/catalog.js

// This file centralizes the custom helper API surface exposed to user scripts.
// Keep additions here so API maintenance stays easy.

export function makeApi({ ctx, baseApi, meshes, hostCall }) {
  const tVec = (p) => (p && typeof p === 'object') ? ({ x: Number(p.x || 0), y: Number(p.y || 0), z: Number(p.z || 0) }) : null;

  const _controller = (id) => (id ? { id, stop: () => hostCall('stopEffect', { id }) } : null);

  const _start = async (type, target, opts = {}) => {
    const m = meshes.get(target);
    if (!m) return null;
    const id = await hostCall('startEffect', { type, targetId: m.id, opts: opts || {} });
    return _controller(id);
  };

  const _stopByTargetAndTypes = async (target, types) => {
    const m = meshes.get(target);
    if (!m) return false;
    await hostCall('stopEffectsForTarget', { targetId: m.id, types: Array.isArray(types) ? types : null });
    return true;
  };

  const View = {
    SetView: async (view) => {
      await hostCall('setView', { view: String(view || '') });
    },
    Focus: async (target, opts = {}) => {
      await hostCall('focus', { target: target && typeof target === 'object' ? (target.id || target.name) : target, opts: opts || {} });
    },
    PickScreen: async (x, y) => tVec(await hostCall('pickScreen', { x: Number(x || 0), y: Number(y || 0) })),
    PickAtPointer: async () => tVec(await hostCall('pickAtPointer', {})),
    PickFromEvent: async (evt) => {
      const ex = evt && typeof evt === 'object' ? Number(evt.x ?? evt.clientX ?? 0) : 0;
      const ey = evt && typeof evt === 'object' ? Number(evt.y ?? evt.clientY ?? 0) : 0;
      return tVec(await hostCall('pickScreen', { x: ex, y: ey }));
    },
  };

  const Mesh = {
    SetVisibility: (target, visible) => {
      const m = meshes.get(target);
      if (!m) return false;
      baseApi.enqueue({ type: 'updateMesh', payload: { id: m.id, changes: { visible: !!visible } } });
      return true;
    },
    SetColor: (target, color) => {
      const m = meshes.get(target);
      if (!m) return false;
      const c = (color && typeof color === 'object') ? color : {};
      baseApi.enqueue({ type: 'updateMesh', payload: { id: m.id, changes: { material: { color: { r: Number(c.r || 0), g: Number(c.g || 0), b: Number(c.b || 0) } } } } });
      return true;
    },

    // Effects return a small controller { id, stop() }.
    PulseColor: async (target, opts = {}) => _start('pulseColor', target, opts),
    StopPulseColor: async (targetOrId) => {
      const id = (typeof targetOrId === 'string') ? targetOrId : (targetOrId && typeof targetOrId === 'object' ? targetOrId.id : null);
      if (!id) return false;
      await hostCall('stopEffect', { id });
      return true;
    },
    FlashColor: async (target, color, duration = 300) => {
      const m = meshes.get(target);
      if (!m) return false;
      const ok = await hostCall('startEffect', { type: 'flashColor', targetId: m.id, opts: { color, duration: Number(duration || 0) } });
      return !!ok;
    },
    FadeMaterial: async (target, toAlpha, duration = 400) => _start('fadeMaterial', target, { toAlpha: Number(toAlpha), duration: Number(duration || 0) }),

    FlowGradient: async (target, opts = {}) => _start('flowGradient', target, opts),
    StopFlowGradient: async (target) => _stopByTargetAndTypes(target, ['flowGradient']),
    FlowDots: async (target, opts = {}) => _start('flowDots', target, opts),
    StopFlowDots: async (target) => _stopByTargetAndTypes(target, ['flowDots']),
    FlowSweep: async (target, opts = {}) => {
      await _start('flowSweep', target, opts);
    },
    FlowWave: async (target, opts = {}) => _start('flowWave', target, opts),
    StopFlowWave: async (target) => _stopByTargetAndTypes(target, ['flowWave']),
    FlowPower: async (target, opts = {}) => _start('flowPower', target, opts),
    StopFlowPower: async (target) => _stopByTargetAndTypes(target, ['flowPower']),

    PulseHalo: async (target, opts = {}) => _start('pulseHalo', target, opts),
    StopPulseHalo: async (targetOrId) => {
      if (typeof targetOrId === 'string' && targetOrId.startsWith('eff-')) {
        await hostCall('stopEffect', { id: targetOrId });
        return true;
      }
      return _stopByTargetAndTypes(targetOrId, ['pulseHalo']);
    },
    StopAllPulseHalos: async () => {
      await hostCall('stopAllEffectsByType', { type: 'pulseHalo' });
    },
  };

  const Motion = {
    MoveTo: async (target, dest, opts = {}) => _start('moveTo', target, { dest, ...(opts || {}) }),
    Rotate: async (target, opts = {}) => _start('rotate', target, opts),
    StopRotate: async (target) => _stopByTargetAndTypes(target, ['rotate']),

    Tilt: async (target, opts = {}) => _start('tilt', target, opts),
    Orbit: async (target, center, opts = {}) => _start('orbit', target, { center, ...(opts || {}) }),
    Bob: async (target, opts = {}) => _start('bob', target, opts),
    Sway: async (target, opts = {}) => _start('sway', target, opts),
    Shake: async (target, opts = {}) => _start('shake', target, opts),
    PulseScale: async (target, opts = {}) => _start('pulseScale', target, opts),
    Follow: async (target, leader, opts = {}) => _start('follow', target, { leader, ...(opts || {}) }),
    PlayAlongPath: async (target, path, opts = {}) => _start('playAlongPath', target, { path, ...(opts || {}) }),
  };

  const Util = {
    Delay: async (ms, fnOrName) => {
      // Host-managed delay so it can outlive the current script event.
      const id = await hostCall('delay', { ms: Number(ms || 0), fnOrName: fnOrName ?? null, meshId: ctx.mesh?.id || null });
      return id;
    },
    CancelDelay: async (timeoutId) => {
      await hostCall('cancelDelay', { id: timeoutId });
    },
  };

  const Sound = {
    PlaySound: async (id, fileOrOptions, opts = {}) => {
      await hostCall('playSound', { id, fileOrOptions, opts: opts || {} });
    },
    StopSound: async (id) => {
      await hostCall('stopSound', { id });
    },
    FadeSound: async (id, volume, duration = 300) => {
      await hostCall('fadeSound', { id, volume: Number(volume), duration: Number(duration || 0) });
    },
  };

  const Markers = {
    ShowMarker: async (target, opts = {}) => {
      const m = meshes.get(target);
      if (!m) return null;
      return await hostCall('showMarker', { targetId: m.id, opts: opts || {} });
    },
    RemoveMarker: async (target) => {
      const m = meshes.get(target);
      if (!m) return;
      await hostCall('removeMarker', { targetId: m.id });
    },
  };

  return { View, Mesh, Motion, Util, Sound, Markers };
}

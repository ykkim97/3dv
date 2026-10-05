import { isTauriRuntime, saveSceneOnDesktop } from '../../../platform/desktopFiles.js';
import { validateCity } from '../core/cityValidation.js';

export function cityFileName(name) {
  const cleaned = Array.from(String(name), char => char.charCodeAt(0) < 32 ? '_' : char).join('');
  const base = cleaned.trim().replace(/(?:\.city)?\.json$/i, '').replace(/[<>:"/\\|?*]/g, '_').slice(0, 100).replace(/[. ]+$/, '');
  if (!base) throw new Error('파일 이름을 입력해 주세요.');
  const safe = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base) ? `_${base}` : base;
  return `${safe}.city.json`;
}

// Called directly by a user click so the browser save picker retains user activation.
export async function saveCityFile(city, name, { runtime = globalThis.window, desktop = isTauriRuntime(), desktopSave = saveSceneOnDesktop } = {}) {
  const fileName = cityFileName(name);
  validateCity(city);
  if (desktop) return await desktopSave(city, fileName) ? 'saved' : 'cancelled';
  const contents = JSON.stringify(city, null, 2);
  if (runtime?.showSaveFilePicker) {
    let handle;
    try {
      handle = await runtime.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Lumatrix 도시 파일', accept: { 'application/json': ['.json'] } }] });
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
      throw error;
    }
    const writable = await handle.createWritable();
    try {
      await writable.write(contents);
      await writable.close();
    } catch (error) {
      await Promise.resolve(writable.abort?.()).catch(() => {});
      throw error;
    }
    return 'saved';
  }
  const url = runtime.URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  try {
    const link = runtime.document.createElement('a');
    link.href = url; link.download = fileName;
    runtime.document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); }
  } finally { runtime.setTimeout(() => runtime.URL.revokeObjectURL(url), 1000); }
  return 'downloaded';
}

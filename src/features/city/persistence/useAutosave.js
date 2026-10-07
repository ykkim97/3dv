import { useCallback, useEffect, useRef, useState } from 'react';
import { Autosave } from './autosave.js';
import { createProjectStore } from './projectStore.js';
import { validateCity } from '../core/cityValidation.js';

export function useAutosave(city, onRestore) {
  const [currentId, setCurrentId] = useState(() => crypto.randomUUID());
  const store = useRef(null), controller = useRef(null), projectId = useRef(currentId);
  const [status, setStatus] = useState({ state: 'loading' });
  const [projects, setProjects] = useState([]);
  const [recovery, setRecovery] = useState(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => {
    try { const list = await store.current.list(); setProjects(list); return list; }
    catch (error) { setStatus({ state: 'error', message: error.message }); return []; }
  }, []);
  useEffect(() => {
    let active = true;
    store.current = createProjectStore();
    const instance = new Autosave(store.current, value => { if (active) setStatus(value); });
    controller.current = instance;
    store.current.list().then(list => {
      if (!active) return;
      setProjects(list);
      const latest = list[0];
      if (latest) { setRecovery(latest); setStatus({ state: 'recovery' }); }
      else { setReady(true); setStatus({ state: 'pending' }); }
    }).catch(error => { if (active) { setStatus({ state: 'error', message: error.message }); setReady(true); } });
    const flush = () => instance.flush().catch(() => {});
    const hidden = () => { if (document.hidden) flush(); };
    const leaving = event => { if (instance.dirty) { flush(); event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', flush); window.addEventListener('beforeunload', leaving);
    return () => {
      active = false; instance.flush().catch(() => {}); instance.dispose();
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', leaving);
    };
  }, []);
  useEffect(() => { if (ready) controller.current?.schedule(city, projectId.current); }, [city, ready, currentId]);
  const restore = async (project, snapshot) => {
    try {
      const restored = validateCity(structuredClone(snapshot.city));
      // Persist the current work before switching away from it.
      if (ready) await controller.current.flush();
      projectId.current = project.id;
      setCurrentId(project.id);
      onRestore(restored); setRecovery(null); setReady(true); setOpen(false);
    } catch (error) { setStatus({ state: 'error', message: `복구 실패: ${error.message}` }); }
  };
  const newProject = () => { controller.current?.flush().catch(() => {}); projectId.current = crypto.randomUUID(); setCurrentId(projectId.current); };
  const showProjects = async () => { await refresh(); setOpen(true); };
  const flush = useCallback(() => controller.current?.flush() || Promise.resolve(), []);
  const remove = async id => {
    try { await store.current.remove(id); await refresh(); }
    catch (error) { setStatus({ state: 'error', message: error.message }); }
  };
  return { status, projects, recovery, open, setOpen, restore, remove, showProjects, flush, newProject, currentId,
    continueWithoutRecovery: () => { setRecovery(null); setReady(true); } };
}

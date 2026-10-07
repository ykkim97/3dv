import { useCallback, useEffect, useRef, useState } from 'react';
import CityEditor from '../editor/CityEditor.jsx';
import { createCity } from '../core/cityState.js';
import { createSceneProject, removePage, validateSceneProject } from './projectModel.js';
import { portalAnchor } from './portalModel.js';
import { createSceneProjectStore } from './sceneProjectStore.js';
import { saveSceneProjectFile } from './projectFiles.js';
import PageLibrary from './PageLibrary.jsx';
import { readSceneFile } from './importSceneFile.js';
import './pages.css';

export default function ProjectEditor() {
  const [project, setProject] = useState(() => createSceneProject(createCity('blank')));
  const [enabled, setEnabled] = useState(false), [manager, setManager] = useState(false), [viewing, setViewing] = useState(false);
  const [backStack, setBackStack] = useState([]), [session, setSession] = useState(null), [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(null), [message, setMessage] = useState(''), [saveStatus, setSaveStatus] = useState(''), [recovery, setRecovery] = useState(null);
  const [loading, setLoading] = useState(null);
  const [libraryView, setLibraryView] = useState('cards');
  const editor = useRef(null), sessions = useRef(new Map()), fileInput = useRef(null), store = useRef(null);
  const pendingTransition = useRef(null);
  const active = project.pages.find(p => p.id === project.activePageId);
  const register = useCallback(api => { editor.current = api; }, []);
  const activeId = active.id;
  const sceneReady = useCallback(() => setLoading(current => current?.pageId === activeId && current.revision === revision ? { ...current, phase: 'revealing' } : current), [activeId, revision]);
  const sceneLoadError = useCallback(error => setLoading(current => current?.pageId === activeId && current.revision === revision ? { ...current, error, phase: 'error' } : current), [activeId, revision]);
  const onCityChange = useCallback(city => setProject(current => {
    const page = current.pages.find(p => p.id === activeId);
    if (!page || page.type !== '3d' || page.city === city) return current;
    return { ...current, pages: current.pages.map(p => p.id === page.id ? { ...p, city } : p) };
  }), [activeId]);
  const capture = () => {
    const snapshot = active.type === '3d' ? editor.current?.snapshot() : null;
    if (!snapshot) return project;
    sessions.current.set(active.id, snapshot);
    const thumbnail = editor.current?.thumbnail();
    return { ...project, pages: project.pages.map(p => p.id === active.id ? { ...p, city: snapshot.city, camera: snapshot.camera, ...(thumbnail ? { thumbnail } : {}) } : p) };
  };
  const transition = (next, id, stack = [...backStack, active.id]) => {
    const page = next.pages.find(p => p.id === id);
    if (!page) { setMessage('목적지 페이지가 없습니다. 이동 포인트 설정을 확인하세요.'); return; }
    if (pendingTransition.current) return;
    const pending = { cancelled: false }; pendingTransition.current = pending;
    const nextRevision = revision + 1;
    setLoading({ name: page.name, pageId: id, revision: nextRevision }); setDraft(null); setManager(false);
    // Let the loading cover paint before disposing/building heavy scene geometry.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (pending.cancelled) return;
      editor.current?.dispose(); editor.current = null;
      setSession(sessions.current.get(id) || { city: page.city, camera: page.camera });
      setProject({ ...next, activePageId: id }); setEnabled(true); setBackStack(stack.slice(-50));
      setRevision(v => v + 1); pendingTransition.current = null;
      if (page.type === '2d') requestAnimationFrame(() => requestAnimationFrame(() => setLoading(current => current?.pageId === id && current.revision === nextRevision ? { ...current, phase: 'revealing' } : current)));
    }));
  };
  useEffect(() => () => { if (pendingTransition.current) pendingTransition.current.cancelled = true; }, []);
  useEffect(() => {
    if (loading?.phase !== 'revealing') return;
    // Fallback for platforms that suppress CSS transition events.
    const timer = setTimeout(() => setLoading(current => current === loading ? null : current), 800);
    return () => clearTimeout(timer);
  }, [loading]);
  const navigate = id => { if (id !== active.id) transition(capture(), id); };
  const back = () => { if (backStack.length) transition(capture(), backStack.at(-1), backStack.slice(0, -1)); };
  const openManager = () => { setProject(capture()); setManager(true); };
  const saveFile = async () => {
    try { const next = capture(); setProject(next); setMessage(await saveSceneProjectFile(next)); }
    catch (error) { setMessage(error.message); }
  };
  useEffect(() => {
    store.current = createSceneProjectStore(); let alive = true;
    store.current.load().then(value => { if (value && alive) setRecovery(validateSceneProject(value)); }).catch(error => { if (alive) setSaveStatus(error.message); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!enabled || recovery) return;
    let alive = true;
    const persist = async () => {
      try {
        const snapshot = editor.current?.snapshot();
        const latest = snapshot ? { ...project, pages: project.pages.map(p => p.id === project.activePageId ? { ...p, city: snapshot.city, camera: snapshot.camera } : p) } : project;
        validateSceneProject(latest); await store.current.save(latest); if (alive) setSaveStatus('프로젝트 자동 저장됨');
      }
      catch (error) { if (alive) setSaveStatus(`자동 저장 실패: ${error.message}`); }
    };
    const timer = setTimeout(persist, 1000);
    const leaving = () => { clearTimeout(timer); persist(); };
    window.addEventListener('pagehide', leaving);
    const hidden = () => { if (document.hidden) leaving(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { alive = false; clearTimeout(timer); window.removeEventListener('pagehide', leaving); document.removeEventListener('visibilitychange', hidden); };
  }, [project, enabled, recovery]);
  const addPage = type => {
    if (project.pages.length >= 30) { setMessage('페이지는 최대 30개까지 만들 수 있습니다.'); return; }
    const id = crypto.randomUUID(), name = `${type === '3d' ? '새 3D 씬' : '새 2D 화면'} ${project.pages.length + 1}`;
    const page = { id, type, name, ...(type === '3d' ? { city: { ...createCity('blank'), name } } : {}) };
    const next = capture(); setProject({ ...next, pages: [...next.pages, page] }); setEnabled(true);
  };
  const startPoint = () => {
    if ((active.city.portals || []).length >= 100) { setMessage('한 씬에는 이동 포인트를 최대 100개까지 배치할 수 있습니다.'); return; }
    if (project.pages.length < 2) { openManager(); setMessage('목적지로 사용할 페이지를 먼저 추가하세요.'); return; }
    setDraft({ id: crypto.randomUUID(), name: '이동 포인트', targetPageId: project.pages.find(p => p.id !== active.id).id });
  };
  const pickPortal = id => {
    const portal = active.city.portals?.find(p => p.id === id);
    if (!portal) return;
    if (viewing) navigate(portal.targetPageId); else setDraft({ ...portal });
  };
  const applyPoint = position => {
    const value = { ...draft, ...position };
    editor.current?.updateCity(city => ({ ...city, portals: [...(city.portals || []).filter(p => p.id !== value.id), value] }));
    setEnabled(true); setDraft(null);
  };
  const place = () => {
    const value = { ...draft }; setDraft(null);
    editor.current?.placePortal((position, objectId) => {
      const anchor = portalAnchor(editor.current.snapshot().city, position, objectId);
      editor.current.updateCity(city => ({ ...city, portals: [...(city.portals || []).filter(p => p.id !== value.id), { ...value, objectId: undefined, offset: undefined, ...anchor }] }));
      setEnabled(true);
    });
  };
  const importProject = value => {
    const next = validateSceneProject(value);
    sessions.current.clear(); setRecovery(null); transition(next, next.activePageId, []);
  };
  const importFile = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const result = await readSceneFile(file);
      if (result.kind === 'project') {
        importProject(result.value);
      } else {
        const city = result.value;
        const next = capture(), page = { id: crypto.randomUUID(), name: city.name, type: '3d', city };
        if (next.pages.length >= 30) throw new Error('페이지는 최대 30개까지 만들 수 있습니다.');
        setProject({ ...next, pages: [...next.pages, page] }); setEnabled(true);
      }
      setMessage('파일을 불러왔습니다.');
    } catch (error) { setMessage(error.message); }
  };
  const deletePage = id => {
    const linked = project.pages.some(p => p.city?.portals?.some(portal => portal.targetPageId === id));
    if (linked) { setMessage('이 페이지로 연결된 이동 포인트를 먼저 삭제하거나 목적지를 변경하세요.'); return; }
    const next = removePage(capture(), id);
    sessions.current.clear();
    if (active.type === '3d') editor.current?.resetHistory(next.pages.find(p => p.id === active.id).city);
    setBackStack(stack => stack.filter(pageId => pageId !== id)); setProject(next);
  };
  const menu = <div className="scene-page-tools" aria-label="씬 페이지 도구">
    <button onClick={back} disabled={!backStack.length} title="이전 페이지와 카메라 시점으로 돌아가기">← 이전</button>
    <button onClick={openManager}>페이지 · {project.pages.length}</button>
    {active.type === '3d' && <><button onClick={startPoint}>＋ 이동 포인트</button><button aria-pressed={viewing} onClick={() => { editor.current?.cancelPlacement(); setViewing(v => !v); }}>{viewing ? '이동 모드' : '포인트 편집'}</button></>}
  </div>;
  return <>
    {active.type === '3d' ? <CityEditor key={`${active.id}:${revision}`} pageSession={enabled ? session || { city: active.city, camera: active.camera } : undefined} registerEditor={register} onCityChange={onCityChange} onProjectSave={saveFile} onProjectManage={openManager} onProjectImport={importProject} projectSaveStatus={saveStatus} onPortalSelect={pickPortal} portalPages={project.pages} portalViewing={viewing} onSceneReady={sceneReady} onSceneLoadError={sceneLoadError} interactionBlocked={!!loading || manager || !!draft || !!recovery} pageMenu={menu} /> : <main className="dashboard-placeholder">{menu}<article><span>2D PAGE</span><h1>{active.name}</h1><p>대시보드 편집기는 준비 중입니다. 이 페이지는 프로젝트에 저장되며 이동 포인트로 방문할 수 있습니다.</p><button onClick={back} disabled={!backStack.length}>이전 화면으로 돌아가기</button><button onClick={openManager}>다른 페이지 열기</button></article></main>}
    <input ref={fileInput} hidden type="file" accept=".json" onChange={importFile} />
    {loading && <div className={`scene-loading-cover ${loading.phase === 'revealing' ? 'is-revealing' : ''}`} aria-busy={!loading.error} onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === 'opacity') setLoading(current => current?.phase === 'revealing' ? null : current); }}><section role={loading.error ? 'alert' : 'status'} aria-live="polite" className="scene-loading-card">
      {!loading.error && <span className="scene-loading-spinner" aria-hidden="true" />}
      <h2>{loading.error ? '화면을 불러오지 못했습니다' : '씬을 불러오고 있어요'}</h2>
      <strong>{loading.name}</strong><p>{loading.error || '지형·시설·연결선을 준비하고 있습니다. 잠시만 기다려 주세요.'}</p>
      {loading.error && <footer><button onClick={() => transition(capture(), active.id, backStack)}>다시 시도</button><button disabled={!backStack.length} onClick={back}>이전 페이지로 돌아가기</button><button onClick={() => setLoading(null)}>닫기</button></footer>}
    </section></div>}
    {message && !loading && <div className="page-message" role="status">{message}<button onClick={() => setMessage('')} aria-label="알림 닫기">×</button></div>}
    {recovery && <div className="scene-page-backdrop"><section className="scene-page-dialog" role="dialog" aria-modal="true" aria-label="씬 프로젝트 복구"><h2>저장된 씬 프로젝트가 있습니다</h2><p>{recovery.name} · {recovery.pages.length}개 페이지</p><p>복구하면 저장된 페이지와 이동 포인트를 함께 불러옵니다.</p><button onClick={() => { sessions.current.clear(); transition(recovery, recovery.activePageId, []); setRecovery(null); }}>프로젝트 복구</button><button onClick={() => setRecovery(null)}>현재 도시에서 계속</button></section></div>}
    {manager && <div className="scene-page-backdrop"><section className="scene-page-dialog page-library-dialog" role="dialog" aria-modal="true" aria-label="페이지 관리"><header><h2>씬 페이지</h2><button onClick={() => setManager(false)} aria-label="페이지 관리 닫기">×</button></header>
      <p>각 3D 씬은 독립된 도시 JSON을 갖습니다. 화면을 바꾸면 이전 씬은 해제되고 현재 씬만 렌더링됩니다.</p>
      <label>프로젝트 이름<input maxLength={80} value={project.name} onChange={e => setProject({ ...project, name: e.target.value })} /></label>
      <PageLibrary project={project} view={libraryView} onViewChange={setLibraryView} onRefresh={() => setProject(capture())} onOpen={navigate} onRename={(id, name) => setProject(current => ({ ...current, pages: current.pages.map(p => p.id === id ? { ...p, name } : p) }))} onStart={id => setProject(current => ({ ...current, entryPageId: id }))} onDelete={deletePage} />
      <footer><button onClick={() => addPage('3d')}>＋ 3D 씬</button><button onClick={() => addPage('2d')}>＋ 2D 화면</button><button onClick={() => fileInput.current.click()}>JSON 불러오기</button><button onClick={saveFile}>프로젝트 파일 저장</button><button disabled={active.id === project.entryPageId} onClick={() => navigate(project.entryPageId)}>시작 페이지 열기</button></footer>
      <small>{saveStatus || '새 페이지나 이동 포인트를 추가하면 프로젝트 자동 저장을 시작합니다.'}</small>
      <details><summary>사용 방법과 저장 안내</summary><p>① 목적지 페이지를 만드세요. ② 원래 3D 씬에서 ‘이동 포인트’를 누르고 이름·목적지를 선택하세요. ③ 위치 지정을 누른 뒤 지형이나 건물을 클릭하세요. ④ ‘이동 모드’로 바꾸고 포인트를 클릭하세요. ‘이전’은 방문 직전의 카메라 시점으로 돌아갑니다.</p><p>포인트 편집 모드에서는 포인트를 클릭해 이름·목적지·위치를 수정하거나 삭제할 수 있습니다. 건물 위 포인트는 이동·회전을 따라가며 건물 철거 시 함께 삭제됩니다. Esc는 위치 지정을 취소합니다.</p><p>프로젝트 파일에는 모든 페이지의 도시 JSON과 이동 관계가 함께 들어갑니다. 기존 ‘도시 파일 내보내기’는 현재 도시만 저장하므로 페이지 연결까지 보관하려면 ‘프로젝트 파일 저장’을 사용하세요. 2D 화면은 편집기 출시 전까지 안내 화면으로 표시됩니다.</p></details>
    </section></div>}
    {draft && <div className="scene-page-backdrop"><section className="scene-page-dialog" role="dialog" aria-modal="true" aria-label="이동 포인트 설정"><header><h2>이동 포인트</h2><button onClick={() => setDraft(null)} aria-label="포인트 설정 닫기">×</button></header><label>표시 이름<input maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label>목적지 페이지<select value={draft.targetPageId} onChange={e => setDraft({ ...draft, targetPageId: e.target.value })}>{project.pages.filter(p => p.id !== active.id).map(p => <option key={p.id} value={p.id}>{p.name} · {p.type.toUpperCase()}</option>)}</select></label><p>지형이나 건물을 클릭해 배치하세요. 건물에 찍으면 건물을 옮기거나 회전할 때도 함께 움직입니다.</p><footer><button disabled={!draft.name.trim()} onClick={place}>{draft.position ? '위치 다시 지정' : '화면에서 위치 지정'}</button>{draft.position && <><button disabled={!draft.name.trim()} onClick={() => applyPoint({})}>설정 저장</button><button onClick={() => navigate(draft.targetPageId)}>목적지로 이동</button><button onClick={() => { editor.current.updateCity(city => ({ ...city, portals: city.portals.filter(p => p.id !== draft.id) })); setDraft(null); }}>삭제</button></>}</footer></section></div>}
  </>;
}

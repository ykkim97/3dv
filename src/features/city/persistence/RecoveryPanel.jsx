import './recovery.css';

export function AutosaveStatus({ status, onOpen, onRetry }) {
  const labels = { loading: '저장소 확인 중', recovery: '복구본 있음', pending: '자동 저장 대기', saving: '자동 저장 중…', saved: '자동 저장됨', error: '자동 저장 실패' };
  return <div className="autosave-status" data-state={status.state}>
    <button onClick={onOpen} title={status.message || (status.savedAt ? `마지막 자동 저장: ${new Date(status.savedAt).toLocaleTimeString('ko-KR')}` : '자동 저장·복구 및 로컬 프로젝트')}>{labels[status.state]}</button>
    {status.state === 'error' && <button onClick={onRetry}>재시도</button>}
  </div>;
}

export default function RecoveryPanel({ autosave }) {
  const { recovery, projects, status, currentId } = autosave;
  if (!recovery && !autosave.open) return null;
  const list = recovery ? [recovery] : projects;
  return <div className="modal-backdrop">
    <section className="recovery-panel glass" role="dialog" aria-modal="true" aria-labelledby="recovery-title" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape' && !recovery) autosave.setOpen(false); }}>
      <h2 id="recovery-title">{recovery ? '이전 작업을 이어서 할까요?' : '자동 저장 · 프로젝트 복구'}</h2>
      <p>{recovery ? '마지막으로 저장된 작업이 있습니다. 복구할 시점을 선택하세요. 현재 열려 있는 도시로 계속해도 이전 복구본은 목록에 남습니다.' : '최근 10개 프로젝트를 보관하며, 각 프로젝트의 최근 저장본 3개 중에서 복구할 수 있습니다. 파일 내보내기로 별도 보관할 수도 있습니다.'}</p>
      {status.state === 'error' && <p role="alert" className="recovery-error">{status.message} 파일 내보내기로 현재 작업을 보관하세요.</p>}
      {!list.length && <p>아직 자동 저장본이 없습니다. 잠시 후 목록을 다시 열어주세요.</p>}
      <div className="recovery-list">{list.map(project => <article key={project.id}>
        <h3>{project.name}{project.id === currentId && ' · 현재 프로젝트'}</h3>
        {(project.snapshots || []).map((snapshot, i) => <div key={snapshot.id}><span>{i === 0 ? '최신 저장본' : `이전 저장본 ${i}`}<small>{new Date(snapshot.savedAt).toLocaleString('ko-KR')} · 시설 {snapshot.city?.objects?.length ?? 0}개</small></span><button onClick={() => autosave.restore(project, snapshot)}>복구</button></div>)}
        {!recovery && project.id !== currentId && <details><summary>목록에서 삭제</summary><p>이 프로젝트의 복구본을 모두 삭제합니다.</p><button onClick={() => autosave.remove(project.id)}>복구본 삭제</button></details>}
      </article>)}</div>
      <div className="recovery-actions">{recovery ? <button autoFocus onClick={autosave.continueWithoutRecovery}>현재 도시로 계속</button> : <button autoFocus onClick={() => autosave.setOpen(false)}>닫기</button>}{!recovery && <button onClick={async () => { try { await autosave.flush(); await autosave.showProjects(); } catch { /* Status includes the failure. */ } }}>지금 자동 저장</button>}</div>
      <small>편집을 멈춘 뒤 약 2초에 저장하며, 연속 편집 중에도 약 10초마다 저장을 시도합니다. 갑작스러운 종료 시 마지막 저장 완료 시점으로 복구합니다. 입력 중인 시설 속성은 적용 버튼을 눌러야 저장됩니다.</small>
    </section>
  </div>;
}

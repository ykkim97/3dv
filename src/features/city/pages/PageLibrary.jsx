export default function PageLibrary({ project, view, onViewChange, onRename, onOpen, onStart, onDelete, onRefresh }) {
  return <>
    <div className="page-library-toolbar"><span>{project.pages.length}개 페이지</span><div><button onClick={onRefresh} title="현재 씬의 미리보기 갱신">미리보기 갱신</button><button aria-pressed={view === 'cards'} onClick={() => onViewChange('cards')}>▦ 카드</button><button aria-pressed={view === 'list'} onClick={() => onViewChange('list')}>☰ 목록</button></div></div>
    <div className={`page-library page-library-${view}`}>{project.pages.map(page => {
      const current = page.id === project.activePageId, start = page.id === project.entryPageId;
      return <article key={page.id} className={current ? 'is-current' : ''}>
        <button className="page-thumbnail" disabled={current || !page.name.trim()} onClick={() => onOpen(page.id)} aria-label={`${page.name} 페이지 열기`}>
          {page.thumbnail ? <img src={page.thumbnail} alt={`${page.name} 씬 미리보기`} loading="lazy" /> : <div className="page-thumbnail-placeholder"><svg viewBox="0 0 160 90" aria-hidden="true">{page.type === '3d' ? <><path d="M20 60 80 30 140 60 80 86Z" fill="#41616a"/><path d="M47 56V30l18-9 18 9v26L65 65Z" fill="#8ec5c8"/><path d="M65 39v26l18-9V30Z" fill="#60949f"/><path d="M86 62V42l15-8 16 8v20l-16 8Z" fill="#bad8cb"/><path d="m101 50 16-8v20l-16 8Z" fill="#82b4ad"/></> : <><rect x="25" y="16" width="110" height="64" rx="6" fill="#41616a"/><rect x="34" y="25" width="92" height="8" rx="2" fill="#8fe9de"/><path d="M36 67V49h13v18m9 0V43h13v24m9 0V54h13v13m9 0V38h13v29" stroke="#b1d4d7" strokeWidth="8"/></>}</svg><span>{page.type === '3d' ? '열면 미리보기가 생성됩니다' : '대시보드 편집기 준비 중'}</span></div>}
          <span className="page-thumbnail-badges"><b>{page.type.toUpperCase()}</b>{current && <b>현재</b>}{start && <b>시작</b>}</span>
        </button>
        <div className="page-card-content"><input aria-label={`${page.name} 페이지 이름`} maxLength={80} value={page.name} onChange={e => onRename(page.id, e.target.value)} /><small>{page.type === '3d' ? `시설 ${page.city.objects.length}개 · 이동 포인트 ${page.city.portals?.length || 0}개` : '2D 화면'}</small><div className="page-card-actions"><button disabled={current || !page.name.trim()} onClick={() => onOpen(page.id)}>{current ? '열려 있음' : '열기'}</button><button disabled={start} onClick={() => onStart(page.id)}>시작 지정</button><button disabled={current || project.pages.length === 1} onClick={() => onDelete(page.id)}>삭제</button></div></div>
      </article>;
    })}</div>
  </>;
}

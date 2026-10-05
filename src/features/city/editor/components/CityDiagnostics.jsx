import { CATEGORIES } from '../../presets/catalog.js';
import Icon from './CityIcon.jsx';
import { EditResults } from '../../management/FacilityManagement.jsx';

export default function CityDiagnostics({ diagnostics, onClose, onIssue, changes, hasPrevious }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="city-diagnostics glass" role="dialog" aria-modal="true" aria-labelledby="city-diagnostics-title">
    <button className="modal-close" aria-label="도시 진단 닫기" onClick={onClose}><Icon name="close" size={18} /></button>
    <span className="eyebrow">CITY OVERVIEW</span><h2 id="city-diagnostics-title">도시 진단</h2><p>부지부터 생활 서비스까지 현재 도시의 큰 흐름을 확인하세요. 수치와 반경은 초기 계획 기준입니다.</p>
    <EditResults changes={changes} hasPrevious={hasPrevious} />
    <div className="diagnostics-grid">{diagnostics.sections.map(section => <article key={section.id} className={section.warning ? 'needs-attention' : ''}><div><Icon name={CATEGORIES.find(category => category.id === section.id)?.icon || 'info'} size={17} /><span>{section.label}</span></div><strong>{section.value}</strong><small>{section.detail}</small></article>)}</div>
    <div className="diagnostics-issues"><h3>다음에 개선할 것 <span>{diagnostics.issues.length}</span></h3>{diagnostics.issues.length ? <ul>{diagnostics.issues.map(issue => <li key={issue.id}><div><strong>{issue.title}</strong><small>{issue.detail}</small></div><div className="diagnostics-issue-actions">{issue.targetId && <button onClick={() => onIssue(issue, 'locate')}>대상 보기</button>}<button onClick={() => onIssue(issue, 'build')}>{issue.asset ? '시설 배치' : issue.targetId ? '도로 연결' : '시작하기'} <Icon name="plus" size={13} /></button></div></li>)}</ul> : <p>현재 계획 기준에서 확인된 부족 항목이 없습니다.</p>}</div>
    <small className="diagnostics-method">계획 기준: 일자리 수요는 인구의 45%, 학교 정원 수요는 15%로 계산합니다. 접근성은 직선거리, 소방은 차량 도로 이동거리로 계산합니다.</small>
  </section></div>;
}

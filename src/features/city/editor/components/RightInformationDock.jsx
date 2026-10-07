import Icon from './CityIcon.jsx';
import './rightInformationDock.css';

export default function RightInformationDock({ visible, active, hasSelection, hasOperations, hasConnections, hasLighting, hasBadges, onSelect, onHelp, children }) {
  const tabs = [
    hasSelection && ['selection', '선택 정보', 'building'],
    hasOperations && ['operations', '도시 운영', 'power'],
    hasBadges && ['status', '공급 표시', 'info'],
    hasConnections && ['connections', '흐름 연결', 'connection'],
    hasLighting && ['lighting', '시간·조명', 'sun'],
  ].filter(Boolean);
  return <aside className="right-information-dock glass" hidden={!visible} aria-label="도시 정보와 편집">
    <nav className="information-dock-tabs" aria-label="정보창 전환">
      {tabs.map(([id, label, icon]) => <button key={id} aria-pressed={active === id} onClick={() => onSelect(id)}><Icon name={icon} size={15} />{label}</button>)}
      <button className="information-dock-help" aria-label="정보창 사용 도움말" title="정보창 사용 도움말" onClick={onHelp}><Icon name="help" size={17} /></button>
    </nav>
    <div className="information-dock-content">{children}</div>
  </aside>;
}

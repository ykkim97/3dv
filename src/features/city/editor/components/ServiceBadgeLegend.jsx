import { serviceBadgeRecords } from '../../simulation/serviceBadges.js';
import Icon from './CityIcon.jsx';

export default function ServiceBadgeLegend({ service, options, onChange }) {
  if (!options.power && !options.water) return null;
  const all = serviceBadgeRecords(service, { ...options, missingOnly: false });
  return <aside className="service-badge-legend glass" aria-label="건물 위 공급 상태 표시">
    <div className="service-badge-heading"><strong>공급 상태</strong><button aria-label="공급 상태 표시 모두 끄기" onClick={() => onChange({ ...options, power: false, water: false })}>×</button></div>
    {['power', 'water'].filter(kind => options[kind]).map(kind => {
      const records = all.filter(record => record.kind === kind), good = records.filter(record => record.status === 'normal').length;
      const shortage = records.filter(record => record.status === 'shortage').length, unset = records.filter(record => record.status === 'unset').length;
      return <section key={kind} className={`service-badge-service ${kind}`}><div className="service-badge-count"><Icon name={kind} size={15} /><strong>{kind === 'power' ? '전력' : '수도'}</strong><small>{service[`${kind}Mode`] === 'network' ? '연결망 기준' : '반경 기준'}</small></div><div className="service-badge-states"><span className="badge-good">✓ 정상 <b>{good}</b></span><span className="badge-missing">! 미연결·중지 <b>{records.length - good - shortage - unset}</b></span>{shortage > 0 && <span className="badge-shortage">! 전력 부족 <b>{shortage}</b></span>}{unset > 0 && <span className="badge-unset">! 수치 미설정 <b>{unset}</b></span>}</div></section>;
    })}
    <details><summary>아이콘은 무엇을 뜻하나요?</summary><p>건물과 공급시설을 함께 집계합니다. 초록 ✓는 정상 공급, 붉은 !는 연결 끊김 또는 운전 중지입니다. 노란 !는 연결되어 있지만 전력이 부족한 상태이고, 회색 !는 계산에 필요한 수치가 비어 있는 상태입니다.</p></details>
    <label><input type="checkbox" checked={options.missingOnly} onChange={e => onChange({ ...options, missingOnly: e.target.checked })} /> 확인이 필요한 시설만 표시</label>
    {options.water && <small>수도는 선택한 반경·연결망 기준이며 유량은 계산하지 않습니다.</small>}
  </aside>;
}

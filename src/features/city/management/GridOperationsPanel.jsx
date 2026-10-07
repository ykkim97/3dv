import { useState } from 'react';
import { facilityName } from './facilityProperties.js';
import { UTILITY_SERVICES } from '../simulation/utilityService.js';
import { applyGridFailure, restoreGridFailure, changedGridConsumers } from './gridOperations.js';
import './gridOperations.css';

const format = n => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const statusNames = { normal: '정상 공급', shortage: '공급 부족', unset: '수치 미설정', disconnected: '연결 끊김', inactive: '운전 중지' };
export default function GridOperationsPanel({ city, service, open, onChange, onFocus, onNotice, onShowBadges, onClose, onConfigure }) {
  const [target, setTarget] = useState('');
  const [scenario, setScenario] = useState(null);
  const sources = city.objects.filter(o => ['source', 'relay'].includes(UTILITY_SERVICES[o.asset]?.role));
  const lines = (city.connections || []).filter(c => ['power', 'water'].includes(c.type));
  const options = [...sources.map(o => ({ key: `facility:${o.id}`, id: o.id, kind: 'facility', label: facilityName(o) })), ...lines.map(c => ({ key: `line:${c.id}`, id: c.id, kind: 'line', label: `${c.type === 'power' ? '전력' : '수도'}선 · ${facilityName(city.objects.find(o => o.id === c.from))} → ${facilityName(city.objects.find(o => o.id === c.to))}` }))];
  const balance = service.powerBalance;
  const selectedTarget = options.find(o => o.key === target);
  const targetNetwork = selectedTarget?.kind === 'line' ? lines.find(c => c.id === selectedTarget.id)?.type : UTILITY_SERVICES[city.objects.find(o => o.id === selectedTarget?.id)?.asset]?.network;
  const targetUsesNetwork = targetNetwork === 'power' ? service.powerMode === 'network' : targetNetwork === 'water' && service.waterMode === 'network';
  const affected = scenario ? changedGridConsumers(scenario.before, service) : [];
  const problems = balance ? [...balance.results].filter(([, result]) => result.status !== 'normal') : [];
  return <section className="grid-operations glass" hidden={!open} aria-label="운영 대시보드">
    <header><div><span className="operation-eyebrow">도시 전체 현황</span><strong>운영 대시보드</strong></div><button aria-label="운영 대시보드 닫기" onClick={onClose}>×</button></header>
    <div className="grid-operation-metrics">{[['power', '전력 연결', service.totals.power], ['water', '수도 연결', service.totals.water]].map(([kind, label, count]) => <div key={kind}><span>{label}<em>{service[`${kind}Mode`] === 'network' ? '연결망' : '반경'}</em></span><b>{count} <small>/ {service.totals.consumers}개</small></b><small>공급 경로 또는 범위 안의 소비시설</small></div>)}</div>
    <h3>전력 수급 <span>kW</span></h3>
    {balance ? <><div className={`operation-notice ${balance.complete ? 'complete' : 'partial'}`}>{balance.complete ? '입력한 수치를 모두 반영했습니다.' : `일부 수치가 비어 있습니다 · ${balance.missing.size}개 시설`}<small>{balance.complete ? '연결되어 있어도 발전 출력이나 중계 용량이 부족하면 전력이 부족할 수 있습니다.' : '아래는 확인된 값만 집계한 결과입니다. 수치가 비어 있는 망의 공급량은 제외합니다.'}</small></div><div className="grid-operation-metrics">{[['사용 가능한 출력', balance.generation, '발전 출력과 설비 용량을 반영'], ['필요한 전력', balance.demand, '운전 중인 소비시설의 수요 합계'], ['실제 배분된 전력', balance.delivered, '중계 용량과 연결 경로를 반영'], ['부족한 전력', balance.shortage, '공급하지 못한 수요', 'shortage']].map(([label, value, hint, style]) => <div key={label} className={style && value > 0 ? 'metric-warning' : ''}><span>{label}</span><b>{format(value)} <small>kW</small></b><small>{hint}</small></div>)}</div></> : <div className="operation-notice">아직 전력량을 계산하지 않습니다.<small>흐름 연결에서 전력 공급 판정을 ‘연결망 기준’으로 바꾸세요.</small><button onClick={onConfigure}>공급 판정 설정 열기 →</button></div>}
    <details className="operation-help"><summary>숫자와 연결 상태는 어떻게 읽나요?</summary><p>‘전력 연결’은 발전소에서 건물까지 경로가 있다는 뜻입니다. 경로가 연결되어도 전력이 충분하다는 뜻은 아닙니다. 필요한 전력과 실제 배분된 전력을 함께 보세요.</p><p>빈 값은 ‘미설정’, 0은 ‘실제 0’입니다. 발전소의 발전 출력, 중계시설의 용량, 건물의 수요를 입력하고 ‘적용’을 누르세요.</p><p>제한된 전력은 시설 ID 순서에 따른 경로 탐색으로 배분합니다. 균등 배분, 전압·손실, ESS 충방전은 계산하지 않습니다. 수도는 연결 여부만 판정하며 유량은 계산하지 않습니다.</p></details>
    {balance?.missing.size > 0 && <details><summary>미설정 시설 {balance.missing.size}개</summary>{[...balance.missing].map(([id, fields]) => <button key={id} onClick={() => onFocus(id)}>{facilityName(city.objects.find(o => o.id === id))} · {fields.map(f => ({ generationKW: '발전 출력', demandKW: '소비 수요', capacityKW: '중계 용량' })[f]).join(', ')}</button>)}</details>}
    {problems.length > 0 && <details><summary>전력 확인 필요 {problems.length}개</summary>{problems.map(([id, result]) => <button key={id} onClick={() => onFocus(id)}>{facilityName(city.objects.find(o => o.id === id))} · {statusNames[result.status]}{result.shortage > 0 && ` · ${format(result.shortage)} kW 부족`}</button>)}</details>}
    <h3>고장·복구 확인</h3>
    <p className="operation-step">1. 대상 선택 → 2. 고장 적용 → 3. 영향 확인 → 4. 복구</p>
    <select aria-label="시나리오 고장 대상" value={target} disabled={!!scenario} onChange={e => setTarget(e.target.value)}><option value="">시설 또는 연결선 선택</option>{options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
    {!scenario && selectedTarget && !targetUsesNetwork && <p className="operation-notice partial">이 대상의 공급 판정을 ‘연결망 기준’으로 바꾸면 고장을 적용할 수 있습니다.<button onClick={onConfigure}>공급 판정 설정 열기 →</button></p>}
    <div className="grid-operation-actions"><button disabled={!!scenario || !selectedTarget || !targetUsesNetwork} onClick={() => {
      const selected = options.find(o => o.key === target);
      const result = applyGridFailure(city, selected);
      setScenario({ restore: result.restore, before: service, label: selected.label });
      onChange(result.city); onShowBadges(); onNotice('고장을 적용했습니다. 상태 아이콘과 영향 목록을 확인하세요.');
    }}>고장 적용</button><button disabled={!scenario} onClick={() => { onChange(c => restoreGridFailure(c, scenario.restore)); setScenario(null); onNotice('대상의 원래 운전 상태를 복구했습니다.'); }}>원래 상태 복구</button></div>
    <details className="operation-help"><summary>고장 적용 전에 알아두세요</summary><p>시설 고장은 운전 상태를 ‘고장’으로, 연결선 고장은 ‘공급 경로 사용’을 끔으로 바꿉니다. 다른 정상 경로가 있으면 우회 공급할 수 있습니다.</p><p>고장은 실제 도시에 적용되어 저장에도 반영됩니다. ‘원래 상태 복구’는 대상의 상태만 되돌려 다른 편집을 유지합니다. 탭을 전환하거나 이 창을 닫아도 고장은 유지됩니다.</p><p>복구 기록은 현재 실행 중에만 남습니다. 앱을 다시 켠 뒤에는 시설 속성의 운전 상태 또는 연결선의 공급 경로 사용을 직접 되돌리세요. 실행 취소로도 되돌릴 수 있습니다.</p></details>
    {scenario && <><p>{scenario.label} · 적용 전 대비 상태·공급량 변경 {affected.length}개</p><small>다른 편집이나 실행 취소에 따른 변화도 비교에 반영됩니다. 정상 우회 경로가 있으면 해당 경로를 사용합니다.</small>{affected.map(id => <button className="grid-affected" key={id} onClick={() => onFocus(id)}>{facilityName(city.objects.find(o => o.id === id))} · 영향 시설로 이동</button>)}</>}
  </section>;
}

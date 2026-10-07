import { useEffect, useMemo, useState } from 'react';
import { facilityName } from '../management/facilityProperties.js';
import { CONNECTION_TYPES, DEFAULT_CONNECTION, FLOW_EFFECTS } from './connectionModel.js';
import './connections.css';
import WaypointEditor from './WaypointEditor.jsx';

export default function ConnectionPanel({ city, engine, mode, onMode, onChange, onNotice, selectedId, onSelect, onClose }) {
  const [draft, setDraft] = useState(DEFAULT_CONNECTION);
  const [source, setSource] = useState(null);
  const connections = useMemo(() => city.connections || [], [city.connections]);
  const selected = connections.find(c => c.id === selectedId);
  const value = selected || draft;
  const objects = useMemo(() => new Map(city.objects.map(o => [o.id, o])), [city.objects]);
  const label = id => { const o = objects.get(id); return o ? `${facilityName(o)}${o.properties?.code ? ` · ${o.properties.code}` : ''}` : '시설 없음'; };
  const update = patch => selected ? onChange(c => ({ ...c, connections: c.connections.map(line => line.id === selected.id ? { ...line, ...patch } : line) })) : setDraft(d => ({ ...d, ...patch }));
  useEffect(() => {
    const instance = engine.current;
    if (!instance) return;
    instance.setConnectionPickHandler(id => {
      if (!source || !city.objects.some(o => o.id === source)) { setSource(id); instance.select(id); onNotice('출발 시설 선택 완료 · 도착 시설을 클릭하세요.'); return; }
      if (id === source) { onNotice('다른 도착 시설을 선택하세요.'); return; }
      if (connections.length >= 2000) { onNotice('연결선은 최대 2,000개까지 추가할 수 있습니다.'); return; }
      const line = { ...draft, id: crypto.randomUUID(), from: source, to: id };
      onChange(c => ({ ...c, connections: [...(c.connections || []), line] }));
      setSource(null); instance.select(null); onNotice('연결선을 추가했습니다. 다음 출발 시설을 클릭해 계속 연결하세요.');
    });
    return () => { instance.setConnectionPickHandler(null); };
  }, [engine, city, connections, source, draft, onChange, onNotice]);
  const cancel = () => { setSource(null); engine.current?.select(null); onMode('select'); };
  return <section className="connection-panel glass" aria-label="흐름 연결선">
    <div className="connection-title"><b>시설 연결 <span className="connection-count">{connections.length}개</span></b><button aria-label="연결선 설정 닫기" onClick={() => { cancel(); onClose(); }}>×</button></div>
    <p>{mode === 'connect' ? source ? `출발: ${label(source)} → 도착 시설 클릭` : '출발 시설 A를 클릭하세요.' : '시설 간 관계와 전력·수도 흐름을 표시합니다.'}</p>
    <div className="connection-actions"><button onClick={() => { onSelect(null); setSource(null); onMode('connect'); }}>+ 연결 만들기</button>{mode === 'connect' && <button onClick={cancel}>취소</button>}{selected && <button onClick={() => onSelect(null)}>새 연결 준비</button>}</div>
    <div className="connection-context">{selected ? <><strong>선택한 연결</strong><span>{label(selected.from)} → {label(selected.to)}</span></> : <><strong>새 연결의 기본 설정</strong><span>아래 설정으로 두 시설을 연결합니다.</span></>}</div>
    <label>연결 종류<select value={value.type} onChange={e => update({ type: e.target.value, color: CONNECTION_TYPES.find(t => t.id === e.target.value).color })}>{CONNECTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>색상<input aria-label="연결선 색상" type="color" value={value.color} onChange={e => update({ color: e.target.value })} /></label>
    <label>흐름 효과<select value={value.effect || 'bands'} onChange={e => update({ effect: e.target.value })}>{FLOW_EFFECTS.map(effect => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select></label>
    <label>경로 모양<select value={value.route} onChange={e => update({ route: e.target.value })}><option value="elbow">둥근 꺾은선</option><option value="straight">직선</option></select></label>
    {selected && <WaypointEditor key={selected.id} city={city} line={selected} engine={engine} mode={mode} onMode={onMode} onChange={onChange} onNotice={onNotice} />}
    <details className="connection-section"><summary>흐름 방향·세부 설정</summary>
    <label>흐름 방향<select value={value.direction} onChange={e => update({ direction: e.target.value })}><option value="forward">출발 → 도착</option><option value="reverse">도착 → 출발</option><option value="both">양방향</option></select></label>
    {value.direction === 'both' && <small>양방향 효과는 선의 가운데에서 양쪽으로 흐릅니다.</small>}
    {[['radius', '선 굵기 (반지름)', 0.1, 2, 0.1, 'm'], ['clearance', '시설 위 띄우기', 0.5, 30, 0.5, 'm'], ['speed', '흐름 속도', 0, 20, 0.5, 'm/s']].map(([key, name, min, max, step, unit]) => <label key={key}>{name}<input aria-label={name} type="number" min={min} max={max} step={step} value={value[key]} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) update({ [key]: Math.max(min, Math.min(max, n)) }); }} /><span>{unit}</span></label>)}
    <label>흐름 효과 재생<input type="checkbox" checked={value.animated} onChange={e => update({ animated: e.target.checked })} /></label>
    <label>연결선 표시<input type="checkbox" checked={value.visible} onChange={e => update({ visible: e.target.checked })} /></label>
    <label>이 선으로 공급하기<input type="checkbox" checked={value.enabled !== false} onChange={e => update({ enabled: e.target.checked })} /></label>
    <small>표시와 효과를 꺼도 공급은 유지됩니다. ‘이 선으로 공급하기’를 끄면 연결망 계산에서 이 선을 제외합니다.</small>
    </details>
    <details className="connection-section" open><summary>연결 목록 <span>{connections.length}개</span></summary>
    <div className="connection-list">{connections.map(c => <div key={c.id} className={selectedId === c.id ? 'selected' : ''}><button onClick={() => { cancel(); onSelect(c.id); }}><i style={{ background: c.color }} /><b>{CONNECTION_TYPES.find(t => t.id === c.type).name}</b><span>{label(c.from)} → {label(c.to)}</span></button><button aria-label={`${label(c.from)} 연결 삭제`} onClick={() => { onChange(city => ({ ...city, connections: city.connections.filter(line => line.id !== c.id) })); if (selectedId === c.id) onSelect(null); }}>×</button></div>)}</div>
    {!connections.length && <small>아직 연결선이 없습니다. ‘연결 만들기’를 누른 뒤 두 시설을 차례로 클릭하세요.</small>}
    </details>
    <details className="connection-section"><summary>도시 전체의 공급 기준</summary>
    <small>연결선을 직접 사용할지, 시설 주변 거리로 공급을 판단할지 선택합니다.</small>
    <label>전력 공급<select value={city.powerSupplyMode || 'range'} onChange={e => { const powerSupplyMode = e.target.value; onChange(c => ({ ...c, powerSupplyMode })); }}><option value="range">주변 거리 기준</option><option value="network">연결선 기준</option></select></label>
    <label>수도 공급<select value={city.waterSupplyMode || 'range'} onChange={e => { const waterSupplyMode = e.target.value; onChange(c => ({ ...c, waterSupplyMode })); }}><option value="range">주변 거리 기준</option><option value="network">연결선 기준</option></select></label>
    <details className="connection-help"><summary>공급 기준 알아보기</summary><p>거리 기준은 시설의 공급 반경으로 판단합니다. 연결선 기준은 연결 경로와 시설의 운전 상태를 확인합니다.</p><p>전력량을 계산하려면 시설 설정에서 발전 출력, 전력 수요, 중계 용량을 입력하세요. 입력하지 않은 값은 ‘미설정’으로 표시됩니다.</p><p>수도는 정수장 → 배수지·가압장 → 건물 순으로 연결하세요. 현재는 연결 상태만 확인하며 유량은 계산하지 않습니다.</p></details>
    </details>
  </section>;
}

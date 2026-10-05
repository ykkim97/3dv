import { useEffect, useMemo, useState } from 'react';
import { facilityName } from '../management/facilityProperties.js';
import { CONNECTION_TYPES, DEFAULT_CONNECTION, FLOW_EFFECTS } from './connectionModel.js';
import './connections.css';

export default function ConnectionPanel({ city, engine, mode, onMode, onChange, onNotice, selectedId, onSelect, onClose }) {
  const [draft, setDraft] = useState(DEFAULT_CONNECTION);
  const [source, setSource] = useState(null);
  const connections = useMemo(() => city.connections || [], [city.connections]);
  const selected = connections.find(c => c.id === selectedId);
  const value = selected || draft;
  const objects = useMemo(() => new Map(city.objects.map(o => [o.id, o])), [city.objects]);
  const label = id => { const o = objects.get(id); return o ? `${facilityName(o)}${o.properties?.code ? ` · ${o.properties.code}` : ''} (${o.x}, ${o.z})` : '시설 없음'; };
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
    <div className="connection-title"><b>흐름 연결선 · {connections.length}</b><button aria-label="연결선 설정 닫기" onClick={() => { cancel(); onClose(); }}>×</button></div>
    <p>{mode === 'connect' ? source ? `출발: ${label(source)} → 도착 시설 클릭` : '출발 시설 A를 클릭하세요.' : '시설 간 관계와 전력·수도 흐름을 표시합니다.'}</p>
    <div className="connection-actions"><button onClick={() => { onSelect(null); setSource(null); onMode('connect'); }}>+ 시설 연결</button>{mode === 'connect' && <button onClick={cancel}>취소</button>}{selected && <button onClick={() => onSelect(null)}>새 연결 설정</button>}</div>
    <label>종류<select value={value.type} onChange={e => update({ type: e.target.value, color: CONNECTION_TYPES.find(t => t.id === e.target.value).color })}>{CONNECTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>색상<input aria-label="연결선 색상" type="color" value={value.color} onChange={e => update({ color: e.target.value })} /></label>
    <label>흐름 효과<select value={value.effect || 'bands'} onChange={e => update({ effect: e.target.value })}>{FLOW_EFFECTS.map(effect => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select></label>
    <label>경로<select value={value.route} onChange={e => update({ route: e.target.value })}><option value="elbow">ㄱ자 · 둥근 모서리</option><option value="straight">직선</option></select></label>
    <label>방향<select value={value.direction} onChange={e => update({ direction: e.target.value })}><option value="forward">A → B</option><option value="reverse">B → A</option><option value="both">중앙 → 양쪽</option></select></label>
    {[['radius', '반지름', 0.1, 2, 0.1, 'm'], ['clearance', '시설 위 여유 높이', 0.5, 30, 0.5, 'm'], ['speed', '흐름 속도', 0, 20, 0.5, 'm/s']].map(([key, name, min, max, step, unit]) => <label key={key}>{name}<input aria-label={name} type="number" min={min} max={max} step={step} value={value[key]} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) update({ [key]: Math.max(min, Math.min(max, n)) }); }} /><span>{unit}</span></label>)}
    <label>흐름 애니메이션<input type="checkbox" checked={value.animated} onChange={e => update({ animated: e.target.checked })} /></label>
    <label>연결선 표시<input type="checkbox" checked={value.visible} onChange={e => update({ visible: e.target.checked })} /></label>
    <small>선택한 효과가 흐름 방향으로 이동합니다. 실제 공급량 계산과 독립적인 시각화이며 시설 이동 시 따라갑니다.</small>
    <div className="connection-list">{connections.map(c => <div key={c.id} className={selectedId === c.id ? 'selected' : ''}><button onClick={() => { cancel(); onSelect(c.id); }}><i style={{ background: c.color }} /><b>{CONNECTION_TYPES.find(t => t.id === c.type).name}</b><span>{label(c.from)} → {label(c.to)}</span></button><button aria-label={`${label(c.from)} 연결 삭제`} onClick={() => { onChange(city => ({ ...city, connections: city.connections.filter(line => line.id !== c.id) })); if (selectedId === c.id) onSelect(null); }}>×</button></div>)}</div>
  </section>;
}

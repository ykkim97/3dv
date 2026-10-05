import { useState } from 'react';
import { districtSummary } from './cityExpansion.js';

export default function DistrictPanel({ city, service, onChange, onClose, onLocate }) {
  const [active, setActive] = useState(city.districts?.[0]?.id || '');
  const [name, setName] = useState('주거 단지');
  const [color, setColor] = useState('#78c99e');
  const districts = city.districts || [], selected = districts.find(item => item.id === active);
  const patch = update => onChange(districts.map(item => item.id === active ? { ...item, ...update } : item));
  const summary = selected && districtSummary(city, selected, service);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="expansion-modal glass" role="dialog" aria-modal="true" aria-labelledby="district-title">
    <button className="modal-close" aria-label="구역 관리 닫기" onClick={onClose}>×</button><h2 id="district-title">구역 관리</h2><p>부지를 묶어 이름과 색을 지정하고 기반시설 상태를 확인하세요.</p>
    <div className="expansion-row"><input aria-label="새 구역 이름" maxLength={40} value={name} onChange={e => setName(e.target.value)} /><input aria-label="새 구역 색상" type="color" value={color} onChange={e => setColor(e.target.value)} /><button disabled={!name.trim() || districts.length >= 100} onClick={() => { const id = crypto.randomUUID(); onChange([...districts, { id, name: name.trim(), color, plotIds: [] }]); setActive(id); }}>구역 추가</button></div>
    <select aria-label="편집할 구역" value={selected?.id || ''} onChange={e => setActive(e.target.value)}><option value="">구역 선택</option>{districts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.plotIds.length}개 부지</option>)}</select>
    {selected && <><div className="expansion-row"><input aria-label="구역 이름" maxLength={40} value={selected.name} onChange={e => patch({ name: e.target.value })} /><input type="color" aria-label="구역 표시 색상" value={selected.color} onChange={e => patch({ color: e.target.value })} /><button onClick={() => { onChange(districts.filter(item => item.id !== active)); setActive(''); }}>구역 해제</button></div>
      <div className="district-stats"><span>시설 <b>{summary.objects.length}</b></span><span>전력 <b>{summary.power}/{summary.consumers}</b></span><span>수도 <b>{summary.water}/{summary.consumers}</b></span></div>
      <p>부지는 한 구역에 속합니다. 다른 구역의 부지를 선택하면 이 구역으로 옮깁니다.</p><div className="district-plots">{city.plots.map((plot, i) => <div key={plot.id}><label><input type="checkbox" checked={selected.plotIds.includes(plot.id)} onChange={e => onChange(districts.map(item => ({ ...item, plotIds: item.id === active && e.target.checked ? [...item.plotIds.filter(id => id !== plot.id), plot.id] : item.plotIds.filter(id => id !== plot.id) })))} />부지 {i + 1}<small>{plot.width} × {plot.depth} m · {plot.x.toFixed(0)}, {plot.z.toFixed(0)}</small></label><button onClick={() => onLocate(plot.id)}>위치</button></div>)}</div>
      {!city.plots.length && <p>부지를 먼저 조성해 주세요.</p>}
    </>}
  </section></div>;
}

export function BatchControls({ items, dx, dz, setDx, setDz, onAction, onLock }) {
  const locked = items.some(item => item.locked);
  return <div className="group-controls"><strong>{items.length}개 대상 선택</strong><p>선택한 부지의 시설과 같은 곡선의 도로 구간도 함께 처리합니다.</p><div className="group-offsets"><label>가로<input aria-label="일괄 가로 이동" type="number" min="-80" max="80" step="2" value={dx} onChange={e => setDx(Number(e.target.value))} /> m</label><label>세로<input aria-label="일괄 세로 이동" type="number" min="-80" max="80" step="2" value={dz} onChange={e => setDz(Number(e.target.value))} /> m</label></div><div className="group-actions"><button disabled={locked} onClick={() => onAction('move')}>함께 이동</button><button disabled={locked} onClick={() => onAction('copy')}>함께 복제</button><button disabled={locked} onClick={() => onAction('delete')}>함께 삭제</button>{items.length > 1 && items.every(item => item.asset) && <button disabled={locked} onClick={() => onAction('rotate')}>90° 회전</button>}<button onClick={() => onLock(!locked)}>{locked ? '잠금 해제' : '선택 잠금'}</button></div><small>Shift + 클릭 또는 Shift + 드래그로 다중 선택합니다.</small></div>;
}

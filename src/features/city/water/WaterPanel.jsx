import { useState } from 'react';
import Icon from '../editor/components/CityIcon.jsx';
import { waterSettings, DEFAULT_WATER } from './waterModel.js';

export function WaterControls({ settings, onChange }) {
  return <div className="water-controls"><label><input type="checkbox" checked={settings.enabled} onChange={event => onChange({ enabled: event.target.checked })} /> 수면 표시 · 자동 채우기</label><label><input type="checkbox" checked={settings.flowing} onChange={event => onChange({ flowing: event.target.checked })} /> 흐르는 잔물결 효과</label><label>물 색상 <input aria-label="물 색상" type="color" value={settings.color} onChange={event => onChange({ color: event.target.value })} /></label><label>수면 불투명도 <b>{Math.round(settings.opacity * 100)}%</b><input aria-label="수면 불투명도" type="range" min="0.3" max="1" step="0.05" value={settings.opacity} onChange={event => onChange({ opacity: Number(event.target.value) })} /></label><button onClick={() => onChange({ enabled: !settings.enabled })}><Icon name="water" size={15} />{settings.enabled ? '물 비우기' : '다시 채우기'}</button></div>;
}

export default function WaterPanel({ city, regions, initialId, onChange, onSelect, onClose }) {
  const [active, setActive] = useState(initialId || 'all');
  const region = regions.find(item => item.id === active);
  const settings = region ? waterSettings(city, region) : { ...DEFAULT_WATER, ...city.waterSettings };
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="water-panel glass" role="dialog" aria-modal="true" aria-labelledby="water-panel-title"><button className="modal-close" aria-label="물 설정 닫기" onClick={onClose}><Icon name="close" /></button><h2 id="water-panel-title">물 설정</h2><p>낮은 지형에 수면이 자동 생성됩니다. 연결된 물은 하나의 수역으로 묶입니다.</p><label className="water-region-picker">설정 대상<select aria-label="설정할 수역 선택" value={region ? active : 'all'} onChange={event => { setActive(event.target.value); const next = regions.find(item => item.id === event.target.value); if (next) onSelect(next.id); }}><option value="all">전체 수면 · 기본 설정</option>{regions.map((item, index) => <option key={item.id} value={item.id}>수역 {index + 1} · {item.x.toFixed(0)}, {item.z.toFixed(0)} m{waterSettings(city, item).enabled ? '' : ' · 비움'}</option>)}</select></label><WaterControls settings={settings} onChange={patch => onChange(patch, region)} />{region && <button onClick={() => { onSelect(region.id); onClose(); }}><Icon name="compass" size={16} /> 수역 위치 보기</button>}<p className="water-hint">전체 수면 표시나 흐름을 끄면 개별 수역에도 적용됩니다. 물 비우기는 지형을 바꾸지 않습니다. 잔물결은 시각 효과이며 실제 유체 흐름을 계산하지 않습니다.</p>{!regions.length && <p>아직 수역이 없습니다. 지형을 수면 아래로 낮춰 보세요.</p>}</section></div>;
}

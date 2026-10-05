import { useState } from 'react';
import { assetById, CATEGORIES } from './cityModel';
import Icon from './CityIcon';
import { MAP_LAYERS } from './cityManagement';

export function FacilityDirectory({ city, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const objects = city.objects.filter(object => (category === 'all' || assetById[object.asset].category === category) && assetById[object.asset].name.includes(query.trim()));
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="facility-directory glass" role="dialog" aria-modal="true" aria-labelledby="facility-directory-title">
    <button className="modal-close" aria-label="시설 목록 닫기" onClick={onClose}><Icon name="close" /></button>
    <h2 id="facility-directory-title">도시 시설 목록</h2><p>시설을 선택하면 해당 위치로 이동합니다.</p>
    <div className="directory-filters"><input autoFocus type="search" aria-label="배치된 시설 검색" placeholder="시설 이름 검색" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="시설 카테고리 필터" value={category} onChange={event => setCategory(event.target.value)}><option value="all">전체 카테고리</option>{CATEGORIES.filter(item => !['plot', 'road', 'terrain'].includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    <small>{objects.length}개 표시 · 전체 {city.objects.length}개</small>
    <ul>{objects.map(object => <li key={object.id}><button onClick={() => onSelect(object.id, 'object')}><Icon name={CATEGORIES.find(item => item.id === assetById[object.asset].category).icon} size={19} /><span><strong>{assetById[object.asset].name}</strong><small>{CATEGORIES.find(item => item.id === assetById[object.asset].category).name} · {object.x.toFixed(1)}, {object.z.toFixed(1)} m</small></span><Icon name="compass" size={16} /></button></li>)}</ul>{!objects.length && <p>조건에 맞는 배치된 시설이 없습니다.</p>}
  </section></div>;
}

export function MapLayerControls({ layers, onChange }) {
  return <div className="map-layer-controls" role="group" aria-label="지도 표시 항목">{MAP_LAYERS.map(layer => <button key={layer.id} aria-pressed={layers[layer.id]} onClick={() => onChange(layer.id)} style={{ '--layer-color': layer.color }}><i />{layer.name}</button>)}</div>;
}

export function EditResults({ changes, hasPrevious }) {
  return <div className="edit-results"><strong>최근 편집 결과</strong>{!hasPrevious ? <small>시설을 배치하거나 이동하면 변경 효과가 표시됩니다.</small> : changes.length ? <ul>{changes.map(change => <li key={change.id} className={change.improved ? 'improved' : 'increased'}><span>{change.label}</span><b>{change.before} → {change.value}{change.unit}</b><small>{change.improved ? '부족 감소' : '부족 증가'}</small></li>)}</ul> : <small>이번 편집에서 서비스 부족 수치는 변하지 않았습니다.</small>}<small>직전 편집과 비교 · 철거나 인구 감소도 부족 수치를 낮출 수 있습니다.</small></div>;
}

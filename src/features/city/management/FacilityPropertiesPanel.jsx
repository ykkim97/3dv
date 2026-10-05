import { useState } from 'react';
import { assetById } from '../presets/catalog.js';
import { FACILITY_NUMBERS, FACILITY_STATUSES, facilityNumberFields, facilityPropertiesProblem } from './facilityProperties.js';
import './facilityProperties.css';

export default function FacilityPropertiesPanel({ object, onApply }) {
  const [draft, setDraft] = useState(() => ({ ...object.properties }));
  const [error, setError] = useState('');
  const [invalidNumbers, setInvalidNumbers] = useState({});
  const patch = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setError(''); };
  const changed = JSON.stringify(draft) !== JSON.stringify(object.properties || {});
  const problem = facilityPropertiesProblem(draft);
  const invalid = Object.values(invalidNumbers).some(Boolean);
  return <details className="inspector-details facility-properties" open>
    <summary>시설 속성</summary>
    <form onSubmit={event => {
      event.preventDefault();
      if (invalid || problem || !changed || object.locked) return;
      try { onApply(draft); setError(''); } catch (failure) { setError(failure.message); }
    }}>
      <fieldset disabled={object.locked}>
        <label>시설 이름<input aria-label="시설 이름" value={draft.name || ''} maxLength={60} placeholder={assetById[object.asset].name} onChange={event => patch('name', event.target.value)} /></label>
        <label>설비 번호<input aria-label="설비 번호" value={draft.code || ''} maxLength={40} placeholder="예: SUB-001" onChange={event => patch('code', event.target.value)} /></label>
        <label>운전 상태<select aria-label="운전 상태" value={draft.status || 'running'} onChange={event => patch('status', event.target.value)}>{FACILITY_STATUSES.map(status => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label>
        {facilityNumberFields(object).map(key => {
          const spec = FACILITY_NUMBERS[key];
          return <label key={key}>{spec.label}<span className="facility-number-input"><input aria-label={spec.label} type="number" min={0} max={spec.max} step="any" placeholder="미설정" value={draft[key] ?? ''} onChange={event => {
            const input = event.target;
            setInvalidNumbers(current => ({ ...current, [key]: input.validity.badInput }));
            patch(key, input.value === '' ? undefined : input.valueAsNumber);
          }} /><span>{spec.unit}</span></span></label>;
        })}
        <label>메모<textarea aria-label="시설 메모" rows={2} maxLength={500} value={draft.notes || ''} onChange={event => patch('notes', event.target.value)} /></label>
        <small>입력한 값과 운전 상태는 시설 정보로 저장됩니다. 현재 공급 반경 계산에는 아직 반영되지 않습니다.</small>
        {(error || problem || invalid) && <p className="facility-properties-error" role="alert">{error || problem || '숫자를 올바르게 입력하세요.'}</p>}
        <div className="facility-properties-actions"><button type="submit" disabled={!changed || invalid || !!problem}>적용</button><button type="button" disabled={!changed} onClick={() => { setDraft({ ...object.properties }); setInvalidNumbers({}); setError(''); }}>변경 취소</button></div>
      </fieldset>
      {object.locked && <small>속성을 편집하려면 선택 잠금을 해제하세요.</small>}
    </form>
  </details>;
}

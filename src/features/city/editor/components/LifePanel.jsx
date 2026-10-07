import { LIFE_OPTIONS } from '../../simulation/lifeSettings.js';
import './lifePanel.css';

export default function LifePanel({ settings = {}, onChange, onClose }) {
  const change = (key, value) => onChange({ ...settings, [key]: value });
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="expansion-modal glass life-panel" role="dialog" aria-modal="true" aria-labelledby="life-title">
      <button className="modal-close" aria-label="생활 연출 닫기" onClick={onClose}>×</button>
      <h2 id="life-title">도시 생활 연출</h2>
      <p>도로와 시설 주변에 작은 움직임을 더해보세요. 필요한 연출만 골라 켤 수 있습니다.</p>
      <label className="life-master"><input type="checkbox" checked={settings.enabled !== false} onChange={e => change('enabled', e.target.checked)} />생활 연출 켜기</label>
      <fieldset disabled={settings.enabled === false}><legend className="sr-only">표시할 생활 연출</legend>
        {LIFE_OPTIONS.map(({ key, label, detail }) => <label className="life-option" key={key}>
          <input type="checkbox" checked={settings[key] !== false} onChange={e => change(key, e.target.checked)} />
          <span><b>{label}</b><small>{detail}</small></span>
        </label>)}
      </fieldset>
      <small className="life-help">새는 낮에만 보입니다. 나비·반딧불은 공원·놀이터·수목 주변에 소수만 분산해서 나타납니다. 수증기는 시설의 운전 상태와 무관한 장식입니다. 실제 교통량이나 배출량은 계산하지 않습니다.</small>
      <small className="life-help">움직임이 멈춰 있다면 보기 → 성능 · 화면 품질에서 애니메이션 설정을 확인하세요. 연출 설정은 도시 저장·자동 저장에 함께 보관됩니다.</small>
    </section>
  </div>;
}

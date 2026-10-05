import { useEffect, useState } from 'react';
import { DEFAULT_ENVIRONMENT } from './dayLighting.js';

export default function LightingPanel({ value, engine, onChange, onClose }) {
  const settings = { ...DEFAULT_ENVIRONMENT, ...value };
  const [liveHour, setLiveHour] = useState(settings.hour);
  useEffect(() => {
    const timer = setInterval(() => setLiveHour(engine.current?.hour ?? settings.hour), 1000);
    return () => clearInterval(timer);
  }, [engine, settings.hour]);
  const hour = liveHour;
  const update = patch => { if (patch.hour !== undefined) setLiveHour(patch.hour); onChange({ ...settings, ...patch }); };
  const previewTime = hour => {
    setLiveHour(hour);
    engine.current?.previewTimeOfDay(hour);
  };
  const commitTime = () => update({ hour: engine.current?.hour ?? liveHour, autoCycle: false });
  return <section className="lighting-panel glass" aria-label="시간과 조명">
    <div className="lighting-title"><b>시간 · 조명</b><button aria-label="조명 설정 닫기" onClick={onClose}>×</button></div>
    <label>도시 시간 <strong>{`${Math.floor(hour).toString().padStart(2, '0')}:${Math.floor(hour % 1 * 60).toString().padStart(2, '0')}`}</strong>
      <input aria-label="도시 시간" type="range" min="0" max="23.75" step="0.25" value={hour} onChange={e => previewTime(Number(e.target.value))} onPointerUp={commitTime} onKeyUp={commitTime} onBlur={commitTime} /></label>
    <div className="lighting-presets">{[['새벽', 5.5], ['낮', 12], ['노을', 18], ['밤', 22]].map(([name, time]) => <button key={name} onClick={() => update({ hour: time, autoCycle: false })}>{name}</button>)}</div>
    <label className="lighting-cycle"><span><input type="checkbox" checked={settings.autoCycle} onChange={e => update({ autoCycle: e.target.checked, hour: engine.current?.hour ?? settings.hour })} />시간 자동 순환</span>
      <select aria-label="하루 순환 시간" value={settings.cycleMinutes} onChange={e => update({ cycleMinutes: Number(e.target.value), hour: engine.current?.hour ?? settings.hour })}>{[2, 5, 10, 20, 60].map(minutes => <option key={minutes} value={minutes}>하루 {minutes}분</option>)}</select></label>
    <small>창문·가로등·정류장·교량은 해가 지면 자동 점등됩니다.</small>
  </section>;
}

import { useEffect, useState } from 'react';
import { editWaypoint, MAX_WAYPOINTS } from './connectionModel.js';

export default function WaypointEditor({ city, line, engine, mode, onMode, onChange, onNotice }) {
  const [index, setIndex] = useState(-1);
  const points = line.waypoints || [];
  const editing = mode === 'waypoint';
  const change = (action, at, point) => {
    try { const next = editWaypoint(city, line.id, action, at, point); if (next !== city) onChange(next); }
    catch (error) { onNotice(error.message); }
  };
  useEffect(() => {
    const instance = engine.current;
    if (!instance || !['select', 'waypoint'].includes(mode)) return;
    instance.showConnectionWaypoints(line.id, index, city);
    return () => { instance.finishWaypointPointer(null, true); instance.clearConnectionWaypoints(); };
  }, [city, line.id, engine, mode, index]);
  return <details className="waypoint-editor" open>
    <summary>경로 편집 <span>경유점 {points.length}개</span></summary>
    <p>선을 클릭해 경유점을 추가하고, 화면의 점을 드래그해 경로를 바꾸세요.</p>
    <div className="connection-actions">
      <button disabled={points.length >= MAX_WAYPOINTS} onClick={() => { setIndex(-1); onMode('waypoint'); }}>+ 경유점 추가</button>
      {editing && <button onClick={() => onMode('select')}>편집 완료</button>}
      {!!points.length && <button onClick={() => { onMode('select'); change('clear'); }}>경로 초기화</button>}
    </div>
    {editing && <p role="status">선택한 선을 클릭해 추가 · 구슬을 드래그해 이동 · Esc로 추가 모드를 종료합니다.</p>}
    {!!points.length && <details className="waypoint-coordinates"><summary>좌표·순서 직접 수정</summary><ol>{points.map((p, i) => <li key={i}>
      <b>{i + 1}</b>
      {['x', 'z'].map(axis => <label key={axis}>{axis.toUpperCase()}<input aria-label={`${i + 1}번 경유점 ${axis.toUpperCase()}`} type="number" step="1" value={p[axis]} onChange={e => { if (Number.isFinite(e.target.valueAsNumber)) change('move', i, { ...p, [axis]: e.target.valueAsNumber }); }} /></label>)}
      <div className="connection-actions"><button onClick={() => { setIndex(i); onMode('select'); onNotice(`${i + 1}번 경유점을 표시했습니다. 노란 점을 드래그하세요.`); }}>화면에서 표시</button><button disabled={i === 0} aria-label={`${i + 1}번 경유점 앞으로`} onClick={() => change('up', i)}>↑</button><button disabled={i === points.length - 1} aria-label={`${i + 1}번 경유점 뒤로`} onClick={() => change('down', i)}>↓</button><button onClick={() => { onMode('select'); change('remove', i); }}>삭제</button></div>
    </li>)}</ol></details>}
    <details className="connection-help"><summary>경로 편집 도움말</summary><small>‘경유점 추가’를 누른 뒤 선택한 선을 클릭하세요. 최대 {MAX_WAYPOINTS}개까지 추가할 수 있습니다. 점을 드래그하면 높이는 자동으로 맞춰집니다. 경로를 초기화하면 선택한 직선 또는 꺾은선으로 돌아갑니다. Ctrl + Z로 되돌릴 수 있습니다.</small></details>
  </details>;
}

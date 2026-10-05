

export default function CopyControls({ count, setCount, gap, setGap, direction, setDirection, onCopy, problem }) {
  return <div className="copy-controls"><strong>같은 간격으로 복제</strong><div className="copy-inputs"><label>개수<input aria-label="복제 개수" type="number" min="1" max="12" step="1" value={count} onChange={e => setCount(Number(e.target.value))} /></label><label>간격<input aria-label="복제 간격" type="number" min="0" max="10" step="0.5" value={gap} onChange={e => setGap(Number(e.target.value))} /> m</label></div><div className="copy-actions"><select aria-label="복제 방향" value={direction} onChange={e => setDirection(e.target.value)}><option value="x+">동쪽 →</option><option value="x-">서쪽 ←</option><option value="z+">북쪽 ↑</option><option value="z-">남쪽 ↓</option></select><button disabled={!!problem} onClick={onCopy}>연속 복제</button></div><small className={problem ? 'copy-problem' : 'copy-ready'}>{problem || `${count}개 배치 가능`}</small></div>;
}

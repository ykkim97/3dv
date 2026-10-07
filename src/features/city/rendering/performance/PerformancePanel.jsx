import { useEffect, useState } from 'react';
import { QUALITY_PRESETS } from './renderQuality.js';
import './performance.css';

export default function PerformancePanel({ engine, value, onChange, onClose }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const instance = engine.current;
    if (!instance) return;
    instance.setPerformanceMonitoring(true);
    const refresh = () => setStats(instance.performanceSnapshot());
    refresh(); const timer = setInterval(refresh, 500);
    return () => { clearInterval(timer); instance.setPerformanceMonitoring(false); };
  }, [engine]);
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="performance-panel glass" role="dialog" aria-modal="true" aria-labelledby="performance-title" onClick={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}>
      <button className="modal-close" aria-label="성능 설정 닫기" onClick={onClose}>×</button>
      <h2 id="performance-title">성능 · 화면 품질</h2>
      <p>같은 시점에서 품질을 바꾸고 2~3초 후 수치를 비교하세요. FPS는 실제로 그린 프레임의 빈도이며 GPU 처리 시간은 별도로 측정하지 않습니다.</p>
      <dl className="performance-metrics">{[['프레임', stats ? `${stats.fps.toFixed(1)} FPS` : '측정 중'], ['평균 렌더 호출', stats ? `${stats.renderMS.toFixed(1)} ms` : '—'], ['드로 콜', stats?.drawCalls ?? '—'], ['활성 / 전체 메시', stats ? `${stats.activeMeshes} / ${stats.meshes}` : '—'], ['렌더 해상도', stats ? `${stats.width} × ${stats.height}` : '—'], ['연결선 / 렌더 묶음', stats ? `${stats.connections} / ${stats.batches}` : '—']].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
      <label>화면 품질<select value={value.preset} onChange={e => onChange({ ...value, preset: e.target.value })}>{QUALITY_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <p>{QUALITY_PRESETS.find(p => p.id === value.preset).description}</p>
      <label>프레임 상한<select value={value.fpsLimit} onChange={e => onChange({ ...value, fpsLimit: Number(e.target.value) })}><option value={60}>60 FPS · 부드럽게</option><option value={30}>30 FPS · 전력 절약</option></select></label>
      <label>흐름·물·생활 애니메이션<input type="checkbox" checked={value.motion} onChange={e => onChange({ ...value, motion: e.target.checked })} /></label>
      <p>애니메이션을 꺼도 연결망 판정은 유지됩니다. 설정은 이 기기에 저장됩니다. 창이 숨겨지거나 매뉴얼이 열리면 장면 렌더링을 쉬게 합니다.</p>
      <button onClick={onClose}>설정 완료</button>
    </section>
  </div>;
}

import { useState } from 'react';

export default function CameraPanel({ views, onAdd, onRemove, onView, onExport, onClose }) {
  const [name, setName] = useState('도시 전경');
  const [exporting, setExporting] = useState(false);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="expansion-modal glass" role="dialog" aria-modal="true" aria-labelledby="camera-title"><button className="modal-close" aria-label="시점 저장 닫기" onClick={onClose}>×</button><h2 id="camera-title">시점 · 이미지 저장</h2><p>현재 카메라 위치를 저장하고 원하는 도시 전경으로 돌아오세요.</p><div className="expansion-row"><input aria-label="시점 이름" maxLength={40} value={name} onChange={e => setName(e.target.value)} /><button disabled={!name.trim() || views.length >= 30} onClick={() => onAdd(name.trim())}>현재 시점 저장</button></div><div className="district-plots">{views.map(view => <div key={view.id}><button onClick={() => onView(view)}>{view.name}</button><button aria-label={`${view.name} 시점 삭제`} onClick={() => onRemove(view.id)}>삭제</button></div>)}</div>{!views.length && <p>아직 저장한 시점이 없습니다.</p>}<button disabled={exporting} onClick={async () => { setExporting(true); try { await onExport(); } finally { setExporting(false); } }}>{exporting ? '이미지 저장 중…' : '도시 이미지 저장 · PNG'}</button><p>편집 UI를 제외한 3D 화면을 현재 해상도로 저장합니다. 즐겨찾기는 도시 파일에 함께 저장됩니다.</p></section></div>;
}

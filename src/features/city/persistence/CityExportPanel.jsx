import { useState } from 'react';
import Icon from '../editor/components/CityIcon.jsx';
import { cityFileName } from './cityFiles.js';
import { isTauriRuntime } from '../../../platform/desktopFiles.js';

export default function CityExportPanel({ cityName, onClose, onSave }) {
  const [name, setName] = useState(cityName || '나의 도시');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canChoosePath = isTauriRuntime() || typeof window.showSaveFilePicker === 'function';
  let fileName;
  try { fileName = cityFileName(name); } catch { /* Show validation when submitting. */ }
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await onSave(name); } catch (error) { setError(error.message || String(error)); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onClick={() => { if (!busy) onClose(); }}>
    <section className="city-export-modal glass" role="dialog" aria-modal="true" aria-labelledby="city-export-title" onClick={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !busy) onClose(); }}>
      <button className="modal-close" aria-label="내보내기 닫기" disabled={busy} onClick={onClose}><Icon name="close" /></button>
      <h2 id="city-export-title">도시 파일 내보내기</h2>
      <form onSubmit={submit}>
        <label htmlFor="city-export-name">파일 이름</label>
        <input id="city-export-name" value={name} maxLength={100} onChange={event => setName(event.target.value)} disabled={busy} autoFocus />
        <p className="export-filename">{fileName || '파일 이름을 입력해 주세요.'}</p>
        <p>{canChoosePath ? '다음 화면에서 저장할 폴더와 최종 파일 이름을 선택하세요.' : '이 브라우저는 저장 경로 선택을 지원하지 않습니다. 다운로드 설정에 따라 저장됩니다. 경로를 직접 선택하려면 데스크톱 앱이나 Chrome·Edge를 이용하세요.'}</p>
        {error && <p role="alert" className="export-error">저장 실패: {error}</p>}
        <div className="export-actions"><button type="button" disabled={busy} onClick={onClose}>취소</button><button type="submit" disabled={busy || !fileName}>{busy ? '저장 중…' : canChoosePath ? '저장 위치 선택' : '다운로드'}</button></div>
      </form>
    </section>
  </div>;
}

import { useEffect, useRef } from 'react';
import ManualPage from './ManualPage.jsx';

export default function ManualDialog({ onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog className="manual-dialog" ref={dialog} aria-label="도시 편집기 매뉴얼" onCancel={event => { event.preventDefault(); onClose(); }}><ManualPage onClose={onClose} /></dialog>;
}

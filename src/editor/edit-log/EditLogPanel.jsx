import { useEffect, useRef } from "react";

export default function EditLogPanel({ logs = [], open, onToggle, onClear }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [logs, open]);

  return (
    <section className={`edit-log-panel ${open ? "open" : "collapsed"}`} aria-label="Edit log terminal">
      <button className="edit-log-tab" type="button" onClick={onToggle} aria-expanded={open}>
        <span className="edit-log-led" aria-hidden />
        <span className="edit-log-title">EDIT LOG</span>
        <span className="edit-log-count">{logs.length}</span>
        <span className="edit-log-chevron">{open ? "▾" : "▴"}</span>
      </button>
      {open ? (
        <div className="edit-log-console">
          <div className="edit-log-toolbar">
            <span>terminal://lumatrix/editor-actions</span>
            <button className="edit-log-clear" type="button" onClick={onClear}>Clear</button>
          </div>
          <div className="edit-log-body" ref={bodyRef}>
            {logs.length ? logs.map((entry) => (
              <div key={entry.id} className="edit-log-line">
                <span className="edit-log-time">[{entry.time}]</span>
                <span className={`edit-log-action action-${String(entry.action || "log").toLowerCase()}`}>{entry.action}</span>
                <span className="edit-log-message">{entry.message}</span>
              </div>
            )) : <div className="edit-log-empty">No edit actions yet.</div>}
          </div>
        </div>
      ) : null}
    </section>
  );
}

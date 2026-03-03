// src/components/RenameModal.jsx
import { useEffect, useMemo, useState } from "react";
import ModalShell from "./ModalShell.jsx";

export default function RenameModal({ open, title = "Rename", initialValue = "", onClose, onSubmit, validate }) {
  const [value, setValue] = useState(String(initialValue ?? ""));

  useEffect(() => {
    if (open) setValue(String(initialValue ?? ""));
  }, [open, initialValue]);

  const err = useMemo(() => {
    const v = String(value ?? "").trim();
    if (!v) return "이름을 입력해 주세요.";
    if (typeof validate === "function") return validate(v);
    return null;
  }, [value, validate]);

  return (
    <ModalShell open={open} title={title} width={520} zIndex={215} onClose={onClose}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          {err ? (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--warn)", fontWeight: 800 }}>{err}</div>
          ) : null}
        </div>
      </div>

      <div className="modal-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost" type="button" onClick={() => onClose && onClose()}>Cancel</button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            const v = String(value ?? "").trim();
            if (err) return;
            onSubmit && onSubmit(v);
          }}
          disabled={!!err}
        >
          OK
        </button>
      </div>
    </ModalShell>
  );
}

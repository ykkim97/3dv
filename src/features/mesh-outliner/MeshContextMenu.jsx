// src/components/MeshContextMenu.jsx
import { useEffect, useRef } from "react";

function MenuItem({ label, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      className={`mesh-ctx-item ${danger ? "danger" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

export default function MeshContextMenu({ open, x = 0, y = 0, onClose, onFrame, onRename, onDelete, onOpenProperties, onGroup, onUngroup, canGroup = false, canUngroup = false, t = (s) => s }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (ev) => {
      const el = ref.current;
      if (!el) return;
      if (ev.target && el.contains(ev.target)) return;
      if (onClose) onClose();
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        if (onClose) onClose();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const left = Math.max(8, Math.min(x, window.innerWidth - 220));
  const top = Math.max(8, Math.min(y, window.innerHeight - 220));

  return (
    <div
      ref={ref}
      className="mesh-context-menu"
      style={{
        left,
        top,
      }}
      role="menu"
      aria-label="Mesh actions"
    >
      <MenuItem label={t("ctx.frame")} onClick={() => { onFrame && onFrame(); onClose && onClose(); }} />
      <MenuItem label={t("ctx.properties")} onClick={() => { onOpenProperties && onOpenProperties(); onClose && onClose(); }} />
      <MenuItem label={t("ctx.rename")} onClick={() => { onRename && onRename(); onClose && onClose(); }} />

      {canGroup || canUngroup ? (
        <>
          <div className="mesh-ctx-separator" />
          {canGroup ? (
            <MenuItem label={t("ctx.group")} onClick={() => { onGroup && onGroup(); onClose && onClose(); }} />
          ) : null}
          {canUngroup ? (
            <MenuItem label={t("ctx.ungroup")} onClick={() => { onUngroup && onUngroup(); onClose && onClose(); }} />
          ) : null}
        </>
      ) : null}

      <div className="mesh-ctx-separator" />
      <MenuItem label={t("ctx.delete")} danger onClick={() => { onDelete && onDelete(); onClose && onClose(); }} />
    </div>
  );
}

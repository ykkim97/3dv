// src/components/ModalShell.jsx

export default function ModalShell({
  open,
  title,
  subtitle,
  width = 860,
  zIndex = 190,
  onClose,
  children,
}) {
  if (!open) return null;

  return (
    <div className="overlay overlay-backdrop" style={{ zIndex }}>
      <div className="modal" style={{ width, maxWidth: "96vw" }}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="btn btn-ghost" type="button" onClick={() => onClose && onClose()} aria-label="Close">✕</button>
        </div>
        {subtitle ? <div className="modal-sub">{subtitle}</div> : null}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

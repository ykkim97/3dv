// src/components/ViewPresetBar.jsx

import IconButton from "./IconButton";

export default function ViewPresetBar({
  disabled = false,
  headerVisible = true,
  snapEnabled = false,
  snapMove = 0.5,
  onToggleSnap,
  onChangeSnapMove,
  onUndo,
  onRedo,
  onToggleGrid,
  gridVisible,
  onToggleAxes,
  axesVisible,
  onSetView,
  onFrame,
  t = (s) => s,
}) {
  const items = [
    { key: "front", label: t("viewbar.front") },
    { key: "top", label: t("viewbar.top") },
    { key: "bottom", label: t("viewbar.bottom") },
    { key: "left", label: t("viewbar.left") },
    { key: "right", label: t("viewbar.right") },
    { key: "iso", label: t("viewbar.iso") },
  ];

  return (
    <div className="viewbar" role="toolbar" aria-label={t("viewbar.aria")}>
      <div className="viewbar-inner">
        {headerVisible && (
          <>
            <IconButton title={t("scene.undo")} onClick={() => onUndo && onUndo()} className="viewbar-icon" disabled={disabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 7v6h-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 12a9 9 0 0114.32-7.36L21 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </IconButton>

            <IconButton title={t("scene.redo")} onClick={() => onRedo && onRedo()} className="viewbar-icon" disabled={disabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 17v-6h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12a9 9 0 01-14.32 7.36L3 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </IconButton>

            <div className="viewbar-divider" />

            <IconButton title={t("scene.grid")} onClick={() => onToggleGrid && onToggleGrid()} className={`viewbar-icon ${gridVisible ? 'active' : ''}`} disabled={disabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/></svg>
            </IconButton>

            <IconButton title={t("scene.axes")} onClick={() => onToggleAxes && onToggleAxes()} className={`viewbar-icon ${axesVisible ? 'active' : ''}`} disabled={disabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M2 12h20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </IconButton>

            <div className="viewbar-divider" />

            <IconButton title={t("snap.toggle")} onClick={() => onToggleSnap && onToggleSnap()} className={`viewbar-icon ${snapEnabled ? 'active' : ''}`} disabled={disabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </IconButton>

            <label className="viewbar-field compact" title={t("snap.move")}>
              <span className="viewbar-field-label">SNAP</span>
              <select
                className="viewbar-select"
                value={snapMove}
                disabled={disabled || !snapEnabled}
                onChange={(ev) => onChangeSnapMove && onChangeSnapMove(Number(ev.target.value))}
              >
                <option value={0.1}>0.1</option>
                <option value={0.25}>0.25</option>
                <option value={0.5}>0.5</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>

            <div className="viewbar-divider" />
          </>
        )}

        {items.map((it) => (
          <IconButton
            key={it.key}
            type="button"
            className={`viewbar-icon viewbar-preset preset-${it.key}`}
            disabled={disabled}
            onClick={() => onSetView && onSetView(it.key)}
            title={it.label}
          >
            <div className="viewbar-icon-graphic" aria-hidden>
            {(() => {
              switch (it.key) {
                case 'front':
                  return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2"/><path d="M5 9h14" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/></svg>
                  );
                case 'top':
                  return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M3 8v6l9 5 9-5V8" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/></svg>
                  );
                case 'bottom':
                  return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 6v8l9 5 9-5V6l-9 5-9-5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5 8h14" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/></svg>
                  );
                case 'left':
                  return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M14 6v12" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/></svg>
                  );
                case 'right':
                  return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="10" y="6" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M10 6v12" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/></svg>
                  );
                case 'iso':
                default:
                  return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v8l-8 4-8-4V6l8-4z" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M12 6v12" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/></svg>
                  );
              }
            })()}
            </div>
            <span className="viewbar-icon-label">{it.label}</span>
          </IconButton>
        ))}

        <IconButton title={t("viewbar.frame")} onClick={() => onFrame && onFrame()} className="viewbar-icon preset-frame" disabled={disabled}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" stroke="currentColor" strokeWidth="1.2"/></svg>
        </IconButton>
      </div>
    </div>
  );
}

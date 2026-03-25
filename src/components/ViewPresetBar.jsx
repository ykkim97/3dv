// src/components/ViewPresetBar.jsx

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
            <button
              className="viewbar-btn"
              title="Undo (Ctrl+Z)"
              type="button"
              disabled={disabled}
              onClick={() => onUndo && onUndo()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 7v6h-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 12a9 9 0 0114.32-7.36L21 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{t("scene.undo")}</span>
            </button>

            <button
              className="viewbar-btn"
              title="Redo (Ctrl+Y)"
              type="button"
              disabled={disabled}
              onClick={() => onRedo && onRedo()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 17v-6h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12a9 9 0 01-14.32 7.36L3 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{t("scene.redo")}</span>
            </button>

            <div className="viewbar-divider" />

            <button
              className={`viewbar-btn ${gridVisible ? "active" : ""}`}
              title="Toggle Grid"
              type="button"
              disabled={disabled}
              onClick={() => onToggleGrid && onToggleGrid()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2"/></svg>
              <span>{t("scene.grid")}</span>
            </button>

            <button
              className={`viewbar-btn ${axesVisible ? "active" : ""}`}
              title="Toggle Axes"
              type="button"
              disabled={disabled}
              onClick={() => onToggleAxes && onToggleAxes()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M2 12h20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              <span>{t("scene.axes")}</span>
            </button>

            <div className="viewbar-divider" />

            <button
              className={`viewbar-btn ${snapEnabled ? "active" : ""}`}
              title={t("snap.title")}
              type="button"
              disabled={disabled}
              onClick={() => onToggleSnap && onToggleSnap()}
            >
              <span>{t("snap.toggle")}</span>
            </button>

            <label className="viewbar-field" title={t("snap.move")}
            >
              <span className="viewbar-field-label">{t("snap.move")}</span>
              <select
                className="viewbar-select"
                value={String(snapMove)}
                disabled={disabled || !snapEnabled}
                onChange={(e) => onChangeSnapMove && onChangeSnapMove(Number(e.target.value))}
              >
                <option value="0.1">0.1</option>
                <option value="0.5">0.5</option>
                <option value="1">1</option>
              </select>
            </label>

            <label className="viewbar-field" title={t("snap.rotate")}
            >
              <span className="viewbar-field-label">{t("snap.rotate")}</span>
              <select className="viewbar-select" value="15" disabled>
                <option value="15">15°</option>
              </select>
            </label>

            <label className="viewbar-field" title={t("snap.scale")}
            >
              <span className="viewbar-field-label">{t("snap.scale")}</span>
              <select className="viewbar-select" value="0.1" disabled>
                <option value="0.1">0.1</option>
              </select>
            </label>

            <div className="viewbar-divider" />
          </>
        )}

        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            className="viewbar-btn"
            disabled={disabled}
            onClick={() => onSetView && onSetView(it.key)}
            title={it.label}
          >
            {it.label}
          </button>
        ))}
        <button
          className="viewbar-btn"
          title={t("viewbar.frame")}
          type="button"
          disabled={disabled}
          onClick={() => onFrame && onFrame()}
        >
          <span>{t("viewbar.frame")}</span>
        </button>
      </div>
    </div>
  );
}

const TOOLS = [
  {
    key: "select",
    title: "Select",
    label: "Q",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M5 4.5 18.5 10.5 12 12.6 10 19.5 5 4.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: "cursor",
    title: "Cursor",
    label: "C",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    key: "move",
    title: "Move",
    label: "G",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: "rotate",
    title: "Rotate",
    label: "R",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M20 11a8 8 0 1 1-2.34-5.66L20 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20 4v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: "scale",
    title: "Scale",
    label: "S",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M15 9h4V5M9 15H5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: "measure",
    title: "Measure",
    label: "D",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M4 16 16 4l4 4L8 20H4v-4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="m12 8 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function ViewportModeToolbar({ activeMode = "move", disabled = false, onChange, snapEnabled = false, snapMove = 0.5, onToggleSnap, onChangeSnapMove }) {
  return (
    <div className="viewport-mode-toolbar" role="toolbar" aria-label="Viewport tools">
      {TOOLS.map((tool) => (
        <button
          key={tool.key}
          type="button"
          className={`viewport-mode-btn ${activeMode === tool.key ? "active" : ""}`}
          onClick={() => onChange && onChange(tool.key)}
          disabled={disabled}
          title={`${tool.title} (${tool.label})`}
          aria-pressed={activeMode === tool.key}
        >
          <span className="viewport-mode-btn-icon">{tool.icon}</span>
          <span className="viewport-mode-btn-key">{tool.label}</span>
        </button>
      ))}

      <button
        type="button"
        className={`viewport-mode-btn viewport-mode-btn-snap ${snapEnabled ? "active" : ""}`}
        onClick={() => onToggleSnap && onToggleSnap()}
        disabled={disabled}
        title={`Snap (${snapEnabled ? "On" : "Off"})`}
        aria-pressed={snapEnabled}
      >
        <span className="viewport-mode-btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M7 3v4M12 3v4M17 3v4M3 7h18M7 17h10M7 12h10M7 21h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="viewport-mode-btn-key">SN</span>
      </button>

      <div className={`viewport-snap-panel ${snapEnabled ? "active" : ""}`}>
        <div className="viewport-snap-label">SNAP</div>
        <select
          className="viewport-snap-select"
          value={String(snapMove)}
          disabled={disabled || !snapEnabled}
          onChange={(e) => onChangeSnapMove && onChangeSnapMove(Number(e.target.value))}
          title="Snap distance"
        >
          <option value="0.1">0.1</option>
          <option value="0.5">0.5</option>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </div>
    </div>
  );
}
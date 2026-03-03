// src/components/TopBar.jsx

export default function TopBar({ onToggleGrid, gridVisible, onToggleHeader, headerVisible, onImport, onToggleGizmo, gizmoVisible, onShowShortcuts }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand">
          <div className="topbar-title">3DV</div>
          <div className="topbar-sub">Scene Editor</div>
        </div>

        <nav className="topbar-menu" aria-label="Top menu">
          <button className="topbar-menu-btn" type="button">File</button>
          <button className="topbar-menu-btn" type="button">Edit</button>
          <button className="topbar-menu-btn" type="button">Help</button>
        </nav>
      </div>

      <div className="topbar-right">
        <button title="Import Scene" onClick={() => onImport && onImport()} className="topbar-action" type="button">
          Import
        </button>

        <button
          title={headerVisible ? "Hide scene header" : "Show scene header"}
          onClick={() => onToggleHeader && onToggleHeader()}
          className={`icon-btn icon-toggle ${headerVisible ? "active" : ""}`}
          type="button"
        >
          {headerVisible ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/></svg>
          )}
        </button>
        <button
          className={`icon-btn icon-toggle ${gridVisible ? "active" : ""}`}
          onClick={() => onToggleGrid && onToggleGrid()}
          title="Toggle Grid"
          type="button"
        >
          {/* simple grid icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: "var(--text)" }}>
            <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2" />
            <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2" />
            <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2" />
            <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          title={gizmoVisible ? "Hide gizmo" : "Show gizmo"}
          onClick={() => onToggleGizmo && onToggleGizmo()}
          className={`icon-btn icon-toggle ${gizmoVisible ? "active" : ""}`}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v6M12 22v-6M2 12h6M22 12h-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button
          title="Shortcuts"
          onClick={() => onShowShortcuts && onShowShortcuts()}
          className="icon-btn icon-toggle"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.2"/><text x="12" y="16" fontSize="12" textAnchor="middle" fill="currentColor">?</text></svg>
        </button>
      </div>
    </header>
  );
}
// src/components/TopBar.jsx
import IconButton from "./IconButton";

export default function TopBar({ onToggleGrid, gridVisible, onToggleHeader, headerVisible, onImport, onToggleGizmo, gizmoVisible, onShowShortcuts, onShowHelp, onShowTools, runtimeMode, onToggleRuntimeMode, runtimeDisabled = false, theme = "dark", onToggleTheme, lang = "ko", onToggleLang, t = (s) => s }) {
  const openSceneCode = () => {
    try {
      const fn = (window && window.__showSceneCode) ? window.__showSceneCode : null;
      if (typeof fn === "function") fn();
    } catch {
      if (onShowTools) onShowTools();
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand">
          <div className="topbar-title">Lumatrix</div>
          <div className="topbar-sub">Scene Editor</div>
        </div>

        <nav className="topbar-menu" aria-label="Top menu">
          <button className="topbar-menu-btn" type="button">File</button>
          <button className="topbar-menu-btn" type="button">Edit</button>
          <button className="topbar-menu-btn" type="button" onClick={() => onShowHelp && onShowHelp()}>{t("topbar.help")}</button>
          <button id="topbar-tools-btn" className="topbar-menu-btn" type="button" onClick={() => onShowTools && onShowTools()}>Tools</button>
        </nav>
      </div>

      <div className="topbar-center" aria-label="Editor status">
        <span className={`topbar-status-dot ${runtimeMode ? "running" : ""}`} />
        <span className="topbar-status-primary">{runtimeMode ? "Runtime" : "Edit"}</span>
        <span className="topbar-status-secondary">{runtimeMode ? "playing scene" : "scene workspace"}</span>
      </div>

      <div className="topbar-right">
        <div className="topbar-action-group">
          <IconButton
            title={runtimeDisabled ? t("topbar.runtimeDisabled") : (runtimeMode ? t("topbar.runtimeOn") : t("topbar.runtimeOff"))}
            onClick={() => { if (!runtimeDisabled) onToggleRuntimeMode && onToggleRuntimeMode(); }}
            className={`topbar-tool-btn topbar-run-btn ${runtimeMode ? "active" : ""}`}
            disabled={runtimeDisabled}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M8 5v14l12-7-12-7Z" fill="currentColor" />
            </svg>
            <span>{t("topbar.run")}</span>
          </IconButton>

          <IconButton title={t("topbar.import")} onClick={() => onImport && onImport()} className="topbar-tool-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M12 3v12M8 7l4-4 4 4M4 21h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t("topbar.import")}</span>
          </IconButton>

          <button title="Show Scene JSON" onClick={openSceneCode} className="topbar-tool-btn" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M7 4h7l4 4v12H7V4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M14 4v5h5M10 13h6M10 16h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Code</span>
          </button>
        </div>

        <div className="topbar-action-group compact">
          <IconButton
            title={theme === "dark" ? t("topbar.themeToLight") : t("topbar.themeToDark")}
            onClick={() => onToggleTheme && onToggleTheme()}
            className={`topbar-icon-btn ${theme === "dark" ? "active" : ""}`}
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z" fill="currentColor" opacity="0.95" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M12 18a6 6 0 1 0 0-12a6 6 0 0 0 0 12Z" fill="currentColor" opacity="0.95" />
                <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            )}
          </IconButton>

          <IconButton title={t("topbar.lang")} onClick={() => onToggleLang && onToggleLang()} className="topbar-icon-btn lang-btn">
            {lang === "ko" ? "KO" : "EN"}
          </IconButton>
        </div>

        <div className="topbar-action-group compact">
        <button
          title={headerVisible ? "Hide scene header" : "Show scene header"}
          onClick={() => onToggleHeader && onToggleHeader()}
          className={`topbar-icon-btn ${headerVisible ? "active" : ""}`}
          type="button"
        >
          {headerVisible ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/></svg>
          )}
        </button>
        <button
          className={`topbar-icon-btn ${gridVisible ? "active" : ""}`}
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
          title={runtimeMode ? "Disabled in runtime mode" : (gizmoVisible ? "Hide gizmo" : "Show gizmo")}
          onClick={() => { if (!runtimeMode) onToggleGizmo && onToggleGizmo(); }}
          className={`topbar-icon-btn ${gizmoVisible ? "active" : ""}`}
          type="button"
          disabled={runtimeMode}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v6M12 22v-6M2 12h6M22 12h-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button
          title="Shortcuts"
          onClick={() => onShowShortcuts && onShowShortcuts()}
          className="topbar-icon-btn"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.2"/><text x="12" y="16" fontSize="12" textAnchor="middle" fill="currentColor">?</text></svg>
        </button>
        </div>
      </div>
    </header>
  );
}

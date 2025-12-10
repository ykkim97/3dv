// src/components/TopBar.jsx
import React from "react";

export default function TopBar({ onToggleGrid, gridVisible }) {
  return (
    <header
      style={{
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px",
        background: "linear-gradient(180deg, #161a2a 0%, #121521 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="topbar-title">3DV</div>
          <div className="topbar-sub">Scene Editor</div>
        </div>

        <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={{ background: "transparent", border: "none", padding: "6px 8px", color: "var(--text)" }} className="small">File</button>
          <button style={{ background: "transparent", border: "none", padding: "6px 8px", color: "var(--text)" }} className="small">Edit</button>
          <button style={{ background: "transparent", border: "none", padding: "6px 8px", color: "var(--text)" }} className="small">Help</button>
        </nav>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          title="Toggle Grid"
          onClick={() => onToggleGrid && onToggleGrid()}
          className="icon-btn icon-btn-circle"
          style={{ background: gridVisible ? "rgba(100,108,255,0.12)" : "transparent" }}
        >
          {/* simple grid icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: "var(--text)" }}>
            <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2" />
            <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.2" />
            <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2" />
            <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <div style={{ width: 8 }} />
      </div>
    </header>
  );
}
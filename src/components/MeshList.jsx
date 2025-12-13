import { useMemo, useState } from "react";

function buildTree(meshes = []) {
  const map = new Map();
  for (const m of meshes) map.set(m.id, { ...m, children: [] });
  const roots = [];
  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) map.get(node.parent).children.push(node);
    else roots.push(node);
  }
  return roots;
}

function KindIcon({ kind }) {
  const s = { width: 10, height: 10, display: "inline-block", marginRight: 10, borderRadius: 3 };
  switch (kind) {
    case "box": return <span style={{ ...s, background: "#4E77FF" }} aria-hidden title="Box" />;
    case "sphere": return <span style={{ ...s, background: "#24D18B", borderRadius: 9999 }} aria-hidden title="Sphere" />;
    case "cylinder": return <span style={{ ...s, background: "#FFC857" }} aria-hidden title="Cylinder" />;
    case "cone": return <span style={{ ...s, background: "#FF6EA1" }} aria-hidden title="Cone" />;
    case "line": return <span style={{ width: 14, height: 2, display: "inline-block", background: "#54D6FF", marginRight: 10, borderRadius: 2 }} aria-hidden title="Line" />;
    case "merged": return <span style={{ ...s, background: "#9D7CFF", borderRadius: 4 }} aria-hidden title="Group" />;
    default: return <span style={{ ...s, background: "#9AA0A6" }} aria-hidden title={kind} />;
  }
}

function TreeItem({ node, level = 0, onSelect, selectedId, onDelete, expandedIds, toggleExpand, selectedIdsSet, onSelectionChange }) {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const isMultiSelected = selectedIdsSet && selectedIdsSet.has(node.id);
  const indent = level * 10;

  const handleClick = (e) => {
    // multi-select when ctrl/cmd is held
    if ((e.ctrlKey || e.metaKey) && typeof onSelectionChange === "function") {
      const next = new Set(selectedIdsSet || []);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      onSelectionChange(next);
      // also notify single select so highlighting works
      if (typeof onSelect === "function") onSelect(node.id, e);
    } else {
      // normal single select
      if (typeof onSelectionChange === "function") onSelectionChange(new Set([node.id]));
      if (typeof onSelect === "function") onSelect(node.id, e);
    }
  };

  return (
    <div style={{ marginLeft: indent }}>
      <div
        className="mesh-row"
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === "Enter") handleClick(e); }}
        aria-pressed={isSelected}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 10px",
          borderRadius: 8,
          cursor: "pointer",
          background: isMultiSelected ? "linear-gradient(90deg, rgba(78,119,255,0.06), rgba(36,209,139,0.03))" : (isSelected ? "linear-gradient(90deg, rgba(78,119,255,0.03), rgba(36,209,139,0.02))" : "transparent"),
          border: isSelected ? "1px solid rgba(78,119,255,0.12)" : "1px solid transparent"
        }}
      >
        <div style={{ width: 18, textAlign: "center", fontSize: 12 }}>
          {node.children && node.children.length ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id, level); }}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                transform: `rotate(${isExpanded ? 0 : -90}deg)`,
                transition: "transform 140ms ease",
                fontSize: 12,
                padding: 0
              }}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              ▾
            </button>
          ) : null}
        </div>

        <KindIcon kind={node.kind} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mesh-name" style={{ fontWeight: 700, fontSize: 13, color: "#E8EDF6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {node.name || node.id}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(node.id); }}
            className="mesh-delete-btn"
            aria-label={`Delete ${node.name || node.id}`}
            title="Delete"
            style={{
              background: "transparent",
              border: "none",
              color: "#FF8B8B",
              padding: "6px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {node.children.map(child => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              onDelete={onDelete}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              selectedIdsSet={selectedIdsSet}
              onSelectionChange={onSelectionChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MeshList({ meshes = [], onSelect, selectedId, onDelete, selectedIds = new Set(), onSelectionChange = () => {} }) {
  const tree = useMemo(() => buildTree(meshes), [meshes]);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggleExpand = (id, level) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (level === 0) {
        if (next.has(id)) next.delete(id);
        else {
          next.clear();
          next.add(id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  return (
    <div>
      <h3 style={{ marginTop: 8, marginBottom: 8, color: "#F2F4F8", textAlign: "center" }}>Meshes</h3>
      <div className="mesh-list-card" style={{ padding: 6 }}>
        {tree.length === 0 ? (
          <div style={{ color: "var(--muted)", padding: 12, textAlign: "center" }}>No meshes</div>
        ) : (
          tree.map(node => (
            <TreeItem
              key={node.id}
              node={node}
              level={0}
              onSelect={onSelect}
              selectedId={selectedId}
              onDelete={onDelete}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              selectedIdsSet={selectedIds}
              onSelectionChange={onSelectionChange}
            />
          ))
        )}
      </div>
    </div>
  );
}
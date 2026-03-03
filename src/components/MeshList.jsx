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
  const base = {
    width: 5,
    height: 5,
    marginRight: 4,
    borderRadius: 999,
    display: "inline-block",
  };

  const map = {
    box: "var(--accent)",
    sphere: "var(--accent-2)",
    cylinder: "var(--warn)",
    cone: "#9b5cf6",
    line: "var(--muted)",
    tetra: "var(--accent)",
    torus: "var(--accent-2)",
    textbox: "rgba(255,255,255,0.65)",
    merged: "rgba(255,255,255,0.4)",
    group: "rgba(255,255,255,0.35)"
  };

  return (
    <span
      style={{
        ...base,
        background: map[kind] || "var(--muted)",
        boxShadow: "0 0 0 2px rgba(0,0,0,0.6)"
      }}
    />
  );
}

function TreeItem({ node, level = 0, onSelect, selectedId, onDelete, onContextMenu, expandedIds, toggleExpand, selectedIdsSet, onMoveToGroup }) {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const isMultiSelected = selectedIdsSet && selectedIdsSet.has(node.id);
  const isGroup = node.kind === "group";
  const indent = level * 12;

  const handleDragStart = (e) => {
    try {
      const ids = (selectedIdsSet && selectedIdsSet.size > 1 && selectedIdsSet.has(node.id))
        ? Array.from(selectedIdsSet)
        : [node.id];
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/x-lumatrix-mesh-ids", JSON.stringify(ids));
      e.dataTransfer.setData("text/plain", JSON.stringify(ids));
    } catch (err) {
      void err;
    }
  };

  const handleDragOver = (e) => {
    if (!isGroup) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = "move"; } catch { void 0; }
  };

  const handleDrop = (e) => {
    if (!isGroup) return;
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("application/x-lumatrix-mesh-ids") || e.dataTransfer.getData("text/plain");
      const ids = JSON.parse(raw || "[]");
      const list = Array.isArray(ids) ? ids.filter((x) => x && x !== node.id) : [];
      if (!list.length) return;
      if (typeof onMoveToGroup === "function") onMoveToGroup(list, node.id);
    } catch (err) {
      void err;
    }
  };

  const handleClick = (e) => {
    // Selection state is owned by the parent (App).
    // TreeItem should only report intent; App decides single vs multi selection.
    if (typeof onSelect === "function") onSelect(node.id, e);
  };

  return (
    <div className="tree-item" style={{ marginLeft: indent }}>
      <div
        className="mesh-row"
        role="button"
        tabIndex={0}
        onClick={handleClick}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          if (typeof onContextMenu === "function") {
            e.preventDefault();
            onContextMenu(node.id, e);
          }
        }}
        onKeyDown={(e) => { if (e.key === "Enter") handleClick(e); }}
        aria-pressed={isSelected}
        style={{
          padding: "0px 6px",
          height: 14,
          minHeight: 14,
          lineHeight: "14px",
          fontSize: 10.5,
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderRadius: 8,
          background:
            isSelected
              ? "linear-gradient(90deg, rgba(80,120,255,0.14), rgba(80,120,255,0.04))"
              : isMultiSelected
              ? "linear-gradient(90deg, rgba(120,200,255,0.10), rgba(120,200,255,0.03))"
              : "transparent",

          borderLeft:
            isSelected
              ? "2px solid var(--accent)"
              : isMultiSelected
              ? "2px solid var(--accent-2)"
              : "2px solid transparent",

          transition: "background 120ms ease",
          cursor: "pointer",
        }}
      >
        {level > 0 ? <span className="tree-hline" aria-hidden /> : null}

        <div style={{ width: 18, textAlign: "center", fontSize: 12 }}>
          {node.children && node.children.length ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id, level); }}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              className="tree-expander"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                transform: `rotate(${isExpanded ? 0 : -90}deg)`,
                transition: "transform 140ms ease",
                fontSize: 8,
                marginRight: 4,
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
          <div className="mesh-name" style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
              color: "var(--warn)",
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
        <div
          className="tree-children"
          style={{
            marginTop: 6,
            borderLeft: "1px solid rgba(255,255,255,0.05)",
            marginLeft: 10,
            paddingLeft: 10
          }}
        >
          {node.children.map(child => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              onDelete={onDelete}
              onContextMenu={onContextMenu}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              selectedIdsSet={selectedIdsSet}
              onMoveToGroup={onMoveToGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MeshList({ meshes = [], onSelect, selectedId, onDelete, onContextMenu, selectedIds = new Set(), onMoveToGroup, t = (s) => s }) {
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
    <div className="mesh-tree">
      {tree.length === 0 ? (
        <div style={{ color: "var(--muted)", padding: 12, textAlign: "center" }}>{t("empty.noMeshes")}</div>
      ) : (
        tree.map(node => (
          <TreeItem
            key={node.id}
            node={node}
            level={0}
            onSelect={onSelect}
            selectedId={selectedId}
            onDelete={onDelete}
            onContextMenu={onContextMenu}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            selectedIdsSet={selectedIds}
            onMoveToGroup={onMoveToGroup}
          />
        ))
      )}
    </div>
  );
}
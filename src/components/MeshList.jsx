import { useMemo, useState } from "react";
import IconButton from "./IconButton";

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

function filterTree(nodes = [], query = "") {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return nodes;
  const matches = (node) => {
    const haystack = `${node.name || ""} ${node.id || ""} ${node.kind || ""}`.toLowerCase();
    return haystack.includes(q);
  };
  const visit = (node) => {
    const children = (node.children || []).map(visit).filter(Boolean);
    if (matches(node) || children.length) return { ...node, children };
    return null;
  };
  return nodes.map(visit).filter(Boolean);
}

function KindIcon({ kind }) {
  return <span className={`object-tree-kind object-tree-kind-${kind || "mesh"}`} aria-hidden />;
}

function EyeIcon({ visible }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12s3.2-5.5 9-5.5S21 12 21 12s-3.2 5.5-9 5.5S3 12 3 12Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" opacity={visible ? "1" : "0.35"} />
      {!visible ? <path d="M5 19 19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : null}
    </svg>
  );
}

function LockIcon({ locked }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d={locked ? "M8 10V7.7C8 5.2 9.7 3.5 12 3.5s4 1.7 4 4V10" : "M16 10V7.7C16 5.2 14.3 3.5 12 3.5c-1.7 0-3 0.9-3.6 2.2"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TreeItem({ node, level = 0, onSelect, selectedId, onDelete, onContextMenu, expandedIds, toggleExpand, selectedIdsSet, onMoveToGroup, onToggleVisible, onToggleLocked }) {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const isMultiSelected = selectedIdsSet && selectedIdsSet.has(node.id);
  const isGroup = node.kind === "group";
  const hasChildren = !!(node.children && node.children.length);
  const isVisible = node.visible !== false;
  const isLocked = node.locked === true;

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
    if (isLocked || !isVisible) return;
    if (typeof onSelect === "function") onSelect(node.id, e);
  };

  return (
    <div className="tree-item object-tree-item" style={{ "--tree-level": level }}>
      <div
        className={`mesh-row object-tree-row ${isSelected ? "active" : ""} ${isMultiSelected ? "multi" : ""} ${isGroup ? "group" : ""} ${!isVisible ? "hidden" : ""} ${isLocked ? "locked" : ""}`}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        draggable={!isLocked}
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
      >
        <span className="object-tree-indent" aria-hidden />
        <span className="object-tree-branch" aria-hidden />

        <span className="object-tree-expander-wrap">
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id, level); }}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              className="tree-expander"
              data-expanded={isExpanded ? "true" : "false"}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              ▸
            </button>
          ) : <span className="object-tree-leaf-dot" aria-hidden />}
        </span>

        <KindIcon kind={node.kind} />

        <div className="object-tree-main">
          <div title={node.name || node.id} className="mesh-name object-tree-name">
            {node.name || node.id}
          </div>
          <div className="object-tree-id">{node.kind || "mesh"} · {node.id}</div>
        </div>

        <div className="object-tree-actions">
          <button
            type="button"
            className={`object-tree-state-btn ${isVisible ? "on" : "off"}`}
            title={isVisible ? "Hide mesh" : "Show mesh"}
            onClick={(e) => {
              e.stopPropagation();
              if (typeof onToggleVisible === "function") onToggleVisible(node.id, !isVisible);
            }}
          >
            <EyeIcon visible={isVisible} />
          </button>
          <button
            type="button"
            className={`object-tree-state-btn ${isLocked ? "locked" : "unlocked"}`}
            title={isLocked ? "Unlock mesh" : "Lock mesh"}
            onClick={(e) => {
              e.stopPropagation();
              if (typeof onToggleLocked === "function") onToggleLocked(node.id, !isLocked);
            }}
          >
            <LockIcon locked={isLocked} />
          </button>
          <IconButton
            title={`Delete ${node.name || node.id}`}
            onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(node.id); }}
            className="mesh-delete-btn"
          >
            ✕
          </IconButton>
        </div>
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <div className="tree-children object-tree-children">
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
              onToggleVisible={onToggleVisible}
              onToggleLocked={onToggleLocked}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MeshList({ meshes = [], onSelect, selectedId, onDelete, onContextMenu, selectedIds = new Set(), onMoveToGroup, onToggleVisible, onToggleLocked, t = (s) => s }) {
  const tree = useMemo(() => buildTree(meshes), [meshes]);
  const [query, setQuery] = useState("");
  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query]);
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
    <div className="panel-component mesh-list-card object-tree">
      <div className="object-tree-header">
        <span className="object-tree-header-title">Scene Objects</span>
        <span className="object-tree-count">{meshes.length}</span>
      </div>
      <div className="object-tree-search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search objects"
          aria-label="Search objects"
        />
      </div>
      <div className="panel-body object-tree-body">
      {filteredTree.length === 0 ? (
        <div style={{ color: "var(--muted)", padding: 12, textAlign: "center" }}>{t("empty.noMeshes")}</div>
      ) : (
        filteredTree.map(node => (
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
            onToggleVisible={onToggleVisible}
            onToggleLocked={onToggleLocked}
          />
        ))
      )}
      </div>
    </div>
  );
}

import IconButton from "../../shared/ui/IconButton.jsx";

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

export default function MeshTreeRow({ node, level = 0, rowStyle, onSelect, selectedId, onDelete, onContextMenu, expandedIds, toggleExpand, selectedIdsSet, onMoveToGroup, onToggleVisible, onToggleLocked }) {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const isMultiSelected = selectedIdsSet?.has(node.id);
  const isGroup = node.kind === "group";
  const hasChildren = !!node.children?.length;
  const isVisible = node.visible !== false;
  const isLocked = node.locked === true;

  const handleDragStart = (event) => {
    const ids = selectedIdsSet?.size > 1 && selectedIdsSet.has(node.id) ? Array.from(selectedIdsSet) : [node.id];
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-lumatrix-mesh-ids", JSON.stringify(ids));
    event.dataTransfer.setData("text/plain", JSON.stringify(ids));
  };

  const handleDrop = (event) => {
    if (!isGroup) return;
    event.preventDefault();
    try {
      const raw = event.dataTransfer.getData("application/x-lumatrix-mesh-ids") || event.dataTransfer.getData("text/plain");
      const ids = JSON.parse(raw || "[]");
      const movableIds = Array.isArray(ids) ? ids.filter((id) => id && id !== node.id) : [];
      if (movableIds.length) onMoveToGroup?.(movableIds, node.id);
    } catch { /* Ignore malformed external drag payloads. */ }
  };

  const handleClick = (event) => {
    if (!isLocked && isVisible) onSelect?.(node.id, event);
  };

  return (
    <div className="tree-item object-tree-item object-tree-virtual-row" style={{ "--tree-level": level, ...rowStyle }}>
      <div
        className={`mesh-row object-tree-row ${isSelected ? "active" : ""} ${isMultiSelected ? "multi" : ""} ${isGroup ? "group" : ""} ${!isVisible ? "hidden" : ""} ${isLocked ? "locked" : ""}`}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        draggable={!isLocked}
        onDragStart={handleDragStart}
        onDragOver={(event) => { if (isGroup) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
        onDrop={handleDrop}
        onContextMenu={(event) => { event.preventDefault(); onContextMenu?.(node.id, event); }}
        onKeyDown={(event) => { if (event.key === "Enter") handleClick(event); }}
        aria-pressed={isSelected}
      >
        <span className="object-tree-indent" aria-hidden />
        <span className="object-tree-branch" aria-hidden />
        <span className="object-tree-expander-wrap">
          {hasChildren ? (
            <button type="button" onClick={(event) => { event.stopPropagation(); toggleExpand(node.id, level); }} aria-label={isExpanded ? "Collapse" : "Expand"} className="tree-expander" data-expanded={isExpanded ? "true" : "false"} title={isExpanded ? "Collapse" : "Expand"}>▸</button>
          ) : <span className="object-tree-leaf-dot" aria-hidden />}
        </span>
        <KindIcon kind={node.kind} />
        <div className="object-tree-main">
          <div title={node.name || node.id} className="mesh-name object-tree-name">{node.name || node.id}</div>
          <div className="object-tree-id">{node.kind || "mesh"} · {node.id}</div>
        </div>
        <div className="object-tree-actions">
          <button type="button" className={`object-tree-state-btn ${isVisible ? "on" : "off"}`} title={isVisible ? "Hide mesh" : "Show mesh"} onClick={(event) => { event.stopPropagation(); onToggleVisible?.(node.id, !isVisible); }}><EyeIcon visible={isVisible} /></button>
          <button type="button" className={`object-tree-state-btn ${isLocked ? "locked" : "unlocked"}`} title={isLocked ? "Unlock mesh" : "Lock mesh"} onClick={(event) => { event.stopPropagation(); onToggleLocked?.(node.id, !isLocked); }}><LockIcon locked={isLocked} /></button>
          <IconButton title={`Delete ${node.name || node.id}`} onClick={(event) => { event.stopPropagation(); onDelete?.(node.id); }} className="mesh-delete-btn">✕</IconButton>
        </div>
      </div>
    </div>
  );
}

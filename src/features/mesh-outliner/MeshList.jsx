import { useMemo, useState } from "react";
import MeshTreeRow from "./MeshTreeRow.jsx";
import { buildMeshTree, filterMeshTree, flattenVisibleMeshTree } from "./meshTree.js";
import { useVirtualMeshTree } from "./useVirtualMeshTree.js";

export default function MeshList({
  meshes = [],
  onSelect,
  selectedId,
  onDelete,
  onContextMenu,
  selectedIds = new Set(),
  onMoveToGroup,
  onToggleVisible,
  onToggleLocked,
  t = (key) => key,
}) {
  const tree = useMemo(() => buildMeshTree(meshes), [meshes]);
  const [query, setQuery] = useState("");
  const filteredTree = useMemo(() => filterMeshTree(tree, query), [tree, query]);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const flatRows = useMemo(
    () => flattenVisibleMeshTree(filteredTree, expandedIds, !!query.trim()),
    [expandedIds, filteredTree, query],
  );
  const virtualTree = useVirtualMeshTree(flatRows);

  const toggleExpand = (id, level) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (level === 0 && !next.has(id)) next.clear();
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search objects"
          aria-label="Search objects"
        />
      </div>
      <div ref={virtualTree.bodyRef} className="panel-body object-tree-body" onScroll={virtualTree.onScroll}>
        {filteredTree.length === 0 ? (
          <div style={{ color: "var(--muted)", padding: 12, textAlign: "center" }}>{t("empty.noMeshes")}</div>
        ) : (
          <div className="object-tree-virtual-spacer" style={{ height: virtualTree.spacerHeight }}>
            {virtualTree.visibleRows.map(({ node, level }, visibleIndex) => {
              const index = virtualTree.startIndex + visibleIndex;
              return (
                <MeshTreeRow
                  key={node.id}
                  node={node}
                  level={level}
                  rowStyle={{ transform: `translateY(${index * virtualTree.rowHeight}px)` }}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

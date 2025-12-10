// src/components/MeshList.jsx
import React, { useState, useMemo } from "react";

function buildTree(meshes = []) {
  const map = new Map();
  for (const m of meshes) {
    map.set(m.id, { ...m, children: [] });
  }
  const roots = [];
  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) {
      map.get(node.parent).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function TreeItem({ node, level = 0, onSelect, selectedId, onDelete }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ marginLeft: level * 12 }}>
      <div
        className="list-item"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          background: selectedId === node.id ? "rgba(255,255,255,0.04)" : undefined
        }}
        onClick={() => onSelect && onSelect(node.id)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {node.children && node.children.length ? (
            <button onClick={(e) => { e.stopPropagation(); setCollapsed(v => !v); }} style={{ background: "transparent", border: "none", color: "var(--muted)" }}>
              {collapsed ? "▸" : "▾"}
            </button>
          ) : <div style={{ width: 18 }} />}
          <div>
            <div style={{ fontWeight: 600 }}>{node.name || node.id}</div>
            <div className="subtitle">{node.kind}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(node.id); }} style={{ background: "#2b2b2b", color: "#f88" }}>Delete</button>
        </div>
      </div>
      {!collapsed && node.children && node.children.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {node.children.map(child => <TreeItem key={child.id} node={child} level={level + 1} onSelect={onSelect} selectedId={selectedId} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

export default function MeshList({ meshes = [], onSelect, selectedId, onDelete }) {
  const tree = useMemo(() => buildTree(meshes), [meshes]);
  return (
    <div>
      <h3 style={{ marginTop: 12, marginBottom: 6 }}>Meshes</h3>
      <div>
        {tree.length === 0 ? <div style={{ color: "var(--muted)" }}>No meshes</div> : tree.map(node => (
          <TreeItem key={node.id} node={node} onSelect={onSelect} selectedId={selectedId} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
export function buildMeshTree(meshes = []) {
  const map = new Map();
  for (const mesh of meshes) map.set(mesh.id, { ...mesh, children: [] });
  const roots = [];
  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) map.get(node.parent).children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function filterMeshTree(nodes = [], query = "") {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return nodes;
  const visit = (node) => {
    const children = (node.children || []).map(visit).filter(Boolean);
    const searchableText = `${node.name || ""} ${node.id || ""} ${node.kind || ""}`.toLowerCase();
    return searchableText.includes(normalizedQuery) || children.length ? { ...node, children } : null;
  };
  return nodes.map(visit).filter(Boolean);
}

export function flattenVisibleMeshTree(nodes = [], expandedIds = new Set(), forceExpanded = false) {
  const rows = [];
  const visit = (node, level) => {
    rows.push({ node, level });
    if ((node.children || []).length && (forceExpanded || expandedIds.has(node.id))) {
      node.children.forEach((child) => visit(child, level + 1));
    }
  };
  nodes.forEach((node) => visit(node, 0));
  return rows;
}

export function getMeshPreorderIds(meshes = []) {
  const ids = [];
  const visit = (node) => {
    ids.push(node.id);
    (node.children || []).forEach(visit);
  };
  buildMeshTree(meshes).forEach(visit);
  return ids;
}

import { footprint, containingPlot } from './footprint.js';
import { placementProblem } from './placementRules.js';

export function snapBuildingPlacement(city, asset, point, rotation = 0, align = true, gap = 1, ignoreId = null) {
  const grid = { x: Math.round(point.x / 2) * 2, z: Math.round(point.z / 2) * 2 };
  const unsnapped = { ...grid, guides: null };
  if (!align) return unsnapped;
  const plot = city.plots.find(p => Math.abs(point.x - p.x) <= p.width / 2 && Math.abs(point.z - p.z) <= p.depth / 2);
  if (!plot) return unsnapped;
  const size = footprint(asset, rotation);
  const occupants = city.objects.filter(o => o.id !== ignoreId && Math.abs(o.x - plot.x) < plot.width / 2 && Math.abs(o.z - plot.z) < plot.depth / 2);
  const candidates = axis => {
    const extent = axis === 'x' ? 'width' : 'depth';
    const half = plot[extent] / 2 - size[extent] / 2 - gap;
    const targets = [{ value: plot[axis], label: '부지 중심' }];
    if (half > 0) for (const sign of [-1, 1]) targets.push({ value: plot[axis] + sign * half, label: '부지 경계' });
    for (const object of occupants) {
      targets.push({ value: object[axis], label: '건물 중심' });
      const other = footprint(object.asset, object.rotation);
      for (const sign of [-1, 1]) targets.push({ value: object[axis] + sign * (other[extent] / 2 + size[extent] / 2 + gap), label: '건물 간격' });
    }
    const near = targets.filter(target => Math.abs(target.value - point[axis]) <= 1.25);
    near.sort((a, b) => Math.abs(a.value - point[axis]) - Math.abs(b.value - point[axis]));
    return [...near, { value: grid[axis], label: null }];
  };
  const xs = candidates('x'), zs = candidates('z');
  const pairs = [];
  for (const x of xs) for (const z of zs) {
    const smart = Number(Boolean(x.label)) + Number(Boolean(z.label));
    pairs.push({ x, z, smart, distance: Math.abs(x.value - point.x) + Math.abs(z.value - point.z) });
  }
  pairs.sort((a, b) => b.smart - a.smart || a.distance - b.distance);
  for (const pair of pairs) {
    if (placementProblem(city, asset, pair.x.value, pair.z.value, rotation, ignoreId)) continue;
    const guides = pair.smart ? { plot, x: pair.x.label ? pair.x.value : null, z: pair.z.label ? pair.z.value : null, label: [...new Set([pair.x.label, pair.z.label].filter(Boolean))].join(' · ') } : null;
    return { x: pair.x.value, z: pair.z.value, guides };
  }
  return unsnapped;
}

export function placementDistances(city, asset, x, z, rotation = 0, ignoreId = null) {
  const size = footprint(asset, rotation);
  const plot = containingPlot(city, asset, x, z, rotation);
  if (!plot) return null;
  const boundary = Math.min(
    x - size.width / 2 - (plot.x - plot.width / 2),
    plot.x + plot.width / 2 - (x + size.width / 2),
    z - size.depth / 2 - (plot.z - plot.depth / 2),
    plot.z + plot.depth / 2 - (z + size.depth / 2),
  );
  let neighbor = Infinity;
  for (const object of city.objects) {
    if (object.id === ignoreId) continue;
    const other = footprint(object.asset, object.rotation);
    const dx = Math.max(0, Math.abs(x - object.x) - (size.width + other.width) / 2);
    const dz = Math.max(0, Math.abs(z - object.z) - (size.depth + other.depth) / 2);
    neighbor = Math.min(neighbor, Math.hypot(dx, dz));
  }
  return { boundary, neighbor: Number.isFinite(neighbor) ? neighbor : null };
}

import { assetById } from '../presets/catalog.js';

export function footprint(asset, rotation = 0) {
  const a = assetById[asset];
  return { width: Math.abs(Math.cos(rotation)) * a.width + Math.abs(Math.sin(rotation)) * a.depth, depth: Math.abs(Math.sin(rotation)) * a.width + Math.abs(Math.cos(rotation)) * a.depth };
}

export function containingPlot(city, asset, x, z, rotation = 0) {
  const { width, depth } = footprint(asset, rotation);
  return city.plots.find(p => Math.abs(x - p.x) + width / 2 <= p.width / 2 + 0.001 && Math.abs(z - p.z) + depth / 2 <= p.depth / 2 + 0.001);
}

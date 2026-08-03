// src/babylon/meshes/meta/ContourMeta.js

import { MeshMeta } from "./MeshMeta";
import { DEFAULT_CONTOUR_COLOR_PRESET } from "../../../ui/contourColorPresets";

function createDefaultContourValues(dim = { x: 5, y: 5, z: 5 }) {
  const values = [];
  const cx = (dim.x - 1) / 2;
  const cy = (dim.y - 1) / 2;
  const cz = (dim.z - 1) / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
  for (let z = 0; z < dim.z; z += 1) {
    for (let y = 0; y < dim.y; y += 1) {
      for (let x = 0; x < dim.x; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        const normalized = 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / maxDist;
        values.push(normalized > 0.18 ? Number(normalized.toFixed(3)) : 0);
      }
    }
  }
  return values;
}

export class ContourMeta extends MeshMeta {
  constructor(opts = {}) {
    const dimensions = opts.params?.dimensions || { x: 5, y: 5, z: 5 };
    const size = opts.params?.size || { x: 5, y: 5, z: 5 };
    super({
      kind: "contour",
      params: {
        dimensions,
        size,
        values: createDefaultContourValues(dimensions),
        minValue: 0,
        maxValue: 1,
        autoDimensions: true,
        colorPreset: DEFAULT_CONTOUR_COLOR_PRESET,
        slice: {
          enabled: false,
          axis: "z",
          index: Math.max(0, dimensions.z - 1),
          cumulative: false,
          quadMode: false,
          quadrants: [
            Math.max(0, dimensions.z - 1),
            Math.max(0, dimensions.z - 1),
            Math.max(0, dimensions.z - 1),
            Math.max(0, dimensions.z - 1),
          ],
        },
        opacity: 0.78,
        cellGap: 0,
        showBounds: true,
        ...(opts.params || {}),
      },
      material: { color: { r: 0.2, g: 0.75, b: 1 }, alpha: 0.78, ...(opts.material || {}) },
      ...opts,
    });
  }
}

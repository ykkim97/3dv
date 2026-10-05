import { mapDimensions } from './mapDimensions.js';
import { plotProblem } from '../plots/plotModel.js';

export function unbuildableCells(city, size = 12) {
  const { half } = mapDimensions(city);
  const cells = [];
  for (let x = -half + size / 2; x < half; x += size) for (let z = -half + size / 2; z < half; z += size) {
    const problem = plotProblem(city, { id: 'info-cell', x, z, width: size, depth: size });
    if (problem) cells.push({ x, z, reason: problem.includes('수면') ? 'water' : problem.includes('도로') ? 'road' : 'occupied' });
  }
  return cells;
}


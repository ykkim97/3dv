import { mapDimensions } from '../core/mapDimensions.js';
import { assetById } from '../presets/catalog.js';
import { footprint, containingPlot } from './footprint.js';
import { terrainHeight } from '../terrain/terrainModel.js';

export function placementProblem(city, asset, x, z, rotation = 0, ignoreId = null) {
  const { width, depth } = footprint(asset, rotation);
  const prop = assetById[asset].category === 'streetscape';
  if (prop) {
    const { half } = mapDimensions(city);
    if (Math.abs(x) + width / 2 > half || Math.abs(z) + depth / 2 > half) return '지도 안에 배치해 주세요.';
    if (terrainHeight(city.heights, x, z) < 0.25) return '소품은 물 밖의 육지에 배치해 주세요.';
  } else if (!containingPlot(city, asset, x, z, rotation)) return '먼저 부지를 조성한 다음, 부지 안에 시설을 배치해 주세요.';
  if (city.objects.some(o => {
    if (o.id === ignoreId) return false;
    const other = footprint(o.asset, o.rotation);
    return Math.abs(o.x - x) < (other.width + width) / 2 - 0.01 && Math.abs(o.z - z) < (other.depth + depth) / 2 - 0.01;
  })) return '이미 시설이 있는 위치입니다. 빈 격자로 옮겨 주세요.';
  return null;
}
// Return the same placement for the ghost and the final click.

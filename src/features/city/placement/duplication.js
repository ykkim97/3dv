import { assetById } from '../presets/catalog.js';
import { footprint } from './footprint.js';
import { placementProblem } from './placementRules.js';
import { copiedFacilityProperties } from '../management/facilityProperties.js';

export function planBuildingCopies(city, source, count, gap, direction) {
  if (!source || !Number.isInteger(count) || count < 1 || count > 12 || !Number.isFinite(gap) || gap < 0 || gap > 10 || !['x+', 'x-', 'z+', 'z-'].includes(direction)) return { copies: [], problem: '복제 개수, 간격 또는 방향을 확인해 주세요.' };
  const size = footprint(source.asset, source.rotation);
  const axis = direction[0], sign = direction[1] === '+' ? 1 : -1;
  const draft = { ...city, objects: [...city.objects] };
  const copies = [];
  for (let i = 1; i <= count; i++) {
    const candidate = { asset: source.asset, ...copiedFacilityProperties(source), x: source.x + (axis === 'x' ? sign * (size.width + gap) * i : 0), z: source.z + (axis === 'z' ? sign * (size.depth + gap) * i : 0), rotation: source.rotation };
    const problem = placementProblem(draft, candidate.asset, candidate.x, candidate.z, candidate.rotation);
    if (problem) return { copies: [], problem: `${i}번째 건물을 놓을 수 없습니다. ${problem}` };
    copies.push(candidate);
    draft.objects.push({ ...candidate, id: `__copy-${i}` });
  }
  return { copies, problem: null };
}

export function planGroupTransform(city, ids, action, offsetX = 0, offsetZ = 0) {
  const unique = [...new Set(ids)];
  const selected = city.objects.filter(object => unique.includes(object.id));
  if (selected.some(object => object.locked)) return { objects: [], problem: '잠긴 시설은 먼저 잠금을 해제하세요.' };
  if (selected.length < 2 || selected.length !== unique.length || !['move', 'copy', 'rotate'].includes(action)) return { objects: [], problem: '시설을 두 개 이상 선택해 주세요.' };
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetZ) || Math.abs(offsetX) > 80 || Math.abs(offsetZ) > 80) return { objects: [], problem: '이동 거리는 -80~80 m 범위로 입력해 주세요.' };
  if (action !== 'rotate' && offsetX === 0 && offsetZ === 0) return { objects: [], problem: '이동 거리를 입력해 주세요.' };
  const centerX = selected.reduce((sum, object) => sum + object.x, 0) / selected.length;
  const centerZ = selected.reduce((sum, object) => sum + object.z, 0) / selected.length;
  const draft = { ...city, objects: action === 'copy' ? [...city.objects] : city.objects.filter(object => !unique.includes(object.id)) };
  const objects = [];
  for (const object of selected) {
    const next = action === 'rotate'
      ? { ...object, x: centerX - (object.z - centerZ), z: centerZ + (object.x - centerX), rotation: object.rotation + Math.PI / 2 }
      : { ...object, x: object.x + offsetX, z: object.z + offsetZ };
    if (action === 'copy') Object.assign(next, copiedFacilityProperties(object));
    const problem = placementProblem(draft, next.asset, next.x, next.z, next.rotation);
    if (problem) return { objects: [], problem: `${assetById[object.asset].name}: ${problem}` };
    objects.push(next);
    draft.objects.push(next);
  }
  return { objects, problem: null };
}

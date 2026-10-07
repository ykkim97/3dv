import { objectBaseHeight } from '../plots/plotModel.js';

const point = p => p && ['x', 'y', 'z'].every(key => Number.isFinite(p[key]) && Math.abs(p[key]) <= 10000);
export function validatePortals(city) {
  if (city.portals === undefined) return;
  if (!Array.isArray(city.portals) || city.portals.length > 100 || city.portals.some(p => !p || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || p.name.length > 80 || typeof p.targetPageId !== 'string' || !p.targetPageId || !point(p.position) || p.objectId !== undefined && (typeof p.objectId !== 'string' || !city.objects.some(o => o.id === p.objectId) || !point(p.offset))) || new Set(city.portals.map(p => p.id)).size !== city.portals.length) throw new Error('이동 포인트 데이터가 올바르지 않습니다.');
}
export function cleanPortals(city) {
  if (!city.portals) return city;
  return { ...city, portals: city.portals.filter(p => !p.objectId || city.objects.some(o => o.id === p.objectId)) };
}
export function portalAnchor(city, position, objectId) {
  const object = city.objects.find(o => o.id === objectId);
  const anchor = { position: { x: position.x, y: position.y + 1.5, z: position.z } };
  if (!object) return anchor;
  const dx = position.x - object.x, dz = position.z - object.z, c = Math.cos(object.rotation), s = Math.sin(object.rotation);
  return { ...anchor, objectId, offset: { x: dx * c - dz * s, y: position.y + 1.5 - objectBaseHeight(city, object), z: dx * s + dz * c } };
}
export function portalPosition(city, portal) {
  const object = city.objects.find(o => o.id === portal.objectId);
  if (!object) return portal.position;
  const { x, y, z } = portal.offset, c = Math.cos(object.rotation), s = Math.sin(object.rotation);
  return { x: object.x + x * c + z * s, y: objectBaseHeight(city, object) + y, z: object.z - x * s + z * c };
}

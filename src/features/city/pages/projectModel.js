import { validateCity } from '../core/cityValidation.js';
import { isPageThumbnail } from './pageThumbnail.js';

export function createSceneProject(city) {
  const id = crypto.randomUUID();
  return { version: 1, type: 'lumatrix-pages', name: '나의 씬 프로젝트', entryPageId: id, activePageId: id, pages: [{ id, name: city.name, type: '3d', city }] };
}
export function validateSceneProject(value) {
  if (!value || value.version !== 1 || value.type !== 'lumatrix-pages' || typeof value.name !== 'string' || value.name.length > 80 || !Array.isArray(value.pages) || !value.pages.length || value.pages.length > 30) throw new Error('지원하지 않는 씬 프로젝트입니다.');
  const ids = new Set(value.pages.map(p => p?.id));
  if (ids.size !== value.pages.length || !ids.has(value.entryPageId) || !ids.has(value.activePageId)) throw new Error('페이지 ID 또는 시작 페이지가 올바르지 않습니다.');
  for (const page of value.pages) {
    if (page?.thumbnail !== undefined && !isPageThumbnail(page.thumbnail)) throw new Error('페이지 미리보기 이미지가 올바르지 않습니다.');
    if (!page || typeof page.id !== 'string' || !page.id || typeof page.name !== 'string' || !page.name.trim() || page.name.length > 80 || !['3d', '2d'].includes(page.type)) throw new Error('페이지 정보가 올바르지 않습니다.');
    if (page.type === '3d') {
      validateCity(page.city);
      if ((page.city.portals || []).some(p => !ids.has(p.targetPageId) || p.targetPageId === page.id)) throw new Error('이동 포인트의 목적지를 확인하세요.');
      if (page.camera && (!['alpha', 'beta', 'radius'].every(k => Number.isFinite(page.camera[k])) || page.camera.radius < 2 || page.camera.radius > 10000 || page.camera.beta < 0 || page.camera.beta > Math.PI || !page.camera.target || ['x', 'y', 'z'].some(k => !Number.isFinite(page.camera.target[k]) || Math.abs(page.camera.target[k]) > 10000) || page.camera.screenOffset && ['x', 'y'].some(k => !Number.isFinite(page.camera.screenOffset[k]) || Math.abs(page.camera.screenOffset[k]) > 10000))) throw new Error('페이지 카메라 정보가 올바르지 않습니다.');
    }
  }
  return value;
}
export function removePage(project, id) {
  if (project.pages.length === 1) throw new Error('마지막 페이지는 삭제할 수 없습니다.');
  if (id === project.activePageId) throw new Error('다른 페이지로 이동한 뒤 삭제하세요.');
  return { ...project, entryPageId: project.entryPageId === id ? project.activePageId : project.entryPageId, pages: project.pages.filter(p => p.id !== id).map(p => p.type === '3d' ? { ...p, city: { ...p.city, portals: (p.city.portals || []).filter(portal => portal.targetPageId !== id) } } : p) };
}

import { validateCity } from '../core/cityValidation.js';
import { validateSceneProject } from './projectModel.js';

// Both import entry points use the same content-based format detection.
export async function readSceneFile(file) {
  if (file.size > 64 * 1024 * 1024) throw new Error('64 MB 이하의 JSON 파일을 선택하세요.');
  let value;
  try { value = JSON.parse(await file.text()); }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error('JSON 파일 내용이 올바르지 않습니다.');
    throw error;
  }
  if (value?.type === 'lumatrix-pages') return { kind: 'project', value: validateSceneProject(value) };
  if (file.size > 8_000_000) throw new Error('8MB 이하의 도시 파일을 선택해 주세요.');
  const city = validateCity(value);
  if (city.portals?.length) throw new Error('이동 포인트가 포함된 도시는 전체 프로젝트 파일로 불러오세요.');
  return { kind: 'city', value: city };
}

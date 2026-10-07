import { isTauriRuntime, saveSceneOnDesktop } from '../../../platform/desktopFiles.js';
import { validateSceneProject } from './projectModel.js';
import { cityFileName } from '../persistence/cityFiles.js';

export async function saveSceneProjectFile(project) {
  validateSceneProject(project);
  const name = cityFileName(project.name).replace(/\.city\.json$/, '.project.json');
  if (isTauriRuntime()) return await saveSceneOnDesktop(project, name) ? '저장했습니다.' : '저장을 취소했습니다.';
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return '프로젝트 파일을 내려받았습니다.';
}

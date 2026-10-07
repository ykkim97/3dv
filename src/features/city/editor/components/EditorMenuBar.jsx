import HeaderMenu from './HeaderMenu.jsx';
import Icon from './CityIcon.jsx';

export default function EditorMenuBar({ openMenu, onOpenMenu, cityName, onMap, onImport, onSave, onExport, onProjects, onUndo, onRedo, canUndo, canRedo, onFocus, canFocus, onHelp, children }) {
  const run = action => () => { onOpenMenu(null); action(); };
  const menu = { textOnly: true, openMenu, onOpen: onOpenMenu };
  return <nav className="editor-menu-bar" aria-label="프로그램 메뉴">
    <span className="editor-menu-logo" aria-hidden="true"><Icon name="building" size={16} /></span>
    <HeaderMenu id="file" label="파일" {...menu}>
      <button onClick={run(onMap)}>새 도시 · 지도 설정</button>
      <button onClick={run(onImport)}>도시·프로젝트 파일 열기</button>
      <button onClick={run(onSave)}>도시 저장 <kbd>Ctrl + S</kbd></button>
      <button onClick={run(onExport)}>도시 파일 내보내기</button>
      <span className="menu-section-label menu-divider">자동 저장</span>
      <button onClick={run(onProjects)}>저장된 프로젝트 · 복구</button>
    </HeaderMenu>
    <HeaderMenu id="edit" label="편집" {...menu}>
      <button disabled={!canUndo} onClick={run(onUndo)}>실행 취소 <kbd>Ctrl + Z</kbd></button>
      <button disabled={!canRedo} onClick={run(onRedo)}>다시 실행 <kbd>Ctrl + Shift + Z</kbd></button>
      <span className="menu-section-label menu-divider">선택한 대상</span>
      <button disabled={!canFocus} onClick={run(onFocus)}>선택 대상에 화면 맞추기 <kbd>F</kbd></button>
    </HeaderMenu>
    {children}
    <HeaderMenu id="help" label="도움말" {...menu}>
      <button onClick={run(onHelp)}>사용 매뉴얼 · 단축키</button>
    </HeaderMenu>
    <span className="editor-menu-project" title={cityName}>{cityName} <span>— Lumatrix Scene Editor</span></span>
  </nav>;
}

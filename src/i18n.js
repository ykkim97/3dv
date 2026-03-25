// src/i18n.js

export const LANGS = /** @type {const} */ ({
  ko: "ko",
  en: "en",
});

export const STRINGS = {
  ko: {
    // Common
    "btn.create": "Create",
    "btn.save": "Save",
    "btn.delete": "Delete",

    // TopBar
    "topbar.help": "Help",
    "topbar.import": "Import",
    "topbar.runtimeDisabled": "씬을 먼저 생성/선택하세요",
    "topbar.runtimeOn": "Runtime 모드 (클릭하면 Edit로 전환)",
    "topbar.runtimeOff": "Edit 모드 (클릭하면 Run)",
    "topbar.themeToLight": "라이트 모드로 전환",
    "topbar.themeToDark": "다크 모드로 전환",
    "topbar.lang": "언어",

    // View preset bar
    "viewbar.aria": "시점 전환",
    "viewbar.front": "정면",
    "viewbar.top": "윗면",
    "viewbar.bottom": "아랫면",
    "viewbar.left": "좌측",
    "viewbar.right": "우측",
    "viewbar.iso": "3D",
    "viewbar.frame": "Frame",

    // Snap
    "snap.title": "Snap 설정",
    "snap.toggle": "Snap",
    "snap.move": "이동 스냅",
    "snap.rotate": "회전 스냅",
    "snap.scale": "스케일 스냅",

    // Panels
    "panel.scenes": "Scenes",
    "panel.meshes": "Meshes",
    "panel.addPrimitives": "도형 추가",
    "panel.importModel": "모델 가져오기",
    "panel.importModelHint": "GLB / GLTF / OBJ 파일을 현재 씬에 추가합니다",
    "panel.meshTree": "메쉬 트리",

    // Empty states
    "empty.selectScene": "씬을 선택하거나 생성하세요",
    "empty.noMeshes": "메쉬가 없습니다",

    // Inspector
    "inspector.title": "Inspector",
    "inspector.select": "편집할 메쉬를 선택하세요",
    "inspector.script": "스크립트",
    "inspector.delete": "Delete",

    // Scene header
    "scene.undo": "Undo",
    "scene.redo": "Redo",
    "scene.grid": "Grid",
    "scene.axes": "Axes",
    "scene.sun": "Sun",
    "scene.hemi": "Hemi",

    // Context menu
    "ctx.frame": "Frame",
    "ctx.properties": "Properties",
    "ctx.rename": "Rename",
    "ctx.delete": "Delete",
    "ctx.group": "Group",
    "ctx.ungroup": "Ungroup",

    // Help
    "help.title": "Help / Manual",
    "help.subtitle": "Lumatrix Scene Editor 기능 요약",
    "help.close": "Close",
  },
  en: {
    // Common
    "btn.create": "Create",
    "btn.save": "Save",
    "btn.delete": "Delete",

    // TopBar
    "topbar.help": "Help",
    "topbar.import": "Import",
    "topbar.runtimeDisabled": "Create or select a scene first",
    "topbar.runtimeOn": "Runtime mode (click to switch to edit)",
    "topbar.runtimeOff": "Edit mode (click to run)",
    "topbar.themeToLight": "Switch to light mode",
    "topbar.themeToDark": "Switch to dark mode",
    "topbar.lang": "Language",

    // View preset bar
    "viewbar.aria": "View presets",
    "viewbar.front": "Front",
    "viewbar.top": "Top",
    "viewbar.bottom": "Bottom",
    "viewbar.left": "Left",
    "viewbar.right": "Right",
    "viewbar.iso": "3D",
    "viewbar.frame": "Frame",

    // Snap
    "snap.title": "Snap settings",
    "snap.toggle": "Snap",
    "snap.move": "Move snap",
    "snap.rotate": "Rotate snap",
    "snap.scale": "Scale snap",

    // Panels
    "panel.scenes": "Scenes",
    "panel.meshes": "Meshes",
    "panel.addPrimitives": "Add primitives",
    "panel.importModel": "Import model",
    "panel.importModelHint": "Add a GLB / GLTF / OBJ file into the current scene",
    "panel.meshTree": "Mesh tree",

    // Empty states
    "empty.selectScene": "Select or create a scene",
    "empty.noMeshes": "No meshes",

    // Inspector
    "inspector.title": "Inspector",
    "inspector.select": "Select a mesh to edit",
    "inspector.script": "Scripts",
    "inspector.delete": "Delete",

    // Scene header
    "scene.undo": "Undo",
    "scene.redo": "Redo",
    "scene.grid": "Grid",
    "scene.axes": "Axes",
    "scene.sun": "Sun",
    "scene.hemi": "Hemi",

    // Context menu
    "ctx.frame": "Frame",
    "ctx.properties": "Properties",
    "ctx.rename": "Rename",
    "ctx.delete": "Delete",
    "ctx.group": "Group",
    "ctx.ungroup": "Ungroup",

    // Help
    "help.title": "Help / Manual",
    "help.subtitle": "Lumatrix Scene Editor quick guide",
    "help.close": "Close",
  },
};

export function makeT(lang) {
  const table = STRINGS[lang] || STRINGS.en;
  return (key) => table[key] || STRINGS.en[key] || key;
}

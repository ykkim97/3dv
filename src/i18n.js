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

    // Panels
    "panel.scenes": "Scenes",
    "panel.meshes": "Meshes",
    "panel.addPrimitives": "도형 추가",
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

    // Panels
    "panel.scenes": "Scenes",
    "panel.meshes": "Meshes",
    "panel.addPrimitives": "Add primitives",
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

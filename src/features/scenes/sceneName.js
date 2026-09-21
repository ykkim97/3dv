// src/utils/sceneName.js

const HANGUL_REGEX = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;
const ALLOWED_ASCII_REGEX = /^[A-Za-z0-9 _-]+$/;

export function getSceneNameError(name) {
  const raw = String(name ?? "");
  const trimmed = raw.trim();

  if (!trimmed) return "씬 이름을 입력해야 합니다.";
  if (HANGUL_REGEX.test(trimmed)) return "씬 이름에는 한글을 사용할 수 없습니다.";
  if (!ALLOWED_ASCII_REGEX.test(trimmed)) return "씬 이름은 영문/숫자/공백/_/- 만 사용할 수 있습니다.";
  if (trimmed.length > 40) return "씬 이름은 40자 이하로 입력해 주세요.";
  return null;
}

export function normalizeSceneName(name) {
  return String(name ?? "").trim();
}

export const QUALITY_PRESETS = [
  { id: 'low', name: '가볍게', pixels: 1, shadows: false, description: '그림자를 끄고 해상도를 줄여 대형 도시의 부하를 낮춥니다.' },
  { id: 'balanced', name: '균형', pixels: 1.5, shadows: true, description: '기본 해상도와 그림자를 유지합니다.' },
  { id: 'high', name: '선명하게', pixels: 2, shadows: true, description: '고해상도 화면에서 선명도를 높입니다. GPU 부하가 늘어날 수 있습니다.' },
];
export const DEFAULT_QUALITY = { preset: 'balanced', fpsLimit: 60, motion: true };
export function normalizeQuality(value) {
  return { preset: QUALITY_PRESETS.some(p => p.id === value?.preset) ? value.preset : 'balanced', fpsLimit: [30, 60].includes(value?.fpsLimit) ? value.fpsLimit : 60, motion: value?.motion !== false };
}
export function qualityScale(preset, pixelRatio = 1) {
  const quality = QUALITY_PRESETS.find(p => p.id === preset) || QUALITY_PRESETS[1];
  return Math.max(1, pixelRatio / quality.pixels);
}

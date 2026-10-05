export const BRIDGE_PRESETS = [
  { id: 'small', name: '소형 콘크리트교', detail: '단순한 상판 · 교각 · 안전 난간', type: 'street', min: 6, max: 80, rise: 1.2, style: 'beam' },
  { id: 'arch', name: '아치교', detail: '양쪽 아치와 수직 연결재', type: 'street', min: 12, max: 140, rise: 1.8, style: 'arch' },
  { id: 'cable', name: '사장 대교', detail: '4차선 · 주탑과 부채꼴 케이블', type: 'avenue', min: 30, max: 300, rise: 3, style: 'cable' },
  { id: 'suspension', name: '현수 대교', detail: '4차선 · 늘어진 주 케이블과 행어', type: 'avenue', min: 40, max: 300, rise: 3, style: 'suspension' },
  { id: 'footbridge', name: '보행교', detail: '좁은 보행 데크 · 나무색 난간', type: 'path', min: 6, max: 100, rise: 0.8, style: 'beam' },
];
export const bridgeById = Object.fromEntries(BRIDGE_PRESETS.map(preset => [preset.id, preset]));

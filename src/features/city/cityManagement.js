export const MAP_LAYERS = [
  { id: 'power', name: '전력', color: '#f2d47a' },
  { id: 'water', name: '수도', color: '#78d4df' },
  { id: 'fire', name: '소방', color: '#ffae76' },
  { id: 'school', name: '학교', color: '#c8acf1' },
  { id: 'hospital', name: '의료', color: '#f2a6bd' },
  { id: 'park', name: '녹지', color: '#a7d785' },
];
export const defaultMapLayers = Object.fromEntries(MAP_LAYERS.map(layer => [layer.id, true]));
export const roleLayer = asset => asset === 'school' ? 'school' : asset === 'hospital' ? 'hospital' : ['park', 'playground'].includes(asset) ? 'park' : null;

export function managementMetrics(diagnostics, utility, fire) {
  return {
    road: { label: '도로 미연결 부지', value: diagnostics.disconnectedPlots.length, unit: '개' },
    power: { label: '전력 공급 밖 건물', value: utility.totals.consumers - utility.totals.power, unit: '개' },
    water: { label: '수도 공급 밖 건물', value: utility.totals.consumers - utility.totals.water, unit: '개' },
    fire: { label: '소방 도달 밖 건물', value: fire.totals.buildings - fire.totals.covered, unit: '개' },
    school: { label: '학교 접근 밖 주민', value: diagnostics.population - diagnostics.access.school.reached, unit: '명' },
    hospital: { label: '의료 접근 밖 주민', value: diagnostics.population - diagnostics.access.hospital.reached, unit: '명' },
    park: { label: '녹지 접근 밖 주민', value: diagnostics.population - diagnostics.access.park.reached, unit: '명' },
    jobs: { label: '예상 일자리 부족', value: Math.max(0, diagnostics.workforce - diagnostics.jobs), unit: '개' },
  };
}

export function compareManagementMetrics(previous, current) {
  if (!previous) return [];
  return Object.entries(current).filter(([id, metric]) => previous[id].value !== metric.value)
    .map(([id, metric]) => ({ id, ...metric, before: previous[id].value, improved: metric.value < previous[id].value }));
}

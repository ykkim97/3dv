// Stable IDs; library grouping is separate from building service categories.
export const EXPANSION_ASSETS = [
  { id: 'logistics-center', name: '물류센터', detail: '물류·보관 · 관제실과 하역 도크', width: 24, depth: 18, height: 8, color: '#afbec1' },
  { id: 'warehouse', name: '일반 창고', detail: '물류·보관 · 대형 셔터와 적재 공간', width: 16, depth: 12, height: 6, color: '#c4bda8' },
  { id: 'cold-storage', name: '냉동 창고', detail: '물류·보관 · 단열 외벽과 냉각 설비', width: 18, depth: 14, height: 7, color: '#c6d9df' },
  { id: 'small-factory', name: '소형 제조공장', detail: '생산시설 · 작업동과 배기 설비', width: 14, depth: 12, height: 7, color: '#b8bca9' },
  { id: 'assembly-plant', name: '조립공장', detail: '생산시설 · 조립동과 자재 반입 구역', width: 22, depth: 16, height: 8, color: '#a7bfc0' },
  { id: 'parking-lot', name: '일반 주차장', detail: '주차시설 · 주차 구획과 출입 차단기', width: 16, depth: 14, height: 2, color: '#849496' },
  { id: 'parking-tower', name: '주차타워', detail: '주차시설 · 4층 주차동과 진입 경사로', width: 14, depth: 12, height: 12, color: '#b9c7cb' },
  { id: 'bus-depot', name: '버스 차고지', detail: '대중교통 · 관제실과 정비 구역', width: 24, depth: 18, height: 7, color: '#9fbfb1' },
  { id: 'recycling-center', name: '재활용 선별장', detail: '자원순환 · 선별동과 분리 보관함', width: 18, depth: 14, height: 6, color: '#a4c2ad' },
  { id: 'resource-recovery', name: '자원회수시설', detail: '자원순환 · 처리동과 배기가스 정화 설비', width: 24, depth: 18, height: 12, color: '#bdc6b4' },
  { id: 'library', category: 'landmark', name: '도서관', detail: '문화·생활 · 열람동과 유리 입구', width: 12, depth: 10, height: 7, color: '#d8d0b9' },
  { id: 'gymnasium', category: 'landmark', name: '체육관', detail: '문화·생활 · 실내 운동장과 출입 로비', width: 18, depth: 14, height: 9, color: '#bdc8d1' },
  { id: 'community-center', category: 'landmark', name: '주민센터', detail: '행정·생활 · 민원 창구와 주민 활동 공간', width: 12, depth: 10, height: 6, color: '#d2cfba' },
].map(asset => ({ category: 'commercial', people: 0, ...asset, model: 'expansion' }));

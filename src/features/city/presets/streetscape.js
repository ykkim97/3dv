export const STREET_PROPS = [
  ['sidewalk', '블록 인도', '보행 공간 · 연결 가능한 8 m 모듈', 2, 8, 0.18, '#bdc6ba'],
  ['crosswalk', '횡단보도', '도로 위 배치 · R 키로 방향 회전', 4, 3, 0.04, '#ecebd7'],
  ['street-lamp', '가로등', '야간 점등 · 따뜻한 보행 조명', 1, 1, 5, '#b3c6bd'],
  ['bench', '공원 벤치', '목재 좌석 · 산책길 쉼터', 2, 1, 1.1, '#ba9366'],
  ['bus-stop', '버스 정류장', '지붕 · 좌석 · 야간 안내판', 4, 2, 3, '#87aeb3'],
].map(([id, name, detail, width, depth, height, color]) => ({ id, name, detail, width, depth, height, color, category: 'streetscape', people: 0 }));

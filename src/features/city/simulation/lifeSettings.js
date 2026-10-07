export const LIFE_OPTIONS = [
  { key: 'cars', label: '차량', detail: '차도를 따라 이동합니다.' },
  { key: 'people', label: '보행자', detail: '도로 옆과 산책로를 걷습니다.' },
  { key: 'birds', label: '새 떼', detail: '도시 상공을 천천히 선회합니다.' },
  { key: 'garden', label: '나비 · 반딧불', detail: '공원·놀이터·수목 주변에 조금씩 나타납니다. 밤에는 반딧불로 바뀝니다.' },
  { key: 'steam', label: '시설 수증기', detail: '원자력·일반 발전소, 소형 제조공장, 자원회수시설에서 피어오릅니다.' },
];
export const LIFE_SETTING_KEYS = ['enabled', ...LIFE_OPTIONS.map(option => option.key)];
export const DEFAULT_LIFE_SETTINGS = Object.fromEntries(LIFE_SETTING_KEYS.map(key => [key, true]));

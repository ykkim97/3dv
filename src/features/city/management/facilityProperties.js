import { assetById } from '../presets/catalog.js';

export const FACILITY_STATUSES = [
  { id: 'running', name: '정상 운전' },
  { id: 'stopped', name: '정지' },
  { id: 'maintenance', name: '점검 중' },
  { id: 'fault', name: '고장' },
];
export const FACILITY_NUMBERS = {
  generationKW: { label: '발전 출력', unit: 'kW', max: 1e9 },
  demandKW: { label: '전력 수요', unit: 'kW', max: 1e9 },
  capacityKW: { label: '정격 전력 용량', unit: 'kW', max: 1e9 },
  storageKWh: { label: '저장 용량', unit: 'kWh', max: 1e9 },
  chargePercent: { label: '초기 충전량', unit: '%', max: 100 },
  flowM3h: { label: '급수·처리 유량', unit: 'm³/h', max: 1e9 },
  capacityM3h: { label: '정격 유량', unit: 'm³/h', max: 1e9 },
};
const TEXT_LIMITS = { name: 60, code: 40, notes: 500 };
const GENERATORS = new Set(['nuclear-plant', 'power-plant', 'solar-farm', 'solar-carport', 'wind-turbine', 'smart-factory']);

export function facilityName(object) {
  return object?.properties?.name?.trim() || assetById[object?.asset]?.name || '시설';
}
export function facilityStatus(object) {
  return FACILITY_STATUSES.find(status => status.id === object?.properties?.status) || FACILITY_STATUSES[0];
}
export function facilityNumberFields(object) {
  const category = assetById[object.asset]?.category;
  const keys = [];
  if (assetById[object.asset]?.powerConsumer) return ['demandKW'];
  if (object.asset === 'solar-carport') return ['generationKW', 'capacityKW'];
  if (GENERATORS.has(object.asset)) keys.push('generationKW');
  if (['residential', 'commercial', 'landmark', 'water', 'power'].includes(category)) keys.push('demandKW');
  if (category === 'power' || object.asset === 'smart-factory') keys.push('capacityKW');
  if (object.asset === 'ess') keys.push('storageKWh', 'chargePercent');
  if (category === 'water') keys.push('flowM3h', 'capacityM3h');
  return keys;
}

export function facilityPropertiesProblem(properties) {
  if (properties === undefined) return null;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return '시설 속성 형식이 올바르지 않습니다.';
  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    if (properties[key] !== undefined && (typeof properties[key] !== 'string' || properties[key].length > limit)) return `시설 ${key === 'name' ? '이름' : key === 'code' ? '설비 번호' : '메모'} 길이를 확인하세요.`;
  }
  if (properties.status !== undefined && !FACILITY_STATUSES.some(status => status.id === properties.status)) return '시설 운전 상태가 올바르지 않습니다.';
  for (const [key, spec] of Object.entries(FACILITY_NUMBERS)) {
    const value = properties[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > spec.max)) return `${spec.label}은 0~${spec.max.toLocaleString()} ${spec.unit} 범위로 입력하세요.`;
  }
  return null;
}

export function validateFacilityProperties(objects) {
  const codes = new Set();
  for (const object of objects) {
    const problem = facilityPropertiesProblem(object.properties);
    if (problem) throw new Error(problem);
    const code = object.properties?.code?.trim().toLowerCase();
    if (!code) continue;
    if (codes.has(code)) throw new Error(`중복된 설비 번호가 있습니다: ${object.properties.code}`);
    codes.add(code);
  }
}

/** One immutable transaction per Apply, rather than one scene update per keystroke. */
export function updateFacilityProperties(city, id, draft) {
  const object = city.objects.find(item => item.id === id);
  if (!object) throw new Error('시설을 찾을 수 없습니다.');
  if (object.locked) throw new Error('잠긴 시설은 먼저 잠금을 해제하세요.');
  const problem = facilityPropertiesProblem(draft);
  if (problem) throw new Error(problem);
  const properties = {};
  for (const key of Object.keys(TEXT_LIMITS)) {
    const text = draft[key]?.trim();
    if (text) properties[key] = text;
  }
  if (draft.status && draft.status !== 'running') properties.status = draft.status;
  for (const key of Object.keys(FACILITY_NUMBERS)) if (draft[key] !== undefined) properties[key] = draft[key];
  const next = { ...city, objects: city.objects.map(item => item.id === id ? { ...item, properties } : item) };
  validateFacilityProperties(next.objects);
  return next;
}

/** Copies inherit configuration, but never reuse an external equipment identifier. */
export function copiedFacilityProperties(object) {
  if (!object.properties) return {};
  const { code: _code, ...properties } = object.properties;
  if (properties.name) properties.name = `${properties.name.slice(0, 56)} 복사본`;
  return { properties };
}

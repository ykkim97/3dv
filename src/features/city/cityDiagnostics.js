import { assetById, plotHasRoadAccess } from './cityModel.js';

// Simple planning assumptions. These are coverage and capacity guides, not a traffic or demographic simulation.
export const CITY_ROLE_SPECS = {
  shop: { jobs: 12 }, cafe: { jobs: 10 }, office: { jobs: 100 }, hotel: { jobs: 45 },
  school: { radius: 55, capacity: 120 },
  hospital: { radius: 70, capacity: 300 },
  park: { radius: 45 }, playground: { radius: 35 },
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const countNear = (homes, facility, radius) => homes.reduce((sum, home) => sum + (distance(home, facility) <= radius ? assetById[home.asset].people : 0), 0);

export function analyzeCity(city, utility, fire) {
  const homes = city.objects.filter(object => assetById[object.asset]?.category === 'residential');
  const commercial = city.objects.filter(object => assetById[object.asset]?.category === 'commercial');
  const population = homes.reduce((sum, home) => sum + assetById[home.asset].people, 0);
  const jobs = commercial.reduce((sum, object) => sum + (CITY_ROLE_SPECS[object.asset]?.jobs || 0), 0);
  const disconnectedPlots = city.plots.filter(plot => !plotHasRoadAccess(city, plot));
  let lowest = Infinity, highest = -Infinity;
  for (const height of city.heights) { lowest = Math.min(lowest, height); highest = Math.max(highest, height); }
  const terrainRelief = Number.isFinite(lowest) ? highest - lowest : 0;
  const facilities = new Map();
  const access = {}, outside = {};
  for (const [kind, assets] of Object.entries({ school: ['school'], hospital: ['hospital'], park: ['park', 'playground'] })) {
    const providers = city.objects.filter(object => assets.includes(object.asset));
    const reached = homes.reduce((sum, home) => sum + (providers.some(provider => distance(home, provider) <= CITY_ROLE_SPECS[provider.asset].radius) ? assetById[home.asset].people : 0), 0);
    const capacity = providers.reduce((sum, provider) => sum + (CITY_ROLE_SPECS[provider.asset].capacity || 0), 0);
    access[kind] = { reached, capacity, count: providers.length };
    outside[kind] = homes.find(home => !providers.some(provider => distance(home, provider) <= CITY_ROLE_SPECS[provider.asset].radius))?.id ?? null;
    for (const provider of providers) facilities.set(provider.id, { ...CITY_ROLE_SPECS[provider.asset], nearbyResidents: countNear(homes, provider, CITY_ROLE_SPECS[provider.asset].radius) });
  }
  const schoolDemand = Math.ceil(population * 0.15);
  const workforce = Math.ceil(population * 0.45);
  const sections = [
    { id: 'plot', label: '부지·도로', value: `${city.plots.length - disconnectedPlots.length}/${city.plots.length}`, detail: '도로 연결 부지', warning: disconnectedPlots.length > 0 || city.plots.length === 0 },
    { id: 'residential', label: '주거', value: population.toLocaleString(), detail: `주거 ${homes.length}개 · 수용 인원`, warning: homes.length === 0 },
    { id: 'commercial', label: '상업', value: jobs.toLocaleString(), detail: `예상 일자리 · 계획 수요 ${workforce}`, warning: population > 0 && jobs < workforce },
    { id: 'landmark', label: '공공시설', value: `${fire.totals.covered}/${fire.totals.buildings}`, detail: `소방 도달 · 학교 ${access.school.reached}/${population}명 · 의료 ${access.hospital.reached}/${population}명`, warning: population > 0 && (fire.totals.covered < fire.totals.buildings || access.school.reached < population || access.hospital.reached < population || access.school.capacity < schoolDemand) },
    { id: 'power', label: '전력시설', value: `${utility.totals.power}/${utility.totals.consumers}`, detail: '예상 공급 건물', warning: utility.totals.power < utility.totals.consumers },
    { id: 'water', label: '수도시설', value: `${utility.totals.water}/${utility.totals.consumers}`, detail: '예상 공급 건물', warning: utility.totals.water < utility.totals.consumers },
    { id: 'nature', label: '공원·자연', value: `${access.park.reached}/${population}`, detail: '녹지 접근 주민', warning: population > 0 && access.park.reached < population },
    { id: 'terrain', label: '지형', value: `${terrainRelief.toFixed(1)} m`, detail: '최고·최저 고도차 · 지형 편집 가능', warning: false },
  ];
  const issues = [];
  const add = (id, title, detail, category, asset, targetId, kind) => issues.push({ id, title, detail, category, asset, targetId, kind });
  if (!city.plots.length) add('plots', '건설 부지를 조성하세요', '시설을 배치할 공간이 필요합니다.', 'plot');
  if (disconnectedPlots.length) add('roads', `도로와 떨어진 부지 ${disconnectedPlots.length}개`, '부지 옆으로 차량 도로를 연결하세요.', 'road', null, disconnectedPlots[0].id, 'plot');
  if (city.plots.length && !homes.length) add('homes', '주거 시설을 배치하세요', '인구가 있어야 도시 서비스 수요를 확인할 수 있습니다.', 'residential', 'house');
  if (population && jobs < workforce) add('jobs', `예상 일자리 ${Math.max(0, workforce - jobs)}개 부족`, '상업 시설을 배치해 주거와 일자리의 균형을 맞추세요.', 'commercial', 'shop');
  if (utility.totals.consumers && utility.totals.power < utility.totals.consumers) add('power', `전력 공급 밖 건물 ${utility.totals.consumers - utility.totals.power}개`, '발전 시설을 놓거나 공급 거점을 가까이 배치하세요.', 'power', 'power-plant', [...utility.consumers].find(([, coverage]) => !coverage.power)?.[0], 'object');
  if (utility.totals.consumers && utility.totals.water < utility.totals.consumers) add('water', `수도 공급 밖 건물 ${utility.totals.consumers - utility.totals.water}개`, '정수장을 놓거나 급수 거점을 가까이 배치하세요.', 'water', 'water-treatment', [...utility.consumers].find(([, coverage]) => !coverage.water)?.[0], 'object');
  if (fire.totals.buildings && fire.totals.covered < fire.totals.buildings) add('fire', `소방 도달 밖 건물 ${fire.totals.buildings - fire.totals.covered}개`, '소방서를 차량 도로에 연결하고 서비스 범위를 확인하세요.', 'landmark', 'fire-station', [...fire.buildings].find(([, coverage]) => !coverage.stationId)?.[0], 'object');
  if (population && access.school.reached < population) add('school', `학교 접근 밖 주민 ${population - access.school.reached}명`, '주거지 가까이에 학교를 배치하세요.', 'landmark', 'school', outside.school, 'object');
  if (population && access.school.count && access.school.capacity < schoolDemand) add('school-capacity', `예상 학교 정원 ${schoolDemand - access.school.capacity}명 부족`, '학교를 추가해 계획 정원을 확보하세요.', 'landmark', 'school');
  if (population && access.hospital.reached < population) add('hospital', `의료 접근 밖 주민 ${population - access.hospital.reached}명`, '주거지 가까이에 의료시설을 배치하세요.', 'landmark', 'hospital', outside.hospital, 'object');
  if (population && access.hospital.count && access.hospital.capacity < population) add('hospital-capacity', `예상 진료권 ${population - access.hospital.capacity}명 부족`, '의료시설을 추가해 계획 수용량을 확보하세요.', 'landmark', 'hospital');
  if (population && access.park.reached < population) add('park', `녹지 접근 밖 주민 ${population - access.park.reached}명`, '주거지 가까이에 공원이나 놀이터를 배치하세요.', 'nature', 'park', outside.park, 'object');
  return { population, jobs, workforce, schoolDemand, disconnectedPlots, access, facilities, sections, issues };
}

// Library organization is independent of persisted simulation categories and IDs.
const groups = [
  ['residential', 'low', '단독·저층', ['house', 'townhouses']],
  ['residential', 'apartments', '공동주택', ['apartment', 'tower']],
  ['commercial', 'shops', '생활 상업', ['shop', 'cafe']],
  ['commercial', 'offices', '업무·숙박', ['office', 'hotel']],
  ['industrial', 'production', '생산시설', ['smart-factory', 'small-factory', 'assembly-plant']],
  ['industrial', 'logistics', '물류·보관', ['logistics-center', 'warehouse', 'cold-storage']],
  ['transport', 'parking', '주차시설', ['parking-lot', 'parking-tower']],
  ['transport', 'transit', '대중교통', ['bus-depot']],
  ['environment', 'recycling', '재활용', ['recycling-center']],
  ['environment', 'recovery', '자원회수', ['resource-recovery']],
  ['landmark', 'public', '행정·안전', ['hall', 'fire-station', 'community-center']],
  ['landmark', 'community', '교육·의료', ['school', 'hospital']],
  ['landmark', 'culture', '문화·체육', ['library', 'gymnasium']],
  ['power', 'generation', '발전시설', ['nuclear-plant', 'power-plant']],
  ['power', 'renewable', '재생에너지', ['solar-farm', 'wind-turbine', 'solar-carport']],
  ['power', 'distribution', '송전·배전', ['substation', 'distribution', 'transmission-tower']],
  ['power', 'charging', '저장·충전', ['ess', 'fast-charger', 'slow-charger']],
  ['water', 'treatment', '취수·정수', ['intake-station', 'water-treatment']],
  ['water', 'supply', '저장·급수', ['reservoir', 'pump-station', 'water-tower']],
  ['water', 'waste', '하수처리', ['wastewater']],
  ['nature', 'parks', '공원·놀이', ['park', 'playground']],
  ['nature', 'trees', '수목·식재', ['tree', 'pine']],
  ['streetscape', 'walking', '보행·안전', ['sidewalk', 'crosswalk']],
  ['streetscape', 'amenities', '조명·휴식', ['street-lamp', 'bench', 'bus-stop']],
];
const byAsset = new Map(groups.flatMap(([category, id, name, assets]) => assets.map(asset => [asset, { category, id, name }])));
export const libraryCategory = asset => byAsset.get(asset.id)?.category || asset.category;
export const librarySubcategory = asset => byAsset.get(asset.id)?.name || '';
export function libraryGroups(category, assets) {
  return groups.filter(([parent, , , ids]) => parent === category && assets.some(asset => ids.includes(asset.id)))
    .map(([, id, name, ids]) => ({ id, name, count: assets.filter(asset => ids.includes(asset.id)).length }));
}
const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
export function filterLibrary(assets, category, subgroup = 'all', query = '') {
  const words = query.trim().split(/\s+/).filter(Boolean).map(normalize);
  return assets.filter(asset => libraryCategory(asset) === category && (subgroup === 'all' || byAsset.get(asset.id)?.id === subgroup)
    && words.every(word => normalize(`${asset.name} ${asset.detail} ${asset.id} ${librarySubcategory(asset)}`).includes(word)));
}

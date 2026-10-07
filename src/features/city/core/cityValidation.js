import { MAP_SIZES, mapDimensions } from './mapDimensions.js';
import { PRESETS, assetById, ROAD_TYPES } from '../presets/catalog.js';
import { PLOT_SURFACES } from '../plots/plotModel.js';
import { bridgeById } from '../presets/bridgePresets.js';
import { validateConnections } from '../connections/connectionModel.js';
import { validateFacilityProperties } from '../management/facilityProperties.js';
import { LIFE_SETTING_KEYS } from '../simulation/lifeSettings.js';

export function validateCity(value) {
  if (value?.powerSupplyMode !== undefined && !['range', 'network'].includes(value.powerSupplyMode)) throw new Error('전력 공급 판정 방식이 올바르지 않습니다.');
  if (value?.waterSupplyMode !== undefined && !['range', 'network'].includes(value.waterSupplyMode)) throw new Error('수도 공급 판정 방식이 올바르지 않습니다.');
  if (value?.environment !== undefined) {
    const env = value.environment;
    if (!env || !Number.isFinite(env.hour) || env.hour < 0 || env.hour >= 24 || typeof env.autoCycle !== 'boolean'
      || !Number.isFinite(env.cycleMinutes) || env.cycleMinutes < 1 || env.cycleMinutes > 60) throw new Error('시간·조명 설정이 올바르지 않습니다.');
  }
  if (!value || value.version !== 1 || typeof value.name !== 'string' || value.name.length > 80 || !PRESETS.some(p => p.id === value.preset)) throw new Error('지원하지 않는 도시 파일입니다.');
  if (value.map !== undefined && (!value.map || !MAP_SIZES.includes(value.map.size) || value.map.resolution !== value.map.size / 2 || value.map.cellSize !== 2)) throw new Error('지도 크기 데이터가 올바르지 않습니다.');
  const { resolution, half, cameraLimit } = value.map ? mapDimensions(value) : mapDimensions();
  if (!Array.isArray(value.heights) || value.heights.length !== (resolution + 1) ** 2 || value.heights.some(h => !Number.isFinite(h) || h < -30 || h > 60)) throw new Error('지형 데이터가 올바르지 않습니다.');
  if (value.terrainPaint !== undefined && (!Array.isArray(value.terrainPaint) || value.terrainPaint.length !== value.heights.length || value.terrainPaint.some(color => color !== null && (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))))) throw new Error('지형 색상 데이터가 올바르지 않습니다.');
  if (value.waterSettings !== undefined) {
    const validWater = settings => settings && typeof settings === 'object' && !Array.isArray(settings) && ['enabled', 'flowing'].every(key => settings[key] === undefined || typeof settings[key] === 'boolean') && (settings.color === undefined || typeof settings.color === 'string' && /^#[0-9a-f]{6}$/i.test(settings.color)) && (settings.opacity === undefined || Number.isFinite(settings.opacity) && settings.opacity >= 0.3 && settings.opacity <= 1);
    if (!validWater(value.waterSettings) || value.waterSettings.regions !== undefined && (!Array.isArray(value.waterSettings.regions) || value.waterSettings.regions.length > resolution ** 2 || value.waterSettings.regions.some(region => !validWater(region) || !Number.isInteger(region.anchor) || region.anchor < 0 || region.anchor >= resolution ** 2))) throw new Error('수면 설정 데이터가 올바르지 않습니다.');
  }
  const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) <= half && Math.abs(p.z) <= half;
  if (!Array.isArray(value.objects) || value.objects.length > 5000 || value.objects.some(o => !validPoint(o) || !assetById[o.asset] || typeof o.id !== 'string' || !Number.isFinite(o.rotation))) throw new Error('시설 데이터가 올바르지 않습니다.');
  validateFacilityProperties(value.objects);
  if (!Array.isArray(value.roads) || value.roads.length > 2000 || value.roads.some(r => typeof r.id !== 'string' || !ROAD_TYPES.some(t => t.id === r.type) || !validPoint(r.a) || !validPoint(r.b))) throw new Error('도로 데이터가 올바르지 않습니다.');
  if (!Array.isArray(value.plots) || value.plots.length > 1000 || value.plots.some(p => !validPoint(p) || typeof p.id !== 'string' || (p.surface !== undefined && !PLOT_SURFACES.some(surface => surface.id === p.surface)) || !Number.isFinite(p.width) || !Number.isFinite(p.depth) || p.width < 4 || p.width > 80 || p.depth < 4 || p.depth > 80 || Math.abs(p.x) + p.width / 2 > half || Math.abs(p.z) + p.depth / 2 > half)) throw new Error('부지 데이터가 올바르지 않습니다.');
  const all = [...value.objects, ...value.roads, ...value.plots];
  if (value.roads.some(road => road.bridge !== undefined && (!bridgeById[road.bridge] || bridgeById[road.bridge].type !== road.type))) throw new Error('교량 프리셋 데이터가 올바르지 않습니다.');
  if (all.some(item => item.locked !== undefined && typeof item.locked !== 'boolean') || value.roads.some(road => road.chainId !== undefined && (typeof road.chainId !== 'string' || road.chainId.length > 100))) throw new Error('선택 잠금 또는 도로 그룹 데이터가 올바르지 않습니다.');
  if (value.districts !== undefined) {
    const assigned = new Set();
    if (!Array.isArray(value.districts) || value.districts.length > 100 || value.districts.some(district => !district || typeof district.id !== 'string' || typeof district.name !== 'string' || district.name.length > 40 || !/^#[0-9a-f]{6}$/i.test(district.color) || !Array.isArray(district.plotIds) || district.plotIds.some(id => { if (!value.plots.some(plot => plot.id === id) || assigned.has(id)) return true; assigned.add(id); return false; })) || new Set(value.districts.map(item => item.id)).size !== value.districts.length) throw new Error('구역 데이터가 올바르지 않습니다.');
  }
  if (value.lifeSettings !== undefined && (!value.lifeSettings || typeof value.lifeSettings !== 'object' || Array.isArray(value.lifeSettings) || LIFE_SETTING_KEYS.some(key => value.lifeSettings[key] !== undefined && typeof value.lifeSettings[key] !== 'boolean'))) throw new Error('도시 생활 연출 설정이 올바르지 않습니다.');
  if (value.cameraViews !== undefined && (!Array.isArray(value.cameraViews) || value.cameraViews.length > 30 || value.cameraViews.some(view => !view || typeof view.id !== 'string' || typeof view.name !== 'string' || view.name.length > 40 || !Number.isFinite(view.alpha) || !Number.isFinite(view.beta) || view.beta < 0 || view.beta > Math.PI / 2 || !Number.isFinite(view.radius) || view.radius < 2 || view.radius > cameraLimit || !view.target || [view.target.x, view.target.y, view.target.z].some(axis => !Number.isFinite(axis) || Math.abs(axis) > 10000) || view.screenOffset !== undefined && (!view.screenOffset || [view.screenOffset.x, view.screenOffset.y].some(axis => !Number.isFinite(axis) || Math.abs(axis) > 10000))) || new Set(value.cameraViews.map(view => view.id)).size !== value.cameraViews.length)) throw new Error('카메라 시점 데이터가 올바르지 않습니다.');
  if (new Set(all.map(o => o.id)).size !== all.length) throw new Error('중복된 시설 ID가 있습니다.');
  validateConnections(value);
  return value;
}

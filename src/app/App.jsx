import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CityEngine } from '../features/city/CityEngine';
import { ASSETS, MAP_SIZES, mapDimensions, expandCity, assetById, BRUSHES, CATEGORIES, createCity, PRESETS, ROAD_TYPES, PLOT_TYPES, PLOT_SURFACES, plotSurface, placementProblem, plotHasRoadAccess, unbuildableCells, validateCity, planBuildingCopies, planGroupTransform, roadProblem } from '../features/city/cityModel';
import Icon from '../features/city/CityIcon';
import { calculateUtilityService } from '../features/city/utilityService';
import { calculateFireService, FIRE_ROUTE_LIMIT } from '../features/city/fireService';
import { analyzeCity, CITY_ROLE_SPECS } from '../features/city/cityDiagnostics';
import { defaultMapLayers, MAP_LAYERS, roleLayer, managementMetrics, compareManagementMetrics } from '../features/city/cityManagement';
import { FacilityDirectory, MapLayerControls, EditResults } from '../features/city/FacilityManagement.jsx';
import { roadTerrainWarning } from '../features/city/roadGeometry';
import { waterRegions, waterSettings } from '../features/city/waterModel';
import WaterPanel, { WaterControls } from '../features/city/WaterPanel';
import DistrictPanel, { BatchControls } from '../features/city/DistrictPanel';
import CameraPanel from '../features/city/CameraPanel';
import RoadLibrary from '../features/city/RoadLibrary';
import LightingPanel from '../features/city/LightingPanel';
import CityExportPanel from '../features/city/CityExportPanel';
import { saveCityFile } from '../features/city/cityFiles.js';
import { BRIDGE_PRESETS, bridgeById } from '../features/city/bridgePresets';
import { planBatch, setLocked, cleanDistricts } from '../features/city/cityExpansion';
import './App.css';
import './CityHud.css';

const STORAGE_KEY = 'lumatrix-city-v1';
function initialCity() {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) return validateCity(JSON.parse(saved)); } catch { /* Invalid saves must not block the editor. */ }
  return createCity('river');
}
function AssetPreview({ asset }) {
  if (asset.category === 'streetscape') return <div className={`asset-preview prop-preview prop-${asset.id}`}><span className="prop-thumbnail" /><span className="prop-thumbnail-detail" /></div>;
  const icons = { townhouses: 'townhouse', cafe: 'cafe', 'fire-station': 'fire', playground: 'playground', 'power-plant': 'power', 'solar-farm': 'solar', ess: 'battery', substation: 'substation', distribution: 'power', 'wind-turbine': 'wind', 'transmission-tower': 'tower', 'water-treatment': 'treatment', reservoir: 'tank', 'pump-station': 'pump', wastewater: 'treatment', 'intake-station': 'intake', 'water-tower': 'water-tower' };
  if (icons[asset.id]) {
    return <div className={`asset-preview utility-preview ${asset.category}`} style={{ '--asset-color': asset.color }}><span className="utility-platform" /><span className="utility-symbol"><Icon name={icons[asset.id]} size={34} /></span><span className="utility-module one" /><span className="utility-module two" /></div>;
  }
  return <div className="asset-preview" style={{ '--asset-color': asset.color, '--building-height': `${Math.min(61, 22 + asset.height * 1.3)}px` }}><span className="model-ground" />{asset.category === 'nature' ? <><span className="model-tree one" /><span className="model-tree two" /><span className="model-tree three" /></> : <><span className={`model-building ${asset.id === 'house' ? 'model-house' : ''}`} /><span className="model-small-tree" /></>}</div>;
}
function SurfacePicker({ value, onChange, disabled = false }) {
  return <div className="surface-picker" role="group" aria-label="부지 표면">{PLOT_SURFACES.map(surface => <button disabled={disabled} key={surface.id} aria-pressed={value === surface.id} className={value === surface.id ? 'active' : ''} onClick={() => onChange(surface.id)}><i style={{ background: surface.color }} />{surface.name}</button>)}</div>;
}
function PlotObjectList({ objects, onSelect, onMove, onRemove }) {
  return <div className="plot-object-list"><strong>부지 내 시설 · {objects.length}</strong>{objects.length ? <ul>{objects.map(object => <li key={object.id}><button className="plot-object-name" onClick={() => onSelect(object.id)}>{assetById[object.asset].name}<small>{object.x.toFixed(1)}, {object.z.toFixed(1)} m</small></button><button aria-label={`${assetById[object.asset].name} 이동`} title="이동" onClick={() => onMove(object.id)}><Icon name="cursor" size={13} /></button><button aria-label={`${assetById[object.asset].name} 철거`} title="철거" onClick={() => onRemove(object.id)}><Icon name="bulldoze" size={13} /></button></li>)}</ul> : <small>배치된 시설이 없습니다.</small>}</div>;
}
function CopyControls({ count, setCount, gap, setGap, direction, setDirection, onCopy, problem }) {
  return <div className="copy-controls"><strong>같은 간격으로 복제</strong><div className="copy-inputs"><label>개수<input aria-label="복제 개수" type="number" min="1" max="12" step="1" value={count} onChange={e => setCount(Number(e.target.value))} /></label><label>간격<input aria-label="복제 간격" type="number" min="0" max="10" step="0.5" value={gap} onChange={e => setGap(Number(e.target.value))} /> m</label></div><div className="copy-actions"><select aria-label="복제 방향" value={direction} onChange={e => setDirection(e.target.value)}><option value="x+">동쪽 →</option><option value="x-">서쪽 ←</option><option value="z+">북쪽 ↑</option><option value="z-">남쪽 ↓</option></select><button disabled={!!problem} onClick={onCopy}>연속 복제</button></div><small className={problem ? 'copy-problem' : 'copy-ready'}>{problem || `${count}개 배치 가능`}</small></div>;
}
function ServiceStatus({ coverage, facility, service }) {
  if (coverage) return <div className="service-status"><strong>기반시설 공급</strong>{[['power', '전력'], ['water', '수도']].map(([kind, label]) => {
    const provider = service.facilities.get(coverage[kind]);
    return <div key={kind} className={provider ? 'connected' : 'disconnected'}><span>{label}</span><b>{provider ? '공급 범위 안' : '공급 범위 밖'}</b><small>{provider ? assetById[provider.asset].name : '가까운 공급 시설 없음'}</small></div>;
  })}<small className="service-explanation">거리 기반 예상 범위 · 전선과 수도관은 아직 연결하지 않습니다.</small></div>;
  if (!facility) return null;
  const status = facility.role === 'terminal' ? '하수 처리 시설' : facility.role === 'support' ? facility.connected ? '정수장 인접' : '정수장 연결 필요' : facility.connected ? facility.role === 'source' ? '공급 시작점' : '공급 거점과 연결됨' : '공급 거점과 떨어져 있음';
  return <div className="service-status"><strong>{facility.network === 'power' ? '전력' : '수도'} 공급 정보</strong><div className={facility.role === 'terminal' ? '' : facility.connected ? 'connected' : 'disconnected'}><span>상태</span><b>{status}</b></div>{facility.radius > 0 && <div><span>예상 범위</span><b>{facility.connected ? `${facility.radius} m` : '비활성'}</b><small>범위 내 건물 {facility.connected ? facility.served : 0}개</small></div>}<small className="service-explanation">거리 기반 예상 범위 · 실제 공급량과 관로는 계산하지 않습니다.</small></div>;
}
function FireStatus({ building, station }) {
  if (station) return <div className="service-status fire-status"><strong>소방 도로 접근</strong><div className={station.roadConnected ? 'connected' : 'disconnected'}><span>소방서</span><b>{station.roadConnected ? '차량 도로 연결됨' : '차량 도로 연결 필요'}</b></div><div><span>도달 건물</span><b>{station.served}개</b><small>도로 이동거리 {FIRE_ROUTE_LIMIT} m 이내</small></div><small className="service-explanation">도로를 따라 이동한 거리의 예상 범위입니다.</small></div>;
  if (!building) return null;
  const status = building.stationId ? '소방서 도달 가능' : !building.roadAccess ? '부지에 차량 도로 연결 필요' : building.nearestRouteMeters !== null ? '소방서 이동거리 초과' : '연결된 소방서 없음';
  return <div className="service-status fire-status"><strong>소방 도로 접근</strong><div className={building.stationId ? 'connected' : 'disconnected'}><span>상태</span><b>{status}</b>{building.routeMeters !== null && <small>도로 이동거리 {Math.round(building.routeMeters)} m</small>}{!building.stationId && building.nearestRouteMeters !== null && <small>가장 가까운 소방서까지 {Math.round(building.nearestRouteMeters)} m · 기준 {FIRE_ROUTE_LIMIT} m</small>}</div><small className="service-explanation">차량 도로 연결과 도로 이동거리로 계산합니다.</small></div>;
}
function RoleStatus({ object, diagnostics }) {
  const asset = assetById[object.asset];
  const spec = CITY_ROLE_SPECS[object.asset];
  const facility = diagnostics.facilities.get(object.id);
  if (asset.category === 'residential') return <div className="role-status">주거 수용 인원 <b>{asset.people}명</b></div>;
  if (spec?.jobs) return <div className="role-status">예상 일자리 <b>{spec.jobs}개</b></div>;
  if (facility) return <div className="role-status">예상 접근 반경 <b>{facility.radius} m</b><span>반경 안의 주민 {facility.nearbyResidents}명{facility.capacity ? ` · 계획 수용 ${facility.capacity}명` : ''}</span></div>;
  return null;
}
function CityDiagnostics({ diagnostics, onClose, onIssue, changes, hasPrevious }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="city-diagnostics glass" role="dialog" aria-modal="true" aria-labelledby="city-diagnostics-title">
    <button className="modal-close" aria-label="도시 진단 닫기" onClick={onClose}><Icon name="close" size={18} /></button>
    <span className="eyebrow">CITY OVERVIEW</span><h2 id="city-diagnostics-title">도시 진단</h2><p>부지부터 생활 서비스까지 현재 도시의 큰 흐름을 확인하세요. 수치와 반경은 초기 계획 기준입니다.</p>
    <EditResults changes={changes} hasPrevious={hasPrevious} />
    <div className="diagnostics-grid">{diagnostics.sections.map(section => <article key={section.id} className={section.warning ? 'needs-attention' : ''}><div><Icon name={CATEGORIES.find(category => category.id === section.id)?.icon || 'info'} size={17} /><span>{section.label}</span></div><strong>{section.value}</strong><small>{section.detail}</small></article>)}</div>
    <div className="diagnostics-issues"><h3>다음에 개선할 것 <span>{diagnostics.issues.length}</span></h3>{diagnostics.issues.length ? <ul>{diagnostics.issues.map(issue => <li key={issue.id}><div><strong>{issue.title}</strong><small>{issue.detail}</small></div><div className="diagnostics-issue-actions">{issue.targetId && <button onClick={() => onIssue(issue, 'locate')}>대상 보기</button>}<button onClick={() => onIssue(issue, 'build')}>{issue.asset ? '시설 배치' : issue.targetId ? '도로 연결' : '시작하기'} <Icon name="plus" size={13} /></button></div></li>)}</ul> : <p>현재 계획 기준에서 확인된 부족 항목이 없습니다.</p>}</div>
    <small className="diagnostics-method">계획 기준: 일자리 수요는 인구의 45%, 학교 정원 수요는 15%로 계산합니다. 접근성은 직선거리, 소방은 차량 도로 이동거리로 계산합니다.</small>
  </section></div>;
}
function MiniMap({ city, waters, infoVisible, blocked, disconnected, service, fire, layers, onNavigate }) {
  const { size, half, resolution } = mapDimensions(city);
  const waterTiles = new Map();
  if (city.waterSettings?.enabled !== false) for (const region of waters) {
    const settings = waterSettings(city, region);
    if (!settings.enabled) continue;
    for (const cell of region.cells) {
      const r = Math.floor(Math.floor(cell / resolution) / 4) * 4, c = Math.floor(cell % resolution / 4) * 4;
      waterTiles.set(`${r}:${c}`, { r, c, color: settings.color });
    }
  }
  const samples = [...waterTiles].map(([key, tile]) => <rect key={key} x={tile.c * 2} y={tile.r * 2} width="8" height="8" fill={tile.color} />);
  const navigate = event => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onNavigate(point.x - half, half - point.y);
  };
  return <svg viewBox={`0 0 ${size} ${size}`} aria-label="도시 지도 · 클릭하여 해당 지역으로 이동, Enter로 중앙 이동" role="button" tabIndex={0} onClick={navigate} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNavigate(0, 0); } }}>
    <rect width={size} height={size} fill="#738468" />{samples}
    {infoVisible && blocked.map(cell => <rect key={`${cell.x}:${cell.z}`} x={cell.x + (half - 6)} y={(half - 6) - cell.z} width="12" height="12" fill={cell.reason === 'water' ? '#d56d6d88' : '#bb855755'} />)}
    {city.plots.map(p => <rect key={p.id} x={p.x + half - p.width / 2} y={half - p.z - p.depth / 2} width={p.width} height={p.depth} fill={plotSurface(p.surface).color} stroke={infoVisible && disconnected.has(p.id) ? '#ff9a62' : '#c8d6a4'} strokeWidth={infoVisible && disconnected.has(p.id) ? '2.5' : '0.7'} />)}
    {infoVisible && [...service.facilities.values()].filter(facility => layers[facility.network] && facility.connected && facility.radius > 0).map(facility => <circle key={`range-${facility.id}`} cx={facility.x + half} cy={half - facility.z} r={facility.radius} fill={facility.network === 'power' ? '#f2d47a' : '#78d4df'} fillOpacity="0.12" stroke={facility.network === 'power' ? '#f2d47a' : '#78d4df'} strokeOpacity="0.65" strokeWidth="0.8" />)}
    {infoVisible && city.objects.filter(object => layers[roleLayer(object.asset)]).map(object => {
      const spec = CITY_ROLE_SPECS[object.asset], color = MAP_LAYERS.find(layer => layer.id === roleLayer(object.asset)).color;
      return <circle key={`role-${object.id}`} cx={object.x + half} cy={half - object.z} r={spec.radius} fill={color} fillOpacity="0.08" stroke={color} strokeOpacity="0.7" strokeWidth="0.8" />;
    })}
    {city.roads.map(r => <line key={r.id} x1={r.a.x + half} y1={half - r.a.z} x2={r.b.x + half} y2={half - r.b.z} stroke={r.bridge ? '#e0bd80' : '#c8ccbc'} strokeWidth={r.bridge ? 3 : 2} />)}
    {infoVisible && layers.fire && fire.routes.map((route, index) => <line key={`fire-route-${index}`} x1={route.a.x + half} y1={half - route.a.z} x2={route.b.x + half} y2={half - route.b.z} stroke="#ffae76" strokeWidth="2.8" />)}
    {city.objects.filter(o => !['tree', 'pine'].includes(o.asset)).map(o => {
      const coverage = service.consumers.get(o.id);
      const power = layers.power && coverage?.power, water = layers.water && coverage?.water;
      const fill = infoVisible && coverage && (layers.power || layers.water) ? power && water ? '#b7e8ba' : power ? '#e7c77e' : water ? '#7bd3dc' : '#e98778' : assetById[o.asset].category === 'nature' ? '#adc48b' : '#e1e5d7';
      return <rect key={o.id} x={o.x + (half - 3)} y={(half - 3) - o.z} width="6" height="6" fill={fill} stroke={infoVisible && layers.fire && fire.buildings.get(o.id)?.stationId ? '#ffae76' : 'none'} strokeWidth="1.5" />;
    })}
    {infoVisible && [...service.facilities.values()].filter(facility => layers[facility.network]).map(facility => <circle key={`facility-${facility.id}`} cx={facility.x + half} cy={half - facility.z} r="2.5" fill={facility.role === 'terminal' ? '#9caaa6' : facility.connected ? facility.network === 'power' ? '#f2d47a' : '#78d4df' : '#e98778'} stroke="#233c35" strokeWidth="0.7" />)}
    {infoVisible && layers.fire && [...fire.stations.values()].map(station => <circle key={`fire-station-${station.id}`} cx={station.x + half} cy={half - station.z} r="3" fill={station.roadConnected ? '#ffae76' : '#e98778'} stroke="#233c35" strokeWidth="0.8" />)}
  </svg>;
}
export default function App() {
  const [history, setHistory] = useState(() => ({ past: [], current: initialCity(), future: [] }));
  const city = history.current;
  const [category, setCategory] = useState('plot');
  const [mode, setMode] = useState('select');
  const [asset, setAsset] = useState('house');
  const [brush, setBrush] = useState('raise');
  const [paintColor, setPaintColor] = useState('#648b49');
  const [road, setRoad] = useState('street');
  const [bridge, setBridge] = useState(null);
  const [roadShape, setRoadShape] = useState('straight');
  const [roadContinuous, setRoadContinuous] = useState(true);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [lifeOpen, setLifeOpen] = useState(false);
  const [boxSelect, setBoxSelect] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [plot, setPlot] = useState('medium');
  const [surface, setSurface] = useState('grass');
  const [gridVisible, setGridVisible] = useState(true);
  const [infoVisible, setInfoVisible] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);
  const [mapLayers, setMapLayers] = useState(defaultMapLayers);
  const [radius, setRadius] = useState(12);
  const [strength, setStrength] = useState(0.5);
  const [rotation, setRotation] = useState(0);
  const [align, setAlign] = useState(true);
  const [gap, setGap] = useState(1);
  const [copyCount, setCopyCount] = useState(1);
  const [copyDirection, setCopyDirection] = useState('x+');
  const [movingId, setMovingId] = useState(null);
  const [selection, setSelection] = useState({ single: null, ids: [], kind: null });
  const selected = selection.single;
  const selectedIds = selection.ids;
  const [groupDx, setGroupDx] = useState(6);
  const [groupDz, setGroupDz] = useState(0);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [newMapSize, setNewMapSize] = useState(240);
  const [helpOpen, setHelpOpen] = useState(false);
  const [lightingOpen, setLightingOpen] = useState(false);
  const night = (city.environment?.hour ?? 12) < 6 || (city.environment?.hour ?? 12) >= 19;
  const [trayOpen, setTrayOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const canvas = useRef(null), engine = useRef(null), fileInput = useRef(null), brushLabel = useRef(null);
  const setSelected = useCallback((id, kind = null) => setSelection({ single: id, ids: id && kind !== 'water' ? [id] : [], kind }), []);
  const onSceneSelect = useCallback((id, additive = false, kind = null) => {
    setSelection(previous => {
      if (Array.isArray(id)) return { single: id.length === 1 ? id[0] : null, ids: id, kind: 'mixed' };
      if (!additive || kind === 'water') return { single: id, ids: id && kind !== 'water' ? [id] : [], kind };
      const base = previous.ids;
      const ids = base.includes(id) ? base.filter(item => item !== id) : [...base, id];
      return { single: ids.length === 1 ? ids[0] : null, ids, kind: 'mixed' };
    });
  }, []);
  const commit = useCallback(next => { setHistory(h => {
    const current = typeof next === 'function' ? next(h.current) : next;
    const normalized = cleanDistricts(current);
    return { past: [...h.past.slice(-24), h.current], current: normalized, future: [] };
  }); setSaved(false); }, []);
  const lockSelection = useCallback(locked => { commit(current => setLocked(current, selectedIds, locked)); setNotice(locked ? '선택한 대상을 잠갔습니다.' : '선택 잠금을 해제했습니다.'); }, [commit, selectedIds]);
  const applyBatchAction = useCallback(action => {
    if (action === 'rotate') {
      const plan = planGroupTransform(city, selectedIds, 'rotate');
      if (plan.problem) { setNotice(plan.problem); return; }
      commit(current => ({ ...current, objects: [...current.objects.filter(item => !selectedIds.includes(item.id)), ...plan.objects] }));
      return;
    }
    const plan = planBatch(city, selectedIds, action, groupDx, groupDz);
    if (plan.problem) { setNotice(plan.problem); return; }
    commit(plan.city); if (action === 'delete') setSelected(null);
    setNotice(`${plan.count}개 대상을 ${action === 'copy' ? '복제' : action === 'delete' ? '삭제' : '이동'}했습니다.`);
  }, [city, selectedIds, groupDx, groupDz, commit, setSelected]);
  const undo = useCallback(() => { setHistory(h => h.past.length ? { past: h.past.slice(0, -1), current: h.past.at(-1), future: [h.current, ...h.future] } : h); setSelected(null); setSaved(false); }, [setSelected]);
  const redo = useCallback(() => { setHistory(h => h.future.length ? { past: [...h.past, h.current], current: h.future[0], future: h.future.slice(1) } : h); setSelected(null); setSaved(false); }, [setSelected]);
  const save = useCallback(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(city)); setSaved(true); setNotice('이 브라우저에 도시를 저장했습니다.'); } catch { setNotice('저장 공간이 부족합니다. 파일로 내보내기를 사용하세요.'); } }, [city]);
  useEffect(() => {
    let instance;
    try { instance = new CityEngine(canvas.current, next => { commit(next); setMode(current => current === 'move' ? 'select' : current); }, onSceneSelect, setNotice, position => {
      if (!brushLabel.current) return;
      brushLabel.current.hidden = !position;
      if (position) { brushLabel.current.style.left = `${position.x + 19}px`; brushLabel.current.style.top = `${position.y - 25}px`; brushLabel.current.textContent = position.label; brushLabel.current.classList.toggle('invalid', !!position.invalid);
      }
    }, setError); engine.current = instance; }
    catch (err) { queueMicrotask(() => setError(`3D 화면을 시작하지 못했습니다. WebGL 설정을 확인해 주세요. ${err.message}`)); }
    return () => { instance?.dispose(); engine.current = null; };
  }, [commit, onSceneSelect]);
  useEffect(() => { if (engine.current && engine.current.renderedCity !== city) engine.current.setCity(city); });
  useEffect(() => { engine.current?.setOptions({ mode, asset, brush, paintColor, road, plot, radius, strength, rotation, surface, align, gap, movingId, roadShape, roadContinuous, boxSelect, bridge }); }, [mode, asset, brush, paintColor, road, plot, radius, strength, rotation, surface, align, gap, movingId, roadShape, roadContinuous, boxSelect, bridge]);
  useEffect(() => { engine.current?.setGridVisible(gridVisible); }, [gridVisible]);
  useEffect(() => { engine.current?.setInfoVisible(infoVisible); }, [infoVisible]);
  useEffect(() => { engine.current?.setMapLayers(mapLayers); }, [mapLayers]);
  useEffect(() => { engine.current?.select(selectedIds.length > 1 ? selectedIds : selected); }, [selected, selectedIds, city]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  const removeSelected = useCallback(() => {
    if (selected?.startsWith('water:')) { setNotice('물 비우기는 선택한 수역의 물 설정에서 변경하세요.'); return; }
    if (selectedIds.length) applyBatchAction('delete');
  }, [selected, selectedIds, applyBatchAction]);
  useEffect(() => {
    const keydown = event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key === 'escape') { setBoxSelect(false); setMode('select'); setMovingId(null); setSelected(null); setPresetsOpen(false); setHelpOpen(false); setDiagnosticsOpen(false); setDirectoryOpen(false); setWaterOpen(false); setDistrictOpen(false); setLifeOpen(false); setCameraOpen(false); engine.current?.cancelPlotDraft(); if (engine.current) engine.current.roadStart = null; }
      if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if ((event.ctrlKey || event.metaKey) && key === 'y') { event.preventDefault(); redo(); }
      if ((event.ctrlKey || event.metaKey) && key === 's') { event.preventDefault(); save(); }
      if (key === 'r' && !event.ctrlKey && !event.metaKey) setRotation(r => r + Math.PI / 2);
      if (key === 'delete') removeSelected();
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [undo, redo, save, removeSelected, setSelected]);
  const selectCategory = id => { engine.current?.cancelPlotDraft(); setMovingId(null); setCategory(id); setSearch(''); setTrayOpen(true); setMode(['terrain', 'road', 'plot'].includes(id) ? id : 'select'); };
  const rotateSelected = () => {
    const o = city.objects.find(item => item.id === selected);
    if (o.locked) { setNotice('잠긴 시설은 먼저 잠금을 해제하세요.'); return; }
    const problem = placementProblem(city, o.asset, o.x, o.z, o.rotation + Math.PI / 2, o.id);
    if (problem) { setNotice(problem); return; }
    commit(c => ({ ...c, objects: c.objects.map(item => item.id === selected ? { ...item, rotation: item.rotation + Math.PI / 2 } : item) }));
  };
  const startMoving = id => { if (city.objects.find(item => item.id === id)?.locked) { setNotice('잠긴 시설은 먼저 잠금을 해제하세요.'); return; } setSelected(id); setMovingId(id); setMode('move'); setNotice('이동할 위치를 부지 안에서 클릭하세요. Esc로 취소할 수 있습니다.'); };
  const copySelected = () => {
    if (!object) return;
    if (object.locked) { setNotice('잠긴 시설은 먼저 잠금을 해제하세요.'); return; }
    const { copies, problem } = planBuildingCopies(city, object, copyCount, gap, copyDirection);
    if (problem) { setNotice(problem); return; }
    commit(c => ({ ...c, objects: [...c.objects, ...copies.map(copy => ({ ...copy, id: crypto.randomUUID() }))] }));
    setNotice(`${copies.length}개 건물을 같은 간격으로 배치했습니다.`);
  };
  const removeObject = id => { if (city.objects.find(item => item.id === id)?.locked) { setNotice('잠긴 시설은 먼저 잠금을 해제하세요.'); return; } commit(c => ({ ...c, objects: c.objects.filter(item => item.id !== id) })); if (selected === id) setSelected(null); };
  const exportCity = async name => {
    const result = await saveCityFile(city, name);
    if (result === 'cancelled') return;
    setExportOpen(false);
    setNotice(result === 'saved' ? '선택한 위치에 도시 파일을 저장했습니다.' : '도시 파일 다운로드를 요청했습니다.');
  };
  const expandCurrentCity = () => {
    try {
      commit(expandCity(city)); setSelected(null); setMode('select'); setPresetsOpen(false);
      setNotice('지도를 480 × 480 m로 확장했습니다. 기존 도시와 지형을 유지했습니다. 실행 취소로 되돌릴 수 있습니다.');
    } catch (error) { setNotice(`지도 확장 실패: ${error.message}`); }
  };
  const importCity = async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { if (file.size > 8_000_000) throw new Error('8MB 이하의 도시 파일을 선택해 주세요.'); commit(validateCity(JSON.parse(await file.text()))); setSelected(null); setMode('select'); setNotice('도시 파일을 불러왔습니다.'); }
    catch (err) { setNotice(`불러오기 실패: ${err.message}`); }
  };
  const exportImage = async () => {
    try {
      if (!engine.current) throw new Error('3D 화면이 준비되지 않았습니다.');
      const blob = await engine.current.captureImage(), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `${city.name.replace(/[<>:"/\\|?*]/g, '_')}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('도시 이미지를 저장했습니다.');
    } catch (error) { setNotice(error.message); }
  };
  const object = city.objects.find(o => o.id === selected), selectedRoad = city.roads.find(r => r.id === selected);
  const selectedPlot = city.plots.find(p => p.id === selected);
  const waters = useMemo(() => waterRegions(city), [city]);
  const selectedWater = waters.find(region => region.id === selected);
  const changeWater = (patch, region = null) => commit(current => {
    const settings = current.waterSettings || {};
    if (!region) return { ...current, waterSettings: { ...settings, ...patch } };
    const regions = settings.regions || [];
    const existing = regions.find(item => region.cells.includes(item.anchor));
    return { ...current, waterSettings: { ...settings, regions: [...regions.filter(item => !region.cells.includes(item.anchor)), { ...existing, anchor: region.anchor, ...patch }] } };
  });
  const changeRoadType = type => {
    if (!selectedRoad || selectedRoad.type === type) return;
    if (selectedRoad.locked) { setNotice('잠긴 도로는 먼저 잠금을 해제하세요.'); return; }
    const candidates = city.roads.filter(item => item.id === selectedRoad.id || selectedRoad.chainId && item.chainId === selectedRoad.chainId).map(item => ({ ...item, type }));
    if (candidates.some(item => item.locked)) { setNotice('같은 도로에 잠긴 구간이 있습니다. 잠금을 해제하세요.'); return; }
    const candidateIds = new Set(candidates.map(item => item.id));
    const network = { ...city, roads: city.roads.map(item => candidateIds.has(item.id) ? candidates.find(road => road.id === item.id) : item) };
    const problem = candidates.map(candidate => roadProblem(network, candidate)).find(Boolean);
    if (problem) { setNotice(problem); return; }
    commit(network);
    setNotice(roadTerrainWarning(network, candidates[0]) || `${ROAD_TYPES.find(road => road.id === type).name}로 변경했습니다.`);
  };
  const chooseBridge = id => { setBridge(id); setRoad(bridgeById[id].type); setRoadShape('straight'); setRoadContinuous(false); setMode('road'); };
  const changeBridgePreset = id => {
    if (selectedRoad.locked) { setNotice('잠긴 교량은 먼저 잠금을 해제하세요.'); return; }
    const candidate = { ...selectedRoad, bridge: id, type: bridgeById[id].type }, problem = roadProblem(city, candidate);
    if (problem) { setNotice(problem); return; }
    commit(current => ({ ...current, roads: current.roads.map(road => road.id === candidate.id ? candidate : road) }));
    setNotice(`${bridgeById[id].name}로 변경했습니다.`);
  };
  const groupItems = [...city.objects, ...city.plots, ...city.roads].filter(item => selectedIds.includes(item.id));
  const plotObjects = selectedPlot ? city.objects.filter(item => Math.abs(item.x - selectedPlot.x) < selectedPlot.width / 2 && Math.abs(item.z - selectedPlot.z) < selectedPlot.depth / 2) : [];
  const copyPlan = object ? planBuildingCopies(city, object, copyCount, gap, copyDirection) : null;
  const service = useMemo(() => calculateUtilityService(city), [city]);
  const fire = useMemo(() => calculateFireService(city), [city]);
  const diagnostics = useMemo(() => analyzeCity(city, service, fire), [city, service, fire]);
  const previousCity = history.past.at(-1);
  const previousMetrics = useMemo(() => {
    if (!previousCity) return null;
    const utility = calculateUtilityService(previousCity), safety = calculateFireService(previousCity);
    return managementMetrics(analyzeCity(previousCity, utility, safety), utility, safety);
  }, [previousCity]);
  const changes = compareManagementMetrics(previousMetrics, managementMetrics(diagnostics, service, fire));
  const locateFacility = (id, kind = 'object') => {
    setDirectoryOpen(false); setDiagnosticsOpen(false); setMovingId(null); setMode('select');
    setSelected(id, kind); engine.current?.focusEntity(id);
  };
  const inspectIssue = (issue, action) => {
    setDiagnosticsOpen(false);
    selectCategory(issue.category);
    if (action === 'locate') locateFacility(issue.targetId, issue.kind);
    else if (issue.asset) { setAsset(issue.asset); setMode('build'); setSelected(null); }
    else if (issue.targetId) setSelected(issue.targetId, issue.kind);
    if (['roads', 'power', 'water', 'fire'].includes(issue.id)) setInfoVisible(true);
  };
  const population = city.objects.reduce((sum, o) => sum + assetById[o.asset].people, 0);
  const buildings = city.objects.filter(o => !['nature', 'streetscape'].includes(assetById[o.asset].category)).length;
  const greens = city.objects.filter(o => assetById[o.asset].category === 'nature').length;
  const activeCategory = CATEGORIES.find(c => c.id === category);
  const visibleAssets = ASSETS.filter(a => a.category === category && a.name.includes(search));
  const disconnected = useMemo(() => new Set(city.plots.filter(plot => !plotHasRoadAccess(city, plot)).map(plot => plot.id)), [city]);
  const blocked = useMemo(() => infoVisible ? unbuildableCells(city) : [], [city, infoVisible]);
  const modeLabel = mode === 'plot' ? '부지 조성' : mode === 'build' ? `${assetById[asset].name} 배치` : mode === 'move' ? '건물 이동' : mode === 'terrain' ? `지형 ${BRUSHES.find(b => b.id === brush).name}` : mode === 'road' ? '도로 연결' : mode === 'bulldoze' ? '시설 철거' : '도시 둘러보기';
  return <main className={`city-app ${night ? 'is-night' : ''} ${infoVisible ? 'info-visible' : ''} ${trayOpen ? 'tray-expanded' : 'tray-collapsed'} ${minimapOpen ? 'map-open' : ''} ${city.objects.length ? 'has-city' : 'empty-city'}`}>
    <canvas ref={canvas} className="city-canvas" aria-label="도시 3D 편집 화면" /><div className="scene-vignette" />{(mode === 'build' || mode === 'plot' || mode === 'move') && <div className="scene-placement-dim" aria-hidden="true" />}<div ref={brushLabel} className="brush-radius-label" hidden />
    {changes.length > 0 && <button className="city-change-summary glass" onClick={() => setDiagnosticsOpen(true)} aria-label="최근 편집 결과 자세히 보기"><span>최근 편집 결과</span>{changes.slice(0, 2).map(change => <small key={change.id} className={change.improved ? 'improved' : 'increased'}>{change.label} {change.before} → {change.value}{change.unit}</small>)}{changes.length > 2 && <small>변경 {changes.length}개 · 자세히 보기</small>}</button>}
    <header className="city-header glass">
      <div className="brand"><span className="brand-symbol"><Icon name="building" size={24} /></span><div>LUMATRIX<span>CITY STUDIO</span></div></div><div className="header-divider" />
      <div className="city-title"><input aria-label="도시 이름" value={city.name} maxLength={80} onChange={e => commit(c => ({ ...c, name: e.target.value }))} /><span><i /> 자유 건설 모드</span></div>
      <button className="preset-trigger" aria-label="도시·지도 설정" title="도시·지도 설정" onClick={() => setPresetsOpen(true)}><Icon name="layers" size={17} /><span className="hud-button-text">도시 · 지도</span></button>
      <button className="directory-trigger" aria-label="시설 목록" title="시설 목록" onClick={() => setDirectoryOpen(true)}><Icon name="building" size={17} /><span className="hud-button-text">시설 목록</span></button>
      <button className="directory-trigger" aria-label="구역 관리" title="구역 관리" onClick={() => setDistrictOpen(true)}><Icon name="plot" size={17} /><span className="hud-button-text">구역 관리</span></button>
      <button className="directory-trigger" aria-label="도시 생활 연출" title="도시 생활 연출" onClick={() => setLifeOpen(true)}><Icon name="people" size={17} /><span className="hud-button-text">생활 연출</span></button>
      <button className="header-diagnostics" aria-label="도시 진단" title="도시 진단" onClick={() => setDiagnosticsOpen(true)}><Icon name="civic" size={17} /><span className="hud-button-text">도시 진단</span><b>{diagnostics.issues.length}</b></button>
      <div className="header-actions"><span className="save-state">{saved ? '저장됨' : '로컬 프로젝트'}</span><button aria-label="도시 파일 불러오기" title="도시 파일 불러오기" onClick={() => fileInput.current.click()}><Icon name="folder" size={18} /></button><button aria-label="도시 파일 내보내기" title="도시 파일 내보내기" onClick={() => setExportOpen(true)}><Icon name="download" size={18} /></button><button className="save-button" onClick={save}><Icon name="save" size={16} /> 도시 저장</button></div><input type="file" accept=".json" ref={fileInput} hidden onChange={importCity} />
    </header>
    <div className="world-heading"><span className="eyebrow">YOUR NEXT GREAT CITY</span><h1>부지에서 시작하는 나의 도시.</h1><p>격자 위에 부지를 놓고, 그 안에 도시를 채워 보세요.</p><div className="getting-started"><button className={category === 'plot' ? 'current' : ''} onClick={() => selectCategory('plot')}><span>01</span> 부지 조성</button><i>→</i><button className={['residential', 'commercial', 'landmark', 'power', 'water', 'nature'].includes(category) ? 'current' : ''} onClick={() => selectCategory('residential')}><span>02</span> 시설 배치</button><i>→</i><button className={category === 'road' ? 'current' : ''} onClick={() => selectCategory('road')}><span>03</span> 도로 연결</button></div></div>
    <aside className="world-summary glass"><div className="panel-label"><span className="live-dot" /> 도시 개요 <span>SANDBOX</span></div><div className="summary-primary"><Icon name="people" size={22} /><strong>{population.toLocaleString()}</strong><span>주거 수용 인원</span></div><div className="summary-grid"><div><b>{buildings}</b><span>건물</span></div><div><b>{city.roads.length}</b><span>도로 구간</span></div><div><b>{greens}</b><span>녹지 시설</span></div></div><div className="summary-utilities"><span><Icon name="power" size={13} /> 전력 <b>{service.totals.power}/{service.totals.consumers}</b></span><span><Icon name="water" size={13} /> 수도 <b>{service.totals.water}/{service.totals.consumers}</b></span><span><Icon name="fire" size={13} /> 소방 <b>{fire.totals.covered}/{fire.totals.buildings}</b></span></div><button className="summary-diagnostics" onClick={() => setDiagnosticsOpen(true)}>도시 진단 <b>{diagnostics.issues.length}</b><Icon name="info" size={13} /></button></aside>
    <nav className="scene-tools glass" aria-label="편집 도구"><button className={mode === 'select' ? 'active' : ''} aria-label="선택 도구" title="선택 도구 · Esc" onClick={() => { setMode('select'); setMovingId(null); }}><Icon name="cursor" /></button><button className={boxSelect && mode === 'select' ? 'active' : ''} aria-label="범위 선택" title="드래그로 건물·부지·도로 선택" aria-pressed={boxSelect} onClick={() => { setMode('select'); setBoxSelect(value => !value); setMovingId(null); }}><Icon name="plot" /></button><button className={mode === 'bulldoze' ? 'danger active' : ''} aria-label="철거 도구" title="클릭해서 시설 철거" onClick={() => { setMode('bulldoze'); setMovingId(null); }}><Icon name="bulldoze" /></button><span /><button aria-label="실행 취소" title="실행 취소 · Ctrl Z" disabled={!history.past.length} onClick={undo}><Icon name="undo" /></button><button aria-label="다시 실행" title="다시 실행 · Ctrl Shift Z" disabled={!history.future.length} onClick={redo}><Icon name="redo" /></button></nav>
    {lightingOpen && <LightingPanel value={city.environment} engine={engine} onChange={environment => commit({ ...city, environment })} onClose={() => setLightingOpen(false)} />}
    <nav className="view-tools glass" aria-label="시점 조절"><button title="기본 시점" aria-label="기본 시점" onClick={() => engine.current?.view('home')}><Icon name="compass" /></button><button title="위에서 보기" aria-label="위에서 보기" onClick={() => engine.current?.view('top')}><Icon name="layers" /></button><span /><button title="확대" aria-label="확대" onClick={() => { if (engine.current) engine.current.camera.radius = Math.max(25, engine.current.camera.radius * 0.8); }}><Icon name="plus" /></button><button title="축소" aria-label="축소" onClick={() => { if (engine.current) engine.current.camera.radius = Math.min(mapDimensions(city).cameraLimit, engine.current.camera.radius * 1.2); }}><Icon name="minus" /></button><span /><button title="시간 · 조명 설정" aria-label="시간 · 조명 설정" aria-expanded={lightingOpen} onClick={() => setLightingOpen(v => !v)}><Icon name={night ? 'moon' : 'sun'} /></button><button aria-label="시점·이미지 저장" title="시점·이미지 저장" onClick={() => setCameraOpen(true)}><Icon name="save" /></button></nav>
    <button className={`grid-toggle glass ${gridVisible ? 'grid-on' : ''}`} aria-pressed={gridVisible} onClick={() => setGridVisible(v => !v)} title="기본 격자 · 4 m · 배치 간격 2 m"><Icon name="plot" size={15} /> 격자 <span>{gridVisible ? 'ON' : 'OFF'}</span></button>
    <button className={`info-toggle glass ${infoVisible ? 'active' : ''}`} aria-pressed={infoVisible} onClick={() => setInfoVisible(value => !value)}><Icon name="info" size={17} /> 정보 보기 <span>{infoVisible ? 'ON' : 'OFF'}</span></button>
    <button className="map-toggle glass" aria-label="미니맵 표시" aria-pressed={minimapOpen} onClick={() => setMinimapOpen(value => !value)}><Icon name="compass" size={16} /> 지도</button>
    {infoVisible && <div className="scene-layer-panel glass"><span>지도 표시</span><MapLayerControls layers={mapLayers} onChange={id => setMapLayers(current => ({ ...current, [id]: !current[id] }))} /></div>}
    <button className="diagnostics-toggle glass" onClick={() => setDiagnosticsOpen(true)}><Icon name="civic" size={16} /> 도시 진단 <span>{diagnostics.issues.length}</span></button>
    {(object || selectedRoad || selectedPlot || selectedWater || groupItems.length > 1) && <section key={selected || 'group'} className="selection-panel glass">
      <div className="panel-label">{groupItems.length > 1 ? '다중 선택' : selectedPlot ? '선택한 부지' : '선택한 시설'}<button aria-label="선택 해제" onClick={() => { setSelected(null); if (mode === 'move') { setMode('select'); setMovingId(null); } }}><Icon name="close" size={15} /></button></div>
      <h2>{groupItems.length > 1 ? `${groupItems.length}개 대상` : selectedWater ? `수역 ${waters.indexOf(selectedWater) + 1}` : selectedPlot ? '건설 부지' : object ? assetById[object.asset].name : bridgeById[selectedRoad.bridge]?.name || ROAD_TYPES.find(t => t.id === selectedRoad.type).name}</h2>
      {groupItems.length > 1 ? <BatchControls items={groupItems} dx={groupDx} dz={groupDz} setDx={setGroupDx} setDz={setGroupDz} onAction={applyBatchAction} onLock={lockSelection} /> : <>
        <p>{selectedWater ? '연결된 개별 수면 · 지형을 유지한 채 물을 비울 수 있습니다.' : selectedPlot ? `${selectedPlot.width} × ${selectedPlot.depth} m · ${plotSurface(selectedPlot.surface).name} · 높이 +0.3 m` : object ? assetById[object.asset].detail : `${Math.hypot(selectedRoad.a.x - selectedRoad.b.x, selectedRoad.a.z - selectedRoad.b.z).toFixed(1)} m · 도로 구간`}</p>
        {(object || selectedPlot || selectedRoad) && <><button aria-pressed={!!(object || selectedPlot || selectedRoad).locked} onClick={() => lockSelection(!(object || selectedPlot || selectedRoad).locked)}>{(object || selectedPlot || selectedRoad).locked ? '잠금 해제' : '선택 잠금'}</button>{(selectedPlot || selectedRoad) && <details className="inspector-details"><summary>이동·복제·삭제</summary><BatchControls items={groupItems} dx={groupDx} dz={groupDz} setDx={setGroupDx} setDz={setGroupDz} onAction={applyBatchAction} onLock={lockSelection} /></details>}</>}
        {selectedWater && <><WaterControls settings={waterSettings(city, selectedWater)} onChange={patch => changeWater(patch, selectedWater)} /><button onClick={() => setWaterOpen(true)}>전체 수역 설정</button><button onClick={() => engine.current?.focusEntity(selected)}>수역 위치로 이동</button></>}
        {selectedRoad && <div className="road-edit-controls"><p>초록색 끝점을 드래그해 길이·방향을 조절하세요.{selectedRoad.bridge && ' 교량 끝은 육지에 연결해야 합니다.'}</p><div role="group" aria-label="선택 도로 종류">{selectedRoad.bridge ? BRIDGE_PRESETS.map(preset => <button key={preset.id} aria-pressed={selectedRoad.bridge === preset.id} onClick={() => changeBridgePreset(preset.id)}>{preset.name}<small>{preset.min}~{preset.max} m</small></button>) : ROAD_TYPES.map(type => <button key={type.id} aria-pressed={selectedRoad.type === type.id} onClick={() => changeRoadType(type.id)}>{type.name}<small>폭 {type.width} m</small></button>)}</div>{roadTerrainWarning(city, selectedRoad) && <p className="road-slope-warning">{roadTerrainWarning(city, selectedRoad)}</p>}</div>}
        {object && <details className="inspector-details"><summary>공급·서비스 상태</summary><ServiceStatus coverage={service.consumers.get(object.id)} facility={service.facilities.get(object.id)} service={service} /><FireStatus building={fire.buildings.get(object.id)} station={fire.stations.get(object.id)} /></details>}
        {object && <RoleStatus object={object} diagnostics={diagnostics} />}
        {(object || selectedPlot || selectedRoad) && <button onClick={() => engine.current?.focusEntity(selected)}><Icon name="compass" size={16} /> 선택 위치로 이동</button>}
        {selectedPlot && <p className="plot-road-status">{disconnected.has(selectedPlot.id) ? '도로 연결 필요' : '도로 연결됨'}</p>}
        {selectedPlot && <SurfacePicker disabled={selectedPlot.locked} value={plotSurface(selectedPlot.surface).id} onChange={surface => commit(c => ({ ...c, plots: c.plots.map(p => p.id === selectedPlot.id ? { ...p, surface } : p) }))} />}
        {selectedPlot && <details className="inspector-details"><summary>부지 내 시설 <span>{plotObjects.length}</span></summary><PlotObjectList objects={plotObjects} onSelect={id => setSelected(id, 'object')} onMove={startMoving} onRemove={removeObject} /></details>}
        {selectedPlot && <button onClick={() => selectCategory('residential')}><Icon name="home" size={16} /> 이 부지에 시설 배치</button>}
        {object && <button onClick={() => startMoving(object.id)}><Icon name="cursor" size={16} /> 이동</button>}
        {object && <button onClick={rotateSelected}><Icon name="rotate" size={16} /> 90° 회전</button>}
        {object && <details className="inspector-details"><summary>연속 복제</summary><CopyControls count={copyCount} setCount={setCopyCount} gap={gap} setGap={setGap} direction={copyDirection} setDirection={setCopyDirection} onCopy={copySelected} problem={copyPlan.problem} /></details>}
        {!selectedWater && <button className="delete-button" onClick={removeSelected}><Icon name="bulldoze" size={16} /> {selectedPlot ? '빈 부지 철거' : '시설 철거'}</button>}
      </>}
    </section>}

    <div className={`bottom-workspace ${trayOpen ? '' : 'collapsed'}`}><aside className="minimap glass"><div className="panel-label">{infoVisible ? '건설 정보 지도' : '지역 지도'} <span>N ↑</span></div><MiniMap city={city} waters={waters} infoVisible={infoVisible} blocked={blocked} disconnected={disconnected} service={service} fire={fire} layers={mapLayers} onNavigate={(x, z) => engine.current?.focusPoint(x, z)} />{infoVisible && <div className="map-info-legend">{mapLayers.power && <span><i className="power-range" /> 전력 예상 범위 · {service.totals.power}/{service.totals.consumers}</span>}{mapLayers.water && <span><i className="water-range" /> 수도 예상 범위 · {service.totals.water}/{service.totals.consumers}</span>}{mapLayers.fire && <span><i className="fire-route" /> 소방 도달 건물 · {fire.totals.covered}/{fire.totals.buildings}</span>}{(mapLayers.power || mapLayers.water) && <span><i className="service-missing" /> 표시한 공급 범위 밖 건물</span>}<span><i className="unconnected" /> 도로 미연결 부지 {disconnected.size}</span><span><i className="unbuildable" /> 새 부지 조성 불가</span></div>}<div className="minimap-footer">{mapDimensions(city).size} × {mapDimensions(city).size} m<span>전체 지역</span></div>{mapDimensions(city).size < 480 && <button className="map-expand-button" onClick={expandCurrentCity}>지도 확장 · 480 m</button>}</aside>
      <section className="build-dock glass"><nav className="category-tabs" aria-label="도시 건설 카테고리">{CATEGORIES.map(c => <button key={c.id} className={category === c.id ? 'active' : ''} style={{ '--category-color': c.color }} onClick={() => selectCategory(c.id)}><Icon name={c.icon} size={19} /><span>{c.name}</span></button>)}<button className="collapse-tray" aria-label={trayOpen ? '트레이 접기' : '트레이 펼치기'} onClick={() => setTrayOpen(v => !v)}>{trayOpen ? '⌄' : '⌃'}</button></nav>
      {trayOpen && <div className="tray-content"><div className="tray-heading">{category === 'terrain' && <button className="water-settings-trigger" onClick={() => setWaterOpen(true)}><Icon name="water" size={15} /> 물 설정 · {waters.length}</button>}<div><h2>{activeCategory.name} <span>{category === 'plot' ? 'DEVELOPMENT SITES' : category === 'terrain' ? 'LANDSCAPING' : category === 'road' ? 'CONNECTIONS' : 'ASSET LIBRARY'}</span></h2><p>{category === 'plot' ? '첫 모서리를 클릭하고 마우스로 가로·세로를 조정하세요. 다시 클릭하면 확정됩니다.' : category === 'terrain' ? '브러시 원이 반경을 표시합니다. 부지 주변 지형을 드래그해 편집하세요.' : category === 'road' ? '부지 옆에서 시작점과 끝점을 클릭하여 도로를 연결하세요.' : '프리셋을 클릭하고 격자로 마우스를 옮기세요. 미리보기 위치에서 다시 클릭하면 배치됩니다.'}</p></div>{!['terrain', 'road', 'plot'].includes(category) && <input type="search" aria-label="시설 검색" placeholder="시설 검색…" value={search} onChange={e => setSearch(e.target.value)} />}{mode === 'build' && <button className="rotation-button" onClick={() => setRotation(r => r + Math.PI / 2)}><Icon name="rotate" size={15} /> {Math.round(rotation * 180 / Math.PI) % 360}° <kbd>R</kbd></button>}{mode === 'build' && <label className="alignment-toggle"><input type="checkbox" checked={align} onChange={e => setAlign(e.target.checked)} /> 자동 정렬</label>}{mode === 'build' && <label className="gap-control">정렬 간격 <input aria-label="정렬 간격" type="number" min="0" max="10" step="0.5" value={gap} onChange={e => setGap(Number(e.target.value))} /> m</label>}</div>
      {category === 'terrain' ? <div className="terrain-controls"><div className="brush-list">{BRUSHES.map(b => <button key={b.id} className={brush === b.id && mode === 'terrain' ? 'selected' : ''} onClick={() => { setBrush(b.id); setMode('terrain'); }}><Icon name={b.icon} size={27} /><b>{b.name}</b></button>)}</div><div className="brush-settings"><label className="terrain-color-picker">색칠 색상<input aria-label="지형 색칠 색상" type="color" value={paintColor} onChange={e => { setPaintColor(e.target.value); setBrush('paint'); setMode('terrain'); }} /><span>{paintColor}</span></label><label>브러시 크기 <b>{radius} m</b><input aria-label="브러시 크기" type="range" min="4" max="32" step="2" value={radius} onChange={e => setRadius(Number(e.target.value))} /></label><label>강도 <b>{Math.round(strength * 100)}%</b><input aria-label="브러시 강도" type="range" min="0.1" max="1" step="0.1" value={strength} onChange={e => setStrength(Number(e.target.value))} /></label></div></div>
      : category === 'plot' ? <div><div className="plot-finish-controls"><span>부지 표면</span><SurfacePicker value={surface} onChange={setSurface} /><small>지면에서 0.3 m 높게 조성</small></div><div className="asset-list">{PLOT_TYPES.map(p => <button key={p.id} className={`asset-card plot-card ${mode === 'plot' && plot === p.id ? 'selected' : ''}`} onClick={() => { engine.current?.cancelPlotDraft(); setPlot(p.id); setMode('plot'); }}><div className={`plot-preview plot-${p.id}`} style={{ backgroundColor: plotSurface(surface).color }}><span /><i /><i /><i /><i /></div><b>{p.name} <span>{p.width} × {p.depth} m</span></b><small>{p.detail}</small><span className="asset-size">기본 크기 · 드래그로 자유 조정</span></button>)}<div className="library-note"><Icon name="plot" size={28} /><span>첫 모서리 클릭 → 크기 조정<br />→ 두 번째 클릭으로 확정</span><small>표시되는 너비 × 깊이 확인</small></div></div></div>
      : category === 'road' ? <RoadLibrary road={road} bridge={bridge} mode={mode} shape={roadShape} continuous={roadContinuous} onShape={setRoadShape} onContinuous={setRoadContinuous} onRoad={type => { setBridge(null); setRoad(type); setMode('road'); }} onBridge={chooseBridge} onFinish={() => { engine.current?.cancelPlotDraft(); if (engine.current) engine.current.roadStart = null; }} />
      : <div className="asset-list">{visibleAssets.map(a => <button key={a.id} className={`asset-card ${mode === 'build' && asset === a.id ? 'selected' : ''}`} onClick={() => { setAsset(a.id); setMovingId(null); setMode('build'); setSelected(null); }}><AssetPreview asset={a} /><b>{a.name}</b><small>{a.detail}</small><span className="asset-size">{a.width} × {a.depth} m</span>{mode === 'build' && asset === a.id && <span className="asset-check"><Icon name="check" size={13} /></span>}</button>)}{!visibleAssets.length && <div className="empty-assets">검색한 시설이 없습니다.</div>}<div className="library-note"><Icon name={activeCategory.icon} size={28} /><span>프리셋 클릭 → 위치 확인<br />→ 격자 클릭으로 배치</span><small>{ASSETS.filter(a => a.category === category).length}개의 시설 프리셋</small></div></div>}</div>}
      </section>
    </div>
    <footer className="city-status"><div><span className="status-dot" /><b>{modeLabel}</b><span className="status-separator" />{mode === 'plot' ? '첫 클릭: 시작점 · 마우스로 크기 조정 · 다시 클릭: 확정' : mode === 'select' ? '클릭 선택 · Shift + 드래그 또는 범위 선택 버튼' : mode === 'terrain' ? `왼쪽 드래그로 지형 편집 · 반경 ${radius} m` : mode === 'road' ? '시작점 → 끝점 클릭' : mode === 'bulldoze' ? '시설을 클릭하여 철거' : mode === 'move' ? '선택한 건물을 새 위치로 옮기기 · Esc 취소' : `프리셋 모양 확인 → ${align ? '부지·건물 자동 정렬' : '2 m 격자에 맞춤'} · R 회전 · Esc 취소`}</div><div className="navigation-hint">우클릭 회전 <span>·</span> 휠 클릭 이동 <span>·</span> 스크롤 확대<button aria-label="사용법" onClick={() => setHelpOpen(true)}><Icon name="help" size={16} /></button></div><button className="mobile-help" aria-label="사용법 열기" onClick={() => setHelpOpen(true)}><Icon name="help" size={16} /></button></footer>
    {notice && <div className="city-toast glass" role="status"><Icon name="check" size={17} />{notice}</div>}{error && <div className="engine-error glass" role="alert">{error}</div>}
    {presetsOpen && <div className="modal-backdrop" onClick={() => setPresetsOpen(false)}><section className="preset-modal glass" role="dialog" aria-modal="true" aria-label="도시·지도 설정" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="프리셋 닫기" onClick={() => setPresetsOpen(false)}><Icon name="close" /></button><h2>도시 · 지도 설정</h2><section className="current-map-settings" aria-label="현재 도시 지도 확장"><b>현재 도시 · {city.name}</b><p>지도 {mapDimensions(city).size} × {mapDimensions(city).size} m · 지형 간격 2 m</p>{mapDimensions(city).size < 480 ? <><p>기존 건물·도로·지형을 유지하면서 바깥에 새 땅을 추가합니다. 전체 면적이 4배로 늘어납니다.</p><button className="map-expand-button" onClick={expandCurrentCity}>현재 도시를 480 × 480 m로 확장</button></> : <p>현재 지원하는 최대 지도 크기입니다.</p>}</section><span className="eyebrow">새 도시 만들기</span><h3>어떤 도시를 만들어 볼까요?</h3><p>새로운 지형과 도시 배치로 시작합니다. 현재 도시는 실행 취소로 되돌릴 수 있습니다.</p><label className="map-size-control">지도 크기<select value={newMapSize} onChange={event => setNewMapSize(Number(event.target.value))}>{MAP_SIZES.map(size => <option key={size} value={size}>{size === 240 ? '소형' : '중형'} · {size} × {size} m</option>)}</select></label><div className="preset-grid">{PRESETS.map(p => <button className={`preset-card preset-${p.id}`} key={p.id} onClick={() => { commit(createCity(p.id, newMapSize)); setSelected(null); setMode('select'); setPresetsOpen(false); engine.current?.view('home'); setNotice(`${p.name} 프리셋을 불러왔습니다.`); }}><div className="preset-art"><span className="preset-river" /><Icon name={p.id === 'alpine' ? 'terrain' : p.id === 'blank' ? 'plus' : 'building'} size={42} /></div><span className="eyebrow">{p.tag}</span><h3>{p.name}</h3><p>{p.subtitle}</p></button>)}</div><div className="preset-footnote">모든 프리셋은 자유롭게 편집할 수 있습니다. · 외부 지도 연결 없이 사용 가능</div></section></div>}
    {helpOpen && <div className="modal-backdrop" onClick={() => setHelpOpen(false)}><section className="help-modal glass" role="dialog" aria-modal="true" aria-label="사용법" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="사용법 닫기" onClick={() => setHelpOpen(false)}><Icon name="close" /></button><span className="eyebrow">MAKE YOURSELF AT HOME</span><h2>도시 만들기, 이렇게 시작하세요.</h2><p>시설 카드를 클릭하면 3D 미리보기가 격자를 따라 움직입니다. 초록색은 배치 가능한 자리, 붉은색은 겹치거나 부적합한 자리입니다. 원하는 위치에서 다시 클릭하세요. 자동 정렬을 켜면 부지 중심·경계와 기존 건물에 맞춰집니다. 여러 시설은 Shift + 클릭으로 함께 선택하여 이동·회전·복제할 수 있습니다. 선택한 시설은 이동하거나 개수·방향·간격을 정해 연속 복제할 수 있습니다. 부지를 선택하면 그 안의 시설을 목록에서 선택·이동·철거할 수 있습니다. 시설은 조성된 부지 안에만 배치할 수 있습니다. 먼저 부지를 만들어 주세요.</p><p>부지는 첫 모서리를 클릭한 뒤 마우스로 가로와 세로 길이를 조정하고 다시 클릭해 확정합니다. 마우스 버튼을 누른 채 끌어도 크기가 변합니다. Esc로 취소할 수 있습니다.</p><p>도로는 직선·곡선·원형을 선택해 배치합니다. 곡선은 시작점·끝점·곡률을 순서대로 클릭하고, 원형은 중심점·반경을 지정합니다. 연속 배치는 Esc로 종료합니다. 범위 선택 버튼으로 건물·부지·도로를 함께 선택할 수 있고, 잠긴 대상은 편집되지 않습니다. 상단에서 구역 관리와 도시 생활 연출을 설정할 수 있습니다. 지형 브러시의 원은 편집 반경을 표시하며, 왼쪽 버튼을 누른 채 드래그하면 지형이 변합니다.</p><dl><dt>카메라 회전 / 이동</dt><dd>우클릭 드래그 / 휠 클릭 드래그</dd><dt>확대 / 축소</dt><dd>마우스 스크롤</dd><dt>실행 취소 / 다시 실행</dt><dd>Ctrl Z / Ctrl Shift Z</dd><dt>도시 저장</dt><dd>Ctrl S · 현재 브라우저에 저장</dd></dl><p>상단 파일 버튼으로 도시를 내보내고 다시 불러올 수 있습니다. 이 도구는 도시 설계용이며 교통·경제 시뮬레이션은 포함하지 않습니다.</p></section></div>}
    {directoryOpen && <FacilityDirectory city={city} onClose={() => setDirectoryOpen(false)} onSelect={locateFacility} />}
    {exportOpen && <CityExportPanel cityName={city.name} onClose={() => setExportOpen(false)} onSave={exportCity} />}
    {cameraOpen && <CameraPanel views={city.cameraViews || []} onClose={() => setCameraOpen(false)} onAdd={name => { if (engine.current) { const view = { id: crypto.randomUUID(), name, ...engine.current.cameraState() }; commit(current => ({ ...current, cameraViews: [...current.cameraViews || [], view] })); } }} onRemove={id => commit(current => ({ ...current, cameraViews: current.cameraViews.filter(view => view.id !== id) }))} onView={view => { engine.current?.restoreCamera(view); setCameraOpen(false); }} onExport={exportImage} />}
    {districtOpen && <DistrictPanel city={city} service={service} onChange={districts => commit(current => ({ ...current, districts }))} onClose={() => setDistrictOpen(false)} onLocate={id => { setDistrictOpen(false); locateFacility(id, 'plot'); }} />}
    {lifeOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setLifeOpen(false); }}><section className="expansion-modal glass" role="dialog" aria-modal="true" aria-labelledby="life-title"><button className="modal-close" aria-label="생활 연출 닫기" onClick={() => setLifeOpen(false)}>×</button><h2 id="life-title">도시 생활 연출</h2><p>차량과 보행자가 연결된 도로를 따라 움직입니다. 밤에는 가로등·차량 조명·건물 창문이 밝아집니다.</p>{[['enabled', '생활 연출 켜기'], ['cars', '차량 표시'], ['people', '보행자 표시']].map(([key, label]) => <label className="life-setting" key={key}><input type="checkbox" checked={city.lifeSettings?.[key] !== false} onChange={e => commit(current => ({ ...current, lifeSettings: { ...current.lifeSettings, [key]: e.target.checked } }))} />{label}</label>)}<small>분위기를 위한 시각 연출입니다. 실제 교통량이나 신호·정체는 계산하지 않습니다.</small></section></div>}
    {waterOpen && <WaterPanel city={city} regions={waters} initialId={selectedWater?.id} onChange={changeWater} onSelect={id => locateFacility(id, 'water')} onClose={() => setWaterOpen(false)} />}
    {diagnosticsOpen && <CityDiagnostics diagnostics={diagnostics} onClose={() => setDiagnosticsOpen(false)} onIssue={inspectIssue} changes={changes} hasPrevious={!!previousCity} />}
  </main>;
}

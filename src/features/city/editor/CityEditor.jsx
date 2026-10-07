import LifePanel from './components/LifePanel.jsx';
import MiniMap from './components/MiniMap.jsx';
import HeaderMenu from './components/HeaderMenu.jsx';
import EditorMenuBar from './components/EditorMenuBar.jsx';
import CityDiagnostics from './components/CityDiagnostics.jsx';
import RoleStatus from './components/RoleStatus.jsx';
import FireStatus from './components/FireStatus.jsx';
import ServiceStatus from './components/ServiceStatus.jsx';
import ServiceBadgeLegend from './components/ServiceBadgeLegend.jsx';
import RightInformationDock from './components/RightInformationDock.jsx';
import { editorFrameViewport } from './camera/frameSelection.js';
import CopyControls from './components/CopyControls.jsx';
import PlotObjectList from './components/PlotObjectList.jsx';
import SurfacePicker from './components/SurfacePicker.jsx';
import AssetPreview from './components/AssetPreview.jsx';
import { filterLibrary, libraryGroups } from '../presets/libraryGroups.js';
import './styles/libraryFilters.css';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cleanPortals } from '../pages/portalModel.js';
import { waitForRenderedScene } from '../pages/sceneReadiness.js';
import { capturePageThumbnail } from '../pages/pageThumbnail.js';
import { readSceneFile } from '../pages/importSceneFile.js';
import { CityEngine } from '../rendering/CityEngine.js';
import { ASSETS, assetById, BRUSHES, CATEGORIES, PRESETS, ROAD_TYPES, PLOT_TYPES } from '../presets/catalog.js';
import { MAP_SIZES, mapDimensions } from '../core/mapDimensions.js';
import { expandCity } from '../core/mapExpansion.js';
import { createCity } from '../core/cityState.js';
import { plotSurface, plotHasRoadAccess } from '../plots/plotModel.js';
import { placementProblem } from '../placement/placementRules.js';
import { unbuildableCells } from '../core/buildability.js';
import { validateCity } from '../core/cityValidation.js';
import { planBuildingCopies, planGroupTransform } from '../placement/duplication.js';
import { roadProblem } from '../roads/roadModel.js';
import Icon from './components/CityIcon.jsx';
import { calculateUtilityService } from '../simulation/utilityService.js';
import { calculateFireService } from '../simulation/fireService.js';
import { analyzeCity } from '../management/cityDiagnostics.js';
import { defaultMapLayers, managementMetrics, compareManagementMetrics } from '../management/cityManagement.js';
import { FacilityDirectory, MapLayerControls, EditResults } from '../management/FacilityManagement.jsx';
import FacilityPropertiesPanel from '../management/FacilityPropertiesPanel.jsx';
import GridOperationsPanel from '../management/GridOperationsPanel.jsx';
import { facilityName, facilityStatus, updateFacilityProperties } from '../management/facilityProperties.js';
import { roadTerrainWarning } from '../roads/roadGeometry.js';
import { waterRegions, waterSettings } from '../water/waterModel.js';
import WaterPanel, { WaterControls } from '../water/WaterPanel.jsx';
import DistrictPanel, { BatchControls } from '../management/DistrictPanel.jsx';
import CameraPanel from './components/CameraPanel.jsx';
import RoadLibrary from '../roads/RoadLibrary.jsx';
import LightingPanel from '../lighting/LightingPanel.jsx';
import ConnectionPanel from '../connections/ConnectionPanel.jsx';
import { cleanConnections } from '../connections/connectionModel.js';
import CityExportPanel from '../persistence/CityExportPanel.jsx';
import { saveCityFile } from '../persistence/cityFiles.js';
import { BRIDGE_PRESETS, bridgeById } from '../presets/bridgePresets.js';
import { planBatch, setLocked, cleanDistricts } from '../placement/cityExpansion.js';
import './styles/cityEditor.css';
import './styles/cityHud.css';
import './styles/cityToolbar.css';
import './styles/gamePointer.css';
import PerformancePanel from '../rendering/performance/PerformancePanel.jsx';
import { normalizeQuality } from '../rendering/performance/renderQuality.js';
import { useAutosave } from '../persistence/useAutosave.js';
import RecoveryPanel, { AutosaveStatus } from '../persistence/RecoveryPanel.jsx';
import './styles/cityTheme.css';
import './styles/editorMenuBar.css';

const STORAGE_KEY = 'lumatrix-city-v1';
const ManualDialog = lazy(() => import('../manual/ManualDialog.jsx'));
function initialCity() {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) return validateCity(JSON.parse(saved)); } catch { /* Invalid saves must not block the editor. */ }
  return createCity('river');
}

export default function CityEditor({ pageSession, onCityChange, registerEditor, onProjectSave, onProjectManage, onProjectImport, projectSaveStatus, pageMenu, onPortalSelect, portalPages = [], portalViewing = false, onSceneReady, onSceneLoadError, interactionBlocked = false }) {
  const [history, setHistory] = useState(() => pageSession?.history || ({ past: [], current: pageSession?.city || initialCity(), future: [] }));
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
  const [gridVisible, setGridVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [serviceBadgeOptions, setServiceBadgeOptions] = useState({ power: false, water: false, missingOnly: false });
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [informationTab, setInformationTab] = useState('selection');
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(null);
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
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [renderQuality, setRenderQuality] = useState(() => {
    try { return normalizeQuality(JSON.parse(localStorage.getItem('lumatrix-render-quality'))); } catch { return normalizeQuality(); }
  });
  const [lightingOpen, setLightingOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const night = (city.environment?.hour ?? 12) < 6 || (city.environment?.hour ?? 12) >= 19;
  const [trayOpen, setTrayOpen] = useState(() => city.objects.length === 0);
  const [search, setSearch] = useState('');
  const [subcategory, setSubcategory] = useState('all');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const canvas = useRef(null), engine = useRef(null), fileInput = useRef(null), brushLabel = useRef(null);
  const portalPopup = useRef(null), portalPopupName = useRef(null), portalPopupTarget = useRef(null);
  const setSelected = useCallback((id, kind = null) => { setInformationTab('selection'); setSelection({ single: id, ids: id && kind !== 'water' ? [id] : [], kind }); }, []);
  const onSceneSelect = useCallback((id, additive = false, kind = null) => {
    setInformationTab('selection');
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
      const normalized = cleanPortals(cleanConnections(cleanDistricts(current)));
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
  const restoreProject = useCallback(restored => {
    setHistory({ past: [], current: restored, future: [] }); setSelected(null); setMode('select');
    setConnectionsOpen(false); setLightingOpen(false); setTrayOpen(restored.objects.length === 0);
    setSaved(false); setNotice('저장된 프로젝트를 복구했습니다.');
  }, [setSelected]);
  const autosave = useAutosave(city, restoreProject, !pageSession);
  const showProjects = pageSession ? onProjectManage : autosave.showProjects;
  const flushAutosave = autosave.flush;
  const save = useCallback(() => {
    if (onProjectSave && pageSession) { onProjectSave(); return; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(city)); setSaved(true); setNotice('이 기기에 도시를 저장했습니다.'); }
    catch { setNotice('저장 공간이 부족합니다. 파일로 내보내기를 사용하세요.'); }
    flushAutosave().catch(() => {});
  }, [city, flushAutosave, onProjectSave, pageSession]);
  useLayoutEffect(() => {
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
  const restoredCamera = useRef(null);
  useEffect(() => { if (engine.current && engine.current.renderedCity !== city) engine.current.setCity(city, service); });
  useEffect(() => {
    if (engine.current && restoredCamera.current !== engine.current && pageSession?.camera) { engine.current.restoreCamera(pageSession.camera); restoredCamera.current = engine.current; }
  }, [pageSession]);
  useEffect(() => { onCityChange?.(city); }, [city, onCityChange]);
  useLayoutEffect(() => {
    registerEditor?.({
      snapshot: () => ({ history, city, camera: engine.current?.cameraState() }),
      thumbnail: () => capturePageThumbnail(canvas.current),
      dispose: () => engine.current?.dispose(),
      updateCity: commit,
      resetHistory: current => setHistory({ past: [], current, future: [] }),
      placePortal: callback => { if (engine.current) engine.current.onPortalPlace = (position, objectId) => { callback(position, objectId); setMode('select'); }; setMode('portal-place'); setNotice('지형이나 건물에서 이동 포인트를 둘 위치를 클릭하세요. Esc로 취소할 수 있습니다.'); },
      cancelPlacement: () => setMode('select'),
    });
  }, [registerEditor, history, city, commit]);
  useEffect(() => { if (engine.current) engine.current.onPortalSelect = onPortalSelect; }, [onPortalSelect]);
  useEffect(() => {
    const instance = engine.current;
    if (!instance) return;
    const popupElement = portalPopup.current;
    instance.portalHoverEnabled = !interactionBlocked && mode === 'select';
    instance.onPortalHover = info => {
      const popup = portalPopup.current;
      if (!popup) return;
      const portal = info && city.portals?.find(p => p.id === info.id);
      popup.hidden = !portal || !instance.portalHoverEnabled;
      if (popup.hidden) return;
      const target = portalPages.find(p => p.id === portal.targetPageId);
      const destination = target ? `${target.type.toUpperCase()} · ${target.name}` : '목적지를 확인하세요';
      if (portalPopupName.current.textContent !== portal.name) portalPopupName.current.textContent = portal.name;
      if (portalPopupTarget.current.textContent !== destination) portalPopupTarget.current.textContent = destination;
      const left = `${Math.max(130, Math.min(window.innerWidth - 130, info.x))}px`, top = `${Math.max(115, info.y)}px`;
      if (popup.style.left !== left) popup.style.left = left;
      if (popup.style.top !== top) popup.style.top = top;
    };
    if (!instance.portalHoverEnabled) instance.clearPortalHover();
    return () => { instance.onPortalHover = null; if (popupElement) popupElement.hidden = true; };
  }, [city.portals, portalPages, mode, interactionBlocked]);
  useEffect(() => {
    const instance = engine.current;
    if (!instance || !onSceneReady) return;
    return waitForRenderedScene(instance, onSceneReady);
  }, [onSceneReady]);
  useEffect(() => { if (error) onSceneLoadError?.(error); }, [error, onSceneLoadError]);
  useEffect(() => {
    engine.current?.setRenderQuality(renderQuality);
    try { localStorage.setItem('lumatrix-render-quality', JSON.stringify(renderQuality)); } catch { /* Quality still applies without persistent storage. */ }
  }, [renderQuality]);
  useEffect(() => { engine.current?.setOptions({ mode, asset, brush, paintColor, road, plot, radius, strength, rotation, surface, align, gap, movingId, roadShape, roadContinuous, boxSelect, bridge }); }, [mode, asset, brush, paintColor, road, plot, radius, strength, rotation, surface, align, gap, movingId, roadShape, roadContinuous, boxSelect, bridge]);
  useEffect(() => { engine.current?.setGridVisible(gridVisible); }, [gridVisible]);
  useEffect(() => {
    const instance = engine.current;
    if (instance) instance.renderPaused = helpOpen || autosave.open || !!autosave.recovery;
    return () => { if (instance) instance.renderPaused = false; };
  }, [helpOpen, autosave.open, autosave.recovery]);
  useEffect(() => {
    if (engine.current) engine.current.onConnectionSelect = id => { setLightingOpen(false); setConnectionsOpen(true); setSelectedConnection(id); setMode('select'); };
  });
  useEffect(() => { engine.current?.setInfoVisible(infoVisible); }, [infoVisible]);
  useEffect(() => { engine.current?.setServiceBadgeOptions(serviceBadgeOptions); }, [serviceBadgeOptions]);
  useEffect(() => { engine.current?.setMapLayers(mapLayers); }, [mapLayers]);
  useEffect(() => { engine.current?.select(selectedIds.length > 1 ? selectedIds : selected); }, [selected, selectedIds, city]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  const removeSelected = useCallback(() => {
    if (selected?.startsWith('water:')) { setNotice('물 비우기는 선택한 수역의 물 설정에서 변경하세요.'); return; }
    if (selectedIds.length) applyBatchAction('delete');
  }, [selected, selectedIds, applyBatchAction]);
  const frameSelected = useCallback(() => {
    const ids = selectedIds.length ? selectedIds : selected ? [selected] : [];
    if (!ids.length) { setNotice('먼저 화면에서 시설을 클릭한 다음 F키를 눌러주세요.'); return; }
    if (canvas.current && engine.current?.frameEntities(ids, editorFrameViewport(canvas.current))) setNotice('선택한 대상 전체가 보이도록 화면을 맞췄습니다.');
    else if (selected) engine.current?.focusEntity(selected);
  }, [selected, selectedIds]);
  useEffect(() => {
    const keydown = event => {
      if (interactionBlocked) return;
      if (helpOpen || performanceOpen || autosave.open || autosave.recovery) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) { event.preventDefault(); frameSelected(); }
      if (key === 'escape') { setHeaderMenu(null); setConnectionsOpen(false); setLightingOpen(false); setBoxSelect(false); setMode('select'); setMovingId(null); setSelected(null); setPresetsOpen(false); setHelpOpen(false); setDiagnosticsOpen(false); setOperationsOpen(false); setDirectoryOpen(false); setWaterOpen(false); setDistrictOpen(false); setLifeOpen(false); setCameraOpen(false); engine.current?.cancelPlotDraft(); if (engine.current) engine.current.roadStart = null; }
      if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if ((event.ctrlKey || event.metaKey) && key === 'y') { event.preventDefault(); redo(); }
      if ((event.ctrlKey || event.metaKey) && key === 's') { event.preventDefault(); save(); }
      if (key === 'r' && !event.ctrlKey && !event.metaKey) setRotation(r => r + Math.PI / 2);
      if (key === 'delete') removeSelected();
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [undo, redo, save, removeSelected, setSelected, helpOpen, frameSelected, performanceOpen, autosave.open, autosave.recovery, interactionBlocked]);
  const selectCategory = id => { engine.current?.cancelPlotDraft(); setMovingId(null); setCategory(id); setSubcategory('all'); setSearch(''); setTrayOpen(true); setMode(['terrain', 'road', 'plot'].includes(id) ? id : 'select'); };
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
    try {
      const result = await readSceneFile(file);
      if (result.kind === 'project') {
        if (!onProjectImport) throw new Error('페이지 메뉴에서 프로젝트 파일을 불러오세요.');
        onProjectImport(result.value); setHeaderMenu(null); return;
      }
      const imported = result.value;
      autosave.newProject(); commit(imported); setTrayOpen(imported.objects.length === 0); setHeaderMenu(null); setConnectionsOpen(false); setLightingOpen(false); setSelected(null); setMode('select'); setNotice('도시 파일을 불러왔습니다.');
    }
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
  const categoryAssets = filterLibrary(ASSETS, category);
  const subgroups = libraryGroups(category, ASSETS);
  const visibleAssets = filterLibrary(ASSETS, category, subcategory, search);
  const disconnected = useMemo(() => new Set(city.plots.filter(plot => !plotHasRoadAccess(city, plot)).map(plot => plot.id)), [city]);
  const blocked = useMemo(() => infoVisible ? unbuildableCells(city) : [], [city, infoVisible]);
  const modeLabel = mode === 'waypoint' ? '연결선 경유점 편집' : mode === 'connect' ? '흐름 연결선' : mode === 'plot' ? '부지 조성' : mode === 'build' ? `${assetById[asset].name} 배치` : mode === 'move' ? '건물 이동' : mode === 'terrain' ? `지형 ${BRUSHES.find(b => b.id === brush).name}` : mode === 'road' ? '도로 연결' : mode === 'bulldoze' ? '시설 철거' : '도시 둘러보기';
  const hasSelection = !!(object || selectedRoad || selectedPlot || selectedWater || groupItems.length > 1);
  const hasBadges = serviceBadgeOptions.power || serviceBadgeOptions.water;
  const dockVisible = hasSelection || operationsOpen || connectionsOpen || lightingOpen || hasBadges;
  const activeInformation = connectionsOpen ? 'connections' : lightingOpen ? 'lighting' : informationTab === 'status' && hasBadges ? 'status' : operationsOpen && (informationTab === 'operations' || !hasSelection) ? 'operations' : hasSelection ? 'selection' : 'status';
  const selectInformation = tab => { if (tab !== 'connections' && ['waypoint', 'connect'].includes(mode)) setMode('select'); setConnectionsOpen(tab === 'connections'); setLightingOpen(tab === 'lighting'); setInformationTab(tab); };
  return <main data-tool={mode} className={`city-app ${dockVisible ? 'has-information-dock' : ''} ${night ? 'is-night' : ''} ${infoVisible ? 'info-visible' : ''} ${trayOpen ? 'tray-expanded' : 'tray-collapsed'} ${minimapOpen ? 'map-open' : ''} ${city.objects.length ? 'has-city' : 'empty-city'}`}>
    <div ref={portalPopup} className="portal-hover-popup" role="tooltip" hidden><strong ref={portalPopupName} /><span ref={portalPopupTarget} /><small>{portalViewing ? '클릭해서 이동' : '클릭해서 포인트 설정'}</small></div>
    <canvas ref={canvas} className="city-canvas" aria-label="도시 3D 편집 화면" /><div className="scene-vignette" />{(mode === 'build' || mode === 'plot' || mode === 'move') && <div className="scene-placement-dim" aria-hidden="true" />}<div ref={brushLabel} className="brush-radius-label" hidden />
    <RecoveryPanel autosave={autosave} />
    {performanceOpen && <PerformancePanel engine={engine} value={renderQuality} onChange={setRenderQuality} onClose={() => setPerformanceOpen(false)} />}
    {changes.length > 0 && <button className="city-change-summary glass" onClick={() => setDiagnosticsOpen(true)} aria-label="최근 편집 결과 자세히 보기"><span>최근 편집 결과</span>{changes.slice(0, 2).map(change => <small key={change.id} className={change.improved ? 'improved' : 'increased'}>{change.label} {change.before} → {change.value}{change.unit}</small>)}{changes.length > 2 && <small>변경 {changes.length}개 · 자세히 보기</small>}</button>}
    <EditorMenuBar openMenu={headerMenu} onOpenMenu={setHeaderMenu} cityName={city.name} onMap={() => setPresetsOpen(true)} onImport={() => fileInput.current.click()} onSave={save} onExport={() => setExportOpen(true)} onProjects={showProjects} onUndo={undo} onRedo={redo} canUndo={!!history.past.length} canRedo={!!history.future.length} onFocus={frameSelected} canFocus={hasSelection} onHelp={() => setHelpOpen(true)}>
      {pageMenu}
      <HeaderMenu id="manage" label="도시 관리" textOnly openMenu={headerMenu} onOpen={setHeaderMenu}>
        <button onClick={() => { setHeaderMenu(null); showProjects(); }}><Icon name="folder" size={16} /> 자동 저장 · 프로젝트 복구</button>
        <button onClick={() => { setHeaderMenu(null); selectInformation('operations'); setOperationsOpen(true); }}><Icon name="power" size={16} /> 운영 대시보드 · 고장 시나리오</button>
        <span className="menu-section-label">시설과 구역</span>
        <button onClick={() => { setHeaderMenu(null); selectInformation('connections'); setSelectedConnection(null); setMode('select'); }}><Icon name="connection" size={16} /> 시설 연결선</button>
        <button onClick={() => { setHeaderMenu(null); setDirectoryOpen(true); }}><Icon name="building" size={16} /> 시설 목록</button>
        <button onClick={() => { setHeaderMenu(null); setDistrictOpen(true); }}><Icon name="plot" size={16} /> 구역 관리</button>
        <button onClick={() => { setHeaderMenu(null); setDiagnosticsOpen(true); }}><Icon name="civic" size={16} /> 도시 진단 <b className="menu-value">{diagnostics.issues.length}</b></button>
      </HeaderMenu>
      <HeaderMenu id="environment" label="환경" textOnly openMenu={headerMenu} onOpen={setHeaderMenu}>
        <span className="menu-section-label">도시 연출</span>
        <button onClick={() => { setHeaderMenu(null); setConnectionsOpen(false); setLightingOpen(v => !v); }}><Icon name="sun" size={16} /> 시간 · 조명</button>
        <button onClick={() => { setHeaderMenu(null); setLifeOpen(true); }}><Icon name="people" size={16} /> 생활 연출</button>
        <button onClick={() => { setHeaderMenu(null); setWaterOpen(true); }}><Icon name="water" size={16} /> 수역 설정</button>
      </HeaderMenu>
      <HeaderMenu id="view" label="보기" textOnly openMenu={headerMenu} onOpen={setHeaderMenu}>
        <button onClick={() => { setHeaderMenu(null); setPerformanceOpen(true); }}><Icon name="info" size={16} /> 성능 · 화면 품질</button>
        <span className="menu-section-label">화면 표시</span>
        <button aria-pressed={gridVisible} onClick={() => setGridVisible(v => !v)} title="기본 격자 · 4 m · 배치 간격 2 m"><Icon name="plot" size={16} /> 격자 <span className="menu-value">{gridVisible ? 'ON' : 'OFF'}</span></button>
        <button aria-pressed={infoVisible} onClick={() => setInfoVisible(v => !v)}><Icon name="info" size={16} /> 정보 보기 <span className="menu-value">{infoVisible ? 'ON' : 'OFF'}</span></button>
        <button aria-pressed={serviceBadgeOptions.power} onClick={() => { selectInformation('status'); setServiceBadgeOptions(v => ({ ...v, power: !v.power })); }}><Icon name="power" size={16} /> 전력 상태 표시 <span className="menu-value">{serviceBadgeOptions.power ? 'ON' : 'OFF'}</span></button>
        <button aria-pressed={serviceBadgeOptions.water} onClick={() => { selectInformation('status'); setServiceBadgeOptions(v => ({ ...v, water: !v.water })); }}><Icon name="water" size={16} /> 수도 상태 표시 <span className="menu-value">{serviceBadgeOptions.water ? 'ON' : 'OFF'}</span></button>
        <button aria-pressed={minimapOpen} onClick={() => setMinimapOpen(v => !v)}><Icon name="compass" size={16} /> 미니맵 <span className="menu-value">{minimapOpen ? 'ON' : 'OFF'}</span></button>
        <button aria-pressed={trayOpen} onClick={() => setTrayOpen(v => !v)}><Icon name="building" size={16} /> 프리셋 펼치기 <span className="menu-value">{trayOpen ? 'ON' : 'OFF'}</span></button>
        {infoVisible && <div className="menu-map-layers"><span className="menu-section-label">정보 레이어</span><MapLayerControls layers={mapLayers} onChange={id => setMapLayers(current => ({ ...current, [id]: !current[id] }))} /></div>}
        <span className="menu-section-label menu-divider">시점</span>
        <div className="menu-view-actions"><button onClick={() => { engine.current?.view('home'); setHeaderMenu(null); }}><Icon name="compass" size={16} /> 기본 시점</button><button onClick={() => { engine.current?.view('top'); setHeaderMenu(null); }}><Icon name="layers" size={16} /> 위에서 보기</button></div>
        <div className="menu-view-actions"><button onClick={() => { if (engine.current) engine.current.camera.radius = Math.max(25, engine.current.camera.radius * 0.8); }}><Icon name="plus" size={16} /> 확대</button><button onClick={() => { if (engine.current) engine.current.camera.radius = Math.min(mapDimensions(city).cameraLimit, engine.current.camera.radius * 1.2); }}><Icon name="minus" size={16} /> 축소</button></div>
        <button onClick={() => { setHeaderMenu(null); setCameraOpen(true); }}><Icon name="save" size={16} /> 시점 · 이미지 저장</button>
      </HeaderMenu>
    </EditorMenuBar>
    <header className="city-header glass">
      <div className="brand"><span className="brand-symbol"><Icon name="building" size={24} /></span><div>LUMATRIX<span>CITY STUDIO</span></div></div><div className="header-divider" />
      <div className="city-title"><input aria-label="도시 이름" value={city.name} maxLength={80} onChange={e => commit(c => ({ ...c, name: e.target.value }))} /><span><i /> 자유 건설 모드</span></div>
      <nav className="quick-tools" aria-label="빠른 실행 도구">
        <span className="quick-tools-label">빠른 실행</span>
        <button aria-label="도시·지도 설정" title="도시·지도 설정" onClick={() => { setHeaderMenu(null); setPresetsOpen(true); }}><Icon name="layers" size={17} /><span>지도</span></button>
        <button aria-label="시설 연결선" title="시설 연결선 열기" aria-pressed={connectionsOpen} onClick={() => { setHeaderMenu(null); setLightingOpen(false); setConnectionsOpen(v => !v); setSelectedConnection(null); setMode('select'); }}><Icon name="connection" size={17} /><span>연결선</span></button>
        <span className="quick-tools-divider" />
        <button aria-label="격자 표시" title="격자 켜기·끄기" aria-pressed={gridVisible} onClick={() => { setHeaderMenu(null); setGridVisible(v => !v); }}><Icon name="plot" size={17} /><span>격자</span></button>
        <button aria-label="지도 정보 표시" title="지도 정보 켜기·끄기" aria-pressed={infoVisible} onClick={() => { setHeaderMenu(null); setInfoVisible(v => !v); }}><Icon name="info" size={17} /><span>정보</span></button>
        <button aria-label="전력 연결 상태 표시" title="건물 위 전력 상태 켜기·끄기" aria-pressed={serviceBadgeOptions.power} onClick={() => { setHeaderMenu(null); selectInformation('status'); setServiceBadgeOptions(v => ({ ...v, power: !v.power })); }}><Icon name="power" size={17} /><span>전력</span></button>
        <button aria-label="수도 연결 상태 표시" title="건물 위 수도 상태 켜기·끄기" aria-pressed={serviceBadgeOptions.water} onClick={() => { setHeaderMenu(null); selectInformation('status'); setServiceBadgeOptions(v => ({ ...v, water: !v.water })); }}><Icon name="water" size={17} /><span>수도</span></button>
        <span className="quick-tools-divider" />
        <button aria-label="기본 시점으로 이동" title="기본 시점으로 이동" onClick={() => { setHeaderMenu(null); engine.current?.view('home'); }}><Icon name="home" size={17} /><span>전체 보기</span></button>
        <button aria-label="선택 대상에 화면 맞추기" title="선택 대상에 화면 맞추기 · F" disabled={!hasSelection} onClick={() => { setHeaderMenu(null); frameSelected(); }}><Icon name="compass" size={17} /><span>선택 보기</span></button>
      </nav>
      <div className="header-actions">{pageSession ? <button className="save-state" onClick={showProjects} title={projectSaveStatus}>{projectSaveStatus?.startsWith('자동 저장 실패') ? '자동 저장 실패' : '씬 프로젝트'}</button> : <AutosaveStatus status={autosave.status} onOpen={showProjects} onRetry={() => autosave.flush().catch(() => {})} />}<span className="save-state">{saved ? '저장됨' : '로컬 프로젝트'}</span><button aria-label="도시 파일 불러오기" title="도시 파일 불러오기" onClick={() => fileInput.current.click()}><Icon name="folder" size={18} /></button><button aria-label="도시 파일 내보내기" title="도시 파일 내보내기" onClick={() => setExportOpen(true)}><Icon name="download" size={18} /></button><button className="save-button" onClick={save}><Icon name="save" size={16} /> {pageSession ? '프로젝트 저장' : '도시 저장'}</button></div><input type="file" accept=".json" ref={fileInput} hidden onChange={importCity} />
    </header>
    <div className="world-heading"><span className="eyebrow">YOUR NEXT GREAT CITY</span><h1>부지에서 시작하는 나의 도시.</h1><p>격자 위에 부지를 놓고, 그 안에 도시를 채워 보세요.</p><div className="getting-started"><button className={category === 'plot' ? 'current' : ''} onClick={() => selectCategory('plot')}><span>01</span> 부지 조성</button><i>→</i><button className={['residential', 'commercial', 'industrial', 'landmark', 'power', 'water', 'nature'].includes(category) ? 'current' : ''} onClick={() => selectCategory('residential')}><span>02</span> 시설 배치</button><i>→</i><button className={category === 'road' ? 'current' : ''} onClick={() => selectCategory('road')}><span>03</span> 도로 연결</button></div></div>
    <aside className="world-summary glass"><div className="panel-label"><span className="live-dot" /> 도시 개요 <span>SANDBOX</span></div><div className="summary-primary"><Icon name="people" size={22} /><strong>{population.toLocaleString()}</strong><span>주거 수용 인원</span></div><div className="summary-grid"><div><b>{buildings}</b><span>건물</span></div><div><b>{city.roads.length}</b><span>도로 구간</span></div><div><b>{greens}</b><span>녹지 시설</span></div></div><div className="summary-utilities"><span><Icon name="power" size={13} /> 전력 <b>{service.totals.power}/{service.totals.consumers}</b></span><span><Icon name="water" size={13} /> 수도 <b>{service.totals.water}/{service.totals.consumers}</b></span><span><Icon name="fire" size={13} /> 소방 <b>{fire.totals.covered}/{fire.totals.buildings}</b></span></div><button className="summary-diagnostics" onClick={() => setDiagnosticsOpen(true)}>도시 진단 <b>{diagnostics.issues.length}</b><Icon name="info" size={13} /></button></aside>
    <nav className="scene-tools glass" aria-label="편집 도구"><button className={mode === 'select' ? 'active' : ''} aria-label="선택 도구" title="선택 도구 · Esc" onClick={() => { setMode('select'); setMovingId(null); }}><Icon name="cursor" /></button><button className={boxSelect && mode === 'select' ? 'active' : ''} aria-label="범위 선택" title="드래그로 건물·부지·도로 선택" aria-pressed={boxSelect} onClick={() => { setMode('select'); setBoxSelect(value => !value); setMovingId(null); }}><Icon name="plot" /></button><button className={mode === 'bulldoze' ? 'danger active' : ''} aria-label="철거 도구" title="클릭해서 시설 철거" onClick={() => { setMode('bulldoze'); setMovingId(null); }}><Icon name="bulldoze" /></button><span /><button aria-label="실행 취소" title="실행 취소 · Ctrl Z" disabled={!history.past.length} onClick={undo}><Icon name="undo" /></button><button aria-label="다시 실행" title="다시 실행 · Ctrl Shift Z" disabled={!history.future.length} onClick={redo}><Icon name="redo" /></button></nav>
    <RightInformationDock visible={dockVisible} active={activeInformation} hasSelection={hasSelection} hasOperations={operationsOpen} hasConnections={connectionsOpen} hasLighting={lightingOpen} hasBadges={hasBadges} onSelect={selectInformation} onHelp={() => setHelpOpen(true)}>
    <div hidden={activeInformation !== 'status'}><ServiceBadgeLegend service={service} options={serviceBadgeOptions} onChange={setServiceBadgeOptions} /></div>
    <GridOperationsPanel onConfigure={() => { selectInformation('connections'); setSelectedConnection(null); }} open={activeInformation === 'operations' && operationsOpen} city={city} service={service} onChange={commit} onNotice={setNotice} onClose={() => { setOperationsOpen(false); setInformationTab('selection'); }} onShowBadges={() => setServiceBadgeOptions(v => ({ ...v, power: true, water: true }))} onFocus={id => { setSelected(id); engine.current?.focusEntity(id); }} />
    {connectionsOpen && <ConnectionPanel city={city} engine={engine} mode={mode} onMode={setMode} onChange={commit} onNotice={setNotice} selectedId={selectedConnection} onSelect={setSelectedConnection} onClose={() => setConnectionsOpen(false)} />}
    {lightingOpen && <LightingPanel value={city.environment} engine={engine} onChange={environment => commit({ ...city, environment })} onClose={() => setLightingOpen(false)} />}
    {hasSelection && <section hidden={activeInformation !== 'selection'} key={selected || 'group'} className="selection-panel glass">
      <div className="panel-label">{groupItems.length > 1 ? '다중 선택' : selectedPlot ? '선택한 부지' : '선택한 시설'}<button aria-label="선택 해제" onClick={() => { setSelected(null); if (mode === 'move') { setMode('select'); setMovingId(null); } }}><Icon name="close" size={15} /></button></div>
      <h2>{groupItems.length > 1 ? `${groupItems.length}개 대상` : selectedWater ? `수역 ${waters.indexOf(selectedWater) + 1}` : selectedPlot ? '건설 부지' : object ? facilityName(object) : bridgeById[selectedRoad.bridge]?.name || ROAD_TYPES.find(t => t.id === selectedRoad.type).name}</h2>
      {groupItems.length > 1 ? <BatchControls items={groupItems} dx={groupDx} dz={groupDz} setDx={setGroupDx} setDz={setGroupDz} onAction={applyBatchAction} onLock={lockSelection} /> : <>
        <p>{selectedWater ? '연결된 개별 수면 · 지형을 유지한 채 물을 비울 수 있습니다.' : selectedPlot ? `${selectedPlot.width} × ${selectedPlot.depth} m · ${plotSurface(selectedPlot.surface).name} · 높이 +0.3 m` : object ? assetById[object.asset].detail : `${Math.hypot(selectedRoad.a.x - selectedRoad.b.x, selectedRoad.a.z - selectedRoad.b.z).toFixed(1)} m · 도로 구간`}</p>
        {object && <div className="facility-status" data-status={facilityStatus(object).id}><span>{facilityStatus(object).name}</span>{object.properties?.code && <span>· {object.properties.code}</span>}</div>}
        {(object || selectedPlot || selectedRoad) && <><button aria-pressed={!!(object || selectedPlot || selectedRoad).locked} onClick={() => lockSelection(!(object || selectedPlot || selectedRoad).locked)}>{(object || selectedPlot || selectedRoad).locked ? '잠금 해제' : '선택 잠금'}</button>{(selectedPlot || selectedRoad) && <details className="inspector-details"><summary>이동·복제·삭제</summary><BatchControls items={groupItems} dx={groupDx} dz={groupDz} setDx={setGroupDx} setDz={setGroupDz} onAction={applyBatchAction} onLock={lockSelection} /></details>}</>}
        {selectedWater && <><WaterControls settings={waterSettings(city, selectedWater)} onChange={patch => changeWater(patch, selectedWater)} /><button onClick={() => setWaterOpen(true)}>전체 수역 설정</button><button onClick={() => engine.current?.focusEntity(selected)}>수역 위치로 이동</button></>}
        {selectedRoad && <div className="road-edit-controls"><p>초록색 끝점을 드래그해 길이·방향을 조절하세요.{selectedRoad.bridge && ' 교량 끝은 육지에 연결해야 합니다.'}</p><div role="group" aria-label="선택 도로 종류">{selectedRoad.bridge ? BRIDGE_PRESETS.map(preset => <button key={preset.id} aria-pressed={selectedRoad.bridge === preset.id} onClick={() => changeBridgePreset(preset.id)}>{preset.name}<small>{preset.min}~{preset.max} m</small></button>) : ROAD_TYPES.map(type => <button key={type.id} aria-pressed={selectedRoad.type === type.id} onClick={() => changeRoadType(type.id)}>{type.name}<small>폭 {type.width} m</small></button>)}</div>{roadTerrainWarning(city, selectedRoad) && <p className="road-slope-warning">{roadTerrainWarning(city, selectedRoad)}</p>}</div>}
        {object && <details className="inspector-details" open><summary>공급·서비스 상태</summary><ServiceStatus objectId={object.id} coverage={service.consumers.get(object.id)} facility={service.facilities.get(object.id)} service={service} /><FireStatus building={fire.buildings.get(object.id)} station={fire.stations.get(object.id)} /></details>}
        {object && <FacilityPropertiesPanel key={`${object.id}:${JSON.stringify(object.properties || {})}`} object={object} onApply={draft => { const next = updateFacilityProperties(city, object.id, draft); commit(next); setNotice('시설 속성을 저장했습니다.'); }} />}
        {object && <RoleStatus object={object} diagnostics={diagnostics} />}
        {(object || selectedPlot || selectedRoad) && <button onClick={() => engine.current?.focusEntity(selected)}><Icon name="compass" size={16} /> 선택 위치로 이동</button>}
        {(object || selectedPlot || groupItems.length > 1) && <button onClick={frameSelected} title="선택 대상 전체가 보이도록 확대 · F"><Icon name="compass" size={16} /> 선택 대상에 화면 맞추기 · F</button>}
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
    </RightInformationDock>

    <div className={`bottom-workspace ${trayOpen ? '' : 'collapsed'}`}>{minimapOpen && <aside className="minimap glass"><div className="panel-label">{infoVisible ? '건설 정보 지도' : '지역 지도'} <span>N ↑</span></div><MiniMap city={city} waters={waters} infoVisible={infoVisible} blocked={blocked} disconnected={disconnected} service={service} fire={fire} layers={mapLayers} onNavigate={(x, z) => engine.current?.focusPoint(x, z)} /><div className="minimap-footer">{mapDimensions(city).size} × {mapDimensions(city).size} m<span>전체 지역</span></div>{mapDimensions(city).size < 480 && <button className="map-expand-button" onClick={expandCurrentCity}>지도 확장 · 480 m</button>}</aside>}
      <section className="build-dock glass"><nav className="category-tabs" aria-label="도시 건설 카테고리">{CATEGORIES.map(c => <button key={c.id} className={category === c.id ? 'active' : ''} style={{ '--category-color': c.color }} onClick={() => selectCategory(c.id)}><Icon name={c.icon} size={19} /><span>{c.name}</span></button>)}<button className="collapse-tray" aria-label={trayOpen ? '트레이 접기' : '트레이 펼치기'} onClick={() => setTrayOpen(v => !v)}>{trayOpen ? '⌄' : '⌃'}</button></nav>
      {trayOpen && <div className="tray-content"><div className="tray-heading">{category === 'terrain' && <button className="water-settings-trigger" onClick={() => setWaterOpen(true)}><Icon name="water" size={15} /> 물 설정 · {waters.length}</button>}<div><h2>{activeCategory.name} <span>{category === 'plot' ? 'DEVELOPMENT SITES' : category === 'terrain' ? 'LANDSCAPING' : category === 'road' ? 'CONNECTIONS' : 'ASSET LIBRARY'}</span></h2><p>{category === 'plot' ? '첫 모서리를 클릭하고 마우스로 가로·세로를 조정하세요. 다시 클릭하면 확정됩니다.' : category === 'terrain' ? '브러시 원이 반경을 표시합니다. 부지 주변 지형을 드래그해 편집하세요.' : category === 'road' ? '부지 옆에서 시작점과 끝점을 클릭하여 도로를 연결하세요.' : '프리셋을 클릭하고 격자로 마우스를 옮기세요. 미리보기 위치에서 다시 클릭하면 배치됩니다.'}</p></div>{!['terrain', 'road', 'plot'].includes(category) && <input type="search" aria-label="시설 검색" placeholder="시설 검색…" value={search} onChange={e => setSearch(e.target.value)} />}{mode === 'build' && <button className="rotation-button" onClick={() => setRotation(r => r + Math.PI / 2)}><Icon name="rotate" size={15} /> {Math.round(rotation * 180 / Math.PI) % 360}° <kbd>R</kbd></button>}{mode === 'build' && <label className="alignment-toggle"><input type="checkbox" checked={align} onChange={e => setAlign(e.target.checked)} /> 자동 정렬</label>}{mode === 'build' && <label className="gap-control">정렬 간격 <input aria-label="정렬 간격" type="number" min="0" max="10" step="0.5" value={gap} onChange={e => setGap(Number(e.target.value))} /> m</label>}</div>
      {!['terrain', 'road', 'plot'].includes(category) && <div className="library-filters" role="group" aria-label="시설 세부 분류"><button aria-pressed={subcategory === 'all'} onClick={() => setSubcategory('all')}>전체 <small>{categoryAssets.length}</small></button>{subgroups.map(group => <button key={group.id} aria-pressed={subcategory === group.id} onClick={() => setSubcategory(group.id)}>{group.name}<small>{group.count}</small></button>)}<span className="library-result-count">{visibleAssets.length}개 표시</span></div>}
      {category === 'terrain' ? <div className="terrain-controls"><div className="brush-list">{BRUSHES.map(b => <button key={b.id} className={brush === b.id && mode === 'terrain' ? 'selected' : ''} onClick={() => { setBrush(b.id); setMode('terrain'); }}><Icon name={b.icon} size={27} /><b>{b.name}</b></button>)}</div><div className="brush-settings"><label className="terrain-color-picker">색칠 색상<input aria-label="지형 색칠 색상" type="color" value={paintColor} onChange={e => { setPaintColor(e.target.value); setBrush('paint'); setMode('terrain'); }} /><span>{paintColor}</span></label><label>브러시 크기 <b>{radius} m</b><input aria-label="브러시 크기" type="range" min="4" max="32" step="2" value={radius} onChange={e => setRadius(Number(e.target.value))} /></label><label>강도 <b>{Math.round(strength * 100)}%</b><input aria-label="브러시 강도" type="range" min="0.1" max="1" step="0.1" value={strength} onChange={e => setStrength(Number(e.target.value))} /></label></div></div>
      : category === 'plot' ? <div><div className="plot-finish-controls"><span>부지 표면</span><SurfacePicker value={surface} onChange={setSurface} /><small>지면에서 0.3 m 높게 조성</small></div><div className="asset-list">{PLOT_TYPES.map(p => <button key={p.id} className={`asset-card plot-card ${mode === 'plot' && plot === p.id ? 'selected' : ''}`} onClick={() => { engine.current?.cancelPlotDraft(); setPlot(p.id); setMode('plot'); }}><AssetPreview asset={{ ...p, color: plotSurface(surface).color }} kind="plot" /><b>{p.name} <span>{p.width} × {p.depth} m</span></b><small>{p.detail}</small><span className="asset-size">기본 크기 · 드래그로 자유 조정</span></button>)}<div className="library-note"><Icon name="plot" size={28} /><span>첫 모서리 클릭 → 크기 조정<br />→ 두 번째 클릭으로 확정</span><small>표시되는 너비 × 깊이 확인</small></div></div></div>
      : category === 'road' ? <RoadLibrary road={road} bridge={bridge} mode={mode} shape={roadShape} continuous={roadContinuous} onShape={setRoadShape} onContinuous={setRoadContinuous} onRoad={type => { setBridge(null); setRoad(type); setMode('road'); }} onBridge={chooseBridge} onFinish={() => { engine.current?.cancelPlotDraft(); if (engine.current) engine.current.roadStart = null; }} />
      : <div className="asset-list">{visibleAssets.map(a => <button key={a.id} className={`asset-card ${mode === 'build' && asset === a.id ? 'selected' : ''}`} onClick={() => { setAsset(a.id); setMovingId(null); setMode('build'); setSelected(null); }}><AssetPreview asset={a} /><b>{a.name}</b><small>{a.detail}</small><span className="asset-size">{a.width} × {a.depth} m</span>{mode === 'build' && asset === a.id && <span className="asset-check"><Icon name="check" size={13} /></span>}</button>)}{!visibleAssets.length && <div className="empty-assets">검색한 시설이 없습니다.</div>}<div className="library-note"><Icon name={activeCategory.icon} size={28} /><span>프리셋 클릭 → 위치 확인<br />→ 격자 클릭으로 배치</span><small>{categoryAssets.length}개의 시설 프리셋</small></div></div>}</div>}
      </section>
    </div>
    <footer className="city-status"><div><span className="status-dot" /><b>{modeLabel}</b><span className="status-separator" />{mode === 'waypoint' ? '선 클릭: 경유점 추가 · 구슬 드래그: 이동 · Esc 종료' : mode === 'connect' ? '출발 시설 A → 도착 시설 B 클릭 · Esc 취소' : mode === 'plot' ? '첫 클릭: 시작점 · 마우스로 크기 조정 · 다시 클릭: 확정' : mode === 'select' ? '클릭 선택 · Shift + 드래그 또는 범위 선택 버튼' : mode === 'terrain' ? `왼쪽 드래그로 지형 편집 · 반경 ${radius} m` : mode === 'road' ? '시작점 → 끝점 클릭' : mode === 'bulldoze' ? '시설을 클릭하여 철거' : mode === 'move' ? '선택한 건물을 새 위치로 옮기기 · Esc 취소' : `프리셋 모양 확인 → ${align ? '부지·건물 자동 정렬' : '2 m 격자에 맞춤'} · R 회전 · Esc 취소`}</div><div className="navigation-hint">우클릭 회전 <span>·</span> 휠 클릭 이동 <span>·</span> 스크롤 확대<button aria-label="사용법" onClick={() => setHelpOpen(true)}><Icon name="help" size={16} /></button></div><button className="mobile-help" aria-label="사용법 열기" onClick={() => setHelpOpen(true)}><Icon name="help" size={16} /></button></footer>
    {notice && <div className="city-toast glass" role="status"><Icon name="check" size={17} />{notice}</div>}{error && <div className="engine-error glass" role="alert">{error}</div>}
    {presetsOpen && <div className="modal-backdrop" onClick={() => setPresetsOpen(false)}><section className="preset-modal glass" role="dialog" aria-modal="true" aria-label="도시·지도 설정" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="프리셋 닫기" onClick={() => setPresetsOpen(false)}><Icon name="close" /></button><h2>도시 · 지도 설정</h2><section className="current-map-settings" aria-label="현재 도시 지도 확장"><b>현재 도시 · {city.name}</b><p>지도 {mapDimensions(city).size} × {mapDimensions(city).size} m · 지형 간격 2 m</p>{mapDimensions(city).size < 480 ? <><p>기존 건물·도로·지형을 유지하면서 바깥에 새 땅을 추가합니다. 전체 면적이 4배로 늘어납니다.</p><button className="map-expand-button" onClick={expandCurrentCity}>현재 도시를 480 × 480 m로 확장</button></> : <p>현재 지원하는 최대 지도 크기입니다.</p>}</section><span className="eyebrow">새 도시 만들기</span><h3>어떤 도시를 만들어 볼까요?</h3><p>새로운 지형과 도시 배치로 시작합니다. 현재 도시는 실행 취소로 되돌릴 수 있습니다.</p><label className="map-size-control">지도 크기<select value={newMapSize} onChange={event => setNewMapSize(Number(event.target.value))}>{MAP_SIZES.map(size => <option key={size} value={size}>{size === 240 ? '소형' : '중형'} · {size} × {size} m</option>)}</select></label><div className="preset-grid">{PRESETS.map(p => <button className={`preset-card preset-${p.id}`} key={p.id} onClick={() => { autosave.newProject(); commit(createCity(p.id, newMapSize)); setSelected(null); setMode('select'); setPresetsOpen(false); engine.current?.view('home'); setNotice(`${p.name} 프리셋을 불러왔습니다.`); }}><div className="preset-art"><AssetPreview asset={p} kind="world" /></div><span className="eyebrow">{p.tag}</span><h3>{p.name}</h3><p>{p.subtitle}</p></button>)}</div><div className="preset-footnote">모든 프리셋은 자유롭게 편집할 수 있습니다. · 외부 지도 연결 없이 사용 가능</div></section></div>}
    {helpOpen && <Suspense fallback={<div className="city-toast glass" role="status">매뉴얼을 불러오는 중…</div>}><ManualDialog onClose={() => setHelpOpen(false)} /></Suspense>}
    {directoryOpen && <FacilityDirectory city={city} onClose={() => setDirectoryOpen(false)} onSelect={locateFacility} />}
    {exportOpen && <CityExportPanel cityName={city.name} onClose={() => setExportOpen(false)} onSave={exportCity} />}
    {cameraOpen && <CameraPanel views={city.cameraViews || []} onClose={() => setCameraOpen(false)} onAdd={name => { if (engine.current) { const view = { id: crypto.randomUUID(), name, ...engine.current.cameraState() }; commit(current => ({ ...current, cameraViews: [...current.cameraViews || [], view] })); } }} onRemove={id => commit(current => ({ ...current, cameraViews: current.cameraViews.filter(view => view.id !== id) }))} onView={view => { engine.current?.restoreCamera(view); setCameraOpen(false); }} onExport={exportImage} />}
    {districtOpen && <DistrictPanel city={city} service={service} onChange={districts => commit(current => ({ ...current, districts }))} onClose={() => setDistrictOpen(false)} onLocate={id => { setDistrictOpen(false); locateFacility(id, 'plot'); }} />}
    {lifeOpen && <LifePanel settings={city.lifeSettings} onChange={lifeSettings => commit(current => ({ ...current, lifeSettings }))} onClose={() => setLifeOpen(false)} />}
    {waterOpen && <WaterPanel city={city} regions={waters} initialId={selectedWater?.id} onChange={changeWater} onSelect={id => locateFacility(id, 'water')} onClose={() => setWaterOpen(false)} />}
    {diagnosticsOpen && <CityDiagnostics diagnostics={diagnostics} onClose={() => setDiagnosticsOpen(false)} onIssue={inspectIssue} changes={changes} hasPrevious={!!previousCity} />}
  </main>;
}

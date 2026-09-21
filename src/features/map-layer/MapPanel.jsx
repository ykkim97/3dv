import { useEffect, useRef, useState } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { buildMapLayerData, DEFAULT_OVERTURE_RELEASE, localToGeo } from "./mapDataService.js";
import "./map-layer.css";

const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 };
const MAP_PATCH_CACHE_LIMIT = 2;

function cachePatch(cache, key, data) {
  cache.delete(key);
  cache.set(key, data);
  while (cache.size > MAP_PATCH_CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

export default function MapPanel({ sceneProject, onApplied }) {
  const mapRef = useRef(null);
  const viewerRef = useRef(null);
  const streamRef = useRef({ generation: 0, loading: false, anchor: null, config: null, current: null, cache: new Map() });
  const [latitude, setLatitude] = useState(DEFAULT_CENTER.latitude);
  const [longitude, setLongitude] = useState(DEFAULT_CENTER.longitude);
  const [radius, setRadius] = useState(1000);
  const [imageryQuality, setImageryQuality] = useState("high");
  const [verticalScale, setVerticalScale] = useState(1);
  const [includeBuildings, setIncludeBuildings] = useState(true);
  const [streamOnPan, setStreamOnPan] = useState(true);
  const [release, setRelease] = useState(DEFAULT_OVERTURE_RELEASE);
  const [status, setStatus] = useState("지도에서 위치를 선택하세요.");
  const [loading, setLoading] = useState(false);
  const token = import.meta.env.VITE_CESIUM_ION_TOKEN || "";

  useEffect(() => {
    let disposed = false;
    let handler;
    let localViewer;
    window.CESIUM_BASE_URL = "/cesium/";
    (async () => {
      const Cesium = await import("cesium");
      if (disposed || !mapRef.current) return;
      Cesium.Ion.defaultAccessToken = token;
      let terrainProvider;
      if (token) {
        try {
          terrainProvider = await Cesium.createWorldTerrainAsync();
        } catch (error) {
          if (disposed) return;
          console.warn("Cesium World Terrain 초기화 실패", error);
          setStatus("지형 미리보기를 열지 못해 평면 지도로 표시합니다.");
        }
      }
      if (disposed || !mapRef.current) return;
      const viewer = new Cesium.Viewer(mapRef.current, {
        terrainProvider,
        baseLayer: new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" })),
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
      });
      localViewer = viewer;
      if (disposed) {
        viewer.destroy();
        return;
      }
      viewerRef.current = viewer;
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude, 4500) });
      const marker = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude),
        point: { pixelSize: 10, color: Cesium.Color.fromCssColorString("#39a0ff"), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      });
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((event) => {
        const point = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid);
        if (!point) return;
        const cartographic = Cesium.Cartographic.fromCartesian(point);
        const nextLon = Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(6));
        const nextLat = Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(6));
        marker.position = Cesium.Cartesian3.fromDegrees(nextLon, nextLat);
        setLongitude(nextLon);
        setLatitude(nextLat);
        setStatus(`${nextLat.toFixed(5)}, ${nextLon.toFixed(5)} 선택됨`);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    })().catch((error) => {
      if (disposed || error?.type === "cancelation") return;
      setStatus(`지도 초기화 실패: ${error.message || error}`);
    });
    return () => {
      disposed = true;
      try { handler?.destroy(); } catch { void 0; }
      try { localViewer?.destroy(); } catch { void 0; }
      if (viewerRef.current === localViewer) viewerRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!sceneProject || !streamOnPan) return undefined;
    let disposed = false;
    const timer = window.setInterval(async () => {
      const stream = streamRef.current;
      if (disposed || !stream.anchor || !stream.config || !stream.current) return;
      const navigation = sceneProject.getMapNavigationState?.();
      if (!navigation) return;
      const now = performance.now();
      const previous = stream.lastNavigation;
      stream.lastNavigation = { ...navigation.target, time: now };
      if (stream.loading) return;

      const baseRadius = stream.config.radius;
      // The initial camera radius is 1.7 times the map radius; keep the user's
      // chosen 1 km patch until they actually zoom out.
      const desiredRadius = Math.min(2500, Math.max(baseRadius, navigation.cameraRadius * 0.55));
      const radiusSteps = [baseRadius, Math.min(2500, baseRadius * 2), Math.min(2500, baseRadius * 4), 2500];
      const patchRadius = radiusSteps.find((value) => value >= desiredRadius) || 2500;
      const distanceFromPatch = Math.hypot(
        navigation.target.x - stream.current.offset.x,
        navigation.target.z - stream.current.offset.z,
      );
      const needsLargerPatch = patchRadius > stream.current.radius;
      if (!needsLargerPatch && distanceFromPatch < stream.current.radius * 0.22) return;

      const snap = Math.max(50, baseRadius * 0.2);
      const elapsed = previous ? Math.max(1, now - previous.time) : 1;
      const dx = previous ? (navigation.target.x - previous.x) * 450 / elapsed : 0;
      const dz = previous ? (navigation.target.z - previous.z) * 450 / elapsed : 0;
      const lead = Math.min(1, patchRadius * 0.12 / Math.max(1, Math.hypot(dx, dz)));
      const offset = {
        x: Math.round((navigation.target.x + dx * lead) / snap) * snap,
        z: Math.round((navigation.target.z + dz * lead) / snap) * snap,
      };
      const key = `${offset.x}:${offset.z}:${patchRadius}`;
      if (key === stream.current.key) return;

      stream.loading = true;
      const generation = stream.generation;
      try {
        let data = stream.cache.get(key);
        if (data) {
          cachePatch(stream.cache, key, data);
          setStatus("캐시된 맵 패치를 적용하는 중…");
        } else {
          const center = localToGeo(offset.x, offset.z, stream.anchor);
          setStatus(`이동 영역을 스트리밍하는 중… ${Math.round(patchRadius)} m`);
          data = await buildMapLayerData({
            ...stream.config,
            latitude: center.latitude,
            longitude: center.longitude,
            radius: patchRadius,
            elevationOrigin: stream.elevationOrigin,
          }, (message) => {
            if (!disposed && generation === streamRef.current.generation) setStatus(message);
          });
          if (!data.imageryCanvas) throw new Error("영상 타일을 불러오지 못해 기존 맵을 유지합니다.");
          data.worldOffset = offset;
          if (disposed || generation !== streamRef.current.generation) return;
          cachePatch(stream.cache, key, data);
        }
        if (disposed || generation !== streamRef.current.generation) return;
        // Don't jump backwards when the user reverses direction during a load.
        const latest = sceneProject.getMapNavigationState?.();
        if (latest && !needsLargerPatch &&
          Math.hypot(latest.target.x - offset.x, latest.target.z - offset.z) >
          Math.hypot(latest.target.x - stream.current.offset.x, latest.target.z - stream.current.offset.z)) return;
        const summary = sceneProject.applyMapLayer(data, { preserveCamera: true, transitionMs: 650 });
        stream.current = { key, offset, radius: patchRadius };
        setStatus(`스트리밍 완료 · 반경 ${patchRadius} m · 건물 ${summary.buildings}개 · 캐시 ${stream.cache.size}/${MAP_PATCH_CACHE_LIMIT}`);
      } catch (error) {
        if (!disposed && generation === streamRef.current.generation) {
          console.error(error);
          setStatus(`맵 스트리밍 실패: ${error.message || error}`);
        }
      } finally {
        if (generation === streamRef.current.generation) stream.loading = false;
      }
    }, 120);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [sceneProject, streamOnPan]);

  const flyToCoordinates = async () => {
    const Cesium = await import("cesium");
    viewerRef.current?.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(Number(longitude), Number(latitude), Math.max(1200, Number(radius) * 5)) });
  };

  const applyLayer = async () => {
    if (!sceneProject) return setStatus("먼저 씬을 생성하거나 선택하세요.");
    const generation = ++streamRef.current.generation;
    streamRef.current.anchor = null;
    streamRef.current.loading = true;
    setLoading(true);
    try {
      const data = await buildMapLayerData({ latitude, longitude, radius, imageryQuality, verticalScale, includeBuildings, release, token }, setStatus);
      if (generation !== streamRef.current.generation) return;
      data.worldOffset = { x: 0, z: 0 };
      const summary = sceneProject.applyMapLayer(data);
      const rendered = await sceneProject.waitForMapLayerReady();
      if (!rendered) throw new Error("Babylon terrain mesh가 렌더 준비 상태가 되지 않았습니다.");
      const warningText = data.warnings.length ? ` · 대체 처리 ${data.warnings.length}건` : "";
      const stream = streamRef.current;
      stream.loading = false;
      stream.lastNavigation = null;
      stream.anchor = { latitude: Number(latitude), longitude: Number(longitude) };
      stream.elevationOrigin = data.elevationOrigin;
      stream.config = { imageryQuality, verticalScale, includeBuildings, release, token, radius: Number(radius) };
      stream.current = { key: `0:0:${Number(radius)}`, offset: { x: 0, z: 0 }, radius: Number(radius) };
      stream.cache = new Map();
      cachePatch(stream.cache, stream.current.key, data);
      setStatus(`화면 적용 완료 · 원형 terrain ${data.resolution}×${data.resolution} · 건물 ${summary.buildings}개${streamOnPan ? " · 팬 스트리밍 켜짐" : ""}${warningText}`);
      onApplied?.(summary);
    } catch (error) {
      console.error(error);
      setStatus(`맵 레이어 실패: ${error.message || error}`);
    } finally {
      if (generation === streamRef.current.generation) streamRef.current.loading = false;
      setLoading(false);
    }
  };

  return (
    <div className="map-panel">
      <div className="panel-header"><h2>Map Layer</h2><span className="map-provider-badge">CESIUM · OVERTURE</span></div>
      <div ref={mapRef} className="map-picker" />
      <div className="map-form">
        <div className="map-coordinate-grid">
          <label>Latitude<input className="input" type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(e.target.value)} /></label>
          <label>Longitude<input className="input" type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(e.target.value)} /></label>
        </div>
        <div className="map-coordinate-grid">
          <label>Radius<select value={radius} onChange={(e) => setRadius(Number(e.target.value))}><option value="250">250 m</option><option value="500">500 m</option><option value="1000">1 km</option><option value="2000">2 km</option></select></label>
          <label>Terrain scale<input className="input" type="number" min="0" max="5" step="0.25" value={verticalScale} onChange={(e) => setVerticalScale(e.target.value)} /></label>
        </div>
        <label>Imagery quality<select value={imageryQuality} onChange={(e) => setImageryQuality(e.target.value)}><option value="standard">Standard</option><option value="high">High (권장)</option><option value="ultra">Ultra</option></select></label>
        <label className="map-check"><input type="checkbox" checked={includeBuildings} onChange={(e) => setIncludeBuildings(e.target.checked)} /> Overture buildings</label>
        <label className="map-check"><input type="checkbox" checked={streamOnPan} onChange={(e) => setStreamOnPan(e.target.checked)} /> 팬 이동 시 맵 스트리밍</label>
        <label>Overture release<input className="input" value={release} onChange={(e) => setRelease(e.target.value)} /></label>
        <div className="map-actions"><button type="button" className="btn btn-ghost" onClick={flyToCoordinates}>좌표 이동</button><button type="button" className="btn btn-primary" disabled={loading || !sceneProject} onClick={applyLayer}>{loading ? "불러오는 중…" : "맵 레이어 적용"}</button></div>
        <button type="button" className="btn btn-warn map-remove" disabled={!sceneProject || loading} onClick={() => { streamRef.current.generation += 1; streamRef.current.anchor = null; streamRef.current.cache.clear(); sceneProject?.clearMapLayer(); setStatus("맵 레이어를 제거했습니다."); }}>레이어 제거</button>
        <div className="map-status" aria-live="polite">{status}</div>
        <div className="map-attribution">Imagery © Cesium / OpenStreetMap contributors · Buildings © Overture Maps Foundation</div>
      </div>
    </div>
  );
}

import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";

const EARTH_METERS = 111_320;
const DEFAULT_OVERTURE_RELEASE = import.meta.env.VITE_OVERTURE_RELEASE || "2026-08-19.0";
const imageryProviders = new Map();
const terrainProviders = new Map();
const imageryTiles = new WeakMap();
const archives = new Map();
const buildingTiles = new Map();

// Cache promises as well as results, so overlapping patches share requests.
function cachedRequest(cache, key, limit, loader) {
  if (cache.has(key)) {
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }
  const value = Promise.resolve().then(loader).catch((error) => {
    if (cache.get(key) === value) cache.delete(key);
    throw error;
  });
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value);
  return value;
}

export function geoToLocal(lon, lat, center) {
  const x = (lon - center.longitude) * EARTH_METERS * Math.cos(center.latitude * Math.PI / 180);
  const z = (lat - center.latitude) * 110_540;
  return { x, z };
}

export function localToGeo(x, z, center) {
  return {
    longitude: center.longitude + x / (EARTH_METERS * Math.cos(center.latitude * Math.PI / 180)),
    latitude: center.latitude + z / 110_540,
  };
}

function boundsForRadius(center, radius) {
  const latDelta = radius / 110_540;
  const lonDelta = radius / (EARTH_METERS * Math.cos(center.latitude * Math.PI / 180));
  return { west: center.longitude - lonDelta, east: center.longitude + lonDelta, south: center.latitude - latDelta, north: center.latitude + latDelta };
}

function lonLatToTile(lon, lat, zoom) {
  const scale = 2 ** zoom;
  const radians = lat * Math.PI / 180;
  return {
    x: Math.floor(((lon + 180) / 360) * scale),
    y: Math.floor((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * scale),
  };
}

function providerPixel(Cesium, provider, lon, lat, level) {
  const scheme = provider.tilingScheme;
  const position = Cesium.Cartographic.fromDegrees(lon, lat);
  const tile = scheme.positionToTileXY(position, level);
  const rectangle = scheme.tileXYToNativeRectangle(tile.x, tile.y, level);
  const projected = scheme.projection.project(position);
  const offsetX = (projected.x - rectangle.west) / (rectangle.east - rectangle.west);
  const offsetY = (rectangle.north - projected.y) / (rectangle.north - rectangle.south);
  return {
    tile,
    offsetX,
    offsetY,
  };
}

function imagerySettings(radius, quality) {
  const baseZoom = radius <= 300 ? 18 : radius <= 600 ? 17 : radius <= 1200 ? 16 : 15;
  if (quality === "ultra") return { zoom: baseZoom + 2, maxTextureSize: 4096 };
  if (quality === "standard") return { zoom: baseZoom, maxTextureSize: 2048 };
  return { zoom: baseZoom + 1, maxTextureSize: 4096 };
}

async function loadImagery(Cesium, center, radius, token, quality, progress) {
  progress("영상 타일을 가져오는 중…");
  Cesium.Ion.defaultAccessToken = token || "";
  let provider;
  if (token) {
    try {
      provider = await cachedRequest(imageryProviders, token, 2,
        () => Cesium.createWorldImageryAsync({ style: Cesium.IonWorldImageryStyle.AERIAL }));
    } catch (error) {
      console.warn("Cesium World Imagery를 열 수 없어 OpenStreetMap으로 전환합니다.", error);
      progress("Cesium 영상 대신 OpenStreetMap 타일을 사용합니다.");
    }
  }
  provider ||= await cachedRequest(imageryProviders, "osm", 2,
    () => new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }));
  if (!imageryTiles.has(provider)) imageryTiles.set(provider, new Map());
  const tileCache = imageryTiles.get(provider);
  const bounds = boundsForRadius(center, radius);
  const settings = imagerySettings(radius, quality);
  const levelZeroScale = Math.round(Math.log2(provider.tilingScheme.getNumberOfXTilesAtLevel(0)));
  const requestedLevel = Math.max(0, settings.zoom - levelZeroScale);
  const level = Number.isFinite(provider.maximumLevel)
    ? Math.min(requestedLevel, provider.maximumLevel)
    : requestedLevel;
  progress(`영상 타일을 가져오는 중… z${level + levelZeroScale}`);
  const pxNW = providerPixel(Cesium, provider, bounds.west, bounds.north, level);
  const pxSE = providerPixel(Cesium, provider, bounds.east, bounds.south, level);
  const nw = pxNW.tile;
  const se = pxSE.tile;
  const tileWidth = provider.tileWidth || 256;
  const tileHeight = provider.tileHeight || 256;
  const cropLeft = pxNW.offsetX * tileWidth;
  const cropTop = pxNW.offsetY * tileHeight;
  const width = Math.max(1, Math.ceil((se.x - nw.x) * tileWidth + pxSE.offsetX * tileWidth - cropLeft));
  const height = Math.max(1, Math.ceil((se.y - nw.y) * tileHeight + pxSE.offsetY * tileHeight - cropTop));
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(width, settings.maxTextureSize);
  canvas.height = Math.min(height, settings.maxTextureSize);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.scale(canvas.width / width, canvas.height / height);
  const tasks = [];
  for (let y = nw.y; y <= se.y; y += 1) {
    for (let x = nw.x; x <= se.x; x += 1) {
      tasks.push(async () => {
        const image = await cachedRequest(tileCache, `${level}/${x}/${y}`, 192, async () => {
          for (let attempt = 0; attempt < 10; attempt += 1) {
            const tileImage = await provider.requestImage(x, y, level);
            if (tileImage) return tileImage;
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
          throw new Error(`영상 타일 요청 지연: ${level}/${x}/${y}`);
        });
        if (image) {
          const destinationX = (x - nw.x) * tileWidth - cropLeft;
          const destinationY = (y - nw.y) * tileHeight - cropTop;
          // Cesium's ImageryProvider decodes ImageBitmap tiles with flipY=true
          // because they normally go straight to WebGL. We compose them in a
          // top-left-origin 2D canvas instead, so restore each bitmap first.
          // HTMLImageElement is the non-ImageBitmap fallback and is not flipped.
          const isFlippedBitmap = typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap;
          if (isFlippedBitmap) {
            context.save();
            context.translate(destinationX, destinationY + tileHeight);
            context.scale(1, -1);
            context.drawImage(image, 0, 0, tileWidth, tileHeight);
            context.restore();
          } else {
            context.drawImage(image, destinationX, destinationY, tileWidth, tileHeight);
          }
        }
      });
    }
  }
  let nextTask = 0;
  await Promise.all(Array.from({ length: Math.min(8, tasks.length) }, async () => {
    while (nextTask < tasks.length) await tasks[nextTask++]();
  }));
  // Keep the decoded canvas in memory. Converting a large mosaic to a data URL
  // and loading it again can leave Babylon's material waiting indefinitely in
  // WebView runtimes (and needlessly duplicates the image in memory).
  return canvas;
}

async function loadTerrain(Cesium, center, radius, token, resolution, elevationOrigin, progress) {
  const count = resolution * resolution;
  if (!token) return { heights: new Array(count).fill(0), elevationOrigin: Number(elevationOrigin) || 0 };
  progress("Cesium World Terrain 고도를 샘플링하는 중…");
  Cesium.Ion.defaultAccessToken = token;
  const provider = await cachedRequest(terrainProviders, token, 2, () => Cesium.createWorldTerrainAsync());
  const bounds = boundsForRadius(center, radius);
  const positions = [];
  for (let row = 0; row < resolution; row += 1) {
    const lat = bounds.north + (bounds.south - bounds.north) * row / (resolution - 1);
    for (let col = 0; col < resolution; col += 1) {
      const lon = bounds.west + (bounds.east - bounds.west) * col / (resolution - 1);
      positions.push(Cesium.Cartographic.fromDegrees(lon, lat));
    }
  }
  // Sample the selected map coordinate explicitly. The local scene origin is
  // defined by this point, not by the lowest point inside the requested area.
  positions.push(Cesium.Cartographic.fromDegrees(center.longitude, center.latitude));
  const sampled = await Cesium.sampleTerrainMostDetailed(provider, positions);
  const sampledCenterHeight = Number.isFinite(sampled[count]?.height) ? sampled[count].height : 0;
  const referenceHeight = Number.isFinite(Number(elevationOrigin)) ? Number(elevationOrigin) : sampledCenterHeight;
  return {
    elevationOrigin: referenceHeight,
    heights: sampled.slice(0, count).map((position) => {
      const height = Number.isFinite(position.height) ? position.height : sampledCenterHeight;
      return height - referenceHeight;
    }),
  };
}

async function loadBuildings(center, radius, release, progress) {
  progress("Overture 건물 타일을 읽는 중…");
  const zoom = 14;
  const bounds = boundsForRadius(center, radius);
  const nw = lonLatToTile(bounds.west, bounds.north, zoom);
  const se = lonLatToTile(bounds.east, bounds.south, zoom);
  const url = `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${release}/buildings.pmtiles`;
  const archive = await cachedRequest(archives, url, 2, () => new PMTiles(url));
  const seen = new Set();
  const buildings = [];
  let failedTiles = 0;
  const tileRequests = [];
  for (let y = nw.y; y <= se.y; y += 1) {
    for (let x = nw.x; x <= se.x; x += 1) tileRequests.push({ x, y });
  }
  // A small worker pool avoids serial network latency without flooding S3.
  let nextTile = 0;
  const loadedTiles = new Map();
  await Promise.all(Array.from({ length: Math.min(4, tileRequests.length) }, async () => {
    while (nextTile < tileRequests.length) {
      const { x, y } = tileRequests[nextTile++];
      try {
        const tile = await cachedRequest(buildingTiles, `${url}/${zoom}/${x}/${y}`, 64,
          () => archive.getZxy(zoom, x, y));
        loadedTiles.set(`${x}/${y}`, tile);
      } catch (error) {
        failedTiles += 1;
        console.warn(`Overture building tile ${zoom}/${x}/${y} 로드 실패`, error);
      }
    }
  }));
  for (let y = nw.y; y <= se.y; y += 1) {
    for (let x = nw.x; x <= se.x; x += 1) {
      const tile = loadedTiles.get(`${x}/${y}`);
      if (!tile?.data) continue;
      const vectorTile = new VectorTile(new PbfReader(tile.data));
      for (const layer of Object.values(vectorTile.layers)) {
        for (let index = 0; index < layer.length; index += 1) {
          // Dense tiles can contain thousands of features. Yield periodically
          // while collecting the whole map footprint, not a tile-order quota.
          if (index > 0 && index % 500 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
          const feature = layer.feature(index);
          const geojson = feature.toGeoJSON(x, y, zoom);
          if (geojson.geometry?.type !== "Polygon" && geojson.geometry?.type !== "MultiPolygon") continue;
          const properties = geojson.properties || {};
          const id = properties.id || `${layer.name}-${x}-${y}-${index}`;
          if (seen.has(id)) continue;
          const polygons = geojson.geometry.type === "Polygon" ? [geojson.geometry.coordinates] : geojson.geometry.coordinates;
          const localPolygons = polygons
            .map((polygon) => polygon[0].map(([lon, lat]) => geoToLocal(lon, lat, center)))
            .filter((polygon) => {
              if (!polygon.length) return false;
              // Keep footprints whose bounds overlap the visible circle.
              // The renderer fades their vertices with the same mask as terrain.
              const xs = polygon.map((point) => point.x);
              const zs = polygon.map((point) => point.z);
              const nearestX = Math.max(Math.min(...xs), Math.min(0, Math.max(...xs)));
              const nearestZ = Math.max(Math.min(...zs), Math.min(0, Math.max(...zs)));
              return Math.hypot(nearestX, nearestZ) < radius;
            });
          if (!localPolygons.length) continue;
          seen.add(id);
          const height = Math.min(250, Math.max(2.5, Number(properties.height) || Number(properties.level) * 3.2 || 10));
          buildings.push({ id, name: properties["@name"] || properties.name || "Building", height, polygons: localPolygons });
        }
      }
    }
  }
  if (failedTiles) progress(`Overture 건물 ${buildings.length}개 · 실패 타일 ${failedTiles}개`);
  return buildings;
}

export async function buildMapLayerData(options, onProgress = () => {}) {
  window.CESIUM_BASE_URL = "/cesium/";
  const Cesium = await import("cesium");
  const center = { latitude: Number(options.latitude), longitude: Number(options.longitude) };
  const radius = Math.max(100, Math.min(2500, Number(options.radius) || 1000));
  const terrainSpacing = options.imageryQuality === "ultra" ? 8 : options.imageryQuality === "standard" ? 32 : 16;
  const resolutionLimit = options.imageryQuality === "ultra" ? 129 : options.imageryQuality === "standard" ? 65 : 97;
  const requestedResolution = Math.min(resolutionLimit, Math.max(25, Math.ceil((radius * 2) / terrainSpacing) + 1));
  // Keep a vertex at x=0/z=0 so the selected geographic origin lands exactly
  // on the editor's Y=0 plane instead of being interpolated between vertices.
  const resolution = requestedResolution % 2 === 0
    ? Math.min(resolutionLimit, requestedResolution + 1)
    : requestedResolution;
  const warnings = [];
  const safeLoad = async (label, loader, fallback) => {
    try {
      return await loader();
    } catch (error) {
      console.warn(`${label} 로드 실패`, error);
      warnings.push(`${label}: ${error.message || error}`);
      return fallback;
    }
  };
  const terrainFallback = { heights: new Array(resolution * resolution).fill(0), elevationOrigin: Number(options.elevationOrigin) || 0 };
  const [imageryCanvas, terrainData, buildings] = await Promise.all([
    safeLoad("영상", () => loadImagery(Cesium, center, radius, options.token, options.imageryQuality || "high", onProgress), null),
    safeLoad("지형", () => loadTerrain(Cesium, center, radius, options.token, resolution, options.elevationOrigin, onProgress), terrainFallback),
    options.includeBuildings
      ? safeLoad("건물", () => loadBuildings(center, radius, options.release || DEFAULT_OVERTURE_RELEASE, onProgress), [])
      : Promise.resolve([]),
  ]);
  return {
    center,
    radius,
    resolution,
    heights: terrainData.heights,
    elevationOrigin: terrainData.elevationOrigin,
    imageryCanvas,
    buildings,
    warnings,
    verticalScale: Number(options.verticalScale) || 1,
    // Keep geographic calculations in metres, but render the complete map
    // layer at a compact editor-friendly scale (500 m => 64 scene units).
    sceneScale: 0.128,
  };
}

export { DEFAULT_OVERTURE_RELEASE };

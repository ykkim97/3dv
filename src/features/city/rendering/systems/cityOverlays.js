import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import { terrainHeight } from '../../terrain/terrainModel.js';
import { plotHasRoadAccess } from '../../plots/plotModel.js';
import { plotTopHeight, objectBaseHeight } from '../../plots/plotModel.js';
import { calculateUtilityService } from '../../simulation/utilityService.js';
import { calculateFireService } from '../../simulation/fireService.js';
import { CITY_ROLE_SPECS } from '../../management/cityDiagnostics.js';
import { defaultMapLayers, MAP_LAYERS, roleLayer } from '../../management/cityManagement.js';

export const cityOverlays = {
  addServiceRangeFill(facility, color) {
    const material = this.material(`${facility.network}-range-fill`, color);
    material.disableLighting = true;
    material.emissiveColor = Color3.FromHexString(color);
    material.alpha = 0.16;
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    // A small terrain-following mesh stays visible over raised sites without
    // drawing over buildings. Only the selected facility gets a filled range.
    const segments = 64, rings = Math.min(32, Math.max(1, Math.ceil(facility.radius / 3)));
    const positions = [], indices = [];
    const plots = this.city.plots.map(plot => ({ ...plot, top: plotTopHeight(this.city, plot) }));
    const point = (x, z) => {
      let height = Math.max(terrainHeight(this.city.heights, x, z) + 0.4, 0.4);
      for (const plot of plots) if (Math.abs(x - plot.x) <= plot.width / 2 && Math.abs(z - plot.z) <= plot.depth / 2) height = Math.max(height, plot.top + 0.08);
      positions.push(x, height, z);
    };
    point(facility.x, facility.z);
    for (let ring = 1; ring <= rings; ring++) for (let i = 0; i < segments; i++) {
      const angle = i * Math.PI * 2 / segments, radius = facility.radius * ring / rings;
      point(facility.x + Math.cos(angle) * radius, facility.z + Math.sin(angle) * radius);
      const current = 1 + (ring - 1) * segments + i, next = 1 + (ring - 1) * segments + (i + 1) % segments;
      if (ring === 1) indices.push(0, next, current);
      else indices.push(current - segments, next, current, current - segments, next - segments, next);
    }
    const mesh = new Mesh('service-range-fill', this.scene), data = new VertexData();
    data.positions = positions; data.indices = indices; data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals); data.applyToMesh(mesh);
    mesh.material = material; mesh.isPickable = false; mesh.freezeWorldMatrix();
    this.serviceGuides.push(mesh);
  },
  setInfoVisible(visible) { this.infoVisible = visible; this.refreshInfoOverlay(); this.updateServiceGuides(); },
  setMapLayers(layers) { this.mapLayers = { ...defaultMapLayers, ...layers }; this.updateServiceGuides(); },
  updateDistricts() {
    this.districtMeshes?.forEach(mesh => mesh.dispose()); this.districtMeshes = [];
    for (const district of this.city.districts || []) for (const plot of this.city.plots.filter(item => district.plotIds.includes(item.id))) {
      const points = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => new Vector3(plot.x + x * plot.width / 2, plotTopHeight(this.city, plot) + 0.06, plot.z + z * plot.depth / 2));
      const mesh = MeshBuilder.CreateLines('district-boundary', { points }, this.scene); mesh.color = Color3.FromHexString(district.color); mesh.isPickable = false; this.districtMeshes.push(mesh);
    }
  },
  updateServiceGuides() {
    for (const guide of this.serviceGuides || []) guide.dispose();
    this.serviceGuides = [];
    if (!this.city) return;
    const service = this.getUtilityService?.() || calculateUtilityService(this.city);
    const layers = this.mapLayers || defaultMapLayers;
    for (const facility of service.facilities.values()) {
      if (this.infoVisible && !layers[facility.network]) continue;
      if (!this.infoVisible && facility.id !== this.selectedId) continue;
      const baseColor = facility.network === 'power' ? '#f3d27a' : '#78d4df';
      const color = Color3.FromHexString(facility.role === 'terminal' ? '#a9b8b1' : facility.connected ? baseColor : '#e48e7e');
      const addRing = (radius, alpha) => {
        const points = Array.from({ length: 65 }, (_, i) => {
          const angle = i * Math.PI * 2 / 64;
          const x = facility.x + Math.cos(angle) * radius;
          const z = facility.z + Math.sin(angle) * radius;
          return new Vector3(x, Math.max(terrainHeight(this.city.heights, x, z) + 0.42, 0.42), z);
        });
        const ring = MeshBuilder.CreateLines('service-range', { points }, this.scene);
        ring.color = color;
        ring.alpha = alpha;
        ring.isPickable = false;
        this.serviceGuides.push(ring);
      };
      addRing(1.6, 0.95);
      if (facility.connected && facility.radius > 0) {
        addRing(facility.radius, facility.id === this.selectedId ? 0.9 : 0.5);
        if (facility.id === this.selectedId) this.addServiceRangeFill(facility, baseColor);
      }
    }
    for (const object of this.city.objects) {
      const layer = roleLayer(object.asset), spec = CITY_ROLE_SPECS[object.asset];
      if (!layer || (!this.infoVisible && object.id !== this.selectedId) || (this.infoVisible && !layers[layer])) continue;
      const points = Array.from({ length: 65 }, (_, i) => {
        const angle = i * Math.PI * 2 / 64;
        const x = object.x + Math.cos(angle) * spec.radius, z = object.z + Math.sin(angle) * spec.radius;
        return new Vector3(x, Math.max(terrainHeight(this.city.heights, x, z) + 0.5, 0.5), z);
      });
      const ring = MeshBuilder.CreateLines(`${layer}-range`, { points }, this.scene);
      ring.color = Color3.FromHexString(MAP_LAYERS.find(item => item.id === layer).color);
      ring.alpha = 0.7;
      ring.isPickable = false;
      this.serviceGuides.push(ring);
    }
    const selectedFireStation = this.city.objects.find(object => object.id === this.selectedId && object.asset === 'fire-station');
    if (this.infoVisible && !layers.fire) return;
    if (!this.infoVisible && !selectedFireStation) return;
    const fire = calculateFireService(this.city, this.infoVisible ? null : selectedFireStation.id);
    for (const station of fire.stations.values()) {
      if (!this.infoVisible && station.id !== this.selectedId) continue;
      const points = Array.from({ length: 33 }, (_, i) => {
        const angle = i * Math.PI * 2 / 32;
        return new Vector3(station.x + Math.cos(angle) * 2, objectBaseHeight(this.city, station) + 0.48, station.z + Math.sin(angle) * 2);
      });
      const marker = MeshBuilder.CreateLines('fire-station-access', { points }, this.scene);
      marker.color = Color3.FromHexString(station.roadConnected ? '#ffb078' : '#e48e7e');
      marker.isPickable = false;
      this.serviceGuides.push(marker);
    }
    if (fire.routes.length) {
      const lines = fire.routes.map(route => [route.a, route.b].map(point => new Vector3(point.x, Math.max(terrainHeight(this.city.heights, point.x, point.z) + 0.48, 0.48), point.z)));
      const routes = MeshBuilder.CreateLineSystem('fire-response-roads', { lines }, this.scene);
      routes.color = Color3.FromHexString('#ffb078');
      routes.alpha = this.infoVisible ? 0.85 : 1;
      routes.isPickable = false;
      this.serviceGuides.push(routes);
    }
  },
  refreshInfoOverlay() {
    if (!this.city) return;
    for (const node of this.nodes) {
      const id = node.metadata?.plotId;
      if (!id) continue;
      const plot = this.city.plots.find(item => item.id === id);
      if (!plot) continue;
      const disconnected = this.infoVisible && !plotHasRoadAccess(this.city, plot);
      for (const mesh of node.getChildMeshes()) if (mesh.name === 'plot-boundary') {
        mesh.setEnabled(disconnected || this.selectedId === plot.id);
        mesh.color = Color3.FromHexString(disconnected ? '#ff9a62' : '#d6e6ad');
        mesh.alpha = disconnected ? 1 : 0.8;
      }
    }
  }
};

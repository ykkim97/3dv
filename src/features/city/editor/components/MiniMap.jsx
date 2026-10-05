import { assetById } from '../../presets/catalog.js';
import { mapDimensions } from '../../core/mapDimensions.js';
import { plotSurface } from '../../plots/plotModel.js';
import { CITY_ROLE_SPECS } from '../../management/cityDiagnostics.js';
import { MAP_LAYERS, roleLayer } from '../../management/cityManagement.js';
import { waterSettings } from '../../water/waterModel.js';

export default function MiniMap({ city, waters, infoVisible, blocked, disconnected, service, fire, layers, onNavigate }) {
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

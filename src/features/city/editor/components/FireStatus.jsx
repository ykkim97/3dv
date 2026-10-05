import { FIRE_ROUTE_LIMIT } from '../../simulation/fireService.js';

export default function FireStatus({ building, station }) {
  if (station) return <div className="service-status fire-status"><strong>소방 도로 접근</strong><div className={station.roadConnected ? 'connected' : 'disconnected'}><span>소방서</span><b>{station.roadConnected ? '차량 도로 연결됨' : '차량 도로 연결 필요'}</b></div><div><span>도달 건물</span><b>{station.served}개</b><small>도로 이동거리 {FIRE_ROUTE_LIMIT} m 이내</small></div><small className="service-explanation">도로를 따라 이동한 거리의 예상 범위입니다.</small></div>;
  if (!building) return null;
  const status = building.stationId ? '소방서 도달 가능' : !building.roadAccess ? '부지에 차량 도로 연결 필요' : building.nearestRouteMeters !== null ? '소방서 이동거리 초과' : '연결된 소방서 없음';
  return <div className="service-status fire-status"><strong>소방 도로 접근</strong><div className={building.stationId ? 'connected' : 'disconnected'}><span>상태</span><b>{status}</b>{building.routeMeters !== null && <small>도로 이동거리 {Math.round(building.routeMeters)} m</small>}{!building.stationId && building.nearestRouteMeters !== null && <small>가장 가까운 소방서까지 {Math.round(building.nearestRouteMeters)} m · 기준 {FIRE_ROUTE_LIMIT} m</small>}</div><small className="service-explanation">차량 도로 연결과 도로 이동거리로 계산합니다.</small></div>;
}

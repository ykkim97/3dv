import { assetById } from '../../presets/catalog.js';

export default function ServiceStatus({ coverage, facility, service }) {
  if (coverage) return <div className="service-status"><strong>기반시설 공급</strong>{[['power', '전력'], ['water', '수도']].map(([kind, label]) => {
    const provider = service.facilities.get(coverage[kind]);
    return <div key={kind} className={provider ? 'connected' : 'disconnected'}><span>{label}</span><b>{provider ? '공급 범위 안' : '공급 범위 밖'}</b><small>{provider ? assetById[provider.asset].name : '가까운 공급 시설 없음'}</small></div>;
  })}<small className="service-explanation">거리 기반 예상 범위 · 전선과 수도관은 아직 연결하지 않습니다.</small></div>;
  if (!facility) return null;
  const status = facility.role === 'terminal' ? '하수 처리 시설' : facility.role === 'support' ? facility.connected ? '정수장 인접' : '정수장 연결 필요' : facility.connected ? facility.role === 'source' ? '공급 시작점' : '공급 거점과 연결됨' : '공급 거점과 떨어져 있음';
  return <div className="service-status"><strong>{facility.network === 'power' ? '전력' : '수도'} 공급 정보</strong><div className={facility.role === 'terminal' ? '' : facility.connected ? 'connected' : 'disconnected'}><span>상태</span><b>{status}</b></div>{facility.radius > 0 && <div><span>예상 범위</span><b>{facility.connected ? `${facility.radius} m` : '비활성'}</b><small>범위 내 건물 {facility.connected ? facility.served : 0}개</small></div>}<small className="service-explanation">거리 기반 예상 범위 · 실제 공급량과 관로는 계산하지 않습니다.</small></div>;
}

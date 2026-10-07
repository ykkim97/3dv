import { assetById } from '../../presets/catalog.js';
import { powerPathNames } from '../../simulation/powerNetwork.js';

const labels = { normal: '정상 공급', shortage: '공급 부족', unset: '수치 미설정', disconnected: '연결 끊김', inactive: '시설 운전 중지' };
const kw = value => value === null ? '미설정' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} kW`;
function NetworkStatus({ id, kind, service }) {
  const network = service[`${kind}Network`], result = network.results.get(id);
  if (!result) return null;
  const quantity = kind === 'power' ? service.powerBalance?.results.get(id) : null;
  return <div className={result.connected ? 'connected' : 'disconnected'} data-status={quantity?.status}><span>{kind === 'power' ? '전력' : '수도'} 연결망</span><b>{quantity ? labels[quantity.status] : result.connected ? '공급 연결됨' : '연결 끊김'}</b><small>{result.reason || `공급 경로: ${powerPathNames(network, id).join(' → ')}`}</small>{quantity && <><dl className="service-quantity">{[['필요 전력', quantity.demand], ['공급 전력', quantity.supplied], ['부족 전력', quantity.shortage]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{kw(value)}</dd></div>)}</dl>{quantity.status === 'unset' && <small>같은 망의 발전 출력·중계 용량·소비 수요를 입력하면 계산됩니다.</small>}</>}</div>;
}
export default function ServiceStatus({ objectId, coverage, facility, service }) {
  if (coverage) return <div className="service-status"><strong>기반시설 공급</strong>{[['power', '전력'], ['water', '수도']].map(([kind, label]) => {
    if (service[`${kind}Network`]) return <NetworkStatus key={kind} id={objectId} kind={kind} service={service} />;
    const provider = service.facilities.get(coverage[kind]);
    return <div key={kind} className={provider ? 'connected' : 'disconnected'}><span>{label}</span><b>{provider ? '공급 범위 안' : '공급 범위 밖'}</b><small>{provider ? assetById[provider.asset].name : '가까운 공급 시설 없음'}</small></div>;
  })}<small>전력량은 연결망 기준에서 계산합니다. 수도 연결망은 경로·운전 상태만 판정합니다.</small></div>;
  if (!facility) return null;
  if (service[`${facility.network}Network`] && ['source', 'relay', 'consumer'].includes(facility.role)) return <div className="service-status"><NetworkStatus id={facility.id} kind={facility.network} service={service} />{facility.role !== 'consumer' && <small>직접 연결된 소비시설 {facility.served}개{facility.asset === 'ess' && ' · ESS 충방전 계산은 지원하지 않습니다.'}</small>}</div>;
  const status = facility.role === 'consumer' ? facility.connected ? '전력 공급 범위 안' : '전력 공급 범위 밖' : facility.role === 'terminal' ? '하수 처리 시설' : facility.connected ? '공급 거점과 연결됨' : '공급 거점 연결 필요';
  return <div className="service-status"><strong>{facility.network === 'power' ? '전력' : '수도'} 공급 정보</strong><div className={facility.connected ? 'connected' : 'disconnected'}><span>상태</span><b>{status}</b></div>{facility.radius > 0 && <small>예상 반경 {facility.radius} m · 범위 내 건물 {facility.served}개</small>}</div>;
}

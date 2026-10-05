import { assetById } from '../../presets/catalog.js';
import { CITY_ROLE_SPECS } from '../../management/cityDiagnostics.js';

export default function RoleStatus({ object, diagnostics }) {
  const asset = assetById[object.asset];
  const spec = CITY_ROLE_SPECS[object.asset];
  const facility = diagnostics.facilities.get(object.id);
  if (asset.category === 'residential') return <div className="role-status">주거 수용 인원 <b>{asset.people}명</b></div>;
  if (spec?.jobs) return <div className="role-status">예상 일자리 <b>{spec.jobs}개</b></div>;
  if (facility) return <div className="role-status">예상 접근 반경 <b>{facility.radius} m</b><span>반경 안의 주민 {facility.nearbyResidents}명{facility.capacity ? ` · 계획 수용 ${facility.capacity}명` : ''}</span></div>;
  return null;
}

import { assetById } from '../../presets/catalog.js';
import Icon from './CityIcon.jsx';

export default function PlotObjectList({ objects, onSelect, onMove, onRemove }) {
  return <div className="plot-object-list"><strong>부지 내 시설 · {objects.length}</strong>{objects.length ? <ul>{objects.map(object => <li key={object.id}><button className="plot-object-name" onClick={() => onSelect(object.id)}>{assetById[object.asset].name}<small>{object.x.toFixed(1)}, {object.z.toFixed(1)} m</small></button><button aria-label={`${assetById[object.asset].name} 이동`} title="이동" onClick={() => onMove(object.id)}><Icon name="cursor" size={13} /></button><button aria-label={`${assetById[object.asset].name} 철거`} title="철거" onClick={() => onRemove(object.id)}><Icon name="bulldoze" size={13} /></button></li>)}</ul> : <small>배치된 시설이 없습니다.</small>}</div>;
}

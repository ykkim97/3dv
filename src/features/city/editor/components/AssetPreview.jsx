import Icon from './CityIcon.jsx';

export default function AssetPreview({ asset }) {
  if (asset.category === 'streetscape') return <div className={`asset-preview prop-preview prop-${asset.id}`}><span className="prop-thumbnail" /><span className="prop-thumbnail-detail" /></div>;
  const icons = { townhouses: 'townhouse', cafe: 'cafe', 'fire-station': 'fire', playground: 'playground', 'power-plant': 'power', 'nuclear-plant': 'nuclear', 'smart-factory': 'factory', 'solar-farm': 'solar', ess: 'battery', substation: 'substation', distribution: 'power', 'wind-turbine': 'wind', 'transmission-tower': 'tower', 'water-treatment': 'treatment', reservoir: 'tank', 'pump-station': 'pump', wastewater: 'treatment', 'intake-station': 'intake', 'water-tower': 'water-tower' };
  if (icons[asset.id]) {
    return <div className={`asset-preview utility-preview ${asset.category}`} style={{ '--asset-color': asset.color }}><span className="utility-platform" /><span className="utility-symbol"><Icon name={icons[asset.id]} size={34} /></span><span className="utility-module one" /><span className="utility-module two" /></div>;
  }
  return <div className="asset-preview" style={{ '--asset-color': asset.color, '--building-height': `${Math.min(61, 22 + asset.height * 1.3)}px` }}><span className="model-ground" />{asset.category === 'nature' ? <><span className="model-tree one" /><span className="model-tree two" /><span className="model-tree three" /></> : <><span className={`model-building ${asset.id === 'house' ? 'model-house' : ''}`} /><span className="model-small-tree" /></>}</div>;
}

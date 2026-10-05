import { PLOT_SURFACES } from '../../plots/plotModel.js';

export default function SurfacePicker({ value, onChange, disabled = false }) {
  return <div className="surface-picker" role="group" aria-label="부지 표면">{PLOT_SURFACES.map(surface => <button disabled={disabled} key={surface.id} aria-pressed={value === surface.id} className={value === surface.id ? 'active' : ''} onClick={() => onChange(surface.id)}><i style={{ background: surface.color }} />{surface.name}</button>)}</div>;
}

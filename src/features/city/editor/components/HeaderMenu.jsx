import { useEffect, useRef } from 'react';
import Icon from './CityIcon.jsx';

/** A disclosure with ordinary, keyboard-focusable controls inside. */
export default function HeaderMenu({ id, label, icon, textOnly = false, openMenu, onOpen, children }) {
  const root = useRef(null);
  const trigger = useRef(null);
  const open = openMenu === id;
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) onOpen(null); };
    const escape = event => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onOpen(null);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open, onOpen]);

  return <div className="header-menu" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) onOpen(null);
  }}>
    <button ref={trigger} className="header-menu-trigger" aria-label={label} title={label} aria-expanded={open} aria-controls={`city-menu-${id}`} onClick={() => onOpen(open ? null : id)}>
      {!textOnly && <Icon name={icon} size={16} />}<span className="hud-button-text">{label}</span>{!textOnly && <span className="menu-chevron" aria-hidden="true">⌄</span>}
    </button>
    {open && <div id={`city-menu-${id}`} className="header-menu-panel glass" aria-label={`${label} 설정`}>{children}</div>}
  </div>;
}

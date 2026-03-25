import { useEffect, useState } from "react";

export default function GuiPanelInspector({ sp, panelId }) {
  const [meta, setMeta] = useState(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [width, setWidth] = useState(380);
  const [height, setHeight] = useState(220);
  const [fontSize, setFontSize] = useState(12);
  const [offset, setOffset] = useState({ x: 0.8, y: 0.8, z: 0.8 });
  const [lineColor, setLineColor] = useState("#9ac8ff");
  const [background, setBackground] = useState("rgba(16,16,20,0.95)");
  const [borderColor, setBorderColor] = useState("#ffffff");
  const [borderThickness, setBorderThickness] = useState(1);
  const [buttons, setButtons] = useState([]);

  useEffect(() => {
    if (!sp || !panelId) return;
    const m = sp.getGuiPanel(panelId);
    setMeta(m);
    if (m) {
      setTitle(m.title || "");
      setText(m.text || "");
      // parse width/height px if strings
      try {
        if (m.width && typeof m.width === 'string' && m.width.endsWith('px')) setWidth(parseInt(m.width, 10));
        if (m.height && typeof m.height === 'string' && m.height.endsWith('px')) setHeight(parseInt(m.height, 10));
      } catch (e) { }
      if (m.offset) setOffset(m.offset);
      if (m.lineColor) setLineColor(m.lineColor);
      if (m.background !== undefined) setBackground(m.background);
      if (m.borderColor !== undefined) setBorderColor(m.borderColor);
      if (m.borderThickness !== undefined) setBorderThickness(Number(m.borderThickness) || 0);
      setButtons(m.buttons || []);
    }
    // register change listener so inspector updates when panel changes elsewhere
    const onChange = (id, metaUpdate) => {
      try {
        if (id !== panelId) return;
        const m2 = sp.getGuiPanel(panelId);
        setMeta(m2);
        if (m2) {
          setTitle(m2.title || "");
          setText(m2.text || "");
          try {
            if (m2.width && typeof m2.width === 'string' && m2.width.endsWith('px')) setWidth(parseInt(m2.width, 10));
            else if (typeof m2.width === 'number') setWidth(Number(m2.width));
            if (m2.height && typeof m2.height === 'string' && m2.height.endsWith('px')) setHeight(parseInt(m2.height, 10));
            else if (typeof m2.height === 'number') setHeight(Number(m2.height));
          } catch (e) { }
          if (m2.offset) setOffset(m2.offset);
          if (m2.lineColor) setLineColor(m2.lineColor);
          if (m2.background !== undefined) setBackground(m2.background);
          if (m2.borderColor !== undefined) setBorderColor(m2.borderColor);
          if (m2.borderThickness !== undefined) setBorderThickness(Number(m2.borderThickness) || 0);
          setButtons(m2.buttons || []);
        }
      } catch (err) { void err; }
    };
    try { if (sp && typeof sp.addGuiPanelChangeListener === 'function') sp.addGuiPanelChangeListener(onChange); } catch { }
    return () => { try { if (sp && typeof sp.removeGuiPanelChangeListener === 'function') sp.removeGuiPanelChangeListener(onChange); } catch { } };
  }, [sp, panelId]);

  if (!meta) return <div style={{ padding: 12, color: 'var(--muted)' }}>No GUI panel selected.</div>;

  const apply = (patch) => {
    try {
      if (typeof console !== 'undefined' && console.log) console.log('GuiPanelInspector.apply ->', panelId, patch);
      let res = null;
      try {
        if (sp && typeof sp.updateGuiPanel === 'function') res = sp.updateGuiPanel(panelId, patch);
        else res = false;
      } catch (err) { res = err; }
      try { if (typeof console !== 'undefined' && console.log) console.log('GuiPanelInspector.apply -> update result', res); } catch (e) { }
    } catch (err) { void err; }
    // refresh meta (also check again shortly)
    try { const m = sp.getGuiPanel(panelId); setMeta(m); console.log('GuiPanelInspector.apply -> refreshed meta', m); } catch (e) { console.log('GuiPanelInspector.apply -> getGuiPanel error', e); }
    setTimeout(() => {
      try { const m2 = sp.getGuiPanel(panelId); console.log('GuiPanelInspector.apply -> refreshed meta (delayed)', m2); setMeta(m2); } catch (e) { void err; }
    }, 120);
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>GUI Panel</div>

      <div style={{ marginBottom: 8 }}>
        <label className="small">Title</label>
        <input className="input" value={title} onChange={(e) => { setTitle(e.target.value); apply({ title: e.target.value }); }} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label className="small">Text</label>
        <input className="input" value={text} onChange={(e) => { setText(e.target.value); apply({ text: e.target.value }); }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label className="small">Width (px)</label>
          <input className="input" type="range" min={100} max={1200} value={width} onChange={(e) => { const v = Number(e.target.value); setWidth(v); apply({ width: v }); }} />
          <input className="input" type="number" value={width} onChange={(e) => { const v = Number(e.target.value||0); setWidth(v); apply({ width: v }); }} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="small">Height (px)</label>
          <input className="input" type="range" min={80} max={900} value={height} onChange={(e) => { const v = Number(e.target.value); setHeight(v); apply({ height: v }); }} />
          <input className="input" type="number" value={height} onChange={(e) => { const v = Number(e.target.value||0); setHeight(v); apply({ height: v }); }} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label className="small">Font Size</label>
        <input className="input" type="range" min={8} max={48} value={fontSize} onChange={(e) => { const v = Number(e.target.value); setFontSize(v); apply({ fontSize: v }); }} />
        <input className="input" type="number" value={fontSize} onChange={(e) => { const v = Number(e.target.value||12); setFontSize(v); apply({ fontSize: v }); }} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label className="small">Background Color / Opacity</label>
        <input className="input" type="text" value={background} onChange={(e) => {
          const v = e.target.value || '';
          // if hex input, normalize leading # characters, otherwise pass through (allow rgba)
          let out = v;
          if (typeof v === 'string' && v.trim().startsWith('#')) {
            const cleaned = String(v).replace(/^#+/, '');
            out = `#${cleaned.slice(-6)}`;
          }
          setBackground(out);
          apply({ background: out });
        }} placeholder="rgba(...) or #hex or transparent" />
        <div style={{ marginTop: 6 }}>
          <input type="color" value={(background && background.startsWith('#')) ? background : '#101014'} onChange={(e) => {
            const c = String(e.target.value || '').replace(/^#+/, '');
            const val = `#${c}`;
            setBackground(val);
            apply({ background: val });
          }} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label className="small">Border Color</label>
        <input className="input" type="color" value={borderColor} onChange={(e) => {
          const c = String(e.target.value || '').replace(/^#+/, '');
          const v = `#${c}`;
          setBorderColor(v);
          apply({ borderColor: v });
        }} />
        <label className="small">Border Thickness</label>
        <input className="input" type="range" min={0} max={12} value={borderThickness} onChange={(e) => { const v = Number(e.target.value); setBorderThickness(v); apply({ borderThickness: v }); }} />
      </div>

      {meta.type === 'linked' ? (
        <>
          <div style={{ marginBottom: 8 }}>
            <label className="small">Offset X, Y, Z</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="range" min={-10} max={10} step="0.1" value={offset.x} onChange={(e) => { const v = Number(e.target.value); setOffset((s) => ({ ...s, x: v })); apply({ offset: { ...offset, x: v } }); }} />
              <input className="input" type="range" min={-10} max={10} step="0.1" value={offset.y} onChange={(e) => { const v = Number(e.target.value); setOffset((s) => ({ ...s, y: v })); apply({ offset: { ...offset, y: v } }); }} />
              <input className="input" type="range" min={-10} max={10} step="0.1" value={offset.z} onChange={(e) => { const v = Number(e.target.value); setOffset((s) => ({ ...s, z: v })); apply({ offset: { ...offset, z: v } }); }} />
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label className="small">Line Color</label>
            <input className="input" type="color" value={lineColor} onChange={(e) => {
              const c = String(e.target.value || '').replace(/^#+/, '');
              const v = `#${c}`;
              setLineColor(v);
              apply({ lineColor: v });
            }} />
          </div>
        </>
      ) : null}

      <div style={{ marginBottom: 8 }}>
        <label className="small">Buttons</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input className="input" placeholder="Button label" onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = e.target.value.trim();
              if (v) { const next = [...buttons, v]; setButtons(next); apply({ buttons: next }); e.target.value = ''; }
            }
          }} />
        </div>
        <div style={{ marginTop: 6 }}>
          {buttons.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <div style={{ flex: 1 }}>{b}</div>
              <button className="btn btn-ghost" type="button" onClick={() => { const next = buttons.filter((_, idx) => idx !== i); setButtons(next); apply({ buttons: next }); }}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="btn btn-warn" type="button" onClick={() => { try { if (sp && typeof sp.removeGuiPanel === 'function') sp.removeGuiPanel(panelId); } catch (err) { void err; } }}>Remove Panel</button>
      </div>
    </div>
  );
}


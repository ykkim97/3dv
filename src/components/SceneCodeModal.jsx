import { useEffect, useState } from "react";
import ModalShell from "./ModalShell.jsx";

export default function SceneCodeModal({ open, getInstance, sceneJson = null, onClose, t = (s) => s }) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!open) return;
    try {
      if (sceneJson) {
        setCode(JSON.stringify(sceneJson, null, 2));
        return;
      }
      const inst = typeof getInstance === "function" ? getInstance() : null;
      if (!inst) {
        setCode("{}");
        return;
      }
      const json = inst.serialize ? inst.serialize() : (inst && inst.scene ? (inst.scene.serialize ? inst.scene.serialize() : null) : null);
      setCode(json ? JSON.stringify(json, null, 2) : "{}");
    } catch (err) { console.error('SceneCodeModal:useEffect', err); setCode("{}"); }
  }, [open, getInstance, sceneJson]);

  const download = () => {
    try {
      const blob = new Blob([code || ""], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scene_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('SceneCodeModal:download', err); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(code || ""); } catch (err) { console.error('SceneCodeModal:copy', err); }
  };

  if (!open) return null;
  const escapeHtml = (str) =>
    String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, '&quot;');

  const renderValue = (val, level = 0) => {
    const indent = (n) => '  '.repeat(n);
    if (val === null) return '<span class="token-null">null</span>';
    if (typeof val === 'string') return `<span class="token-string">"${escapeHtml(val)}"</span>`;
    if (typeof val === 'number') return `<span class="token-number">${String(val)}</span>`;
    if (typeof val === 'boolean') return `<span class="token-boolean">${String(val)}</span>`;
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      const items = val.map((it) => `${indent(level+1)}${renderValue(it, level+1)}`);
      return '[\n' + items.join(',\n') + '\n' + indent(level) + ']';
    }
    if (typeof val === 'object') {
      const keys = Object.keys(val || {});
      if (!keys.length) return '{}';
      const parts = keys.map((k) => {
        const keyHtml = `<span class="token-key">"${escapeHtml(k)}"</span>`;
        return `${indent(level+1)}${keyHtml}: ${renderValue(val[k], level+1)}`;
      });
      return '{\n' + parts.join(',\n') + '\n' + indent(level) + '}';
    }
    // fallback
    return `<span class="token-string">"${escapeHtml(String(val))}"</span>`;
  };

  const highlightJson = (raw) => {
    if (!raw) return '';
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return renderValue(obj, 0);
    } catch (err) {
      // fallback: escape and show raw
      return `<span class="token-string">${escapeHtml(raw)}</span>`;
    }
  };

  return (
    <ModalShell open={open} title={t("tools.sceneCode") || "Scene JSON"} width={820} zIndex={240} onClose={onClose}>
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button className="btn btn-primary" onClick={copy}>Copy</button>
          <button className="btn" onClick={download}>Download</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <pre className="scene-code-pre code-vscode" dangerouslySetInnerHTML={{ __html: highlightJson(code) }} />
      </div>
    </ModalShell>
  );
}

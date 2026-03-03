import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";

const EVENT_KEYS = ["onClick", "onLoad", "onMouseDown", "onMouseUp", "onTaskView"];
const IDENTIFIER_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function normalizeScripts(s) {
  const scripts = (s && typeof s === "object") ? s : {};
  const eventsSrc = (scripts.events && typeof scripts.events === "object") ? scripts.events : scripts;
  const functionsSrc = (scripts.functions && typeof scripts.functions === "object") ? scripts.functions : {};

  const events = {};
  for (const k of EVENT_KEYS) events[k] = (typeof eventsSrc[k] === "string") ? eventsSrc[k] : "";

  const functions = {};
  for (const [name, code] of Object.entries(functionsSrc)) {
    if (typeof code === "string") functions[name] = code;
  }

  return { events, functions };
}

function packScripts(draft) {
  const d = draft || { events: {}, functions: {} };
  const events = {};
  const functions = {};

  const ev = (d.events && typeof d.events === "object") ? d.events : {};
  for (const k of EVENT_KEYS) {
    const v = String(ev[k] || "").trim();
    if (v) events[k] = v;
  }

  const fn = (d.functions && typeof d.functions === "object") ? d.functions : {};
  for (const [name, code] of Object.entries(fn)) {
    const v = String(code || "").trim();
    if (v) functions[name] = v;
  }

  if (!Object.keys(events).length && !Object.keys(functions).length) return null;
  return { events, functions };
}

function buildFunctionsPreamble(functionsObj) {
  const f = (functionsObj && typeof functionsObj === "object") ? functionsObj : {};
  let out = "";
  for (const [name, code] of Object.entries(f)) {
    const src = String(code || "").trim();
    if (!src) continue;
    out += `\n// fn:${name}\n${src}\n`;
  }
  return out;
}

export default function ScriptEditorModal({ open, meshMeta, onClose, onSave }) {
  const initial = useMemo(() => normalizeScripts(meshMeta?.scripts), [meshMeta]);
  const [draft, setDraft] = useState(initial);
  const [activeKind, setActiveKind] = useState("event"); // 'event' | 'function'
  const [activeKey, setActiveKey] = useState("onClick");
  const [syntaxError, setSyntaxError] = useState(null);
  const monaco = useMonaco();
  const extraLibDisposableRef = useRef(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setActiveKind("event");
      setActiveKey("onClick");
      setSyntaxError(null);
    }
  }, [open, initial]);

  // Configure Monaco for a better JS editing experience (ctx/api intellisense).
  useEffect(() => {
    if (!open) return;
    if (!monaco) return;

    try {
      const defaults = monaco.languages.typescript.javascriptDefaults;
      try {
        defaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        });
      } catch (err) {
        void err;
      }

      // Provide ctx/api types as an extra lib so Monaco can autocomplete.
      const libSource = `
declare const ctx: {
  mesh: { id: string };
  scene: { id: string; name: string } | null;
  payload: any;
  data: any;
};

declare const api: {
  fetch: typeof fetch;
  log: (...args: any[]) => void;
  sleep: (ms: number) => Promise<void>;
  enqueue: (cmd: any) => void;
};
`;
      const libUri = "ts:lumatrix-script-ctx-api.d.ts";

      try {
        extraLibDisposableRef.current?.dispose?.();
      } catch (err) {
        void err;
      }

      extraLibDisposableRef.current = defaults.addExtraLib(libSource, libUri);
    } catch (err) {
      void err;
    }

    return () => {
      try {
        extraLibDisposableRef.current?.dispose?.();
      } catch (err) {
        void err;
      }
      extraLibDisposableRef.current = null;
    };
  }, [monaco, open]);

  const currentCode = (activeKind === "function")
    ? (draft.functions?.[activeKey] || "")
    : (draft.events?.[activeKey] || "");

  const validate = (nextDraft, kind, key) => {
    try {
      const d = nextDraft || draft;
      const preamble = buildFunctionsPreamble(d.functions);
      const handlerCode = (kind === "event") ? String(d.events?.[key] || "") : "";

      // Mirror Worker compilation strategy.
      // eslint-disable-next-line no-new-func
      new Function(
        "ctx",
        "api",
        '"use strict";\n' +
          String(preamble || "") +
          "\n" +
          'return (async (ctx, api) => {\n' +
          String(handlerCode) +
          "\n" +
          "})(ctx, api);\n"
      );
      setSyntaxError(null);
      return true;
    } catch (err) {
      setSyntaxError(err && err.message ? String(err.message) : String(err));
      return false;
    }
  };

  const formatWithPrettier = async () => {
    try {
      const src = String(currentCode || "");
      // Lazy-load prettier to keep initial load snappy.
      const [{ default: prettier }, { default: babel }, { default: estree }] = await Promise.all([
        import("prettier/standalone"),
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
      ]);

      const formatted = prettier.format(src, {
        parser: "babel",
        plugins: [babel, estree],
        printWidth: 90,
        tabWidth: 2,
        semi: true,
        singleQuote: true,
      });

      setDraft((p) => {
        if (activeKind === "function") {
          return { ...p, functions: { ...(p.functions || {}), [activeKey]: formatted } };
        }
        return { ...p, events: { ...(p.events || {}), [activeKey]: formatted } };
      });
      validate(
        {
          ...draft,
          events: activeKind === "event" ? { ...(draft.events || {}), [activeKey]: formatted } : (draft.events || {}),
          functions: activeKind === "function" ? { ...(draft.functions || {}), [activeKey]: formatted } : (draft.functions || {}),
        },
        activeKind,
        activeKey
      );
    } catch (err) {
      setSyntaxError(err && err.message ? String(err.message) : String(err));
    }
  };

  if (!open) return null;

  const meshLabel = meshMeta ? `${meshMeta.name || meshMeta.id} (${meshMeta.id})` : "(no mesh)";
  const functionNames = Object.keys(draft.functions || {}).sort((a, b) => a.localeCompare(b));

  const addFunction = () => {
    const name = window.prompt("Function name (JS identifier)");
    if (!name) return;
    const n = String(name).trim();
    if (!IDENTIFIER_REGEX.test(n)) {
      window.alert("Invalid function name. Use a valid JS identifier (A-Z, 0-9, _, $).");
      return;
    }
    if (draft.functions && Object.prototype.hasOwnProperty.call(draft.functions, n)) {
      window.alert("Function already exists.");
      return;
    }

    const templ = `function ${n}(ctx, api) {\n  // TODO\n}\n`;
    const next = { ...draft, functions: { ...(draft.functions || {}), [n]: templ } };
    setDraft(next);
    setActiveKind("function");
    setActiveKey(n);
    setSyntaxError(null);
    validate(next, "function", n);
  };

  const deleteFunction = (name) => {
    const n = String(name || "").trim();
    if (!n) return;
    const ok = window.confirm(`Delete function '${n}'?`);
    if (!ok) return;
    setDraft((p) => {
      const nextFns = { ...(p.functions || {}) };
      delete nextFns[n];
      return { ...p, functions: nextFns };
    });
    if (activeKind === "function" && activeKey === n) {
      setActiveKind("event");
      setActiveKey("onClick");
      setSyntaxError(null);
      validate(draft, "event", "onClick");
    }
  };

  return (
    <div className="overlay overlay-backdrop" style={{ zIndex: 180 }}>
      <div className="modal script-editor-modal" style={{ width: 980, maxWidth: "96vw" }}>
        <div className="modal-header">
          <h3 className="modal-title">Script Editor</h3>
          <button className="btn btn-ghost" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-sub">Mesh: {meshLabel}</div>
        <div className="script-editor-body">
          <div className="script-editor-sidebar" role="tablist" aria-label="Script handlers">
            <div style={{ fontWeight: 900, fontSize: 11, color: "var(--muted)", margin: "4px 6px 6px" }}>Events</div>
            {EVENT_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={`script-editor-tab ${(activeKind === "event" && activeKey === k) ? "active" : ""}`}
                onClick={() => {
                  setActiveKind("event");
                  setActiveKey(k);
                  setSyntaxError(null);
                  validate(draft, "event", k);
                }}
                aria-selected={activeKind === "event" && activeKey === k}
              >
                {k}
              </button>
            ))}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "0 6px" }}>
              <div style={{ fontWeight: 900, fontSize: 11, color: "var(--muted)" }}>Functions</div>
              <button className="btn btn-ghost" type="button" onClick={addFunction} style={{ padding: "4px 8px" }} title="Add function">
                +
              </button>
            </div>
            {functionNames.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 11, padding: "6px 8px" }}>No functions</div>
            ) : (
              functionNames.map((name) => (
                <div key={name} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    type="button"
                    className={`script-editor-tab ${(activeKind === "function" && activeKey === name) ? "active" : ""}`}
                    onClick={() => {
                      setActiveKind("function");
                      setActiveKey(name);
                      setSyntaxError(null);
                      validate(draft, "function", name);
                    }}
                    aria-selected={activeKind === "function" && activeKey === name}
                    style={{ flex: 1 }}
                  >
                    {name}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => deleteFunction(name)}
                    title="Delete function"
                    style={{ padding: "4px 6px", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}

            <div className="script-editor-hint">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Available</div>
              <div><code>ctx</code> (mesh/scene/payload/data)</div>
              <div><code>api.enqueue(cmd)</code></div>
              <div><code>api.fetch</code> / <code>api.log</code> / <code>api.sleep</code></div>
            </div>
          </div>

          <div className="script-editor-main">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              value={currentCode}
              onChange={(value) => {
                const next = typeof value === "string" ? value : "";
                setDraft((p) => {
                  const nextDraft = (activeKind === "function")
                    ? { ...p, functions: { ...(p.functions || {}), [activeKey]: next } }
                    : { ...p, events: { ...(p.events || {}), [activeKey]: next } };
                  // validate against the draft we are about to commit
                  validate(nextDraft, activeKind, activeKey);
                  return nextDraft;
                });
              }}
              options={{
                minimap: { enabled: true },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                insertSpaces: true,
                automaticLayout: true,
                renderLineHighlight: "line",
              }}
              theme="vs-dark"
            />

            {syntaxError ? (
              <div className="script-editor-error" role="status">
                {syntaxError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-ghost" type="button" onClick={formatWithPrettier} disabled={!meshMeta?.id}>Format</button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              if (!validate(draft, activeKind, activeKey)) return;
              const scripts = packScripts(draft);
              if (typeof onSave === "function") onSave(scripts);
            }}
            disabled={!meshMeta?.id}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

# Source architecture

- `main.jsx`: local fonts, global styles, React entry and tooltips.
- `app/App.jsx`: city editor and standalone `#manual` entry.
- `features/city`: city domains, rendering, editing UI and manual; see its [architecture](features/city/README.md).
- `platform/desktopFiles.js`: Tauri detection and desktop JSON save bridge.
- `shared/styles`: fonts, design tokens and base form/tooltip styling.
- `shared/tooltip`: title-based tooltip manager.

The former standalone mesh editor, scripting runtime, Cesium integration and
WASM demonstration were removed with their exclusive dependencies and build hooks.
Use `npm run audit:unused` to inspect references from the app, tests and maintenance
scripts. The audit handles static/dynamic imports, CSS imports and literal new URL
references, but cannot prove arbitrary computed runtime paths. Documentation, user
city files, fixtures and Tauri resources are reviewed separately.

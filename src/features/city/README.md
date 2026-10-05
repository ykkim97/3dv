# City feature architecture

`src/main.jsx` loads the application shell in `src/app/App.jsx`. The shell mounts
`editor/CityEditor.jsx`, which owns screen composition and coordinates editor state.

The header groups facility/district/diagnostic tools under **도시 관리**, lighting/life/water
settings under **환경**, and grid/information layers/minimap/camera controls under **보기**.
`editor/components/HeaderMenu.jsx` owns disclosure dismissal and keyboard focus;
`editor/styles/cityToolbar.css` owns these menu and inspector placement rules.
Populated cities start with the construction tray collapsed. Choosing a category opens
it; the minimap is mounted only while enabled in **보기**. Lighting and connection
panels use the same inspector position and temporarily hide the selection inspector.

| Directory | Responsibility |
| --- | --- |
| `core` | City creation, validation, map dimensions, expansion and buildability summaries |
| `presets` | Serializable facility, bridge and streetscape definitions |
| `plots` | Plot rules, surfaces, textures and geometry |
| `placement` | Footprints, placement validation, alignment, duplication and batch operations |
| `roads` | Road rules, road/bridge geometry and the road preset library |
| `terrain` | Height sampling, leveling and terrain painting |
| `water` | Water regions, settings, materials and controls |
| `lighting` | Day/night calculations, scene lighting and time controls |
| `connections` | Facility-to-facility flow links, validation, rounded tubes, GPU flow animation and controls |
| `simulation` | Traffic/pedestrians, utility supply and fire service calculations |
| `management` | Districts, facility directory, diagnostics and map layers |
| `persistence` | City file import/export and export controls |
| `interaction` | Pointer input, selection, previews and placement commands |
| `rendering` | Babylon scene lifecycle, mesh builders and rendering systems |
| `editor` | Editor composition, HUD components, camera controls and city styles |

## Dependency rules

- Domain calculations and preset definitions do not import React or Babylon.
  Geometry/material modules in their owning feature may import Babylon.
- UI and rendering import domain functions. Domain functions never import editor
  components, input handling or scene runtime classes.
- Import the owning module directly. `cityModel.js` remains a compatibility export
  facade for the previous model API; new code should not depend on that facade.
- Keep feature-specific UI and tests beside their feature. Move code to `shared`
  only when it is independent of the city domain and reused outside this feature.
- `CityEngine` owns scene initialization, shared resources, city synchronization
  and disposal. Method groups in `rendering/builders`, `rendering/systems`,
  `interaction`, `lighting/LightingSystem.js` and `editor/camera` are attached once
  to its prototype. These methods run with the engine as `this`; preserve that
  contract and do not introduce duplicate method names. They do not create extra
  render loops or duplicate scene resources.
- The editor owns history and selection state; callbacks pass serializable city
  data between the UI and runtime. Do not store Babylon meshes in city JSON.

## Adding a feature

1. Add preset definitions and pure rules in the owning feature directory.
2. Add geometry or runtime behavior only if needed, then wire it into `CityEngine`.
3. Add controls in the same feature and compose them in `editor/CityEditor.jsx`.
4. If saved data changes, update `core/cityValidation.js` and persistence tests
   together, including compatibility with older city files.
5. Test domain behavior beside the module. Use Babylon `NullEngine` for scene
   integration checks. Keep instancing, material reuse and light limits intact.

## Facility properties

Select a facility and edit **시설 속성** in the right inspector, then choose **적용**.
Individual names, equipment codes, notes, operating state and optional power/water
figures live in `objects[].properties`. Missing properties use the preset name and
normal operating state; numeric values remain unset rather than assuming a capacity.
Equipment codes are unique (ignoring case and surrounding whitespace). Copies retain
configuration and receive a copy-name suffix, but clear the equipment code.
All edits participate in undo/redo and JSON validation; locked facilities reject edits.
Names and codes appear in the facility directory, plot list and connection endpoints.
Property-only edits reuse existing facility geometry, flow batches and cached shadows.
These are descriptive values for now; coverage still uses the existing range rules.

## Flow connections

Open **흐름 연결** in the header, choose power/water/general styling, then click
**시설 연결** and click source A followed by destination B. Click a tube or its list
entry to edit it. Connections store object IDs in the optional `connections` JSON
array; older files without it still load. Moving a facility updates its path;
deleting an endpoint removes the link in the same undoable editor transaction.
Colors, radius, clearance, straight/elbow routing, direction, speed, visibility
and animation are saved. These links visualize relationships independently of
the existing utility coverage simulation; they do not calculate physical flow.
Tube geometry is cached until endpoints, settings or terrain change. Effects
`bands`, `arrows`, `pulse`, `dots` and `wave` run entirely in a shader; missing
`effect` defaults to `bands` for existing saves. Up to 32 links share each mesh,
all batches share one material and one time uniform update per frame. Per-vertex
attributes retain individual color, speed, direction and paused phase. Triangle
ranges resolve picking back to individual links. Only affected batches rebuild.
No additional lights or shadows are created by flow effects.

Repeated facility presets share GPU instance geometry; placement previews remain
independent clones. Static facility matrices are frozen and refreshed after
terrain edits. Simulation vehicles share body geometry, static streetlight poles
and bulbs merge by material, and road lookups use a map. Shadow textures are
cached until scene edits or a sunlight change; cycling sunlight invalidates at
bounded clock intervals. Dynamic traffic does not cast shadows, as before.

`node scripts/benchmark-city-rendering.mjs` reports reproducible structural counts
for the smart-grid demo's facilities, connections and simulation. It excludes
terrain, roads, water and overlays and does **not** measure GPU FPS. Baseline and
optimized snapshots live in `artifacts/smart-grid-demo/performance-*.json`.

## Verification commands

```sh
npm run test:city
npm run lint:city
npm run build
node scripts/verify-decorated-city.mjs
```

The last command loads `artifacts/decorated-city/TEST_1_decorated.city.json`, builds
its scene and checks finite geometry. An alternative city file path can be passed
as an argument. NullEngine checks do not replace visual browser verification.

This refactor preserves the existing JSON format, local storage key and public
engine methods. City styles live in `editor/styles`; import order is preserved.

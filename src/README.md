# Source architecture

Lumatrix uses feature-first UI modules around a Babylon.js scene runtime.

- `app`: application composition and global editor orchestration.
- `editor`: editor-wide UI such as the viewport, top-level controls, shortcuts, and edit log.
- `entities`: serializable domain models. These modules must not depend on React or Babylon runtime objects.
- `features`: user-facing capabilities grouped by domain, such as the outliner, inspector, scripting, and scene import/export.
- `scene`: Babylon.js runtime lifecycle and rendering systems.
- `shared`: reusable UI, styles, assets, and browser helpers with no feature ownership.
- `infrastructure`: implementation details outside the editor domain, including WASM loading.
- `i18n`: translations and language helpers.

Dependency direction should generally be:

```text
app -> editor/features -> entities/shared
                     -> scene -> entities
infrastructure ----------------^ (injected at the app boundary)
```

Avoid importing `app` from lower layers. Feature-specific components should stay in their feature instead of moving into `shared` merely because more than one component uses them.

The city editor has its own [feature architecture](features/city/README.md), with
separate domain, interaction, rendering and UI modules. `app/App.jsx` mounts
`features/city/editor/CityEditor.jsx`; city styles belong to that feature.

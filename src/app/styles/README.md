# Workspace styles

`App.css` is the only stylesheet imported by the application shell. It composes focused global style layers:

- `layout.css`: application sizing and the three-column workspace.
- `chrome.css`: top navigation and viewport command bar.
- `sidebar.css`: scene navigation and mesh creation controls.
- `viewport.css`: canvas overlays, viewport tools, and object outliner.
- `inspector.css`: property editor and contour controls.
- `overlays.css`: modals, menus, script editor, and edit log.
- `responsive.css`: width-dependent token overrides and compact layouts.

Colors, dimensions, typography, radii, and elevation belong in `src/shared/styles/design-tokens.css`. Shared buttons and inputs belong in `src/shared/styles/ui.css`. Avoid redefining a component selector in multiple layer files; prefer changing a token when the change is global.

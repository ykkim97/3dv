// src/components/MeshPrimitivesToolbar.jsx

import {
  BoxIcon,
  SphereIcon,
  CylinderIcon,
  ConeIcon,
  LineIcon,
  TetraIcon,
  TorusIcon,
  TextBoxIcon,
  PlaneIcon,
  ArrowIcon,
  DomeIcon,
  CapsuleIcon,
  TubeIcon,
} from "../ui/meshIcons";
import Tooltip from "./Tooltip.jsx";

const ITEMS = [
  { kind: "box", title: "Add Box", Icon: BoxIcon },
  { kind: "sphere", title: "Add Sphere", Icon: SphereIcon },
  { kind: "cylinder", title: "Add Cylinder", Icon: CylinderIcon },
  { kind: "cone", title: "Add Cone", Icon: ConeIcon },
  { kind: "line", title: "Add Line", Icon: LineIcon },
  { kind: "tetra", title: "Add Tetrahedron", Icon: TetraIcon },
  { kind: "torus", title: "Add Torus", Icon: TorusIcon },
  { kind: "textbox", title: "Add Text Box", Icon: TextBoxIcon },
  { kind: "plane", title: "Add Plane", Icon: PlaneIcon },
  { kind: "arrow", title: "Add Arrow", Icon: ArrowIcon },
  { kind: "dome", title: "Add Dome", Icon: DomeIcon },
  { kind: "capsule", title: "Add Capsule", Icon: CapsuleIcon },
  { kind: "tube", title: "Add Tube", Icon: TubeIcon },
];

const KIND_COLOR = {
  box: "var(--accent)",
  sphere: "var(--accent-2)",
  cylinder: "var(--warn)",
  cone: "color-mix(in srgb, var(--accent) 55%, var(--warn))",
  line: "var(--muted)",
  tetra: "color-mix(in srgb, var(--accent-2) 65%, var(--accent))",
  torus: "color-mix(in srgb, var(--warn) 60%, var(--accent-2))",
  textbox: "color-mix(in srgb, var(--text) 75%, var(--accent))",
  plane: "color-mix(in srgb, var(--muted) 55%, var(--accent))",
  arrow: "color-mix(in srgb, var(--accent) 65%, var(--accent-2))",
  dome: "color-mix(in srgb, var(--accent-2) 55%, var(--text))",
  capsule: "color-mix(in srgb, var(--warn) 55%, var(--accent))",
  tube: "color-mix(in srgb, var(--muted) 65%, var(--accent-2))",
};

export default function MeshPrimitivesToolbar({ onAdd }) {
  return (
    <div className="add-collection" role="toolbar" aria-label="Add meshes">
      {ITEMS.map((item) => (
        <Tooltip key={item.kind} text={item.title}>
          <button
            type="button"
            onClick={() => onAdd(item.kind)}
            className="icon-btn"
            style={{ color: KIND_COLOR[item.kind] || "var(--text)" }}
          >
            <item.Icon />
          </button>
        </Tooltip>
      ))}
      <Tooltip text={"Add GUI panel (linked to selection or overlay)"}>
        <button
          type="button"
          onClick={() => {
            try {
              // call onAdd with special 'gui' keyword if provided
              if (typeof onAdd === 'function') onAdd('gui');
            } catch (err) { void err; }
          }}
          className="icon-btn"
          style={{ color: 'var(--accent)' }}
        >
          <span style={{ fontWeight: 800, fontSize: 12 }}>GUI</span>
        </button>
      </Tooltip>
    </div>
  );
}

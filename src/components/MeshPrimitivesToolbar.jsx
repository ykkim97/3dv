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
} from "../ui/meshIcons";

const ITEMS = [
  { kind: "box", title: "Add Box", Icon: BoxIcon },
  { kind: "sphere", title: "Add Sphere", Icon: SphereIcon },
  { kind: "cylinder", title: "Add Cylinder", Icon: CylinderIcon },
  { kind: "cone", title: "Add Cone", Icon: ConeIcon },
  { kind: "line", title: "Add Line", Icon: LineIcon },
  { kind: "tetra", title: "Add Tetrahedron", Icon: TetraIcon },
  { kind: "torus", title: "Add Torus", Icon: TorusIcon },
  { kind: "textbox", title: "Add Text Box", Icon: TextBoxIcon },
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
};

export default function MeshPrimitivesToolbar({ onAdd }) {
  return (
    <div className="add-collection" role="toolbar" aria-label="Add meshes">
      {ITEMS.map(({ kind, title, Icon }) => (
        <button
          key={kind}
          title={title}
          type="button"
          onClick={() => onAdd(kind)}
          className="icon-btn"
          style={{ color: KIND_COLOR[kind] || "var(--text)" }}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}

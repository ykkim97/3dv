function PrimitiveIcon({ children, className = "", ...props }) {
  return (
    <svg
      className={`svg mesh-primitive-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BoxIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="m4.5 7.3 7.5-4 7.5 4v9.2l-7.5 4-7.5-4Z" fill="currentColor" opacity=".08" stroke="none" />
      <path d="m4.5 7.3 7.5 4 7.5-4M12 11.3v9.2M4.5 7.3v9.2l7.5 4 7.5-4V7.3l-7.5-4Z" />
      <path d="m7.6 5.65 7.55 4.03" opacity=".45" />
    </PrimitiveIcon>
  );
}

export function SphereIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <circle cx="12" cy="12" r="8.25" fill="currentColor" opacity=".08" />
      <ellipse cx="12" cy="12" rx="3.65" ry="8.25" opacity=".65" />
      <path d="M4.15 9.45c2.15 1.1 4.9 1.7 7.85 1.7s5.7-.6 7.85-1.7M5.1 15.7c2-.8 4.4-1.25 6.9-1.25s4.9.45 6.9 1.25" opacity=".48" />
      <circle cx="8.2" cy="7.6" r="1" fill="currentColor" stroke="none" />
    </PrimitiveIcon>
  );
}

export function CylinderIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="M5 6.2v11.5c0 1.55 3.15 2.8 7 2.8s7-1.25 7-2.8V6.2" fill="currentColor" opacity=".07" />
      <ellipse cx="12" cy="6.2" rx="7" ry="2.75" fill="currentColor" opacity=".15" />
      <path d="M5 6.2v11.5c0 1.55 3.15 2.8 7 2.8s7-1.25 7-2.8V6.2" />
      <ellipse cx="12" cy="6.2" rx="7" ry="2.75" />
      <path d="M5 16.8c1.2 1.2 3.85 2 7 2s5.8-.8 7-2" opacity=".45" />
    </PrimitiveIcon>
  );
}

export function ConeIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="M12 3.1 4.4 18c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9Z" fill="currentColor" opacity=".09" stroke="none" />
      <path d="M12 3.1 4.4 18M12 3.1 19.6 18" />
      <ellipse cx="12" cy="18" rx="7.6" ry="2.9" />
      <path d="M12 3.1v14.7" opacity=".35" strokeDasharray="1.6 2.2" />
    </PrimitiveIcon>
  );
}

export function LineIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="m4 16 5-7 5 5 6-7" strokeWidth="1.8" />
      <circle cx="4" cy="16" r="1.45" fill="currentColor" />
      <circle cx="9" cy="9" r="1.45" fill="var(--panel)" />
      <circle cx="14" cy="14" r="1.45" fill="var(--panel)" />
      <circle cx="20" cy="7" r="1.45" fill="currentColor" />
    </PrimitiveIcon>
  );
}

export function TetraIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="m12 3.1-8 16h16Z" fill="currentColor" opacity=".07" stroke="none" />
      <path d="m12 3.1-8 16h16Z" />
      <path d="m12 3.1 2.5 10.2L4 19.1M14.5 13.3 20 19.1" />
      <path d="m4 19.1 10.5-5.8 5.5 5.8Z" fill="currentColor" opacity=".15" stroke="none" />
      <circle cx="14.5" cy="13.3" r="1" fill="currentColor" stroke="none" />
    </PrimitiveIcon>
  );
}

export function TorusIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <ellipse cx="12" cy="12" rx="9" ry="6.2" fill="currentColor" opacity=".08" />
      <ellipse cx="12" cy="12" rx="4.25" ry="2.55" />
      <path d="M3.2 10.85c1.65 2.2 5 3.7 8.8 3.7s7.15-1.5 8.8-3.7M5.7 7.65c1.25 1.05 3.55 1.75 6.3 1.75s5.05-.7 6.3-1.75" opacity=".55" />
      <ellipse cx="12" cy="12" rx="9" ry="6.2" />
    </PrimitiveIcon>
  );
}

export function TextBoxIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.3" fill="currentColor" opacity=".08" />
      <rect x="3.5" y="5" width="17" height="14" rx="2.3" />
      <path d="M8 9h8M12 9v6.2M9.75 15.2h4.5" strokeWidth="1.65" />
      <circle cx="6.2" cy="7.6" r=".7" fill="currentColor" stroke="none" opacity=".7" />
      <circle cx="17.8" cy="16.4" r=".7" fill="currentColor" stroke="none" opacity=".7" />
    </PrimitiveIcon>
  );
}

export function PlaneIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="m3.2 14.7 7.3-7.3 10.3 2.1-7.35 7.35Z" fill="currentColor" opacity=".09" />
      <path d="m6.7 11.2 10.35 2.1M10.5 7.4l2.95 9.45M15.65 8.45l-7.3 7.3" opacity=".45" />
      <path d="m3.2 14.7 7.3-7.3 10.3 2.1-7.35 7.35Z" />
    </PrimitiveIcon>
  );
}

export function ArrowIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="M3.2 11.9h11.1V7.2l6.5 4.8-6.5 4.8v-4.7H3.2Z" fill="currentColor" opacity=".11" />
      <path d="M3.2 11.9h11.1V7.2l6.5 4.8-6.5 4.8v-4.7H3.2" strokeWidth="1.65" />
      <path d="m16.7 9 4.1 3-4.1 3" opacity=".45" />
    </PrimitiveIcon>
  );
}

export function DomeIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="M3.5 16.2a8.5 8.5 0 0 1 17 0Z" fill="currentColor" opacity=".1" />
      <path d="M3.5 16.2a8.5 8.5 0 0 1 17 0" />
      <ellipse cx="12" cy="16.2" rx="8.5" ry="2.75" />
      <path d="M12 7.7c-2.1 2.15-3.25 5.1-3.25 8.5M12 7.7c2.1 2.15 3.25 5.1 3.25 8.5" opacity=".45" />
    </PrimitiveIcon>
  );
}

export function CapsuleIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <rect x="6.2" y="2.8" width="11.6" height="18.4" rx="5.8" fill="currentColor" opacity=".08" />
      <rect x="6.2" y="2.8" width="11.6" height="18.4" rx="5.8" />
      <path d="M6.3 8.6c1.45.8 3.45 1.25 5.7 1.25s4.25-.45 5.7-1.25M6.3 15.4c1.45-.8 3.45-1.25 5.7-1.25s4.25.45 5.7 1.25" opacity=".5" />
      <path d="M12 3v18" opacity=".28" />
    </PrimitiveIcon>
  );
}

export function TubeIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="M4.2 16.4c2.2-5.1 6.4-8.4 11.15-8.4 2 0 3.6.55 4.65 1.55" strokeWidth="3.5" opacity=".13" />
      <path d="M4.2 16.4c2.2-5.1 6.4-8.4 11.15-8.4 2 0 3.6.55 4.65 1.55" strokeWidth="1.6" />
      <ellipse cx="4.2" cy="16.4" rx="1.6" ry="2.15" transform="rotate(35 4.2 16.4)" fill="var(--panel)" />
      <ellipse cx="20" cy="9.55" rx="1.3" ry="1.8" transform="rotate(-52 20 9.55)" fill="currentColor" opacity=".35" />
    </PrimitiveIcon>
  );
}

export function ContourIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <path d="m4.2 7.6 7.8-4 7.8 4v8.8l-7.8 4-7.8-4Z" fill="currentColor" opacity=".055" />
      <path d="m4.2 7.6 7.8 4 7.8-4M12 11.6v8.8M4.2 7.6v8.8l7.8 4 7.8-4V7.6l-7.8-4Z" opacity=".65" />
      <circle cx="8.1" cy="10" r="1.15" fill="currentColor" stroke="none" opacity=".5" />
      <circle cx="13.8" cy="8.3" r="1.45" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14.2" r="1.05" fill="currentColor" stroke="none" opacity=".72" />
      <circle cx="9.4" cy="15.4" r=".8" fill="currentColor" stroke="none" opacity=".38" />
    </PrimitiveIcon>
  );
}

export function GuiPanelIcon(props) {
  return (
    <PrimitiveIcon {...props}>
      <rect x="3.2" y="4.2" width="17.6" height="15.6" rx="2.2" fill="currentColor" opacity=".07" />
      <rect x="3.2" y="4.2" width="17.6" height="15.6" rx="2.2" />
      <path d="M3.2 8.2h17.6M8 8.2v11.6" opacity=".65" />
      <path d="M5.2 6.2h.1M7.1 6.2h.1M10.3 11.3h7M10.3 14.1h5.4M10.3 16.9h3.6" />
    </PrimitiveIcon>
  );
}

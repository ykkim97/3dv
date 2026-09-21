export const PRIMITIVE_SHORTCUTS = {
  Digit1: { kind: "box", label: "1" },
  Digit2: { kind: "sphere", label: "2" },
  Digit3: { kind: "cylinder", label: "3" },
  Digit4: { kind: "cone", label: "4" },
  Digit5: { kind: "line", label: "5" },
  Digit6: { kind: "tetra", label: "6" },
  Digit7: { kind: "torus", label: "7" },
  Digit8: { kind: "textbox", label: "8" },
  Digit9: { kind: "plane", label: "9" },
  Digit0: { kind: "arrow", label: "0" },
};

export const PRIMITIVE_SHIFT_SHORTCUTS = {
  Digit1: { kind: "dome", label: "Shift+1" },
  Digit2: { kind: "capsule", label: "Shift+2" },
  Digit3: { kind: "tube", label: "Shift+3" },
  Digit4: { kind: "contour", label: "Shift+4" },
};

export const PRIMITIVE_SHORTCUT_BY_KIND = Object.fromEntries(
  [...Object.values(PRIMITIVE_SHORTCUTS), ...Object.values(PRIMITIVE_SHIFT_SHORTCUTS)].map((item) => [item.kind, item.label])
);

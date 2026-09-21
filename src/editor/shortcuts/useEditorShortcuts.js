import { useEffect } from "react";
import { PRIMITIVE_SHIFT_SHORTCUTS, PRIMITIVE_SHORTCUTS } from "../../features/mesh-creation/primitiveShortcuts.js";

function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || !!target?.isContentEditable;
}

export function useEditorShortcuts({
  runtimeMode,
  hasScene,
  hasSelection,
  onNudge,
  onSelectAll,
  onArmPrimitive,
  onDeleteSelection,
  onFrameSelection,
  onUndo,
  onRedo,
}) {
  useEffect(() => {
    if (runtimeMode) return undefined;

    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;

      const baseStep = event.shiftKey ? 0.1 : (event.altKey ? 2 : 0.5);
      if (!event.ctrlKey && !event.metaKey) {
        const offsets = {
          ArrowLeft: [-baseStep, 0, 0],
          ArrowRight: [baseStep, 0, 0],
          ArrowUp: [0, 0, -baseStep],
          ArrowDown: [0, 0, baseStep],
          PageUp: [0, baseStep, 0],
          PageDown: [0, -baseStep, 0],
        };
        if (offsets[event.key]) {
          onNudge?.(...offsets[event.key]);
          event.preventDefault();
          return;
        }
      }

      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "a") {
        event.preventDefault();
        event.stopPropagation();
        onSelectAll?.();
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const shortcut = event.shiftKey ? PRIMITIVE_SHIFT_SHORTCUTS[event.code] : PRIMITIVE_SHORTCUTS[event.code];
        if (shortcut && hasScene) {
          event.preventDefault();
          onArmPrimitive?.(shortcut.kind);
          return;
        }
      }

      if ((event.key === "Delete" || event.key === "Backspace") && hasSelection) {
        onDeleteSelection?.();
      } else if (key === "f" && hasSelection) {
        onFrameSelection?.();
        event.preventDefault();
      } else if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) {
        event.preventDefault();
        onUndo?.();
      } else if ((event.ctrlKey || event.metaKey) && (key === "y" || (event.shiftKey && key === "z"))) {
        event.preventDefault();
        onRedo?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasScene, hasSelection, onArmPrimitive, onDeleteSelection, onFrameSelection, onNudge, onRedo, onSelectAll, onUndo, runtimeMode]);
}

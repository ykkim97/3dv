import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

export function useVirtualMeshTree(rows, { rowHeight = 26, overscan = 12, fallbackHeight = 360 } = {}) {
  const bodyRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(fallbackHeight);

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) return undefined;
    const measure = () => setViewportHeight(element.clientHeight || fallbackHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallbackHeight]);

  const range = useMemo(() => {
    const maxScrollTop = Math.max(0, rows.length * rowHeight - viewportHeight);
    const effectiveScrollTop = Math.min(scrollTop, maxScrollTop);
    return {
      startIndex: Math.max(0, Math.floor(effectiveScrollTop / rowHeight) - overscan),
      endIndex: Math.min(rows.length, Math.ceil((effectiveScrollTop + viewportHeight) / rowHeight) + overscan),
    };
  }, [overscan, rowHeight, rows.length, scrollTop, viewportHeight]);

  const onScroll = useCallback((event) => setScrollTop(event.currentTarget.scrollTop), []);
  return {
    bodyRef,
    onScroll,
    rowHeight,
    spacerHeight: rows.length * rowHeight,
    startIndex: range.startIndex,
    visibleRows: rows.slice(range.startIndex, range.endIndex),
  };
}

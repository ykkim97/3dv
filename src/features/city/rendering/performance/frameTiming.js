// Retain fractional refresh intervals so 144 Hz displays can average 60 FPS.
export function nextFrameTime(now, previous, interval) {
  const next = previous == null ? now + interval : previous + interval;
  return next < now ? now + interval : next;
}

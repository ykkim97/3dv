export const DEFAULT_ENVIRONMENT = { hour: 12, autoCycle: false, cycleMinutes: 10 };
export function daylightAt(hour) {
  const elevation = Math.sin((hour - 6) / 24 * Math.PI * 2);
  const daylight = Math.max(0, Math.min(1, (elevation + 0.12) / 0.5));
  return { elevation, daylight, lamps: 1 - daylight, night: daylight < 0.25 };
}
export function advanceHour(hour, seconds, minutes) {
  return (hour + Math.max(0, seconds) * 24 / (minutes * 60)) % 24;
}

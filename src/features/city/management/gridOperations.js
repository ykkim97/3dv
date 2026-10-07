export function applyGridFailure(city, target) {
  if (target.kind === 'line') {
    const line = city.connections?.find(c => c.id === target.id);
    if (!line) throw new Error('연결선을 찾을 수 없습니다.');
    return { city: { ...city, connections: city.connections.map(c => c.id === target.id ? { ...c, enabled: false } : c) }, restore: { ...target, value: line.enabled } };
  }
  const object = city.objects.find(o => o.id === target.id);
  if (!object) throw new Error('시설을 찾을 수 없습니다.');
  return { city: { ...city, objects: city.objects.map(o => o.id === target.id ? { ...o, properties: { ...o.properties, status: 'fault' } } : o) }, restore: { ...target, value: object.properties?.status } };
}

export function restoreGridFailure(city, restore) {
  if (restore.kind === 'line') return { ...city, connections: (city.connections || []).map(c => {
    if (c.id !== restore.id) return c;
    const next = { ...c }; if (restore.value === undefined) delete next.enabled; else next.enabled = restore.value;
    return next;
  }) };
  return { ...city, objects: city.objects.map(o => {
    if (o.id !== restore.id) return o;
    const properties = { ...o.properties };
    if (restore.value === undefined) delete properties.status; else properties.status = restore.value;
    return { ...o, properties };
  }) };
}

export function changedGridConsumers(before, after) {
  return [...after.consumers].filter(([id, value]) => {
    const old = before.consumers.get(id);
    return old && (!!old.power !== !!value.power || !!old.water !== !!value.water || before.powerBalance?.results.get(id)?.status !== after.powerBalance?.results.get(id)?.status || before.powerBalance?.results.get(id)?.supplied !== after.powerBalance?.results.get(id)?.supplied);
  }).map(([id]) => id);
}

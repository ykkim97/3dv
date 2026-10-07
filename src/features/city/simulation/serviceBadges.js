// Badge data shares the same assessment as the inspector, diagnostics and minimap.
export function serviceBadgeRecords(service, options) {
  const records = [];
  const add = (id, kind, connected) => {
    const quantity = kind === 'power' ? service.powerBalance?.results.get(id) : null;
    const status = quantity?.status || (connected && kind === 'power' && service.powerBalance?.missing.has(id) ? 'unset' : connected ? 'normal' : 'disconnected');
    if (options[kind] && (!options.missingOnly || status !== 'normal')) records.push({ id, kind, connected, status });
  };
  for (const [id, coverage] of service.consumers) {
    add(id, 'power', !!coverage.power);
    add(id, 'water', !!coverage.water);
  }
  for (const [id, facility] of service.facilities) {
    if (facility.role !== 'terminal') add(id, facility.network, facility.connected);
  }
  return records;
}

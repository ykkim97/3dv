import { assetById } from '../presets/catalog.js';
import { facilityName, facilityStatus } from '../management/facilityProperties.js';

export const isPowerConsumer = object => assetById[object.asset]?.powerConsumer === true || ['residential', 'commercial', 'landmark'].includes(assetById[object.asset]?.category);

// Multi-source BFS: consumers receive power but cannot act as distribution hubs.
// Presentation flags (visibility, animation, speed) never open a circuit.
export function calculatePowerNetwork(city, specs, kind = 'power') {
  const nodes = new Map(city.objects.filter(o => specs[o.asset]?.network === kind && ['source', 'relay', 'consumer'].includes(specs[o.asset].role) || (kind === 'power' ? isPowerConsumer(o) : ['residential', 'commercial', 'landmark'].includes(assetById[o.asset]?.category))).map(o => [o.id, o]));
  const edges = new Map([...nodes.keys()].map(id => [id, []]));
  const add = (a, b) => { if (nodes.has(a) && nodes.has(b)) edges.get(a).push(b); };
  for (const line of city.connections || []) {
    if (line.type !== kind || line.enabled === false) continue;
    if (line.direction !== 'reverse') add(line.from, line.to);
    if (line.direction === 'reverse' || line.direction === 'both') add(line.to, line.from);
  }
  const sources = [...nodes.values()].filter(o => specs[o.asset]?.role === 'source');
  const blockers = new Map();
  const traverse = ignoreStatus => {
    const parents = new Map(), queue = [];
    for (const source of sources) if (ignoreStatus || facilityStatus(source).id === 'running') {
      parents.set(source.id, null); queue.push(source.id);
      if (ignoreStatus) blockers.set(source.id, facilityStatus(source).id === 'running' ? null : source.id);
    }
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (isPowerConsumer(nodes.get(id))) continue;
      for (const next of edges.get(id)) {
        if (parents.has(next) || !ignoreStatus && facilityStatus(nodes.get(next)).id !== 'running') continue;
        parents.set(next, id); queue.push(next);
        if (ignoreStatus) blockers.set(next, blockers.get(id) || (facilityStatus(nodes.get(next)).id === 'running' ? null : next));
      }
    }
    return parents;
  };
  const parents = traverse(false), possible = traverse(true);
  const results = new Map();
  for (const [id, object] of nodes) {
    let reason = null;
    if (!parents.has(id)) {
      if (facilityStatus(object).id !== 'running') reason = `${facilityName(object)} · ${facilityStatus(object).name}`;
      else if (possible.has(id)) {
        const blocked = nodes.get(blockers.get(id));
        reason = `공급 경로 차단: ${facilityName(blocked)} · ${facilityStatus(blocked).name}`;
      } else reason = sources.length ? `${kind === 'power' ? '발전원까지 이어지는 전력' : '정수장까지 이어지는 수도'} 경로 없음 · 선 종류와 방향을 확인하세요.` : kind === 'power' ? '발전 시설 없음 · ESS는 독립 발전원이 아닙니다.' : '정수장 없음 · 배수지와 취수장은 독립 공급원이 아닙니다.';
    }
    results.set(id, { connected: parents.has(id), provider: parents.get(id) ?? null, reason });
  }
  return { results, parents, nodes, edges };
}

export function powerPathNames(network, id) {
  if (!network?.parents.has(id)) return [];
  const path = [];
  for (let current = id; current !== null; current = network.parents.get(current)) path.push(facilityName(network.nodes.get(current)));
  return path.reverse();
}

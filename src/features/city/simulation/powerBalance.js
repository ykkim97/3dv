import { facilityStatus } from '../management/facilityProperties.js';
import { isPowerConsumer } from './powerNetwork.js';

const EPSILON = 1e-7;
const number = (object, key) => Number.isFinite(object.properties?.[key]) ? object.properties[key] : null;

// Directed capacity graph with split relay nodes. Residual reverse edges allow
// rerouting through healthy alternatives. Allocation is deterministic by ID;
// it is a planning model, not voltage, frequency or AC load-flow simulation.
function allocate(nodes, network, specs) {
  const graph = new Map(), sinks = new Map();
  const add = (a, b, capacity) => {
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    const forward = { to: b, capacity, initial: capacity }, reverse = { to: a, capacity: 0 };
    forward.reverse = reverse; reverse.reverse = forward;
    graph.get(a).push(forward); graph.get(b).push(reverse);
    return forward;
  };
  const ids = new Map(nodes.map((o, i) => [o.id, i * 2]));
  const source = -1, sink = -2;
  const totalDemand = nodes.reduce((sum, o) => sum + (isPowerConsumer(o) ? number(o, 'demandKW') : 0), 0);
  for (const object of nodes) {
    const id = ids.get(object.id), spec = specs[object.asset];
    add(id, id + 1, spec?.role === 'relay' ? number(object, 'capacityKW') : totalDemand);
    if (spec?.role === 'source') add(source, id, Math.min(number(object, 'generationKW'), number(object, 'capacityKW') ?? Infinity));
    if (isPowerConsumer(object)) sinks.set(object.id, add(id + 1, sink, number(object, 'demandKW')));
    else for (const next of network.edges.get(object.id)) if (ids.has(next)) add(id + 1, ids.get(next), totalDemand);
  }
  if (!graph.has(source) || !graph.has(sink)) return new Map(nodes.filter(isPowerConsumer).map(o => [o.id, 0]));
  for (;;) {
    const parents = new Map([[source, null]]), queue = [source];
    for (let i = 0; i < queue.length && !parents.has(sink); i++) for (const edge of graph.get(queue[i])) {
      if (edge.capacity <= EPSILON || parents.has(edge.to)) continue;
      parents.set(edge.to, { from: queue[i], edge }); queue.push(edge.to);
    }
    if (!parents.has(sink)) break;
    let flow = Infinity;
    for (let id = sink; id !== source; id = parents.get(id).from) flow = Math.min(flow, parents.get(id).edge.capacity);
    for (let id = sink; id !== source; id = parents.get(id).from) { const edge = parents.get(id).edge; edge.capacity -= flow; edge.reverse.capacity += flow; }
  }
  return new Map([...sinks].map(([id, edge]) => [id, edge.initial - edge.capacity]));
}

export function calculatePowerBalance(network, specs) {
  const results = new Map(), missing = new Map();
  const active = [...network.nodes.values()].filter(o => facilityStatus(o).id === 'running');
  let generation = 0, demand = 0, delivered = 0, shortage = 0;
  for (const object of active) {
    const fields = isPowerConsumer(object) ? ['demandKW'] : specs[object.asset]?.role === 'source' ? ['generationKW'] : ['capacityKW'];
    const absent = fields.filter(key => number(object, key) === null);
    if (absent.length) missing.set(object.id, absent);
    if (isPowerConsumer(object)) demand += number(object, 'demandKW') ?? 0;
    else if (specs[object.asset]?.role === 'source') generation += Math.min(number(object, 'generationKW') ?? 0, number(object, 'capacityKW') ?? Infinity);
  }
  // Missing values invalidate only their reachable component, not other grids.
  const adjacent = new Map(active.filter(o => network.parents.has(o.id)).map(o => [o.id, new Set()]));
  for (const [from, destinations] of network.edges) for (const to of destinations) {
    if (!adjacent.has(from) || !adjacent.has(to) || isPowerConsumer(network.nodes.get(from))) continue;
    adjacent.get(from).add(to); adjacent.get(to).add(from);
  }
  const visited = new Set();
  for (const root of [...adjacent.keys()].sort()) {
    if (visited.has(root)) continue;
    const queue = [root]; visited.add(root);
    for (let i = 0; i < queue.length; i++) for (const next of adjacent.get(queue[i])) if (!visited.has(next)) { visited.add(next); queue.push(next); }
    const nodes = queue.sort().map(id => network.nodes.get(id));
    const unset = nodes.some(o => missing.has(o.id));
    const allocation = unset ? null : allocate(nodes, network, specs);
    for (const object of nodes.filter(isPowerConsumer)) {
      const requested = number(object, 'demandKW'), supplied = allocation?.get(object.id) ?? null;
      const deficit = supplied === null ? null : Math.max(0, requested - supplied);
      results.set(object.id, { status: unset ? 'unset' : deficit > EPSILON ? 'shortage' : 'normal', demand: requested, supplied, shortage: deficit });
      delivered += supplied ?? 0; shortage += deficit ?? 0;
    }
  }
  for (const object of network.nodes.values()) if (isPowerConsumer(object) && !results.has(object.id)) {
    const running = facilityStatus(object).id === 'running', requested = running ? number(object, 'demandKW') : 0;
    results.set(object.id, { status: running ? 'disconnected' : 'inactive', demand: requested, supplied: 0, shortage: requested });
    shortage += requested ?? 0;
  }
  return { results, missing, generation, demand, delivered, shortage, complete: missing.size === 0 };
}

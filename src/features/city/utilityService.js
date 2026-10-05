import { assetById } from './cityModel.js';

// Conceptual service ranges in metres. Physical cables, pipes and capacity are not modeled yet.
export const UTILITY_SERVICES = {
  'power-plant': { network: 'power', role: 'source', radius: 42 },
  'solar-farm': { network: 'power', role: 'source', radius: 26 },
  'wind-turbine': { network: 'power', role: 'source', radius: 32 },
  substation: { network: 'power', role: 'relay', radius: 28, link: 48 },
  'transmission-tower': { network: 'power', role: 'relay', radius: 0, link: 56 },
  distribution: { network: 'power', role: 'relay', radius: 24, link: 36 },
  ess: { network: 'power', role: 'relay', radius: 18, link: 32 },
  'water-treatment': { network: 'water', role: 'source', radius: 40 },
  reservoir: { network: 'water', role: 'relay', radius: 28, link: 42 },
  'pump-station': { network: 'water', role: 'relay', radius: 22, link: 36 },
  'water-tower': { network: 'water', role: 'relay', radius: 30, link: 44 },
  'intake-station': { network: 'water', role: 'support', radius: 0, link: 36 },
  wastewater: { network: 'water', role: 'terminal', radius: 0 },
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function calculateUtilityService(city) {
  const facilities = city.objects.flatMap(object => {
    const spec = UTILITY_SERVICES[object.asset];
    return spec ? [{ ...object, ...spec, connected: spec.role === 'source', served: 0 }] : [];
  });
  let changed;
  do {
    changed = false;
    for (const facility of facilities) {
      if (facility.connected || facility.role !== 'relay') continue;
      if (facilities.some(other => other.connected && other.network === facility.network && distance(other, facility) <= facility.link)) {
        facility.connected = true;
        changed = true;
      }
    }
  } while (changed);
  for (const facility of facilities) {
    if (facility.role === 'support') {
      facility.connected = facilities.some(other => other.connected && other.asset === 'water-treatment' && distance(other, facility) <= facility.link);
    }
  }

  const consumers = new Map();
  const totals = { consumers: 0, power: 0, water: 0, both: 0 };
  for (const object of city.objects) {
    if (!['residential', 'commercial', 'landmark'].includes(assetById[object.asset]?.category)) continue;
    const providers = {};
    for (const network of ['power', 'water']) {
      let nearest = null, nearestDistance = Infinity;
      for (const facility of facilities) {
        if (!facility.connected || facility.network !== network || facility.radius <= 0) continue;
        const meters = distance(facility, object);
        if (meters <= facility.radius && meters < nearestDistance) { nearest = facility; nearestDistance = meters; }
      }
      providers[network] = nearest?.id ?? null;
    }
    consumers.set(object.id, providers);
    totals.consumers++;
    if (providers.power) totals.power++;
    if (providers.water) totals.water++;
    if (providers.power && providers.water) totals.both++;
    for (const facility of facilities) {
      if (facility.connected && facility.radius > 0 && distance(facility, object) <= facility.radius) facility.served++;
    }
  }
  return { facilities: new Map(facilities.map(facility => [facility.id, facility])), consumers, totals };
}

import { assetById } from '../presets/catalog.js';
import { calculatePowerNetwork } from './powerNetwork.js';
import { calculatePowerBalance } from './powerBalance.js';

// Conceptual ranges in metres. Network mode also evaluates directed supply and power capacity.
export const UTILITY_SERVICES = {
  'nuclear-plant': { network: 'power', role: 'source', radius: 56 },
  'power-plant': { network: 'power', role: 'source', radius: 42 },
  'solar-farm': { network: 'power', role: 'source', radius: 26 },
  'solar-carport': { network: 'power', role: 'source', radius: 22 },
  'fast-charger': { network: 'power', role: 'consumer', radius: 0, link: 0 },
  'slow-charger': { network: 'power', role: 'consumer', radius: 0, link: 0 },
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
  const powerMode = city.powerSupplyMode === 'network' ? 'network' : 'range';
  const powerNetwork = powerMode === 'network' ? calculatePowerNetwork(city, UTILITY_SERVICES) : null;
  const waterMode = city.waterSupplyMode === 'network' ? 'network' : 'range';
  const waterNetwork = waterMode === 'network' ? calculatePowerNetwork(city, UTILITY_SERVICES, 'water') : null;
  const networks = { power: powerNetwork, water: waterNetwork };
  const powerBalance = powerNetwork ? calculatePowerBalance(powerNetwork, UTILITY_SERVICES) : null;
  const facilities = city.objects.flatMap(object => {
    const spec = UTILITY_SERVICES[object.asset];
    return spec ? [{ ...object, ...spec, connected: spec.role === 'source', served: 0 }] : [];
  });
  let changed;
  do {
    changed = false;
    for (const facility of facilities) {
      if (facility.connected || facility.role !== 'relay') continue;
      if (networks[facility.network]) continue;
      if (facilities.some(other => other.connected && other.network === facility.network && distance(other, facility) <= facility.link)) {
        facility.connected = true;
        changed = true;
      }
    }
  } while (changed);
  for (const facility of facilities) {
    if (facility.role === 'consumer' && !networks[facility.network]) {
      facility.connected = facilities.some(other => other.connected && other.network === facility.network && other.role !== 'consumer' && other.radius > 0 && distance(other, facility) <= other.radius);
    }
    if (facility.role === 'support') {
      facility.connected = facilities.some(other => other.connected && other.asset === 'water-treatment' && distance(other, facility) <= facility.link);
    }
  }

  const consumers = new Map();
  for (const facility of facilities) {
    const network = networks[facility.network];
    if (!network) continue;
    facility.connected = network.results.get(facility.id)?.connected ?? false;
    facility.radius = 0;
  }
  // Chargers are power facilities, so they do not enter building water totals.
  // Include them in the provider's served count and in the power balance instead.
  for (const consumer of facilities.filter(facility => facility.role === 'consumer' && facility.connected)) {
    if (powerNetwork) {
      const provider = facilities.find(facility => facility.id === powerNetwork.results.get(consumer.id)?.provider);
      if (provider) provider.served++;
    } else {
      for (const provider of facilities) if (provider.connected && provider.network === consumer.network && provider.radius > 0 && distance(provider, consumer) <= provider.radius) provider.served++;
    }
  }
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
    if (powerNetwork) providers.power = powerNetwork.results.get(object.id)?.provider ?? null;
    if (waterNetwork) providers.water = waterNetwork.results.get(object.id)?.provider ?? null;
    consumers.set(object.id, providers);
    totals.consumers++;
    if (providers.power) totals.power++;
    if (providers.water) totals.water++;
    if (providers.power && providers.water) totals.both++;
    for (const facility of facilities) {
      if (facility.connected && facility.radius > 0 && distance(facility, object) <= facility.radius) facility.served++;
    }
    if (powerNetwork && providers.power) facilities.find(f => f.id === providers.power).served++;
    if (waterNetwork && providers.water) facilities.find(f => f.id === providers.water).served++;
  }
  return { facilities: new Map(facilities.map(facility => [facility.id, facility])), consumers, totals, powerMode, powerNetwork, waterMode, waterNetwork, powerBalance };
}

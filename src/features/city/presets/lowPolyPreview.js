// Static isometric SVG meshes; no WebGL context or animation per card.
const project = ([x, y, z]) => [80 + (x - z) * 4, 75 + (x + z) * 2 - y * 4];
function shade(hex, factor) {
  return '#' + hex.slice(1).match(/../g).map(c => Math.min(255, Math.round(parseInt(c, 16) * factor)).toString(16).padStart(2, '0')).join('');
}
export function lowPolyPreview(asset, kind = 'asset') {
  const parts = [], id = asset.id, color = asset.color || '#b5cfcd';
  const polygon = (vertices, fill) => parts.push({ points: vertices.map(project).map(p => p.join(',')).join(' '), fill });
  const box = (x, z, w, d, h, fill = color, y = 0) => {
    const a = [x, y, z], b = [x + w, y, z], c = [x + w, y, z + d], e = [x, y, z + d];
    const top = p => [p[0], p[1] + h, p[2]];
    polygon([e, c, top(c), top(e)], shade(fill, .72));
    polygon([b, c, top(c), top(b)], shade(fill, .9));
    polygon([top(a), top(b), top(c), top(e)], shade(fill, 1.1));
  };
  const tank = (x, z, r, h, fill = '#bdd9db', y = 0, topRadius = r) => {
    const base = [], top = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; base.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); top.push([x + Math.cos(a) * topRadius, y + h, z + Math.sin(a) * topRadius]); }
    for (let i = 0; i < 4; i++) polygon([base[i], base[i + 1], top[i + 1], top[i]], shade(fill, .65 + i * .08));
    polygon(top, shade(fill, 1.08));
  };
  const roof = (x, z, w, d, y, fill = '#bd7960') => {
    polygon([[x, y, z + d], [x + w, y, z + d], [x + w / 2, y + 2.5, z + d]], shade(fill, .72));
    polygon([[x + w / 2, y + 2.5, z], [x + w, y, z], [x + w, y, z + d], [x + w / 2, y + 2.5, z + d]], fill);
    polygon([[x, y, z], [x + w / 2, y + 2.5, z], [x + w / 2, y + 2.5, z + d], [x, y, z + d]], shade(fill, 1.15));
  };
  const tree = (x, z, pine = false) => { box(x - .2, z - .2, .4, .4, 2, '#977459'); tank(x, z, pine ? 1.6 : 1.8, pine ? 4.5 : 2.8, '#79b388', 1.7, pine ? 0 : 1.1); };
  const windows = (x, z, w, h) => { for (let y = 1; y < h - .5; y += 1.7) for (let dx = .6; dx < w - .4; dx += 1.5) box(x + dx, z, .85, .06, .8, '#4f8fa3', y); };
  const hall = (h = 4, w = 9, d = 6) => { box(-w / 2, -3, w, d, h); windows(-w / 2, -3 + d, w, h); };
  const car = (x, z, fill = '#efb86e', bus = false) => { box(x, z, bus ? 2.8 : 1.8, bus ? 5 : 3, 1, fill); box(x + .15, z + .5, bus ? 2.5 : 1.5, bus ? 3.8 : 1.6, .65, '#568292', 1); };
  const panel = (x, z, w = 3, d = 2, y = 1) => { box(x, z, w, d, .3, '#467ea1', y); for (let i = 1; i < 3; i++) box(x + w * i / 3, z, .05, d, .02, '#a5d8e7', y + .31); };
  const sign = (text, x = 3, z = 3, y = 6) => { box(x, z, .25, .25, y, '#718e99'); const p = project([x, y + .6, z]); parts.push({ text, x: p[0], y: p[1], fill: '#f4df93' }); };
  box(-7, -6, 14, 12, .55, ['nature', 'streetscape'].includes(asset.category) || ['plot', 'world'].includes(kind) ? '#81a47d' : '#91a8aa', -.55);
  if (kind === 'world') {
    if (id === 'river') { box(1, -6, 3, 12, .08, '#65b9d0'); box(-2, -1, 8, 1.5, .4, '#d2dfd8', .4); }
    if (id === 'coast') { box(1, -6, 6, 12, .08, '#65b9d0'); box(0, -6, 1, 12, .1, '#dfcf9b'); }
    if (id === 'alpine') { tank(-3, -2, 3, 8, '#93aa92', 0, 0); tank(2, -3, 2.5, 6, '#b3c4ad', 0, 0); tree(3, 3, true); }
    if (id === 'blank') for (let x = -5; x < 6; x += 2) { box(x, -5, .06, 10, .02, '#b7c9a2'); box(-5, x, 10, .06, .02, '#b7c9a2'); }
    else { box(-5, 1, 3, 3, 2.5, '#e5dac0'); roof(-5, 1, 3, 3, 2.5); if (id !== 'alpine') { box(-4, -4, 3, 3, 6, '#c2d9d4'); windows(-4, -1, 3, 6); tree(-1, 4); } }
  } else if (kind === 'plot') {
    const w = id === 'small' ? 7 : id === 'large' ? 13 : 10;
    box(-w / 2, -4, w, 8, .15, color);
    for (const x of [-w / 2, w / 2 - .35]) for (const z of [-4, 3.65]) box(x, z, .35, .35, .5, '#f9d885');
  } else if (kind === 'road') {
    box(id === 'path' ? -1.5 : -3, -6, id === 'path' ? 3 : 6, 12, .15, id === 'path' ? '#cbb791' : '#4f646d');
    if (id !== 'path') for (let z = -5; z < 6; z += 3) box(-.1, z, .2, 1.5, .02, '#ffe7a6', .15);
    if (id === 'avenue') for (const x of [-1.5, 1.5]) box(x, -6, .08, 12, .02, '#dfe9df', .15);
    tree(4, 1);
  } else if (kind === 'bridge') {
    box(-6, -5, 12, 10, .08, '#559bb4'); box(-7, -1.5, 14, 3, .45, '#c4d6da', 2);
    for (const x of [-4, 4]) box(x, -1, .6, 2, 2, '#91a5ab');
    if (['cable', 'suspension'].includes(asset.style)) {
      for (const x of [-4, 4]) { box(x, -1.4, .4, .4, 7, '#dbe7e4', 2); for (const dx of [-2, 2]) polygon([[x, 9, -1.2], [x + dx, 2.5, -1.2], [x + dx + .1, 2.5, -1.2]], '#edce87'); }
      if (asset.style === 'suspension') for (let x = -3; x < 4; x++) box(x, -1.2, .08, .08, 2 + x * x / 4, '#edce87', 2.5);
    } else if (asset.style === 'arch') for (let x = -5; x < 5; x++) box(x, -1.4, .9, .35, .4, '#e8c98c', 2.7 + 3 * (1 - x * x / 25));
    else for (let x = -6; x < 7; x += 2) box(x, 1.2, .12, .12, 1, asset.id === 'footbridge' ? '#bb9467' : '#e2cf9e', 2.45);
  } else switch (id) {
    case 'house': hall(3, 6, 5); roof(-3, -3, 6, 5, 3, asset.roof); tree(4, 3); break;
    case 'townhouses': for (let x = -5; x < 4; x += 3.3) { box(x, -2, 3, 4, 3.5); roof(x, -2, 3, 4, 3.5); windows(x, 2, 3, 3.5); } break;
    case 'apartment': hall(9, 6, 5); for (let y = 2; y < 9; y += 2) box(-3, 2, 6, .4, .25, '#cce3d8', y); break;
    case 'tower': hall(13, 5, 5); box(-1.8, -2.3, 3.6, 3.6, .7, '#b4c7c7', 13); break;
    case 'office': hall(14, 5, 5); box(-1.5, -2, 3, 3, 1.5, '#577982', 14); break;
    case 'hotel': hall(9, 8, 4); box(-4, 1, 8, 1.8, .5, '#e8bb74', 2); sign('H', 3, 1, 10); break;
    case 'shop': hall(3, 7, 5); for (let x = -3.5; x < 3.5; x++) box(x, 2, .9, 1.5, .25, x % 2 ? '#f0d7a2' : '#cc7970', 2); break;
    case 'cafe': hall(3, 6, 4); roof(-3, -3, 6, 4, 3); for (const x of [-2, 2]) { tank(x, 3, 1, .25, '#efd6a2', 1); box(x - .1, 2.9, .2, .2, 1, '#9d795b'); } break;
    case 'hall': hall(4, 10, 6); for (let x = -4; x < 5; x += 2) box(x, 3, .4, .4, 3.5, '#f0e8d4'); roof(-5, 2, 10, 1.5, 4, '#92a8b0'); break;
    case 'school': hall(4, 10, 5); box(-1, -1, 2, 3, 2, '#ecc984', 4); sign('◷', 0, 2, 6); break;
    case 'hospital': hall(7, 8, 6); box(-1.2, 3.05, 2.4, .1, .7, '#e78579', 5); box(-.35, 3.05, .7, .1, 2.4, '#e78579', 4.15); break;
    case 'fire-station': hall(3, 9, 5); for (const x of [-3, 0]) box(x, 2.05, 2.1, .12, 2, '#cd776a'); box(3, -3, 2, 3, 7); car(-3, 3, '#d97762'); break;
    case 'nuclear-plant': for (const x of [-3, 2]) { tank(x, -1, 2, 7, '#dce2d5', 0, 1.4); tank(x, -1, 1.25, .1, '#568494', 7); } tank(0, 3, 2, 3); break;
    case 'power-plant': hall(4, 8, 5); for (const x of [-2, 2]) { tank(x, -2, .6, 8, '#acb9b4'); tank(x, -2, .65, .5, '#d78f73', 6); } break;
    case 'solar-farm': for (const x of [-5, 0]) for (const z of [-3, 1]) panel(x, z, 4, 3); break;
    case 'solar-carport': for (const x of [-4, 4]) for (const z of [-3, 3]) box(x, z, .3, .3, 3, '#ceddd4'); car(-2, -1); panel(-5, -4, 10, 8, 3); break;
    case 'ess': for (const x of [-4, 0]) { box(x, -3, 3, 6, 3, '#d1e0d7'); box(x + .5, 3.03, 2, .1, 1, '#71af9c', 1); } break;
    case 'fast-charger': car(-3, -1); box(1, 0, 1, 1, 2.5, '#72cdb6'); for (const x of [-4, 4]) box(x, -3, .3, .3, 4); box(-5, -4, 10, 5, .5, '#78bdae', 4); break;
    case 'slow-charger': car(-1, -2, '#d4e6db'); box(3, 1, 1, 1, 3, '#72cdb6'); box(3.2, 2, .6, .1, .8, '#34626a', 1.6); break;
    case 'substation': for (const x of [-3, 2]) { box(x, -2, 2, 4, 2); for (let z = -1.5; z < 2; z++) tank(x + 1, z, .25, 1, '#657d81', 2); } for (const x of [-5, 5]) box(x, -3, .3, .3, 6); box(-5, -3, 10, .4, .4, '#d0d9ce', 6); break;
    case 'distribution': box(-3, -2, 5, 4, 3); box(-2.5, 2.05, 4, .1, 1.5, '#73988a', .5); tank(3, 0, .5, 5, '#d4dcc9'); break;
    case 'wind-turbine': box(-.3, -.3, .6, .6, 11, '#dce5df'); for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; polygon([[0, 11, 0], [Math.cos(a) * 5, 11 + Math.sin(a) * 5, 0], [Math.cos(a) * 4 + .4, 11 + Math.sin(a) * 4 + .6, 0]], '#e2ede7'); } break;
    case 'transmission-tower': for (const x of [-2, 2]) box(x, 0, .35, .35, 11, '#9bb9bf'); for (let y = 2; y < 11; y += 2) { box(-2, 0, 4, .3, .25, '#9bb9bf', y); polygon([[-2, y, 0], [2, y + 2, 0], [2, y + 2.2, 0]], '#d0deda'); } box(-5, -1, 10, 1, .5, '#b6ccce', 9); break;
    case 'water-treatment': for (const x of [-5, 0]) { box(x, -3, 4, 6, 1, '#cedddb'); box(x + .3, -2.7, 3.4, 5.4, .05, '#68bdd0', 1); } box(-1, -4, 2, 1, 4); break;
    case 'wastewater': for (const x of [-3, 3]) { tank(x, 0, 2.5, 1.2, '#b6c8b8'); tank(x, 0, 2.15, .1, '#679e9a', 1.2); box(x - 2, -.15, 4, .3, .15, '#decea1', 1.4); } break;
    case 'reservoir': for (const x of [-3, 3]) tank(x, 0, 2.5, 4); break;
    case 'water-tower': for (const x of [-1.5, 1.5]) box(x, 0, .35, .35, 7, '#8fb0b5'); tank(0, 0, 3, 3, '#c5e1e0', 7); tank(0, 0, 3.2, 1, '#70b1c3', 10, 0); break;
    case 'pump-station': hall(3, 6, 5); for (const x of [-2, 2]) { tank(x, 3, .5, 2, '#6bb9ca'); box(x, 2.5, .5, 3, .5, '#6bb9ca', 1.8); } break;
    case 'intake-station': box(-6, -4, 12, 8, .1, '#579eb8'); box(-4, -3, 5, 4, 3); for (const x of [0, 2, 4]) box(x, 0, .6, 5, .5, '#a7d1d9', .5); break;
    case 'tree': tree(0, 0); break;
    case 'pine': tree(0, 0, true); break;
    case 'park': box(-5, -.7, 10, 1.4, .1, '#dacba2'); tree(-3, -3); tree(3, 2); box(-2, 3, 3, .8, 1, '#b38a65'); break;
    case 'playground': for (const x of [-4, 0]) box(x, -2, .25, .25, 4, '#e4bf75'); box(-4, -2, 4, .3, .3, '#e4bf75', 4); box(-3, -2, 2, 1, .2, '#7ab9c6', 1.5); polygon([[2, 3, -2], [5, .2, 3], [4, .2, 3], [1, 3, -2]], '#e59972'); break;
    case 'sidewalk': for (let z = -5; z < 5; z += 2) box(-2, z, 4, 1.8, .25, '#c7d3c3'); tree(4, 0); break;
    case 'crosswalk': box(-6, -4, 12, 8, .1, '#51656e'); for (let x = -5; x < 5; x += 2) box(x, -3, 1.2, 6, .04, '#f0e9cd', .1); break;
    case 'street-lamp': box(-.2, 0, .4, .4, 9, '#98b5bc'); box(-.2, -2, .4, 2, .3, '#98b5bc', 9); box(-1, -3, 2, 1.5, .4, '#f3d78b', 8.7); break;
    case 'bench': box(-4, 0, 8, 1.5, .4, '#c8996e', 1.5); box(-4, 0, 8, .3, 1.5, '#c8996e', 1.7); for (const x of [-3, 3]) box(x, .5, .4, .4, 1.5, '#577880'); break;
    case 'bus-stop': for (const x of [-4, 4]) box(x, -2, .3, .3, 4, '#8cb5bf'); box(-4, -2, 8, .2, 3, '#81b3bd', 1); box(-5, -3, 10, 4, .35, '#d5e1d3', 4); box(-3, -1, 5, 1, .3, '#ba956d', 1); sign('B', 5, 1, 4); break;
    case 'parking-lot': box(-6, -5, 12, 10, .1, '#556b73'); for (let x = -5; x < 6; x += 3) box(x, 0, .12, 4, .05, '#ece4ba', .1); car(-3, 0); sign('P', 4, -2, 4); break;
    case 'parking-tower': for (let y = 0; y < 8; y += 2.5) { box(-4, -3, 8, 6, .35, '#cbd9d6', y); for (const x of [-4, 3.5]) box(x, 2.5, .4, .4, 2.5, '#809fa7', y); } car(-1, 0); sign('P', 4, 3, 7); break;
    case 'bus-depot': hall(4, 10, 5); for (const x of [-4, 0]) box(x, 2, 3, .1, 3, '#486a7b'); car(-3, 2, '#72bcae', true); break;
    case 'logistics-center': hall(4, 10, 5); for (let x = -4; x < 4; x += 2.5) box(x, 2, 1.8, .1, 2.5, '#627f88'); box(2, 2.5, 2.5, 4, 2, '#e3d8b8'); car(2, 5, '#7cabb3'); break;
    case 'warehouse': hall(3, 10, 6); roof(-5, -3, 10, 6, 3, '#93aeb7'); box(-2, 3.05, 4, .1, 2.5, '#637e86'); break;
    case 'cold-storage': hall(4, 10, 6); for (const x of [-3, 1]) { box(x, -2, 2, 2, .7, '#adc6d1', 4); tank(x + 1, -1, .7, .2, '#536e86', 4.7); } sign('❄', 2, 3, 5); break;
    case 'small-factory': hall(3, 8, 5); roof(-4, -3, 8, 5, 3, '#8a9fa8'); tank(3, -2, .65, 8, '#b7c7c5'); break;
    case 'smart-factory': hall(4, 10, 6); for (const x of [-4, 0]) panel(x, -2, 3, 3, 4); box(-5, 2.7, 10, .3, .7, '#83cfbb', 2); break;
    case 'assembly-plant': hall(3, 10, 7); for (let z = -3; z < 4; z += 2.5) roof(-5, z, 10, 2, 3, '#b2c4c7'); break;
    case 'recycling-center': hall(3, 8, 4); for (const [i, fill] of ['#80b89c', '#6ba8c3', '#e6c577'].entries()) box(-4 + i * 3, 2, 2, 2, 1.6, fill); break;
    case 'resource-recovery': hall(4, 7, 5); tank(4, -2, .6, 9, '#b4c9c5'); for (const x of [-2, 2]) tank(x, 3, 1.3, 4, '#84b6aa'); break;
    case 'library': hall(4, 9, 5); roof(-4.5, -3, 9, 5, 4, '#8baebe'); for (let x = -3; x < 4; x += 1.1) box(x, 2.05, .65, .1, 2, ['#dfaf79', '#81bcb4', '#b2a0cd'][Math.round(x + 3) % 3], 1); break;
    case 'gymnasium': hall(3, 10, 7); tank(0, 0, 4.5, 2, '#97b7c6', 3, 3); sign('●', 4, 3, 4); break;
    case 'community-center': hall(4, 8, 5); for (const x of [-3, 3]) box(x, 2, .4, .4, 3, '#ecdec2'); box(-4, 2, 8, 2, .4, '#b4c5b8', 3); sign('◷', 0, 2, 5); break;
    default: hall(Math.min(11, Math.max(3, (asset.height || 4) / 2))); tree(5, 3);
  }
  return parts;
}

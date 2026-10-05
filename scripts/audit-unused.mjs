import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const slash = value => value.split(path.sep).join('/');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}
const sources = files(path.join(root, 'src')).filter(file => !file.endsWith('.md'));
const scripts = files(path.join(root, 'scripts')).filter(file => /\.(mjs|js)$/.test(file));
const entries = [path.join(root, 'src/main.jsx'), ...sources.filter(file => file.endsWith('.test.js')), ...scripts];
const reached = new Set(), packages = new Set(), missing = [];
function visit(file) {
  if (reached.has(file)) return;
  reached.add(file);
  if (!/\.(jsx?|mjs|css)$/.test(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  const references = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|@import\s*|new URL\(\s*|\burl\(\s*)['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const reference of references) {
    if (reference.startsWith('node:') || reference.includes('://') || reference.startsWith('data:')) continue;
    if (!reference.startsWith('.')) {
      if (!reference.startsWith('/')) packages.add(reference.startsWith('@') ? reference.split('/').slice(0, 2).join('/') : reference.split('/')[0]);
      continue;
    }
    const base = path.resolve(path.dirname(file), reference.split('?')[0]);
    const target = [base, ...['.js', '.jsx', '.css', '/index.js'].map(extension => base + extension)].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (target) visit(target);
    else missing.push({ file: slash(path.relative(root, file)), reference });
  }
}
entries.forEach(visit);
const unused = sources.filter(file => !reached.has(file)).map(file => slash(path.relative(root, file)));
console.log(JSON.stringify({ entries: entries.map(file => slash(path.relative(root, file))), unused, packages: [...packages].sort(), missing }, null, 2));
if (missing.length) process.exitCode = 1;

// Refreshes the factual half of catalog/packages.json from the real manifests in the
// alexandria repo. Authored fields (blurb, about, order) are preserved — this only
// touches what the manifest is the source of truth for, so the catalog can never drift
// from the packages it claims to describe.
//
//   ALEXANDRIA=~/Desktop/alexandria node tools/sync-catalog.mjs
//
// Packages whose subject is "_test" are excluded on purpose: hostile-probe is the arena's
// adversarial boundary test and its own manifest says to keep it out of any registry,
// and never-ready exists only to exercise the degrade path.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = (process.env.ALEXANDRIA || join(homedir(), 'Desktop', 'alexandria')).replace(/^~/, homedir());

if (!existsSync(SRC)) {
  console.error(`no alexandria checkout at ${SRC} — set ALEXANDRIA=<path>`);
  process.exit(1);
}

const file = join(ROOT, 'catalog', 'packages.json');
const catalog = JSON.parse(await readFile(file, 'utf8'));
const byId = (list) => Object.fromEntries(list.map((p) => [p.id, p]));

const list = async (dir) => (await readdir(join(SRC, dir), { withFileTypes: true }))
  .filter((d) => d.isDirectory()).map((d) => d.name).sort();

const changes = [];
const set = (pkg, key, value) => {
  if (JSON.stringify(pkg[key]) !== JSON.stringify(value)) {
    changes.push(`${pkg.id}.${key}: ${JSON.stringify(pkg[key])} -> ${JSON.stringify(value)}`);
    pkg[key] = value;
  }
};

const worlds = byId(catalog.worlds);
for (const id of await list('worlds')) {
  const w = JSON.parse(await readFile(join(SRC, 'worlds', id, 'world.json'), 'utf8'));
  const p = worlds[id];
  if (!p) { console.warn(`world "${id}" is in the repo but not in the catalog — add it by hand, it needs a blurb`); continue; }
  set(p, 'name', w.name);
  set(p, 'version', w.version);
  set(p, 'facts', [
    ['ARCHETYPE', w.archetype],
    ['BEATS STAGED', w.beats.kinds.join(', ')],
    ['BEATS PER MODULE', `${w.beats.min} to ${w.beats.max}`],
    ['PAGINATION', w.pagination.policy.replace(/-/g, ' ')],
    ['SHIPS CODE', 'no'],
    ['REVIEW', p.review],
  ]);
}

const sims = byId(catalog.simulations);
for (const id of await list('engines')) {
  const e = JSON.parse(await readFile(join(SRC, 'engines', id, 'engine.json'), 'utf8'));
  if (e.subject === '_test') continue;
  const p = sims[id];
  if (!p) { console.warn(`engine "${id}" is in the repo but not in the catalog — add it by hand, it needs a blurb`); continue; }
  set(p, 'name', e.name);
  set(p, 'version', e.version);
  set(p, 'review', e.review);
  set(p, 'facts', [
    ['SUBJECT', e.subject],
    ['LEVEL BAND', e.levels.map((l) => l.replace(/-/g, ' ')).join(', ')],
    ['TASK SPACE', Object.keys(e.taskSpace).join(', ')],
    ['SCORED', e.scored ? 'yes' : 'no'],
    ['SANDBOX', 'iframe, no network'],
    ['REVIEW', e.review],
  ]);
}

await writeFile(file, JSON.stringify(catalog, null, 2) + '\n');
console.log(changes.length ? `synced from ${SRC}:\n  ` + changes.join('\n  ') : `already in sync with ${SRC}`);

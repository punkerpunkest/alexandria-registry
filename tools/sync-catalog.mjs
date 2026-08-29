// Refreshes the factual half of catalog/packages.json from the real manifests in the
// alexandria repo. Authored fields — blurb, about, pitch, topic, ordering — are preserved;
// this only touches what a manifest is the source of truth for, so the catalog can never
// drift from the packages it claims to describe.
//
//   ALEXANDRIA=~/Desktop/alexandria node tools/sync-catalog.mjs
//
// A package whose `subject` starts with an underscore is excluded, which is the same
// one-line rule `isTestEngine` applies in the app. hostile-probe is the arena's adversarial
// boundary test and its own manifest says to keep it out of any registry; never-ready
// exists to exercise the degrade path. Filtering on the prefix rather than on a list means
// the next fixture is excluded without anyone remembering to.
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

// Keys beginning with an underscore are prose written for a human reader — the repo uses
// them throughout for notes and measurements. Nothing machine-readable may depend on one.
const machineOnly = (obj) => obj && Object.fromEntries(
  Object.entries(obj).filter(([k]) => !k.startsWith('_')));

const changes = [];
const set = (pkg, key, value) => {
  if (JSON.stringify(pkg[key]) !== JSON.stringify(value)) {
    changes.push(`${pkg.id}.${key}`);
    pkg[key] = value;
  }
};

const worlds = byId(catalog.worlds);
for (const id of await list('worlds')) {
  const w = JSON.parse(await readFile(join(SRC, 'worlds', id, 'world.json'), 'utf8'));
  const p = worlds[id];
  if (!p) { console.warn(`world "${id}" is in the repo but not the catalog — add it by hand, it needs a blurb`); continue; }

  // NOTE: world.json declares no `author` and no `review`. The registry contract's world
  // entry carries `author`, so this is a real gap in the world manifest rather than an
  // omission here — the site must not invent an identity the package does not claim.
  set(p, 'manifest', {
    name: w.name,
    version: w.version,
    archetype: w.archetype,
    ...(w.viewport ? { viewport: machineOnly(w.viewport) } : {}),
    beats: { min: w.beats.min, max: w.beats.max, kinds: w.beats.kinds },
    pagination: w.pagination.policy,
  });
  set(p, 'facts', [
    ['ARCHETYPE', w.archetype],
    ['BEATS STAGED', w.beats.kinds.join(', ')],
    ['BEATS PER MODULE', `${w.beats.min} to ${w.beats.max}`],
    ['PAGINATION', w.pagination.policy.replace(/-/g, ' ')],
    ['VIEWPORT', w.viewport ? `${w.viewport.minWidth}×${w.viewport.minHeight} minimum` : 'none declared'],
    ['SHIPS CODE', 'no'],
    ['REVIEW', 'not declared in world.json'],
  ]);
}

const sims = byId(catalog.simulations);
for (const id of await list('engines')) {
  const e = JSON.parse(await readFile(join(SRC, 'engines', id, 'engine.json'), 'utf8'));
  if (String(e.subject).startsWith('_')) continue;
  const p = sims[id];
  if (!p) { console.warn(`engine "${id}" is in the repo but not the catalog — add it by hand, it needs a blurb`); continue; }

  set(p, 'manifest', {
    name: e.name,
    version: e.version,
    author: e.author,
    review: e.review,
    subject: e.subject,
    levels: e.levels,
    scored: e.scored,
    taskKinds: Object.keys(e.taskSpace),
  });
  set(p, 'facts', [
    ['SUBJECT', e.subject],
    ['LEVEL BAND', e.levels.map((l) => l.replace(/-/g, ' ')).join(', ')],
    ['TASK SPACE', Object.keys(e.taskSpace).join(', ')],
    ['SCORED', e.scored ? 'yes' : 'no'],
    ['SANDBOX', 'iframe, no network'],
    ['REVIEW', e.review],
  ]);
  if (!p.pitch) console.warn(`engine "${id}" has no authored pitch and engine.json declares none`);
}

await writeFile(file, JSON.stringify(catalog, null, 2) + '\n');
console.log(changes.length ? `synced from ${SRC}: ${changes.join(', ')}` : `already in sync with ${SRC}`);

// Packs each catalogued package into a gzipped tar under public/packages/ and records the
// archive's path, digest and size back into catalog/packages.json.
//
//   ALEXANDRIA=~/Desktop/alexandria node tools/pack.mjs
//
// The archive layout is the one docs/contracts/registry.md specifies: the manifest sits at
// the archive ROOT, not nested inside a folder, which is what `tar czf out.tar.gz -C <pkg> .`
// produces. The digest is Subresource Integrity form — `sha256-<base64>` — over the archive
// itself, so the algorithm travels with the digest.
//
// A tar embeds file mtimes and gzip embeds its own, so re-packing unchanged sources would
// produce a different archive and therefore a different hash every run. To keep the
// published hash stable, each entry also records `srcHash`, a digest over the package's
// sorted file list and contents. If that has not changed and the archive still exists, the
// pack is skipped. Delete the archive to force one.
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = (process.env.ALEXANDRIA || join(homedir(), 'Desktop', 'alexandria')).replace(/^~/, homedir());

if (!existsSync(SRC)) {
  console.error(`no alexandria checkout at ${SRC} — set ALEXANDRIA=<path>`);
  process.exit(1);
}

// Every file in the package, sorted, so the digest is stable across machines.
async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === '.DS_Store') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p, base));
    else if (e.isFile()) out.push(relative(base, p));
  }
  return out.sort();
}

async function sourceDigest(dir) {
  const h = createHash('sha256');
  for (const rel of await walk(dir)) {
    h.update(rel);
    h.update(await readFile(join(dir, rel)));
  }
  return h.digest('hex');
}

const file = join(ROOT, 'catalog', 'packages.json');
const catalog = JSON.parse(await readFile(file, 'utf8'));

const GROUPS = [
  ['worlds', 'worlds', 'worlds'],
  ['simulations', 'engines', 'engines'],
];

let packed = 0, skipped = 0;
for (const [key, srcDir, outDir] of GROUPS) {
  for (const p of catalog[key]) {
    const pkgDir = join(SRC, srcDir, p.id);
    if (!existsSync(pkgDir)) { console.warn(`skipping ${p.id}: no package at ${pkgDir}`); continue; }

    const version = p.manifest.version;
    const rel = `packages/${outDir}/${p.id}/${version}.tar.gz`;
    const abs = join(ROOT, 'public', rel);
    const srcHash = await sourceDigest(pkgDir);

    if (p.archive?.srcHash === srcHash && existsSync(abs)) { skipped++; continue; }

    await mkdir(dirname(abs), { recursive: true });
    // `-C <pkg> .` puts the manifest at the archive root rather than under a folder.
    await run('tar', ['czf', abs, '-C', pkgDir, '.']);

    const bytes = (await stat(abs)).size;
    const hash = 'sha256-' + createHash('sha256').update(await readFile(abs)).digest('base64');
    p.archive = { path: rel, hash, bytes, srcHash };
    packed++;
    console.log(`${p.id.padEnd(18)} ${String(bytes).padStart(8)} bytes  ${hash}`);
  }
}

await writeFile(file, JSON.stringify(catalog, null, 2) + '\n');
console.log(`packed ${packed}, unchanged ${skipped}`);

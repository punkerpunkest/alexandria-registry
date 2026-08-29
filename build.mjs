// Builds the whole site into dist/. No dependencies, no framework.
// The registry is meant to be a dumb static host, so the build is one file that
// reads catalog/packages.json and writes HTML.
import { readFile, writeFile, mkdir, readdir, copyFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'dist');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const catalog = JSON.parse(await readFile(join(ROOT, 'catalog', 'packages.json'), 'utf8'));

const KIND = {
  worlds:      { slug: 'worlds',      one: 'world',      col: 'WORLD',      href: '/' },
  simulations: { slug: 'simulations', one: 'simulation', col: 'SIMULATION', href: '/simulations' },
};

// ── shots ────────────────────────────────────────────────────────────────────
// A package's screenshots are whatever PNGs sit in public/shots/<id>, sorted by
// filename. captions.json beside them is optional and lines up index for index.
async function shotsFor(id) {
  const dir = join(ROOT, 'public', 'shots', id);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f)).sort();
  let captions = [];
  if (existsSync(join(dir, 'captions.json'))) {
    try { captions = JSON.parse(await readFile(join(dir, 'captions.json'), 'utf8')); } catch {}
  }
  return files.map((f, i) => ({ src: `/shots/${id}/${f}`, caption: captions[i] || '' }));
}

for (const kind of Object.keys(KIND)) {
  for (const pkg of catalog[kind]) pkg.shots = await shotsFor(pkg.id);
}

const counts = { worlds: catalog.worlds.length, simulations: catalog.simulations.length };

// ── shell ────────────────────────────────────────────────────────────────────
const shell = ({ title, description, body, script = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="dark">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="preload" href="/fonts/hack-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
</head>
<body>
${body}
${script}
</body>
</html>
`;

const glass = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5 L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

const reviewDot = (review) =>
  review === 'verified'
    ? '<span class="dot dot--ok" title="verified"></span>'
    : '<span class="dot dot--open" title="unreviewed"></span>';

// ── list page ────────────────────────────────────────────────────────────────
function listPage(kind) {
  const k = KIND[kind];
  const items = catalog[kind];

  const rows = items.map((p, i) => `      <a class="row" href="/${k.slug}/${esc(p.id)}" data-hay="${esc((p.id + ' ' + p.name + ' ' + p.blurb + ' ' + p.source).toLowerCase())}">
        <span class="row__rank">${i + 1}</span>
        <span class="row__name"><b>${esc(p.id)}</b><em>${esc(p.source)}</em>${reviewDot(p.review)}</span>
        <span class="row__desc">${esc(p.blurb)}</span>
      </a>`).join('\n');

  const topics = new Set(items.map((p) => (p.facts.find(([a]) => a === 'SUBJECT') || [])[1]).filter(Boolean)).size;
  const barText = kind === 'worlds'
    ? `${counts.worlds} worlds in the catalog. Taste is the only way to pick one.`
    : `${counts.simulations} simulations in the catalog, across ${topics} topics.`;

  const body = `<main class="page col">
  <header class="hero">
    <div>
      <h1 class="wordmark">ALEXANDRIA</h1>
      <p class="tagline">THE OPEN WORLD AND SIMULATION ECOSYSTEM</p>
    </div>
    <p class="blurb">Worlds decide the form your material arrives in. Simulations pose a real task and own whether you got it right. Both are community-built; neither ships with Alexandria.</p>
  </header>

  <p class="label catalog-label">THE CATALOG</p>

  <div class="search">
    ${glass}
    <input id="q" type="search" placeholder="Search worlds and simulations..." autocomplete="off" aria-label="Search the catalog">
    <kbd>/</kbd>
  </div>

  <nav class="tabs">
    <a class="tab" href="/"${kind === 'worlds' ? ' aria-current="page"' : ''}>Worlds (${counts.worlds})</a>
    <a class="tab" href="/simulations"${kind === 'simulations' ? ' aria-current="page"' : ''}>Simulations (${counts.simulations})</a>
    <p class="legend"><span><i class="dot dot--ok"></i>verified</span><span><i class="dot dot--open"></i>unreviewed</span></p>
  </nav>

  <div class="thead"><span>#</span><span>${k.col}</span><span>DESCRIPTION</span></div>
  <div class="rows" id="rows">
${rows}
  </div>
  <p class="empty" id="empty" hidden>Nothing matches. Every gap in this catalog is a request for someone to build something.</p>

  <div class="bar">
    <span class="dot dot--accent"></span>
    <span>${esc(barText)}</span>
    <a href="#" id="random">Open a random ${k.one} &rarr;</a>
  </div>
</main>`;

  const script = `<script>
const ids = ${JSON.stringify(items.map((p) => `/${k.slug}/${p.id}`))};
document.getElementById('random').addEventListener('click', (e) => {
  e.preventDefault();
  location.href = ids[Math.floor(Math.random() * ids.length)];
});
const q = document.getElementById('q');
const rows = [...document.querySelectorAll('.row')];
const empty = document.getElementById('empty');
q.addEventListener('input', () => {
  const t = q.value.trim().toLowerCase();
  let shown = 0;
  for (const r of rows) {
    const hit = !t || r.dataset.hay.includes(t);
    r.hidden = !hit;
    if (hit) shown++;
  }
  empty.hidden = shown > 0;
});
addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); }
});
</script>`;

  return shell({
    title: kind === 'worlds' ? 'Alexandria — the world and simulation registry' : 'Simulations — Alexandria registry',
    description: 'The open catalog of worlds and simulations for Alexandria, the open source learning space.',
    body, script,
  });
}

// ── package page ─────────────────────────────────────────────────────────────
function packagePage(kind, p) {
  const k = KIND[kind];

  const stage = p.shots.length
    ? p.shots.map((s, i) => `      <img src="${esc(s.src)}" alt="${esc(p.name)} screenshot ${i + 1}" class="${i === 0 ? 'is-on' : ''}" ${i ? 'loading="lazy"' : ''}>`).join('\n')
    : `      <p class="shots__none">No screenshots yet. A package earns its claims by rendering, not by describing itself.</p>`;

  const arrows = p.shots.length > 1 ? `
      <button class="shots__arrow shots__arrow--prev" id="prev" aria-label="Previous screenshot"><svg width="10" height="10" viewBox="0 0 5 10" fill="none" aria-hidden="true"><path d="M5 0 L0 5 L5 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <button class="shots__arrow shots__arrow--next" id="next" aria-label="Next screenshot"><svg width="10" height="10" viewBox="0 0 5 10" fill="none" aria-hidden="true"><path d="M0 0 L5 5 L0 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : '';

  const pager = p.shots.length > 1
    ? `<div class="pager" id="pager">${p.shots.map((s, i) => `<button aria-label="Screenshot ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div>`
    : '';

  const caption = p.shots.length
    ? `<p class="caption" id="caption">${esc(pad(1) + (p.shots[0].caption ? ' — ' + p.shots[0].caption : ''))}</p>`
    : '';

  const body = `<main class="page page--package col">
  <a class="back" href="${k.href}">&larr; Registry</a>

  <div class="head">
    <div>
      <h1 class="title">${esc(p.id)}</h1>
      <p class="meta">${esc(p.source)} <span>&middot;</span> ${esc(p.version)} <span>&middot;</span> ${reviewDot(p.review)} ${esc(p.review)}</p>
    </div>
    <div class="head__actions"><a class="btn" href="#install">Install</a></div>
  </div>

  <div class="shots">
${stage}${arrows}
  </div>

  <div class="filmstrip">
    ${caption}
    ${pager}
  </div>

  <div class="about">
    <div>
      <p class="label about__label">WHAT IT DOES</p>
      ${p.about.map((t) => `<p>${esc(t)}</p>`).join('\n      ')}
    </div>
    <aside class="manifest">
      <p class="label">MANIFEST</p>
      <dl>
${p.facts.map(([a, b]) => `        <dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('\n')}
      </dl>
    </aside>
  </div>
</main>`;

  const script = p.shots.length > 1 ? `<script>
const shots = [...document.querySelectorAll('.shots img')];
const dots = [...document.querySelectorAll('#pager button')];
const caps = ${JSON.stringify(p.shots.map((s) => s.caption))};
let at = 0;
function go(n) {
  at = (n + shots.length) % shots.length;
  shots.forEach((s, i) => s.classList.toggle('is-on', i === at));
  dots.forEach((d, i) => d.setAttribute('aria-current', String(i === at)));
  const num = String(at + 1).padStart(2, '0');
  document.getElementById('caption').textContent = caps[at] ? num + ' — ' + caps[at] : num;
}
document.getElementById('prev').addEventListener('click', () => go(at - 1));
document.getElementById('next').addEventListener('click', () => go(at + 1));
dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') go(at - 1);
  if (e.key === 'ArrowRight') go(at + 1);
});
</script>` : '';

  return shell({
    title: `${p.id} — Alexandria registry`,
    description: p.blurb,
    body, script,
  });
}

function pad(n) { return String(n).padStart(2, '0'); }

// ── copy public/ verbatim ────────────────────────────────────────────────────
async function copyTree(from, to) {
  if (!existsSync(from)) return 0;
  await mkdir(to, { recursive: true });
  let n = 0;
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const src = join(from, entry.name), dst = join(to, entry.name);
    if (entry.isDirectory()) n += await copyTree(src, dst);
    else if (entry.name !== 'captions.json') { await copyFile(src, dst); n++; }
  }
  return n;
}

// ── write ────────────────────────────────────────────────────────────────────
await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'worlds'), { recursive: true });
await mkdir(join(OUT, 'simulations'), { recursive: true });

await writeFile(join(OUT, 'index.html'), listPage('worlds'));
await writeFile(join(OUT, 'simulations', 'index.html'), listPage('simulations'));

let pages = 2;
for (const kind of Object.keys(KIND)) {
  for (const p of catalog[kind]) {
    await writeFile(join(OUT, KIND[kind].slug, `${p.id}.html`), packagePage(kind, p));
    pages++;
  }
}

await copyFile(join(ROOT, 'src', 'site.css'), join(OUT, 'site.css'));
const assets = await copyTree(join(ROOT, 'public'), OUT);

const shotCount = Object.keys(KIND).reduce((n, k) => n + catalog[k].reduce((m, p) => m + p.shots.length, 0), 0);
console.log(`built ${pages} pages, ${assets} assets, ${shotCount} screenshots -> dist/`);

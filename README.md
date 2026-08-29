# Alexandria registry

The public catalog of [Alexandria](https://github.com/punkerpunkest/alexandria) **worlds** and
**simulations**.

A world decides the form your material arrives in — a paged board, a scrolling article, a
visual novel. A simulation is an engine with a declared task space that poses a real task
and owns whether you got it right. Both are community packages. Neither ships with
Alexandria, and the app works without either.

## Why this is a static site

The registry publishes a compact index and instances sync and search it locally. That keeps
the local-first story intact, means no query ever leaves a student's machine, and lets the
whole thing sit on a CDN — which matters when an open source project is paying for it. So
there is no server here, no database, and no dependencies: `build.mjs` reads
`catalog/packages.json` and writes HTML.

```
npm run build     # -> dist/
npm run serve     # build, then serve dist/ on :4321
npm run sync      # refresh the catalog from a local alexandria checkout
npm run pack      # rebuild the package archives and their digests
```

## Two surfaces, one host

The site serves two jobs that must not be confused, and `docs/contracts/registry.md` in the
alexandria repo owns the distinction:

> A student **browses** worlds. The system **matches** simulations.

So there are two products here. The pages are the world surface. **`/index.json` is the
simulation surface** — a compact index Alexandria fetches in Node, searches locally, and
installs from, with no query endpoint and no per-query telemetry, because a registry that
answers questions is a registry that learns what a student is studying.

The consequence you can see on the pages: a simulation is never installed by hand, so its
page says so and the archive is there because the bytes have to be hosted somewhere
Alexandria can fetch them from. A world **cannot** be installed by Alexandria at all today,
so its page says that instead and tells you where to unpack it.

## `/index.json`

Shape is fixed by the contract. `index: 1` is a format version — a reader that meets a
number it does not know must refuse the whole file rather than best-effort a subset it may
be misreading. `archive` is relative to the index's own URL so the host can move or be
mirrored. `hash` is Subresource Integrity form, `sha256-<base64>`, over the archive, so the
algorithm travels with the digest. `bytes` is a hint for a UI and never a cap.

The `worlds` array is specified by the same contract so the site has one format, and
nothing can consume it yet. It carries no `author`, because `world.json` declares none and
the site will not invent an identity a package does not claim.

## Layout

```
catalog/packages.json   the catalog. `manifest` and `facts` are synced; blurb, about,
                        pitch and topic are authored; `archive` is written by pack
build.mjs               the whole build, including /index.json
tools/pack.mjs          tars each package, digests it, records path/hash/bytes
tools/sync-catalog.mjs  mirrors the real manifests into the catalog
src/site.css            Tokyo Night Storm on a character grid
public/fonts/           Hack, subset to the characters this site uses (~6KB per weight)
public/shots/<id>/      screenshots (webp), sorted by filename; captions.json is optional
public/packages/        the archives themselves, committed so the host stays dumb
```

## Archives

Gzipped tar with the manifest at the archive **root**, not nested inside a folder — which
is what `tar czf out.tar.gz -C <package> .` produces. `pack` records a `srcHash` over each
package's sorted file list and contents, and skips repacking when that has not changed,
because a tar embeds mtimes and would otherwise produce a new digest on every run.

## Adding a package

1. Add an entry to `catalog/packages.json` with an `id`, a `blurb` of 48 characters or
   fewer, and one or two `about` paragraphs.
2. Drop screenshots into `public/shots/<id>/` as `01.webp`, `02.webp`, … and, if you want
   captions under the carousel, a `captions.json` holding an array of short strings in the
   same order. The ones here were captured from the app itself in deterministic fixture
   mode, so they are real renders of real modules rather than mockups — a package earns its
   claims by rendering.
3. Run `npm run sync` so the version, archetype, task space and review status come from the
   package's own manifest rather than from whatever was typed here, then `npm run pack` to
   build its archive and record the digest.

A simulation also needs a `topic` — its address in the specificity tree — and a `pitch`,
the one-liner a matcher reads. Neither has a manifest origin today, so both are authored in
`catalog/packages.json`. `pitch` should move into `engine.json` so the index derives it
rather than duplicating it.

`sync` deliberately skips any engine whose `subject` is `_test`. `hostile-probe` is the
arena's adversarial boundary test and its manifest says to keep it out of any registry;
`never-ready` exists only to exercise the degrade path.

## Review status

Every package currently reads `unreviewed`, and the catalog says so rather than implying
otherwise. A filled green dot means a package has been reviewed; a hollow amber ring means
it has not. Community learning content varies far more in quality than community themes do,
because a bad simulation does not just look wrong, it teaches wrong — so ranking, review and
provenance are core problems here rather than later ones.

## Deploying

Vercel, from this repo. Framework preset "Other", build command `node build.mjs`, output
directory `dist` — all three are already declared in `vercel.json`, so importing the repo
needs no configuration. Every push to `main` ships; branches get preview URLs.

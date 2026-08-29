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
```

## Layout

```
catalog/packages.json   the catalog. Facts mirror the real manifests; blurbs are authored
build.mjs               the whole build
src/site.css            Tokyo Night Storm on a character grid
public/fonts/           Hack, subset to the characters this site uses (~6KB per weight)
public/shots/<id>/      screenshots (webp), sorted by filename; captions.json is optional
```

## Adding a package

1. Add an entry to `catalog/packages.json` with an `id`, a `blurb` of 48 characters or
   fewer, and one or two `about` paragraphs.
2. Drop screenshots into `public/shots/<id>/` as `01.webp`, `02.webp`, … and, if you want
   captions under the carousel, a `captions.json` holding an array of short strings in the
   same order. The ones here were captured from the app itself in deterministic fixture
   mode, so they are real renders of real modules rather than mockups — a package earns its
   claims by rendering.
3. Run `npm run sync` so the version, archetype, task space and review status come from the
   package's own manifest rather than from whatever was typed here.

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

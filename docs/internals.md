# Internals

For people who modify deckmd or build plugins and tools. For how to use it, see [usage.md](usage.md).

## Files

```
index.html              launcher page when opening this repository directly → list of example decks
deck.config.js          config for this repository (the example list)
js/
  boot.js               list of files to load (libraries as CDN URLs, versions only here). The launcher page loads only this
  defaults.js           config defaults in one place (theme: ember, etc.)
  deck.js               loader: Markdown → slides → reveal.js
  notices.js            list of library and font licenses written at the top of a bundled file
  pack.js               deckmd helper (E key): modes, view options, PDF printing, packing into one file
  md-spans.js           markdown-it-bracketed-spans wrapped for the browser ([text]{.class})
css/base.css            shared rules (.cols .card .chapter … and the variable list). Always loaded first, regardless of theme
themes/<name>/<name>.css  themes: ember (default), catppuccin, solarized
plugins/grid/           built-in plugin (```grid cell diagrams and ```table tables)
plugins/math/           built-in plugin: TeX in Markdown with KaTeX (plugins: [math])
plugins/source/         built-in plugin: under each slide, a slide with its Markdown source (plugins: [source])
templates/              files to copy into your talks repository: index.html, index.cdn.html (deckmd from the CDN; init fills in the version), index.full.html, deck.config.js, deck.config.full.js, talk.md
tools/
  serve.mjs             npx deckmd serve: the project, decks or folders (launcher page and config made on the fly without a project; deckmd under /_deckmd/)
  serve.sh, .cmd, .ps1  the same idea for a repository checkout without node (python3 → node → php)
  build.mjs             command-line pack and unpack (runs pack.js unchanged in jsdom)
  project.mjs           finding the deckmd project ("tree") from the current folder upwards, like git; shared by build, serve, add and init
  init.mjs              npx deckmd init: starts a talks repository from templates/ (build.mjs hands over to it)
  add.mjs               npx deckmd add: adds slides/<name>/deck.md (in a project) or ./<name>.md from the starter
  localize.mjs          downloads CDN libraries, fonts and licenses into vendor/
  libs.mjs              runs plugins/*/*.js in a sandbox to learn their DeckMD.register libs (for localize.mjs and the tests)
  release.mjs           builds the offline zip (distribution on hold)
scripts/version.mjs     repo maintenance, not published: npm version copies the new version into DeckMD.version
scripts/site.mjs        builds the demo site into _site/ (intro deck as home, all examples in ?deck-list); .github/workflows/pages.yml deploys it on push to main
vendor/                 (not in git) local copy fetched by localize.mjs
examples/<deck>/        example decks: syntax (syntax guide), grid (cell diagrams and tables; it also uses the source plugin), readme, page (a deck written in HTML), interactive
docs/                   documentation
tests/                  build.test.mjs, browser.html, fixtures/
package.json            npm package deckmd (bin: npx deckmd, dependency jsdom)
```

The npm package contains only the runtime (`js/ css/ themes/ plugins/`), `templates/`, `tools/` and the user docs (`files` in `package.json`). Examples and tests stay in the repository only.

## Load order

1. The **launcher page** has a single `<script src="…/js/boot.js">`.
2. **boot.js**: inserts the files in its list (`LIST`) into the page in order — config (`deck.config.js`), reveal.js and its CSS, fonts, plugins (notes, highlight), markdown-it and its plugins, js-yaml, `defaults.js`, `notices.js`, `pack.js`, `deck.js`. Libraries use CDN URLs (with `data-local`, the same path under `vendor/`); our own files are relative to `boot.js`'s own URL. If the launcher page already has a tag with the same name, it is skipped. The final `deck.js` waits until all CSS is loaded.
3. **deck.js**: merges the config (`defaults.js` ← `deck.config.js` ← front matter ← URL), reads the Markdown (fetch with a server, a file picker without one, the embedded copy in a bundled file), loads the theme, CSS and plugins, splits the Markdown into slides and renders them with markdown-it (remembering each slide's Markdown in `DeckMD.sources` and the front matter in `DeckMD.frontMatter`, which the source plugin shows), runs plugin post-processing, then calls `Reveal.initialize`.
4. **pack.js**: the E key panel. When packing, it gathers what deck.js recorded (the initial tags `DeckMD.staticTags`, the loaded theme, CSS and plugins `DeckMD.loaded`, the Markdown source, images) and builds a single HTML file.

`templates/index.full.html` is what `boot.js` does, written out as explicit tags.

## Shape of a bundled file

```html
<!doctype html>
<!-- packed with deckmd · offline (everything inside) · 2026-10-09 -->
<!-- bundled libraries and fonts (each under its own license …): reveal.js — MIT — https://…/LICENSE … -->
<style data-src="https://cdn.jsdelivr.net/npm/reveal.js@…/dist/reveal.css">…</style>        ← library: key = CDN URL
<style data-src="themes/ember/ember.css" data-from="deckmd">…</style>                      ← deckmd's file: key = path relative to deckmd
<style data-src="deck.css" data-file="slides/x/deck.css">…</style>                           ← your file: data-file = original location
<script type="text/markdown" data-base="./" data-path="slides/x/deck.md">…Markdown…</script>
<script type="application/json" id="deck-assets">{"img/a.png": "data:image/png;base64,…"}</script>
<script data-src="js/deck.js" data-from="deckmd">…</script>
```

- `data-src` is the key deck.js uses to recognize "already embedded, don't load again".
- `data-from`, `data-file` and `data-path` are used by unpacking (`build.mjs --unpack`). Files under boot.js (deckmd, or `…/deckmd@version/` on the CDN) are deckmd's own.
- A share bundle keeps libraries as `<link href>` and `<script src>` (CDN).

## Tools

- **build.mjs**: opens the launcher page in jsdom (files = disk, libraries = `vendor/` or the internet) and calls `DeckPack.pack(mode)`. It only fills in what jsdom lacks: `fetch`, `matchMedia`, `ResizeObserver`. Unpacking (`--unpack`) works on strings, without jsdom.
- **localize.mjs**: downloads the CDN URLs in the `boot.js` list, reveal.js's built-in themes, the libraries plugins declare with `DeckMD.register` (found by `libs.mjs`), and the license texts (`notices.js`) into `vendor/<URL as is>`. It also follows `url(…)` inside CSS (fonts). Paths are derived directly from URLs, so `data-local` finds them by the same rule.
- **release.mjs**: offline zip (committed files + `vendor/` + a `data-local` sample). Distribution is on hold.
- **serve.sh / serve.cmd, ps1**: static file server (the node and php fallbacks also serve directory listings, so the deck list `scan` works). **serve.cmd and ps1 (Windows) have not been tested on Windows yet** (macOS has no PowerShell, so they were never run). To test: a window opens and shows the URL, it moves to the next port when the port is in use, directory listing for a folder without `index.html` (`scan`), Ctrl+C stops it.

Upgrading a library = editing the URL in `js/boot.js` (running `localize.mjs` again fetches it under the new path). deckmd's own version is in `package.json`.

## Tests

```bash
npm install                 # once (jsdom)
npm test                    # pack and unpack (= node --test tests/build.test.mjs). Output in tests/out/
tools/serve.sh              # → http://localhost:8000/tests/browser.html
```

- `build.test.mjs`: offline and share packing, HTML decks, assets, path rules (`/`, theme directories, `reveal/…`), non-ASCII (Korean) paths, overwriting, options, the pack → unpack → repack round trip, a launcher page that loads deckmd from the CDN.
- `browser.html`: opens decks in iframes and checks slide counts, notes, external requests, fonts and error screens, and also reopens the bundled files in `tests/out/` and the result of packing with the E key. Open it after `npm test`.
- Test decks are in `tests/fixtures/`.

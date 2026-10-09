# Usage

How to create, view, and pack a deck. For syntax see [writing.md](writing.md), for looks [styling.md](styling.md), and for packing in detail [packing.md](packing.md).

## Setup: three ways

| Way | Launcher page (`index.html`) | When |
|---|---|---|
| **Repository** (recommended) | `<script src="deckmd/js/boot.js"></script>` | A talks repository where your decks keep piling up |
| **CDN** | `<script src="https://cdn.jsdelivr.net/npm/deckmd@VERSION/js/boot.js"></script>` | Nothing to download. One Markdown file + this file |
| **Offline** | Repository + `<script src="deckmd/js/boot.js" data-local></script>` | Planes, air-gapped networks |

### Repository

```bash
git submodule add <deckmd repo> deckmd        # or copy it into deckmd/
cp deckmd/templates/index.html deckmd/templates/deck.config.js .
mkdir -p talks/2026-11-first-talk
cp deckmd/templates/talk.md talks/2026-11-first-talk/
```

```
talks-repo/
  deckmd/               ← the template (git submodule, pinned to a tag)
  index.html            ← templates/index.html (one boot.js line)
  deck.config.js        ← templates/deck.config.js (deck list, shared theme, etc.)
  talks/2026-11-first-talk/
    talk.md  img/
    dist/2026-11-first-talk.offline.html   ← pack and commit when you're done
```

For why it's laid out this way, see [workflow.md](workflow.md).

### CDN

Just change the one `boot.js` tag in `index.html` to the CDN URL. `boot.js` finds everything else (themes, plugins, libraries) relative to its own URL. With the version in the URL, that deck stays the same even when deckmd changes. (Available once published to npm.)

### Offline

Download things ahead of time while you still have internet.

```bash
node deckmd/tools/localize.mjs          # libraries, fonts, and licenses into deckmd/vendor/
cd deckmd && npm install                # if you also want to pack from the command line (jsdom)
```

Then add `data-local` to the tag in the launcher page.

## Viewing while you write

```bash
deckmd/tools/serve.sh       # Windows: deckmd\tools\serve.cmd (double-click works too; not yet tested on Windows). Or python3 -m http.server
```

`http://localhost:8000/` → deck list → deck. Edit the Markdown and reload, and it redraws the same slide you were on. `serve.sh` uses whichever of python3 → node → php is available.

### Without a server

If you open `index.html` directly in the browser, the browser blocks a `file://` page from reading neighboring files, so the first time you pick the Markdown file yourself (button or drag and drop).
- Image and CSS paths are relative to the location given in `?src=`, so for a deck with images, open `index.html?src=talks/x/talk.md` and pick that file.
- Chrome and Edge remember the picked file and redraw as soon as you save changes. Other browsers only remember it until you reload.

## URL options

| Option | Meaning |
|---|---|
| `?src=path.md` | Deck to open |
| `?deck-list` | Deck list |
| `?core` | Only slides whose tier is `core` (short version). Slides without a `tier` follow `defaultTier` ([writing.md](writing.md)) |
| `?draft` | Show `<!-- @@ … -->` review notes as yellow sticky notes |
| `?mode=dark\|light\|auto` | Light/dark mode (when the theme supports it) |
| `?split=headings&lines=10` | How to split by headings a Markdown file with no slide breaks |
| `?pick` | Pick a file even when opened through a server |
| `?print-pdf` | Print layout (⌘/Ctrl+P → Save as PDF). With `&showNotes=separate-page`, notes go on their own pages |

reveal.js settings can be given in the URL too (e.g. `?transition=none`).

## Keyboard shortcuts

reveal.js defaults (`?` for the list): `→`/`Space` next, `S` speaker view (notes, clock), `Esc`/`O` overview, `F` fullscreen, `B` black out the screen.

**E** = deckmd helper: light/dark mode, toggle `?draft` and `?core`, open the print layout for PDF (optionally with notes), pack into one file and download. Close it with `Esc`.

## Config: `deck.config.js`

Put it next to the launcher page (it's optional). A sample listing every key with explanations is `templates/deck.config.full.js`; values you don't set come from `deckmd/js/defaults.js`.

```js
window.DeckConfig = {
  title: 'Talks',
  home: 'list',            // opened without ?src: 'list' = deck list | 'deck' = the src deck below
  scan: ['talks/*'],       // folders to build the deck list from (each folder under talks)
  theme: 'ember',          // defaults for every deck: theme, mode, plugins, css, style, reveal, split, lines, size
};
```

- `scan` reads the web server's directory listing. The top folder (`'.'`) doesn't work because `index.html` hides its listing, so put decks one level down, like `talks/*`. When opening without a server, or on GitHub Pages, list them yourself with `decks: [{ src, title }, …]`.
- Paths in the config are **relative to the launcher page** (even when you use a config in another folder via `data-config`).

When config, front matter, and URL options overlap:

| Key | Config → front matter → URL options |
|---|---|
| `theme` | Front matter, if present, replaces the config's |
| `css`, `style`, `plugins` | Config's + front matter's (the same file only once) |
| `reveal` | Front matter is merged over the config (one level deep) |
| `split`, `lines`, `mode`, `defaultTier` | URL options > front matter > config |
| `size` | Front matter > config |
| `home`, `scan`, `decks`, `title` | Config only (for the deck list) |

## Launcher page options

Add these to `<script src="deckmd/js/boot.js" …>`.

| Attribute | Meaning |
|---|---|
| `data-local` | Load libraries and fonts from `vendor/` (run `localize.mjs` first) |
| `data-skip="highlight font"` | Leave out: `reveal` `highlight` `notes` `font` `markdown` `yaml` `pack` `config` |
| `data-config="x.js"` | Config file (default: `deck.config.js` next to it, `none` = no config) |

If you want to manage a particular file yourself, write just that tag in the launcher page. `boot.js` skips files with the same name. A launcher page with every tag written out is `templates/index.full.html`.

## Pack when you're done

While viewing the deck, press **E** → "Offline" (one file with everything inside, opens without internet) or "Share" (libraries from the CDN, smaller). From the command line:

```bash
node deckmd/tools/build.mjs talks/x/talk.md         # → talks/x/dist/x.offline.html  (first time: cd deckmd && npm install)
npx deckmd talks/x/talk.md                          # without a deckmd folder (npm)
```

For details (share, unpack, what gets included and what doesn't), see [packing.md](packing.md).

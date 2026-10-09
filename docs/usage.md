# Usage

How to create, view, and pack a deck. For syntax see [writing.md](writing.md), for looks [styling.md](styling.md), and for packing in detail [packing.md](packing.md).

## Setup: three ways

The quickest start is [`npx deckmd init`](#npx-deckmd-init), which writes the files for you. The table is what those files contain.

| Way | Launcher page (`index.html`) | When |
|---|---|---|
| **Repository** (recommended) | `<script src="deckmd/js/boot.js"></script>` | A talks repository where your decks keep piling up |
| **CDN** | `<script src="https://cdn.jsdelivr.net/npm/deckmd@VERSION/js/boot.js"></script>` | Nothing to download. One Markdown file + this file |
| **Offline** | Repository + `<script src="deckmd/js/boot.js" data-local></script>` | Planes, air-gapped networks |

### `npx deckmd init`

The quickest start. It creates the files for you; each of the two choices has a default.

```bash
npx deckmd init [dir] [--cdn | --repo] [--single | --multi]
```

| Option | Means |
|---|---|
| `--cdn` (default) | `index.html` loads deckmd from the CDN, pinned to the version you ran `init` with (change the number to upgrade) |
| `--repo` | also copies deckmd into `deckmd/` (runtime, templates, tools). You own the copy; works offline after `node deckmd/tools/localize.mjs`. To follow deckmd's updates with git, use a submodule instead (below) |
| `--single` (default) | one deck: `index.html` + `slides.md`. Opening `index.html` shows it, no config needed |
| `--multi` | a talks repository: `index.html`, `deck.config.js`, `slides/first-deck/deck.md`. Opening `index.html` lists the decks |

`init` never overwrites. If any file it would create exists (with `--repo`, also `deckmd/`), it stops and changes nothing.

### `npx deckmd add`

Adds a deck to a `--multi` (talks) repository; run it at the top of the repository.

```bash
npx deckmd add my-talk "My talk title"      # → slides/my-talk/deck.md
```

It copies the starter (`templates/deck.md`) with the title and today's date filled in. The title is optional (`my-talk` → "My talk"; an unquoted `add my-talk My talk title` works too). The name is the folder name: no `/ \ : * ? " < > |`, and no leading dot. It never overwrites an existing `talk.md`. The deck shows up in the deck list on the next reload.

### Repository by hand (git submodule)

```bash
git submodule add <deckmd repo> deckmd        # or copy it into deckmd/
cp deckmd/templates/index.html deckmd/templates/deck.config.js .
mkdir -p slides/2026-11-first-talk
cp deckmd/templates/deck.md slides/2026-11-first-talk/
```

```
talks-repo/
  deckmd/               ← the template (git submodule, pinned to a tag)
  index.html            ← templates/index.html (one boot.js line)
  deck.config.js        ← templates/deck.config.js (deck list, shared theme, etc.)
  slides/2026-11-first-talk/
    deck.md  img/
    dist/2026-11-first-talk.offline.html   ← pack and commit when you're done
```

For why it's laid out this way, see [workflow.md](workflow.md).

### CDN

`npx deckmd init` writes this for you. By hand: change the one `boot.js` tag in `index.html` to the CDN URL. `boot.js` finds everything else (themes, plugins, libraries) relative to its own URL. With the version in the URL, that deck stays the same even when deckmd changes.

### Offline

Download things ahead of time while you still have internet.

```bash
node deckmd/tools/localize.mjs          # libraries, fonts, and licenses into deckmd/vendor/
cd deckmd && npm install                # if you also want to pack from the command line (jsdom)
```

Then add `data-local` to the tag in the launcher page.

## Viewing while you write

```bash
npx deckmd serve                          # serve the current folder (a project made by init): its index.html, or the deck list
npx deckmd serve my-deck.md               # one deck, nothing else needed: no index.html, no config
npx deckmd serve a.md b.md examples/*.md  # a deck list of those files
```

`http://localhost:8000/` → deck list → deck. Edit the Markdown and reload, and it redraws the same slide you were on.

- With files and no project in the folder, the server makes the launcher page and the config itself and serves deckmd from the package (under `/_deckmd/`). Your files, and what they refer to (images, CSS, plugins next to them), are read from disk on every request, so images and paths resolve relative to the Markdown as usual. Decks in different folders keep their paths relative to their common folder.
- With files **from inside a project** (the folder has an `index.html` and/or `deck.config.js`), the project is used: its `index.html` is the page (so its deckmd version), and its `deck.config.js` (or the file its `boot.js` tag names with `data-config`) is followed. Only `home`, `src` and `decks` are replaced by your files, so the theme, plugins, CSS and mode of the project apply while you preview one deck. The first lines `serve` prints say what it used. Files outside the folder can't use the project's settings, and it says so.
- Without files, it serves the current folder as it is, with folder listings (so a `decks: 'auto'` deck list can scan `slides/*`). This replaces `python3 -m http.server`; any static server still works.
- `--port N` (default 8000, or the next free port; `0` = any), `--open` (open the browser), `--host 0.0.0.0` (open it to your network, for a phone or a friend's laptop). The default is `localhost` only.
- Dot files and folders (`.git`, `.env`) are never served, and of deckmd itself only `js/ css/ themes/ plugins/` are.
- A request whose `Host` is a domain name is refused (403). Only `localhost`, an IP address, or the name you gave `--host` is accepted, so a web page on some other site can't read your files through your browser by pointing its domain at 127.0.0.1 (DNS rebinding).
- A symbolic link is followed only while its real path stays inside the served folder (or deckmd's own `js/ css/ themes/ plugins/`, so a `deckmd/` that links to the package works). A link to a file outside gets 403.
- `--host 0.0.0.0` opens the whole folder (dot files excepted) to your network, and `serve` prints a warning when you use a host other than localhost.
- A repository checkout also has `tools/serve.sh` (python3 → node → php, whichever exists; `serve.cmd` and `serve.ps1` for Windows, not tested there).
- Press **E** on a served deck to pack it: that works the same as on any other page.

### Without a server

If you open `index.html` directly in the browser, the browser blocks a `file://` page from reading neighboring files, so the first time you pick the Markdown file yourself (button or drag and drop).
- Image and CSS paths are relative to the location given in `?src=`, so for a deck with images, open `index.html?src=slides/x/deck.md` and pick that file.
- Chrome and Edge remember the picked file and redraw as soon as you save changes. Other browsers only remember it until you reload.

## URL options

| Option | Meaning |
|---|---|
| `?src=path.md` | Deck to open. Only a path under the folder of `index.html` is accepted: a URL (`https://…`), a leading `/` or a `..` that climbs out of the folder is refused (`sub/../talk.md` stays inside, so it opens). A link must not be able to make the page run someone else's Markdown, because a deck's front matter can load scripts. |
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
  scan: ['slides/*'],       // folders to build the deck list from (each folder under slides)
  theme: 'ember',          // defaults for every deck: theme, mode, plugins, css, style, reveal, split, lines, size
};
```

- `scan` reads the web server's directory listing. The top folder (`'.'`) doesn't work because `index.html` hides its listing, so put decks one level down, like `slides/*`. When opening without a server, or on GitHub Pages, list them yourself with `decks: [{ src, title }, …]`.
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
node deckmd/tools/build.mjs slides/x/deck.md         # → slides/x/dist/x.offline.html  (first time: cd deckmd && npm install)
npx deckmd slides/x/deck.md                          # without a deckmd folder (npm)
```

For details (share, unpack, what gets included and what doesn't), see [packing.md](packing.md).

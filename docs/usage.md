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

`init` never overwrites. If any file it would create exists (with `--repo`, also `deckmd/`), it stops and changes nothing. Inside an existing deckmd project (found the way [below](#the-project-and--c)) it refuses, since a project in a project is usually a mistake (`add` makes a deck there); `--force` starts one anyway.

### `npx deckmd add`

Adds a deck.

```bash
npx deckmd add my-talk "My talk title"      # in a project → <project>/slides/my-talk/deck.md
```

It copies the starter (`templates/deck.md`) with the title and today's date filled in. The title is optional (`my-talk` → "My talk"; an unquoted `add my-talk My talk title` works too). The name is the folder (or file) name: no `/ \ : * ? " < > |`, and no leading dot. It never overwrites.

In a [project](#the-project-and--c) the deck goes to `slides/<name>/deck.md` at the top of the project, whatever folder of it you are in, and shows up in the deck list on the next reload. Without a project it makes just `./<name>.md` here, a deck on its own (`npx deckmd serve <name>.md`).

### The project and `-C`

A **project** (the "tree") is a folder with a deckmd launcher: an `index.html` that loads `boot.js` (or `deck.js`) and has no slides written in it. Like git with its repository, `serve`, `add`, `init` and packing look for it in the folder you are in and in the folders above it (up to 4 levels; never your home folder or above, never the root of the disk). So `npx deckmd add x` works from `slides/my-talk/img/` too.

`npx deckmd -C path <command> …` starts in that folder, as if you had `cd`'d there; the project is looked for from there (the folder need not be the project's root). `-C` goes before the command.

Whenever there is a project, only files inside it are used. Without one, only what you name is used, and nothing above the folder you are in.

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
npx deckmd serve                          # the project (see above), from any folder in it
npx deckmd serve my-deck.md               # one deck; with no project nothing else is needed: no index.html, no config
npx deckmd serve a.md b.md examples/*.md  # a deck list of those files
npx deckmd serve slides                   # a folder: every .md in it, two levels deep (never dot folders or node_modules)
```

`http://localhost:8000/` → deck list → deck. Edit the Markdown and reload, and it redraws the same slide you were on.

**What is served** depends on whether a [project](#the-project-and--c) is found from the current folder:

| | In a project | No project |
|---|---|---|
| `serve` | the whole project, as it is | refused, with `npx deckmd init` / `serve my-deck.md` as the way out |
| `serve a.md …` (files or folders) | the project's `index.html` is the page and its `deck.config.js` is followed, only `home`, `src` and `decks` are replaced by what you named, so the theme, plugins and CSS apply. The site is the whole project (without `node_modules`) | the server makes the launcher page and config at the common folder of the decks (never above the current folder), and serves only the **folders of the decks you named** (in full). Nothing between them |

- **Only files inside the project are used.** A deck outside it is refused, with the command that works (`cd ../other && npx deckmd serve x.md`). Without a project the decks must be under the current folder. Your home folder, a folder above it, and the root of the disk are never served. Without a project, a file outside the decks' folders (a sibling `assets/`, a README one level up) is a 404 that says why: put it next to the deck, or run it in a project. `serve` prints the project it found (and how many folders up) when you started in a subfolder.
- **Only slide and web file types** are served, everywhere: Markdown, HTML, CSS, JS, JSON, CSV/TSV, YAML, XML, images, fonts, audio, video, PDF, `.wasm`. Keys, certificates, databases, archives and files without an extension are a 404, and they don't show in folder listings. Dot files and folders (`.git`, `.env`) are never served. Of deckmd itself, only `js/ css/ themes/ plugins/` are (under `/_deckmd/`).
- Files are streamed and answer `Range` requests, so video (and video backgrounds) can seek, and play in Safari. A request can't end the server: a folder it can't read answers 403, and any other failure answers 500 and is printed in the terminal.
- In a project, folder listings are served so a `decks: 'auto'` deck list can scan `slides/*`; this replaces `python3 -m http.server`, and any static server still works. Files are read from disk on every request, so images and paths resolve relative to the Markdown as usual. The first lines `serve` prints say what it used.
- `--port N` (default 8000, or the next free port; `0` = any), `--open` (open the browser), `--host 0.0.0.0` (open it to your network, for a phone or a friend's laptop). The default is `localhost` only. With another host `serve` prints a warning that the folder is open to your network.
- A request whose `Host` is a domain name is refused (403). Only `localhost`, an IP address, or the name you gave `--host` is accepted, so a web page on some other site can't read your files through your browser by pointing its domain at 127.0.0.1 (DNS rebinding).
- A symbolic link is followed only while its real path stays inside the served folder (or deckmd's own `js/ css/ themes/ plugins/`, so a `deckmd/` that links to the package works), and the rules above apply to where it really leads: a link to a file outside gets 403, and a link can't reach a dot folder, a folder outside the decks' folders (without a project) or a key file under a harmless name (404; such links are not listed either). A `deck.config.js` that is a link out of the folder is refused too (403).
- A repository checkout also has `tools/serve.sh` (python3 → node → php, whichever exists; `serve.cmd` and `serve.ps1` for Windows, not tested there).
- Press **E** on a served deck to pack it: that works the same as on any other page.

### Without a server

If you open `index.html` directly in the browser, the browser blocks a `file://` page from reading neighboring files, so the first time you pick the Markdown file yourself (button or drag and drop).
- Image and CSS paths are relative to the location given in `?src=`, so for a deck with images, open `index.html?src=slides/x/deck.md` and pick that file.
- Chrome and Edge remember the picked file and redraw as soon as you save changes. Other browsers only remember it until you reload.
- Packing (E key) needs the files next to the page, which a `file://` page can't read. Serve the folder instead; any static server works. The pick screen and the E panel show these commands filled in for that page, each with a copy button:

  ```bash
  cd 'the folder of index.html'
  npx deckmd serve                    # with Node
  python3 -m http.server              # or with Python (python on Windows)
  ```

  Then open `http://localhost:8000/` (with the same `?src=…`): the deck opens without picking, and E packs it. In a repository with a `deckmd/` folder, `node deckmd/tools/build.mjs serve` does the same without downloading anything. A bundled file needs none of this: it packs from `file://`.

## URL options

| Option | Meaning |
|---|---|
| `?src=path.md` | Deck to open. Only a path under the folder of `index.html` is accepted: a URL (`https://…`), a leading `/` or a `..` that climbs out of the folder is refused (`sub/../talk.md` stays inside, so it opens). A link must not be able to make the page run someone else's Markdown, because a deck's front matter can load scripts. |
| `?deck-list` | Deck list |
| `?core` | Only slides whose tier is `core` (short version). Slides without a `tier` follow `defaultTier` ([writing.md](writing.md)) |
| `?draft` | Show `<!-- @@ … -->` review notes as yellow sticky notes |
| `?mode=dark\|light\|auto` | Light/dark mode (when the theme supports it) |
| `?split=headings&lines=10` | How to split by headings a Markdown file with no slide breaks |
| `?use=source,math` | Add built-in plugins to this viewing (the names of plugins that come with deckmd; a path or a URL is ignored). The deck list uses it for the decks that say `plugins: […]`. Not `?plugins=`: reveal.js takes every query parameter as one of its own settings, and its `plugins` is a list |
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

- `decks` is `'auto'` (the folders of `scan`) or a list of paths and `{ src, title, core, plugins }`, and the string `'auto'` in the list stands for the scan: `decks: ['auto', { src: 'README.md', title: 'README', core: false, plugins: ['source'] }]`. `title` is the name shown (else the deck's front matter title or first heading); `core: false` leaves out the short-version link of that deck; `plugins` opens that deck with those built-in plugins added (`?use=`). A Markdown file with no `---` slide breaks, like a README, is split by headings, so it works as a deck without changes.
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

# deckmd

English · [한국어](README.ko.md)

A reveal.js slide deck from a single Markdown file.
View it in the browser right away with no build step, and when you're done, pack it into one HTML file.

**Demo: [qgp9.github.io/deckmd](https://qgp9.github.io/deckmd/)** — the page itself is a deckmd deck; all examples are under [?deck-list](https://qgp9.github.io/deckmd/?deck-list).

## TL;DR

```bash
cat > mydeck.md <<'EOF'
# Hello deckmd

---

## A slide

- Markdown in
- slides out
EOF
npx deckmd mydeck.md --share      # → dist/mydeck.share.html: one small file, open it in a browser
```

Live preview while you write: `npx deckmd serve mydeck.md`. No Node? [See below](#works-with-or-without-node). (The first `npx` run takes a few seconds to install.)

## What a deck looks like

```markdown
---
title: My first talk
theme: catppuccin
---

# My first talk

---

## Today

- Write in Markdown {.fragment}
- See it in the browser right away {.fragment}

Note:
Speaker notes (S key)
```

## Works with or without node

Like reveal.js itself, deckmd needs no build step, no web server and no node to write or present. Markdown, themes and plugins are added on top of that without taking it away. Node is optional, and it makes things easier.

- **The Markdown can be its own file.** `index.html` is a one-line launcher (`<script src="…/js/boot.js">`) and the slides live in `slides.md` next to it. You can still write slides inside `index.html` if you prefer one file. With node, you don't need `index.html` either: `npx deckmd serve my-deck.md` shows a bare Markdown file.
- **No node, no web server.** Open `index.html` in a browser and pick the Markdown file (button or drag and drop); Chrome and Edge remember it and redraw when you save; other browsers keep it only until you reload. Presenting, speaker view, PDF printing and the E-key helper all work this way ([docs/usage.md](docs/usage.md#without-a-server)).
- **Offline packing happens in the browser.** Press **E** → "Offline" and the page packs itself into one HTML file that opens without internet. No node, no build tool. (Opened as `file://`, the browser does not let the page read the files next to the Markdown, so images, CSS and scripts you reference by path are left out; from any web server they are included. Details: [docs/packing.md](docs/packing.md).)
- **With node, it is the most convenient.** `npx deckmd init` sets up a project, `npx deckmd serve` serves and reloads it (and lists many decks), `npx deckmd add` adds a deck, and `npx deckmd talk.md` packs from the command line, the same file the E key makes.

| | Needs | You get |
|---|---|---|
| Write and present | a browser | the deck itself (pick the Markdown file once per browser session if not Chrome/Edge) |
| Offline packing | a browser | one HTML file (with `file://`, without files next to the deck) |
| `npx deckmd …` | node 22+ | no `index.html`, serving, deck list, command-line packing |

## What it is

deckmd is three things put together.

### 1. Write in Markdown

A few bits of Markdown syntax on top of reveal.js.

- Split slides with `---`; put slide settings at the top of a slide with `<!-- class: chapter; tier: core -->`
- Attributes with `{.fragment}`, `{.class #id key=val}`, on part of a line with `[text]{.muted}`, and groups with `::: cols`
- Below `Note:` go the speaker notes, `<!-- @@ note -->` is a review note (`?draft`), and `?core` gives the short version
- reveal.js features (fragments, backgrounds, transitions, auto-animate, code line highlights) straight from Markdown
- Markdown without slide breaks (a README, say) is split by headings into a deck
- Add syntax with plugins (built in: cell diagrams and tables with ```` ```grid ````, a source view under each slide, and TeX math with KaTeX)

→ [docs/writing.md](docs/writing.md), and the syntax guide as a deck: [`examples/syntax/talk.md`](examples/syntax/talk.md)

### 2. Template

Many decks share one set of templates.

- The launcher page is one line: `<script src="…/js/boot.js">`. Libraries (reveal.js, markdown-it, fonts) come from a CDN, or from a local copy when you work offline
- Themes: `ember` (default), `catppuccin`, `solarized`, and the reveal.js built-in themes. Light and dark modes
- Layout classes (`cols`, `card`, `chapter` …) and color variables — switch themes and the syntax stays the same
- One config, `deck.config.js`, for defaults across all decks and the deck list
- Keep it in your repository as `deckmd/`, or use one CDN line

→ [docs/usage.md](docs/usage.md), [docs/styling.md](docs/styling.md)

### 3. Pack

Freeze a finished deck into one HTML file. Even if the template changes later, that deck still opens as it was.

- While viewing a deck, press **E** → "Offline" (everything inside, opens without internet) or "Share" (libraries from a CDN, small)
- The command line gives the same result: `node deckmd/tools/build.mjs talk.md`, `npx deckmd talk.md`
- Unpack: get your own files (Markdown, images, CSS) back out of a bundled file
- The licenses of the bundled libraries are listed at the top of the file

→ [docs/packing.md](docs/packing.md)

## Getting started

```bash
npx deckmd init                  # index.html + slides.md (deckmd itself comes from the CDN)
npx deckmd serve                 # a small web server; open http://localhost:8000/ and edit slides.md
```

No project needed to look at a Markdown file: `npx deckmd serve my-deck.md` shows that one deck, `npx deckmd serve a.md b.md` a deck list, `npx deckmd serve some/folder` every deck in it. Run inside a project (found like git finds its repository: in this folder or the ones above), it uses the project's `index.html` and `deck.config.js` and only replaces which decks to show, so your theme applies; `npx deckmd -C path …` starts in another folder. `serve` also takes `--port`, `--open` and `--host 0.0.0.0` (to open it to a phone on your network).

When you're done, press **E** while viewing the deck → "Offline", or run `npx deckmd slides.md`. Commit the resulting file next to the deck; that is the frozen version.

`init` has two choices, each with a default:

| Option | |
|---|---|
| `--cdn` (default) / `--repo` | where deckmd comes from: the CDN, pinned to a version / a copy in `deckmd/` in your repository (works offline, you own the version) |
| `--single` (default) / `--multi` | one deck: `index.html` + `slides.md` / a talks repository, one folder per deck: `index.html`, `deck.config.js`, `slides/first-deck/deck.md` and a deck list as the home page |

`init` never overwrites: if any of the files (with `--repo`, also `deckmd/`) already exists, it stops and changes nothing. To do it by hand, or with a git submodule: [docs/usage.md](docs/usage.md).

In a project, add a deck with `npx deckmd add my-talk "My talk title"` (from any folder in it): it creates `slides/my-talk/deck.md` from the starter, with the title and date filled in, and the deck shows up in the deck list. Outside a project it makes `./my-talk.md`.

Working offline, opening without a server, URL options and config: [docs/usage.md](docs/usage.md).

## Docs

[docs/](docs/) — usage, writing slides, styling, fonts, packing and unpacking, plugins, buttons and JS, organizing your repository, internals.

## License

MIT ([LICENSE](LICENSE)). The libraries and fonts it loads follow their own licenses; a bundled file lists the ones it contains, with license links, in a comment at the top.

| Library | License |
|---|---|
| [reveal.js](https://github.com/hakimel/reveal.js) | MIT |
| [markdown-it](https://github.com/markdown-it/markdown-it), markdown-it-attrs, markdown-it-container, markdown-it-bracketed-spans | MIT |
| [js-yaml](https://github.com/nodeca/js-yaml) | MIT |
| [highlight.js](https://github.com/highlightjs/highlight.js) (inside reveal.js's highlight plugin) | BSD-3-Clause |
| [Pretendard](https://github.com/orioncactus/pretendard) font | SIL Open Font License 1.1 |
| League Gothic, Source Sans Pro fonts (when using reveal.js built-in themes) | SIL Open Font License 1.1 |
| [Catppuccin](https://github.com/catppuccin/catppuccin), [Solarized](https://github.com/altercation/solarized) colors (themes) | MIT |
| [jsdom](https://github.com/jsdom/jsdom) (command-line packing only) | MIT |

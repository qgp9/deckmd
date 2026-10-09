# deckmd

English · [한국어](README.ko.md)

A reveal.js slide deck from a single Markdown file.
View it in the browser right away with no build step, and when you're done, pack it into one HTML file.

**Demo: [qgp9.github.io/deckmd](https://qgp9.github.io/deckmd/)** — the page itself is a deckmd deck; all examples are under [?deck-list](https://qgp9.github.io/deckmd/?deck-list).

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

## What it is

deckmd is three things put together.

### 1. Write in Markdown

A few bits of Markdown syntax on top of reveal.js.

- Split slides with `---`; put slide settings at the top of a slide with `<!-- class: chapter; tier: core -->`
- Attributes with `{.fragment}`, `{.class #id key=val}`, on part of a line with `[text]{.muted}`, and groups with `::: cols`
- Below `Note:` go the speaker notes, `<!-- @@ note -->` is a review note (`?draft`), and `?core` gives the short version
- reveal.js features (fragments, backgrounds, transitions, auto-animate, code line highlights) straight from Markdown
- Markdown without slide breaks (a README, say) is split by headings into a deck
- Add syntax with plugins (built in: cell diagrams with ```` ```grid ````)

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
python3 -m http.server           # any static web server; open http://localhost:8000/ and edit slides.md
```

When you're done, press **E** while viewing the deck → "Offline", or run `npx deckmd slides.md`. Commit the resulting file next to the deck; that is the frozen version.

`init` has two choices, each with a default:

| Option | |
|---|---|
| `--cdn` (default) / `--repo` | where deckmd comes from: the CDN, pinned to a version / a copy in `deckmd/` in your repository (works offline, you own the version) |
| `--single` (default) / `--multi` | one deck: `index.html` + `slides.md` / a talks repository, one folder per deck: `index.html`, `deck.config.js`, `slides/first-deck/deck.md` and a deck list as the home page |

`init` never overwrites: if any of the files (with `--repo`, also `deckmd/`) already exists, it stops and changes nothing. To do it by hand, or with a git submodule: [docs/usage.md](docs/usage.md).

In a `--multi` repository, add a deck with `npx deckmd add my-talk "My talk title"`: it creates `slides/my-talk/deck.md` from the starter, with the title and date filled in, and the deck shows up in the deck list.

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

---
title: Introducing deckmd
theme: reveal/league   # a reveal.js built-in theme
---

<!-- tier: core; class: chapter -->

###### Introducing deckmd

# One Markdown file becomes a slide deck

View it in the browser with no build step, and end up with one HTML file {.teaser}

Source: [examples/readme/rewrite.md](https://github.com/qgp9/deckmd/blob/main/examples/readme/rewrite.md) {.small .muted}

Note:
Let me introduce deckmd, a tool that turns a single Markdown file into a reveal.js slide deck.
This deck is an example made by asking an AI to restructure README.md as a presentation.

---

<!-- tier: core -->

## Three things every deck needs

::::: cols three
::: card hl
### Write
in Markdown
:::
::: card
### Template
shared by many decks
:::
::: card cool
### Keep
pack it into one HTML file
:::
:::::

Note:
deckmd is three things put together.
A Markdown syntax to write in, one set of templates shared by many decks, and packing, which freezes a finished deck into a single file.
Let's go through them in order.

---

<!-- tier: core; class: chapter -->

###### 1

# Write in Markdown

A few bits of syntax on top of reveal.js {.teaser}

---

<!-- tier: core -->

## One `---` line splits slides

```markdown
---
title: My first talk
theme: catppuccin
---

# My first talk

---

## Today

- Write in Markdown {.fragment}
```

Note:
Put the title and theme in the front matter at the top, and a line of three dashes between slides.
Three dashes inside a code block don't count as a slide break.

---

<!-- tier: core -->

## Attributes with `{…}`, groups with `:::`

::: fragments
- `{.fragment}`: appears on click
- `[text]{.muted}`: a class on part of the text
- `::: cols`: two columns side by side
- `<!-- class: chapter; tier: core -->` at the top of a slide: slide settings
:::

Note:
Attributes for an element go in braces at the end of a paragraph or list item; settings for a slide go in a comment at the top of the slide.
reveal.js features (fragments, backgrounds, transitions, auto-animate, code line highlights) work from Markdown the same way.

---

<!-- tier: core -->

## Notes, review notes, short version

| Write | Result |
|---|---|
| below `Note:` | speaker notes (`S` key) |
| `<!-- @@ note -->` | review note, only with `?draft` |
| `tier: core` | kept when opened with `?core` |

Note:
When your time slot shrinks, add ?core to the URL to open a short version with only the core slides.
This deck is written so the story still works with only its core slides.

---

<!-- tier: core -->

## A README becomes a deck as it is

- No slide breaks? It's **split by headings** into slides
- Too long goes into a "(cont.)" slide; still overflowing, the text shrinks
- Don't like it? Ask an AI to polish it 🙂

Note:
Markdown with no dash slide breaks at all is split by headings into a deck. Tune it with split and lines in the front matter or with URL options.
It follows a few rules, so it isn't perfect. If you want a polished deck, ask an AI. That's how this deck was made.

---

<!-- tier: core -->

## Add syntax with plugins

- One code block language, one diagram
- Built in: cell diagrams with ```` ```grid ````
- Turn it on with `plugins: [name]` in the front matter

Note:
Syntax like drawing a diagram from a code block language comes from plugins.
How to write one is in docs/plugins.md.

---

<!-- tier: core; class: chapter -->

###### 2

# Template

Many decks share one set of templates {.teaser}

---

<!-- tier: core -->

## The launcher page is one `<script>` line

```html
<script src="deckmd/js/boot.js"></script>
```

- `boot.js` finds the rest (themes, plugins, libraries)
- Libraries (reveal.js, markdown-it, fonts) come from a CDN

Note:
The index.html that opens a deck has just one tag that loads boot.js.
boot.js finds the other files relative to its own URL.

---

<!-- tier: core -->

## Three ways to set up

| Way | When |
|---|---|
| **Repository** (recommended) | your own talks repository, where talks keep piling up |
| **CDN** | right away, nothing to download |
| **Offline** | planes, closed networks |

Note:
The recommended way is to keep deckmd in your talks repository as a deckmd folder.
For the CDN, just point the boot.js tag at the CDN; this works once it's published on npm.
To work offline, download the libraries first with localize.mjs and add data-local to the tag.

---

<!-- tier: core -->

## Switch themes, keep the syntax

- Themes: `ember` (default), `catppuccin`, `solarized`, reveal.js built-in themes
- Light and dark modes
- Layout classes (`cols`, `card`, `chapter` …) and color variables are shared

Note:
Change the theme with one theme line in the front matter.
Layout classes and color variables are the same in every theme, so switching themes doesn't mean editing the Markdown.

---

<!-- tier: core -->

## Shared settings in one `deck.config.js`

```js
window.DeckConfig = {
  title: 'Talks',
  scan: ['talks/*'],   // folders to build the deck list from
  theme: 'ember',      // default for all decks
};
```

Note:
This config file sits next to the launcher page. It sets the defaults for all decks and the deck list.
A value written in a deck's front matter overrides the config.

---

<!-- tier: core; class: chapter -->

###### 3

# Pack

Freeze a finished deck into one HTML file {.teaser}

---

<!-- tier: core -->

## One E key, one file

::::: cols
::: card hl
### Offline
everything inside

opens without internet {.small .muted}
:::
::: card cool
### Share
libraries from a CDN

small file, needs internet {.small .muted}
:::
:::::

> Even if the template changes later, the deck still opens as it was {.fragment}

Note:
While viewing a deck, press E and choose Offline or Share to download the file.
Offline is about 4 MB plus your images, mostly the Pretendard font and code highlighting. Share is a few dozen KB plus your images.
Commit the resulting file next to the deck; that is the frozen version.

---

<!-- tier: core -->

## Same result from the command line

```bash
node deckmd/tools/build.mjs talks/x/talk.md          # offline
node deckmd/tools/build.mjs talks/x/talk.md --share  # share
npx deckmd talks/x/talk.md                           # without a deckmd folder
```

Note:
Use it to pack without a person at the browser, or to re-pack many decks at once from an agent or a script.
It opens the launcher page in jsdom as a browser would and runs the same code, so the result matches the E key.
It needs npm install once in the deckmd folder, and Node 22 or later.

---

<!-- tier: core -->

## Get your own files back out of a bundle

```bash
node deckmd/tools/build.mjs x.offline.html --unpack
```

- Comes out: Markdown, images, the deck's CSS and JS, `deck.config.js`
- Stays in: libraries and deckmd's own files

Note:
That's unpacking. Packing marks each file with where it came from, so only your files go back to their original places.

---

<!-- tier: core -->

## A few commands to start

1. `git submodule add <deckmd repository> deckmd`
2. Copy `index.html`, `deck.config.js`, `talk.md` from `templates/`
3. `deckmd/tools/serve.sh` → `http://localhost:8000/`
4. When done, **E** → "Offline"
{.steps-ol}

Note:
Add the template to your talks repository as a submodule, or copy it into a deckmd folder.
Copy the launcher page and config from templates to the top of your repository, and talk.md into a new folder under talks.
Start serve.sh and pick a deck at localhost 8000. On Windows it's serve.cmd. Edit the Markdown and reload.

---

<!-- tier: core -->

## Recap

::: fragments
- **Write**: one Markdown file, reveal.js features as they are
- **Template**: one `<script>` line; switch themes, keep the syntax
- **Keep**: one HTML file with the E key, and you can unpack it again
:::

Details in `docs/` {.small .muted}

Note:
The docs are in the docs folder: usage.md for usage, writing.md for syntax, packing.md for packing.

---

<!-- tier: core; class: chapter -->

# Thank you

MIT License {.teaser}

---

<!-- tier: backup; fit -->

## URL options

| Option | Meaning |
|---|---|
| `?src=path.md` | deck to open |
| `?deck-list` | deck list |
| `?core` | only `tier: core` slides (short version) |
| `?draft` | review notes as yellow sticky notes |
| `?mode=dark\|light\|auto` | light/dark mode (when the theme supports it) |
| `?split=headings&lines=10` | how to split Markdown without slide breaks by headings |
| `?pick` | pick a file even when served |
| `?print-pdf` | for printing (⌘/Ctrl+P → Save as PDF) |

---

<!-- tier: backup -->

## Shortcuts

| Key | Does |
|---|---|
| `→` `Space` | next |
| `S` | speaker view (notes, clock) |
| `Esc` `O` | overview |
| `F` / `B` | fullscreen / black screen |
| `E` | deckmd helper (mode, `?draft`·`?core`, PDF, pack) |

---

<!-- tier: backup -->

## Opening without a server

- Open `index.html` directly and you pick the Markdown file yourself the first time (button or drag and drop)
- Chrome and Edge remember the picked file and redraw as soon as you save
- Packing a deck opened this way leaves out the images, CSS and JS next to the deck

Note:
That's because browsers block pages at file URLs from reading neighboring files.
For a deck with images, open it like index.html?src=talks/x/talk.md and pick that file.

---

<!-- tier: backup; fit -->

## Licenses

| Library | License |
|---|---|
| reveal.js, markdown-it (+ plugins), js-yaml, jsdom | MIT |
| highlight.js | BSD-3-Clause |
| Pretendard, League Gothic, Source Sans Pro fonts | SIL Open Font License 1.1 |
| Catppuccin, Solarized colors (themes) | MIT |

deckmd is MIT. A bundled file lists the libraries it contains, with license links, in a comment at the top {.small .muted}

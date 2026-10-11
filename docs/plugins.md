# Plugins

Plugins add what Markdown cannot do (diagram syntax, post-processing slides, behavior when a slide is shown). A plugin is just a script.

```yaml
plugins: [grid]            # a name → deckmd's plugins/grid/grid.js
plugins: [./my.js]         # a path → relative to this Markdown file (starting with / → relative to the launcher page)
```

The lists from the front matter and from `deck.config.js` are merged (the same file only once). When packing, plugins and the CSS they load go in too.

## Built-in: grid

Diagrams made of cells laid out N×M: arrays, memory, boards, calendars, seating charts. The same cells can also be drawn as a table with data in it (see [Data and tables](#data-and-tables)). Example deck: [`examples/grid/`](../examples/grid/talk.md).

````markdown
```grid {size=2x8 index id=mem}
0        list   accent !      // cell spec · text · color · ! (highlight)
1-3      A#     cool          // # = running number within this line → A1 A2 A3
B2:D2    "two words" bad      // Excel-style rectangle. Quote text containing spaces
8> 3 4 end! · 7               // fill in order from cell 8. A trailing ! highlights that cell
```
````

**One line** = `cell-spec [text] [color] [!]`. Later lines override earlier ones. A color without text changes only the color and keeps the text.

| Cell spec | Meaning |
|---|---|
| `5`, `1-3`, `2,5,6` | Cell numbers. Left → right, top → bottom, from 0 (from 1 with `start=1`). Spaces after commas are allowed. A range goes up (`3-1` is an error) |
| `B2`, `B2:C5` | Excel-style cell or rectangle (A1 is the first cell, always 1-based) |
| `3:3`, `2:4` | Whole rows (needs `size`) |
| `C:C`, `B:D` | Whole columns (needs `size`) |
| `8> a b c` | Fill in order from cell 8. A trailing `!` as in `end!` highlights that cell; `_` is an empty cell |

| Other | Meaning |
|---|---|
| Text `_` | Clear the text |
| `\#` | A literal `#`, not a running number |
| Color | `accent` `cool` `good` `bad` `warn` `muted` (theme variables, so they fit any theme), or a color value such as `#c792ea`. To use one of these names as text, quote it (`"bad"`) |
| `!` | Highlight border |

| Header `{…}` | Meaning |
|---|---|
| `size=RxC` | Rows × columns. Without it, `cols=16` and the row count fits the cells used |
| `index` | Show cell numbers |
| `head` | Column letters (A B C …) and row numbers |
| `start=1` | Number cells from 1 |
| `h=90` | Cell height (px, default 76). Text size scales with it |
| `id=mem` | Gives each cell `data-id="mem-number"`. If the neighboring slides use `auto-animate`, matching cells animate into each other (default `g`; use different ids for two grids on one slide) |

A malformed line shows a red box in its place that says which line is wrong.

### Data and tables

Lines that start with `|` are **data**: a Markdown table whose cells fill the grid (`**bold**`, `` `code` `` and links work in them). The other lines are the commands above, applied on top, in any order among the data lines. Without `size` the grid is as big as the data.

````markdown
```table
| Name  | Q1 | Q2     |
|:------|---:|-------:|
| Alpha | 10 | 12     |
| Beta  | 7  | **15** |

B3 !            // Excel-style addresses: the header row is row 1
C2:C3 good
A2:A3 accent
```
````

- `` ```grid `` draws `<div>` cells. `` ```grid {as=table} `` draws a real `<table>`, and `` ```table `` is the same thing: text wraps, columns size to their content, and it copies, prints and reads out like a table. Colors, `!`, `id` and `data-id` (auto-animate) work in both.
- The first data row is the **header** (`<thead>`) when the second line is a `|---|` line. That line also sets the alignment: `:---` left, `:---:` center, `---:` right. It is not a row; cell addresses count the header as row 1.
- Text typed in a command line (`A1 hello`) is plain text; text from the data lines is Markdown.
- `size` can be bigger than the data (empty cells) but not smaller. `index`, `head` and `h` are for the `<div>` grid; a table ignores them. (`start` still sets where the plain cell numbers `5`, `1-3` begin; Excel-style addresses are not affected.)
- A table that is already written as plain Markdown (or `<table>`) is not converted. Write it in the fence, or color a cell of it with `{.y}` `{.n}` `{.m}` at the end of the cell text.

## Built-in: source

Shows, under each slide, the Markdown that made it: press **↓** (the slide below the slide). For example decks and tutorials ("this syntax gives this slide") without copying the source into the deck, so the two can't drift apart.

```yaml
plugins: [source]
```

- The first slide that has a source has two pages under it: the **front matter** (the `--- … ---` settings at the top of the file), then its source. (If the first slide is `source: off`, the next one carries the front matter.)
- The source slide has the slide as written: its settings comment (`<!-- class: center -->`) and content, **without the speaker notes**. It is highlighted as Markdown.
- Off for one slide: `<!-- source: off -->` in that slide (it can go with other settings: `<!-- class: center; source: off -->`). Off for a viewing: add `?source=off` to the address. Off for the whole deck: don't list the plugin; then no code of it is loaded.
- Slide numbers don't change (a source slide is a vertical slide: ↓, not →). Moving sideways always starts at the top slide of the next stack, never at a source you looked at last; going to a source on purpose (↓, a link such as `#/3/1`, the back button) works.
- `?core` cuts a slide together with its source. A deck written in HTML has no Markdown, so it gets none; a slide that is already a vertical stack (raw `<section>`s inside it) is left alone, since reveal.js has only two levels.
- Printing (`?print-pdf`) prints the source slides too, as vertical slides do. Add `?source=off` to leave them out.
- There is no button for it in the helper panel (E): it is something the deck's author turns on.

## Built-in: math

TeX in Markdown, drawn with [KaTeX](https://katex.org). Example deck: [`examples/math/`](../examples/math/talk.md).

```yaml
plugins: [math]
```

````markdown
Euler: $e^{i\pi} + 1 = 0$ in a sentence, and as a block:

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$
````

- `$…$` and `\(…\)` in a sentence; `$$…$$` and `\[…\]` as a block (a line that starts with `$$`, up to the line that ends with `$$`; one line is enough) or inside a sentence.
- A formula reaches KaTeX as written: `_`, `*` and `\` inside it are not Markdown. Code spans and code blocks are never touched.
- **Money is not math.** A single `$` opens a formula only when no space follows it, and closes it only when no space comes before it and no digit follows ("it costs $5 and $10" stays text). Write `\$` for a dollar sign that would otherwise start a formula.
- A formula KaTeX can't read stays in place as the TeX you wrote, in red, with the message as its tooltip (and in the console); the rest of the deck is fine.
- In the front matter: `math: { output: htmlAndMathml, macros: { '\RR': '\mathbb{R}' } }`. `output` is `htmlAndMathml` (default: the same look in every browser, and MathML for screen readers), `html`, or `mathml` (the browser draws it: no CSS and no fonts, a smaller bundle, a look that depends on the browser). `macros` are KaTeX macros.
- KaTeX (the JS, the CSS and its fonts, woff2 only: about 0.5 MB) is loaded only when the Markdown has a formula in it, found with the same rules that draw one: money (`$5 and $10`), `\$` and code don't count. Like every library: `data-local` loads it from `vendor/` (`node tools/localize.mjs` always downloads it), and packing embeds it (offline) or keeps the CDN files (share), **only for a deck that has a formula**: an offline bundle of a deck without one doesn't contain KaTeX.

## Writing a plugin

Put it at `plugins/<name>/<name>.js` (inside deckmd), or in a JS file at any path. It registers syntax with `DeckMD`.

```js
// plugins/hello/hello.js — render ```hello code blocks as a diagram
DeckMD.loadCSS('hello.css');                       // CSS next to this file (all loaded before the deck starts)
DeckMD.registerFence('hello', (code, attrs) => `<div class="hello">${DeckMD.esc(code)}</div>`);
DeckMD.afterRender(section => { /* adjust the slide after it is built */ });
// DeckMD.init(deck => deck.md.use(...)) — markdown-it, the front matter and the source exist once init runs (see below)
```

| API | What it does |
|---|---|
| `DeckMD.registerFence(lang, (code, attrs, token) => HTML)` | Turns code blocks of that language into HTML. `{key=val}` in the code block header arrives as `attrs` (```` ```grid {size=4x8 index} ````). A thrown error is shown in place as a red box |
| `DeckMD.afterRender((section, deck) => …)` | After a slide is built (before reveal.js starts) |
| `DeckMD.sources` | A `WeakMap`: slide `section` → the Markdown it was made from (settings comment + content, without the notes). Empty for slides of a deck written in HTML |
| `DeckMD.registerRun(name, section => cleanup)` | Every time a slide with the slide setting `run: name` is shown. The returned function is called on leaving ([interactive.md](interactive.md)) |
| `DeckMD.loadCSS(path)` | CSS next to the plugin itself |
| `DeckMD.init(deck => …)` | Runs `fn` once the deck's data exists: `deck.md` (the markdown-it instance), `deck.config` (this deck's front matter) and `deck.source`. Use it for anything that needs them: when the plugin is inside a bundled file it runs while the page is read, before they exist (from a server it runs later, so it would work by luck). Declaring things (`registerFence`, `afterRender`, `loadCSS`, `register`) needs no `init` |
| `DeckMD.register({ libs: [url, …], load: 'auto' \| 'manual' })` | Declares the libraries the plugin needs from the internet. Put it at the very top of the plugin file, with the URLs written out in full (no template strings): `node tools/localize.mjs` runs the file in a sandbox to learn what to download into `vendor/`. `load: 'auto'` (default): deck.js loads them in this order, CSS and JS, once each, before the slides are built. `'manual'`: only declared; the plugin loads them when it wants (only for some decks, or depending on a setting: the math plugin loads KaTeX only when the Markdown has a formula, and no CSS for `output: mathml`). It returns a handle `{ libs, css, js }` (the URLs) to give to `DeckMD.load`: `const katex = DeckMD.register({ … });` then `DeckMD.load(katex)` or `DeckMD.load(katex.js)` |
| `DeckMD.load(url \| [url, …] \| handle)` | Loads libraries, in order (each URL once; returns a promise). The handle is what `DeckMD.register` returned. It uses `vendor/` with `data-local`, and is recorded, so packing embeds it (offline) or keeps the CDN URL (share). A plugin can add its license with `DeckNotices.list.push({ name, spdx, match })` |
| `DeckMD.md`, `DeckMD.config`, `DeckMD.source` | markdown-it, the front matter, the Markdown text. Not there yet while a plugin file in a bundled file is read: use `DeckMD.init` |
| `DeckMD.esc(text)` | HTML escape |
| `DeckMD.version` | The deckmd version (a string like `'0.2.0'`). For information (messages such as "requires deckmd 0.2 or later", bug reports) |

- A plugin that must work across deckmd versions should check for the feature it needs instead of comparing version numbers: `if (!DeckMD.registerRun) { … }`. Comparing version strings is error-prone (`'0.10' < '0.9'`).
- Paths can be written as literal strings or computed (when packing, what was actually loaded is recorded and embedded).
- Buttons and JS that runs when a slide is shown: see [interactive.md](interactive.md).
- For a plugin shared by several decks, put it in your own repository's `plugins/<name>/` and reference it relative to the launcher page, like `plugins: [/plugins/x/x.js]`, so it survives updating `deckmd/`.

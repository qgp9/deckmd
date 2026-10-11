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
- The source slide has the slide as written in the file: its settings comment (`<!-- class: center -->`) and content, **without the speaker notes**. It is highlighted as Markdown. A deck with no `---` breaks (a README) is split by headings, and each slide shows the lines of the file it was made from, not the text deckmd built for it (`<!-- fit -->` and a repeated title for a "(cont.)" slide).
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
| `DeckMD.slideInfo` | A `WeakMap`: slide `section` → `{ startLine, endLine, source, notes }`: where the slide is in the Markdown file. `startLine`..`endLine` are 1-based, inclusive, from the first to the last non-blank line the slide was made from (the front matter's lines count, so they are line numbers of the file). `source` is those lines as written (settings comment, content and speaker notes), `notes` the speaker notes alone, and `withoutNotes` the lines as written minus the notes. `source`, `notes` and `withoutNotes` are worked out when you read them (getters), so a deck that nobody asks about pays for the two line numbers only; read what you need rather than spreading the object (`{ ...info }` reads everything at once). For a deck split by headings (no `---`), a slide covers its heading and the blocks under it. Not set for slides of a deck written in HTML |
| `DeckMD.slides()` | The slides of the page in order, the `slideInfo` objects themselves: `{ section, startLine, endLine, source, notes }` (slides made from Markdown only: a `?core` cut is gone, and the slides that plugins like `source` add are not in it) |
| `DeckMD.slideAt(line)` | The `slideInfo` of the slide at a line of the file: the one whose lines contain it; a line between slides (blank, `---`, front matter) gives the next slide, and a line after the last gives the last. `null` if there are no slides or the line is not a number |
| `DeckMD.currentSlide()` | The `slideInfo` of the slide being shown. On a slide a plugin put next to it (a source slide of the `source` plugin) it is the slide it belongs to |
| `DeckMD.outline(text)` | The structure of a Markdown text without showing it: `{ ok: true, meta, frontMatter, split, slides: [{ startLine, endLine, attrs }] }`, where `attrs` is the slide's settings comment (`<!-- class: chapter; tier: core -->` → `{ class: 'chapter', tier: 'core' }`). `{ ok: false, error }` for a YAML error in the front matter. Made by the same split a load makes, so an editor's outline of unsaved text agrees with what is shown |
| `DeckMD.setSource(text, { line })` | Show new Markdown without reloading (a live preview for an editor). The slides are built again from the text; the slide being shown stays, or the one at `line` if given. Returns `{ ok: true, slides }`, `{ ok: false, error }` (a YAML error, not a Markdown deck, not shown yet) or `{ ok: false, reload: true, error }` when the front matter changed (theme, css, plugins, size … are read once at load, so save the file and reload). On `ok: false` nothing has changed, also when a plugin or a fence throws while the slides are built (the slides shown before are put back; state a plugin reset in `beforeRender` stays reset). The front matter is compared with line endings made alike, so an editor that keeps `\n` in a `\r\n` file does not get a `reload`. `DeckMD.source` becomes the new text |
| `DeckMD.beforeRender(({ update }) => …)` | Before the slides are built: on load (`update: false`) and before every `setSource` (`update: true`). Reset the state your plugin keeps between slides here (a counter, "the first slide gets X"). `afterRender` runs again for every slide on every `setSource`, since the slides are built from nothing each time |
| `DeckMD.source` | The whole Markdown file as text (front matter and notes included). `null` for a deck written in HTML |
| `DeckMD.frontMatter` | The front matter as written (`---` … `---`), `''` if there is none |
| `DeckMD.registerRun(name, section => cleanup)` | Every time a slide with the slide setting `run: name` is shown. The returned function is called on leaving ([interactive.md](interactive.md)) |
| `DeckMD.loadCSS(path)` | CSS next to the plugin itself |
| `DeckMD.init(deck => …)` | Runs `fn` once the deck's data exists: `deck.md` (the markdown-it instance), `deck.config` (this deck's front matter) and `deck.source`. Use it for anything that needs them: when the plugin is inside a bundled file it runs while the page is read, before they exist (from a server it runs later, so it would work by luck). Declaring things (`registerFence`, `afterRender`, `loadCSS`, `register`) needs no `init` |
| `DeckMD.register({ libs, files, load })` | Declares what the plugin needs. Put it at the very top of the plugin file, written out in full (no template strings or variables): `node tools/localize.mjs` runs the file in a sandbox to learn what to download into `vendor/`. See [Declaring libraries](#declaring-libraries). It returns a handle to give to `DeckMD.load`: `{ libs, css, js }` (all the URLs) and one such object per named library (`lib.katex.js`) |
| `DeckMD.load(url \| [url, …] \| handle)` | Loads libraries, in order (each URL once; returns a promise). The handle is what `DeckMD.register` returned (or a part of it: `lib.katex`, `lib.katex.js`). It uses `vendor/` with `data-local`, and is recorded, so packing embeds it (offline) or keeps the CDN URL (share). A plugin can add its license with `DeckNotices.list.push({ name, spdx, match })` |
| `DeckMD.md`, `DeckMD.config`, `DeckMD.source` | markdown-it, the front matter, the Markdown text. Not there yet while a plugin file in a bundled file is read: use `DeckMD.init` |
| `DeckMD.esc(text)` | HTML escape |
| `DeckMD.version` | The deckmd version (a string like `'0.2.0'`). For information (messages such as "requires deckmd 0.2 or later", bug reports) |

- `setSource` builds every slide again: about 7 ms for the 11-slide syntax example and about 60 ms for a 500-slide deck (Chrome, on the author's machine; several times that when the machine is busy). An editor should still wait a moment after typing before it calls it. What lives in the old slide elements (fragment progress, a running animation, a `run:` function's state) starts over; the plugins' `afterRender` hooks run as on a fresh load.
- A plugin that must work across deckmd versions should check for the feature it needs instead of comparing version numbers: `if (!DeckMD.registerRun) { … }`. Comparing version strings is error-prone (`'0.10' < '0.9'`).
- Paths can be written as literal strings or computed (when packing, what was actually loaded is recorded and embedded).
- Buttons and JS that runs when a slide is shown: see [interactive.md](interactive.md).
- For a plugin shared by several decks, put it in your own repository's `plugins/<name>/` and reference it relative to the launcher page, like `plugins: [/plugins/x/x.js]`, so it survives updating `deckmd/`.

### Declaring libraries

```js
const lib = DeckMD.register({
  libs: {
    katex: { npm: 'katex@0.18.7', files: ['dist/katex.min.css', 'dist/katex.min.js'], compat: 'exact', load: 'manual' },
    // another: { github: 'user/repo@v1.2.3', files: ['dist/x.js'], compat: '^1.2' },
  },
  files: ['math.css'],                          // the plugin's own CSS, next to the plugin file
});
DeckMD.load(lib.katex);                         // later, when the plugin wants it
```

- A library is `npm: 'name@version'` or `github: 'user/repo@tag'` with `files` (paths inside the package). deckmd turns them into jsDelivr URLs, the same way for the browser, `localize` and packing. The version is required: a library without one cannot be pinned, localized or checked.
- `load: 'auto'` (default): deck.js loads them in this order, CSS and JS, once each, before the slides are built. `'manual'`: only declared; the plugin loads them when it wants (the math plugin loads KaTeX only when the Markdown has a formula, and no CSS for `output: mathml`). It can be set on a library or on the whole call.
- `files` (outside `libs`) are the plugin's own CSS files, relative to the plugin file; only `.css` is supported.
- The older form still works: `libs: ['https://cdn.jsdelivr.net/npm/x@1.2.3/dist/x.min.js', …]`, a list of URLs written out in full.
- One version of a library per page. If another plugin (or a `DeckMD.load` of a jsDelivr URL) uses the same library in a different version, it is an error that names both. Two plugins that want the same version share one download.
- `compat` is **required** for a named library, and is **Reserved: not active yet; declaring it now helps avoid conflicts later.** It says how this plugin would accept another version of the library. Write `'exact'` when unsure, and for a library that has no semver versions; `'none'` or `''` mean no policy; a range (`'^1.2'`, `'~1.2.3'`) says which versions would also do. Today the only checks are that a range agrees with the library's own version (`katex@0.18.7` with `compat: '^0.17'` is an error) and that two different versions of one library are an error. Picking one version that fits every plugin comes later.

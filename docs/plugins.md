# Plugins

Plugins add what Markdown cannot do (diagram syntax, post-processing slides, behavior when a slide is shown). A plugin is just a script.

```yaml
plugins: [grid]            # a name → deckmd's plugins/grid/grid.js
plugins: [./my.js]         # a path → relative to this Markdown file (starting with / → relative to the launcher page)
```

The lists from the front matter and from `deck.config.js` are merged (the same file only once). When packing, plugins and the CSS they load go in too.

## Built-in: grid

Diagrams made of cells laid out N×M: arrays, memory, boards, calendars, seating charts. Example deck: [`examples/grid/`](../examples/grid/talk.md).

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
| `5`, `1-3`, `2,5,6` | Cell numbers. Left → right, top → bottom, from 0 (from 1 with `start=1`). Spaces after commas are allowed |
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

## Writing a plugin

Put it at `plugins/<name>/<name>.js` (inside deckmd), or in a JS file at any path. It registers syntax with `DeckMD`.

```js
// plugins/hello/hello.js — render ```hello code blocks as a diagram
DeckMD.loadCSS('hello.css');                       // CSS next to this file (all loaded before the deck starts)
DeckMD.registerFence('hello', (code, attrs) => `<div class="hello">${DeckMD.esc(code)}</div>`);
DeckMD.afterRender(section => { /* adjust the slide after it is built */ });
// DeckMD.md is the markdown-it instance — DeckMD.md.use(...) works too
```

| API | What it does |
|---|---|
| `DeckMD.registerFence(lang, (code, attrs, token) => HTML)` | Turns code blocks of that language into HTML. `{key=val}` in the code block header arrives as `attrs` (```` ```grid {size=4x8 index} ````). A thrown error is shown in place as a red box |
| `DeckMD.afterRender((section, deck) => …)` | After a slide is built (before reveal.js starts) |
| `DeckMD.registerRun(name, section => cleanup)` | Every time a slide with the slide setting `run: name` is shown. The returned function is called on leaving ([interactive.md](interactive.md)) |
| `DeckMD.loadCSS(path)` | CSS next to the plugin itself |
| `DeckMD.md` | The markdown-it instance |
| `DeckMD.config` | This deck's front matter |
| `DeckMD.esc(text)` | HTML escape |
| `DeckMD.version` | The deckmd version (a string like `'0.2.0'`). For information (messages such as "requires deckmd 0.2 or later", bug reports) |

- A plugin that must work across deckmd versions should check for the feature it needs instead of comparing version numbers: `if (!DeckMD.registerRun) { … }`. Comparing version strings is error-prone (`'0.10' < '0.9'`).
- Paths can be written as literal strings or computed (when packing, what was actually loaded is recorded and embedded).
- Buttons and JS that runs when a slide is shown: see [interactive.md](interactive.md).
- For a plugin shared by several decks, put it in your own repository's `plugins/<name>/` and reference it relative to the launcher page, like `plugins: [/plugins/x/x.js]`, so it survives updating `deckmd/`.

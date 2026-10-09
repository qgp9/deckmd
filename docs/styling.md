# Styling (themes, CSS, variables)

Styling has two layers.

1. **reveal.js styling** — reveal.js themes and their variables (`--r-*`), and the classes reveal.js provides. deckmd uses them as is.
2. **What deckmd adds** — layout classes (`css/base.css`), theme directories (`ember`, `catppuccin`, `solarized`), color variables (`--bg`, `--accent` …), code colors, light/dark mode, `css:` and `style:`.

For fonts see [fonts.md](fonts.md); for syntax, [writing.md](writing.md).

## Choosing a method

There are five methods, each with a different **scope**.

| Method | Scope | Where | When |
|---|---|---|---|
| Class on a slide or element | That slide / that element | Markdown body | `<!-- class: center -->`, `{.small .muted}`, `::: card hl` |
| `<style>` | One deck | Markdown body | You want a bit of CSS right next to the text |
| `style:` | One deck, or all | Front matter / `deck.config.js` | Changing just a few variables like colors or fonts (most common) |
| `css:` | One deck, or all | Front matter / `deck.config.js` | Long CSS, or you need font or image files (`url(…)`) |
| `theme:` | One deck, or all | Front matter / `deck.config.js` | Replacing the whole look (e.g. a company template) |

- Just a color, a font, or a size → one line of `style:`.
- Long enough for a file, or needs font/image files → a `css:` file.
- Same look for other decks, different from top to bottom → make a theme.
- `theme:` **replaces** the default theme. Using `theme:` to change just one part makes the rest of the look disappear with it.

Order of application (later wins):

```
reveal.css → css/base.css → theme → config css → front matter css → config style → front matter style → <style> in Markdown
```

With equal selector specificity, the later one wins. If something doesn't take effect, check the order; if that doesn't help, make the selector more specific (`.reveal h2`).

## 1. reveal.js styling

### reveal.js built-in themes

Use `theme: reveal/<name>`: `black` `white` `league` `beige` `night` `serif` `simple` `solarized` `moon` `dracula` `sky` `blood` `black-contrast` `white-contrast` ([previews](https://revealjs.com/themes/)).

```yaml
theme: reveal/white
```

- Loaded from the same place as the page's reveal.css (CDN, or `vendor/` with `data-local`). Packing for offline puts it inside the file; share keeps it as a CDN link.
- deckmd's layout classes (`cols`, `card` …) work too. Their colors are derived from the theme's `--r-*` values (see "Color variables" below).
- Theme-specific looks such as uppercase headings stay as they are. If the theme's font has no Hangul, Korean text falls back to a substitute font.

### reveal.js variables (`--r-*`)

reveal.js themes are painted with CSS variables. deckmd themes set the same variables, and `base.css` applies them (since reveal.css itself doesn't use the variables).

| Variable | Meaning |
|---|---|
| `--r-background-color` | Background |
| `--r-main-font`, `--r-main-font-size`, `--r-main-color` | Body font, size, color (size is 44px at 1920x1080) |
| `--r-heading-font`, `--r-heading-color`, `--r-heading-font-weight`, `--r-heading-letter-spacing` | Headings |
| `--r-code-font` | Code font |
| `--r-link-color` | Links |
| `--r-selection-background-color`, `--r-selection-color` | Selected text |

### reveal.js classes and settings

- Fragment styles: `{.fragment .fade-up}`, `.grow`, `.highlight-red` … ([fragments](https://revealjs.com/fragments/))
- Layout: `.r-fit-text` (fit text to the slide width), `.r-stretch` (fill the remaining height), `.r-stack` (stack on top of each other) ([layout](https://revealjs.com/layout/))
- Margins, transitions, slide numbers, and the progress bar are reveal.js settings in `reveal: { … }` (slide width and height are deckmd's `size:`). E.g. `reveal: { slideNumber: false, progress: false }`.

## 2. What deckmd adds

### Themes

One theme = one directory (`themes/<name>/<name>.css`).

| Theme | Default mode | Other mode | |
|---|---|---|---|
| `ember` (default) | Dark | Light | Navy background, orange accent, Monokai code colors |
| `catppuccin` | Dark (Mocha) | Light (Latte) | [Catppuccin](https://catppuccin.com) colors |
| `solarized` | Light | Dark | [Solarized](https://ethanschoonover.com/solarized) colors |

A theme only sets **colors, fonts, background, and decoration**; layout is done by `css/base.css`. So syntax like `::: cols` keeps working when you switch themes.

### Layout classes (`css/base.css`)

Always loaded first, whichever theme you use.

`.center`, `.muted`, `.small`, `.tiny`, `.big`, `.huge`, `.cols` (`.three`, `.wide-left`, `.wide-right`, `.mid`), `.card` (`.hl`, `.cool`), `.statement`, `.chapter` (`######` marks the step, `{.teaser}` the subtitle), `.message`, `.quote`, `.flow`, `.timeline`, `.steps-ol`, and `svg.dg` for diagram SVGs.

```markdown
<!-- class: center -->          class on the whole slide (centered)
<!-- bg: #223 -->               slide background (color or image path)

## Heading {.muted}              class on an element
At the end of a paragraph {.small}

::::: cols                       block: any name becomes a class
::: card hl                      card + highlighted border
...
:::
:::::
```

To use a class that doesn't exist (`.mybox`), define it in `style:` or `css:`. Examples in [`examples/syntax/talk.md`](../examples/syntax/talk.md).

### Color variables

Change a value on `:root` and it spreads everywhere. The full list with descriptions is in the comment at the top of [`css/base.css`](../css/base.css).

| Variable | Meaning |
|---|---|
| `--bg`, `--bg-2`, `--bg-3`, `--line` | Background, card background, chip background, lines |
| `--text`, `--muted`, `--h3-color` | Body text, muted text, subheadings |
| `--accent`, `--cool` | Accent color (`**bold**`, numbers, etc.), secondary color (`*italic*`, links) |
| `--good`, `--bad`, `--warn` | Table `td.y`, `td.n`, `td.m`, etc. |
| `--on-accent` | Text on an accent-colored background |

```yaml
---
style: |
  :root {
    --accent: #c92000;
    --r-main-font-size: 40px;
  }
---
```

If a theme doesn't set these variables, they are derived from the reveal.js variables (`--bg` ← `--r-background-color`, `--accent` ← `--r-link-color` …). That's why the reveal.js built-in themes go well with deckmd classes.

### Code colors

Code block colors are set with variables. If unset, you get Monokai colors on a dark box.

| Variable | Colors |
|---|---|
| `--code-bg`, `--code-fg` | Code box background and text |
| `--hl-keyword` | Keywords, tags |
| `--hl-string` | Strings, regexes |
| `--hl-number` | Numbers, literals like `true` and `null` |
| `--hl-comment`, `--hl-comment-style` | Comments (`italic`, etc.) |
| `--hl-function`, `--hl-type` | Function names, type and class names |
| `--hl-attr`, `--hl-variable` | Attributes and keys, variables and parameters |
| `--hl-meta`, `--hl-link`, `--hl-deletion`, `--hl-punct` | Everything else |

```yaml
style: ":root { --hl-keyword: #ff79c6; --hl-string: #f1fa8c; }"
```

### Light/dark mode

`mode` can be set in the config (`deck.config.js`), the front matter, or the URL (`?mode=light`) (priority: URL > front matter > config). You can also switch it in the E-key helper.

| Value | Meaning |
|---|---|
| `dark`, `light` | Fixed |
| `auto` | Decided by the OS setting (`prefers-color-scheme`) at open time. It does not follow OS changes while the deck stays open |
| Not set | The theme's default mode |

`deck.js` only adds `<html data-mode="dark|light">`. **Whether a mode is supported is up to the theme**: it puts its default mode's values on `:root` and overrides them for the other mode with `:root[data-mode="…"]`. Supported modes are declared with `--deck-modes` (first one is the default; the helper panel reads this to show the toggle button).

```css
/* A theme that's light by default and also supports dark mode */
:root { --deck-modes: light dark;
        --bg: #fff; --text: #1b2330; /* … */ }
:root[data-mode="dark"] { --bg: #0e1117; --text: #e9edf3; /* … */ }
```

If the deck's CSS (`css:`, `style:`, `<style>`) hard-codes colors, those parts won't follow the mode. Use variables (`var(--bg)`, etc.).

### Writing paths

Paths for `theme`, `css`, `plugins`, and images and links follow the same rules.

| Value | Relative to |
|---|---|
| `ember` (bare name, theme/plugins) | The one inside deckmd (`deckmd/themes/ember/ember.css`) |
| `my/x.css`, `../x.css` | The file where it's written (front matter = that Markdown, `deck.config.js` = `index.html`) |
| `/themes/x.css` | **Where `index.html` is** (not the server root) |

For theme only, you may give a directory. If the last part has no extension, it means `<name>.css` inside it: `/themes/my` → `/themes/my/my.css`.

CSS for a single deck goes next to the Markdown as `css: [my.css]`; CSS shared by several decks goes next to `index.html` with `css: ['themes/my.css']` in `deck.config.js`.

### Making a theme

The easiest way is to copy `themes/ember/`, rename it, and change the values. The entry CSS needs:

1. **Variable values** (`:root { … }`): the "variables a theme must define" at the top of `css/base.css`; for code colors, just the `--hl-*` ones.
2. **Background**: `html, body, html.reveal-full-page, html.reveal-full-page body, .reveal-viewport { background: var(--bg); color: var(--text); }` (so the background is painted in `?print-pdf` too)
3. (Optional) modes: `--deck-modes` and `:root[data-mode="…"]`, fills for diagram SVGs (`.dg .box.dim`, etc.), decoration like logos.

Put logo and font files and split-out CSS (`@import`) in the same directory and refer to them with relative paths. Keep themes for your own repository next to `index.html` and refer to them by path (so they don't disappear when you update `deckmd/`).

```js
// deck.config.js
theme: 'themes/my',              // = themes/my/my.css
```

### Common tasks

| Want to | How |
|---|---|
| Change only the accent color | `style: ":root { --accent: #0a7; }"` |
| Change one code color | `style: ":root { --hl-keyword: #ff79c6; }"` |
| Make text a bit bigger | `style: ":root { --r-main-font-size: 48px; }"` |
| Change fonts, or skip downloading them | [fonts.md](fonts.md) |
| Hide slide numbers and the progress bar | Front matter `reveal: { slideNumber: false, progress: false }` |
| Change slide size (aspect ratio) | Front matter `size: 1280x720` (CSS px values are relative to this size too) |
| Change the background of one slide | `<!-- bg: #223 -->` |
| Light/dark mode | `mode: light`, `mode: dark`, `mode: auto` (when the theme supports it) |

### When packing

- `url(…)` and `@import` in theme and `css:` files are included in the file when packing (both offline and share).
- `url(…)` inside `style:` or `<style>` is not included. If you need font or image files, put them in a `css:` file.
- Text-only `style:` and `<style>` live in the Markdown, so they're bundled as is.

For details, see [packing.md](packing.md).

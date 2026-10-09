# Writing slides

A deckmd deck is one Markdown file. markdown-it turns that Markdown into HTML, which is split into slides (`<section>`) and handed to reveal.js. So there are two sides to writing:

1. **What reveal.js does** — slide navigation, step-by-step reveals, speaker notes, backgrounds, transitions, code highlighting, and so on. deckmd just makes them usable from Markdown.
2. **What deckmd adds** — front matter, slide settings comments, `:::` blocks, `{…}` attributes, review notes, the short version (`?core`), split by headings, plugin syntax.

[`examples/syntax/talk.md`](../examples/syntax/talk.md) is the manual (it is itself a deck). For looks, see [styling.md](styling.md).

```markdown
---
title: Talk title
---

# Talk title

[Name · 2026.11.20]{.muted}

Note:
From here to the end of the slide: speaker notes (S key).

---

<!-- tier: core -->

## First slide

- Item one {.fragment}
- Item two {.fragment}
```

## 1. reveal.js features from Markdown

Most reveal.js features are turned on with **classes or `data-` attributes**. In deckmd you use `{…}` to attach them to an element, and the slide settings comment `<!-- … -->` to attach them to a slide (`<section>`) (see section 2). For the features themselves, see the [reveal.js docs](https://revealjs.com/).

| reveal.js feature | In deckmd | In reveal.js |
|---|---|---|
| Slides | Separate with a single `---` line | `<section>` |
| Step-by-step reveals ([fragments](https://revealjs.com/fragments/)) | `{.fragment}` at the end of an item or paragraph; style with `{.fragment .fade-up}`, order with `{.fragment data-fragment-index=2}`. Wrap a whole list in `::: fragments` | `class="fragment"` |
| Speaker notes ([speaker view](https://revealjs.com/speaker-view/)) | Everything below a `Note:` line in the slide → `S` key | `<aside class="notes">` |
| Backgrounds ([backgrounds](https://revealjs.com/backgrounds/)) | `<!-- bg: #223 -->`, `<!-- bg: img/photo.jpg -->`, `<!-- bg: img/clip.mp4 -->` (video). Other background attributes: `<!-- background-size: contain; background-opacity: 0.3 -->`. Paths are relative to the Markdown and get included when packing | `data-background-color`, `data-background-image`, `data-background-video`, `data-background-*` |
| Transitions ([transitions](https://revealjs.com/transitions/)) | Per slide `<!-- transition: zoom -->`, whole deck via front matter `reveal: { transition: slide }` | `data-transition` |
| Auto-animate ([auto-animate](https://revealjs.com/auto-animate/)) | `<!-- auto-animate -->` on adjacent slides, `{data-id=t}` on elements to pair | `data-auto-animate`, `data-id` |
| Code highlighting ([code](https://revealjs.com/code/)) | ```` ```js ```` code blocks. Line numbers and step highlights: ```` ```js {data-line-numbers="1-2|4"} ```` | `<pre><code data-line-numbers>` |
| Layout helpers ([layout](https://revealjs.com/layout/)) | `{.r-fit-text}`, `::: r-stack`, `{.r-stretch}` | Same classes |
| Other slide attributes | `<!-- name: value -->` becomes `data-name` (`visibility: hidden`, `autoslide: 2000` …) | `data-*` |
| Config ([config](https://revealjs.com/config/)) | `reveal: { … }` in front matter or config, or the URL `?transition=none` | `Reveal.initialize({ … })` |
| Printing / PDF ([pdf export](https://revealjs.com/pdf-export/)) | `?print-pdf` (also in the E-key helper) | Same |

- reveal.js settings deckmd sets: `hash`, `center`, `transition: 'fade'`, `slideNumber`, slide size (`size`, default 1920x1080), etc. Change them with `reveal: { … }`. Full list in `templates/deck.config.full.js`.
- Vertical slides (slides within slides) are not supported.
- The reveal.js markdown plugin syntax (`<!-- .slide: … -->`, `<!-- .element: … -->`) is not used. Slide settings comments and `{…}` do the same job.

## 2. What deckmd adds

### Front matter

YAML at the very top. Everything is optional.

```yaml
---
title: Talk title           # browser title
size: 1920x1080             # slide size
mode: auto                  # dark | light | auto. Only if the theme supports it
theme: ember                # theme (styling.md)
css: [talk.css]             # extra CSS (path relative to this file)
style: ":root { --accent: #0a7; }"   # CSS inline
plugins: [grid]             # plugins (plugins.md)
reveal: { transition: slide }        # reveal.js settings
split: headings             # slide splitting: rules(---) | headings. See below
lines: 12                   # lines per slide when using headings
defaultTier: core           # tier for slides without one (core | none). See tier below
---
```

Paths are relative to this Markdown file; starting with `/` they are relative to the launcher page (`index.html`). A bare name means the one inside deckmd (`ember` → `themes/ember/ember.css`). For overlap with the config (`deck.config.js`), see [usage.md](usage.md).

### Slide breaks and slide settings

| Syntax | Meaning |
|---|---|
| `---` (on its own line) | Slide break (not inside code blocks) |
| `<!-- class: chapter; tier: core -->` at the start of a slide | Slide settings. Separate several with `;` or line breaks |
| `Note:` (on its own line) | Everything below is speaker notes |
| `<!-- @@ note -->` | Review note. Shown as a yellow sticky note only when opened with `?draft` |

Slide settings:

| Name | Meaning |
|---|---|
| `class: name` | Class on the slide (`chapter` = chapter slide, `center` = centered) |
| `id: name` | Slide id (jump straight there with `#/name` in the URL) |
| `tier: core` | Tier. Opening with `?core` keeps only slides whose tier is `core` (the short version, for when your time slot shrinks). Slides without `tier` get `defaultTier`: the default is `core`, so you only tag the slides to drop with `tier: backup`; set it to `none` and only slides tagged `tier: core` remain |
| `fit` | Shrink text to fit the slide when it overflows (down to 60%) |
| `bg: color, image, video` | Slide background |
| `auto-animate` | Animate between adjacent slides |
| `run: name` | Function to run every time the slide is shown ([interactive.md](interactive.md)) |
| Any other `name: value` | Becomes `data-name` (reveal.js attributes) |

### Body

| Syntax | Result |
|---|---|
| `{.class #id key=val}` at the end of a paragraph, list item, or heading | Attributes on that element |
| `[text]{.muted}` | Just that text as a `<span>` |
| `::: cols` … `:::` | `<div class="cols">`. Any name becomes a class |
| Wrap a list in `::: fragments` | Items appear one at a time |
| `{.steps-ol}` on the line after a list | Class on the whole list |
| `![description](img/x.png)` | Image. Path relative to the Markdown; starting with `/`, relative to the launcher page |
| Raw HTML | Mix in things like hand-drawn SVG (`<script>` is not executed) |

To nest `:::` blocks, use more colons on the outer one (`::: card` inside `::::: cols`).

```markdown
::::: cols
::: card hl
### Left
:::
::: card
### Right
:::
:::::
```

For the classes themes provide (`cols`, `card`, `statement`, `chapter` …), see [styling.md](styling.md).

### Any Markdown (README as is)

Markdown with no `---` slide breaks at all is **split by headings** into a deck: `#` → chapter slide, `##`/`###` → slide; long sections continue onto "(cont.)" slides, and if it still overflows the text is shrunk (`fit`). Tune it with front matter `split: headings | rules`, `lines: 12`, or the URL `?split=headings&lines=10`.

It's cut by a few rules, so it's not perfect. If you don't like it, ask an AI to "polish this into slides". These days it does better 🙂

### Writing HTML directly

You can skip Markdown and write `<section>`s directly inside `.slides` in the launcher page ([`examples/page/index.html`](../examples/page/index.html)). Settings go in `<script type="application/yaml" id="deck-meta">` instead of front matter.

### Plugin syntax

Syntax like "one code block language draws one picture" is added by plugins. For the built-in `grid` plugin (cell diagrams, ```` ```grid ````) and how to write your own, see [plugins.md](plugins.md).

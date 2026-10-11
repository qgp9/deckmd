---
title: A tour of deckmd syntax
size: 1920x1080
theme: catppuccin   # themes/catppuccin/catppuccin.css (or a path to a file)
plugins: [grid, source]   # plugins/grid/grid.js — ```grid cell diagrams; source: ↓ shows the Markdown of each slide (leave it out of your own talks)
# css: [my.css]         # path relative to this Markdown file
# reveal: { transition: slide }   # override Reveal.initialize options
---

<!-- class: center -->

###### deckmd

# A reveal.js deck from one Markdown file

Open it with `index.html?src=examples/syntax/talk.md` {.teaser}

Press ↓ under a slide to see the Markdown it was made from {.small .muted}

Source: [examples/syntax/talk.md](https://github.com/qgp9/deckmd/blob/main/examples/syntax/talk.md) {.small .muted}

Note:
A `---` line splits slides; everything below the `Note:` line is speaker notes (S key).

---

## Plain Markdown just works

- **Bold** uses the accent color, *italic* the secondary color
- `code`, [links](https://revealjs.com)
- Tables, blockquotes and code blocks all work

> In this theme, a blockquote serves as the "message line".

```js
Reveal.initialize({ hash: true })
```

---

## Attributes: `{.class #id key=value}`

At the end of a paragraph, it applies to the paragraph {.big}

- At the end of a list item, it applies to that item {.fragment}
- One at a time, on each click {.fragment}
- `data-fragment-index` works too {.fragment data-fragment-index=1}

You can also put them on [just part of the text]{.muted}.

---

## Groups: `::: class`

::::: cols
::: card hl
### Left card
A box opened with `::: card hl`
:::
::: card cool
### Right card
When nesting, make the outer colons longer: `::::: cols`
:::
:::::

::: fragments
- Wrap a list in `::: fragments`
- and its items
- appear one by one
:::

Note:
`:::` takes any name and makes `<div class="name rest">`. When nesting, the outer colons must be longer than the inner ones (otherwise the inner ::: closes the outer one).

---

<!-- tier: backup -->

## Slide settings: `<!-- … -->` at the top

| Setting | Meaning |
|---|---|
| `tier: core` / `tier: backup` | opened with `?core`, only core remains |
| `class: chapter` | class on the slide's `<section>` |
| `auto-animate` | elements with the same `data-id` animate between adjacent slides |
| `bg: #223` / `bg: pic.jpg` | background color / image |
| `transition: zoom` | any other name becomes `data-name` |

Separate several with `;` or line breaks. This slide is `tier: backup`. {.small .muted}

<!-- @@ Open with ?draft to see review notes like this one as yellow sticky notes -->

---

<!-- class: chapter -->

###### Plugins

# What Markdown can't do, plugins can

One code block language = one diagram {.teaser}

---

<!-- auto-animate -->

## Cell diagrams ```` ```grid ```` {data-id=t}

```grid {size=1x16 index id=g}
0     list  accent !
1-3   A#    cool
4-8   B#    good
```

```grid {size=1x16 index id=next h=56}
1> 2! 3! end! 5 6 7 8 end
1-3   cool
```

Each line: cells · text · color · `!` (highlight). `1> …` fills cells in order from cell 1. Syntax: `docs/plugins.md`, examples: `examples/grid` {.small .muted}

---

<!-- auto-animate -->

## Move A, and the cells follow {data-id=t}

```grid {size=1x16 index id=g}
0     list  accent
4-8   B#    good
11-13 A#    cool !
```

Cells with the same `id` carry over between `auto-animate` slides.

---

## Mix in HTML as it is

<svg class="dg" viewBox="0 0 1200 200">
  <rect class="box dir" x="20" y="40" width="300" height="110" rx="12"/>
  <text class="y" x="40" y="105">Markdown</text>
  <line class="ln a" x1="320" y1="95" x2="440" y2="95"/>
  <rect class="box file" x="440" y="40" width="300" height="110" rx="12"/>
  <text class="c" x="460" y="105">markdown-it</text>
  <line class="ln a" x1="740" y1="95" x2="860" y2="95"/>
  <rect class="box hl" x="860" y="40" width="300" height="110" rx="12"/>
  <text x="880" y="105">reveal.js</text>
</svg>

Keep things like hand-drawn SVG as HTML, and write the rest in Markdown.

---

## Images use plain Markdown image syntax

![Markdown → deck.js → reveal.js](img/deck-flow.svg)

Paths are relative to this Markdown file. When you pack (E key or `build.mjs`), images go inside the file too. {.small .muted}

---

<!-- class: center -->

<p class="statement">This file <strong>is the syntax guide</strong>.</p>

Open `examples/syntax/talk.md` · cell diagram examples: `?src=examples/grid/talk.md` {.muted}

---
title: deckmd
plugins: [grid]
---

<!-- class: center -->

# deckmd

A reveal.js slide deck from a single Markdown file {.teaser}

Press **→** to go on · **?** for shortcuts · **E** for the helper {.small .muted}

Note:
This page is itself a deckmd deck: examples/intro/talk.md in the repository.

---

## Write Markdown

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

`---` splits slides, `Note:` starts the speaker notes. That's most of it. {.small .muted}

---

## Get slides

::::: cols three
::: card
### No build step
Open the Markdown through a small web server and reload as you write
:::
::: card hl
### One file at the end
Press **E** → *Offline*: the whole deck, fonts and images in one HTML file
:::
::: card
### Still reveal.js
Fragments, backgrounds, transitions, auto-animate, speaker notes, PDF
:::
:::::

---

## A little extra syntax

- `{.fragment}` after a line, `[text]{.muted}` inside one {.fragment}
- `::: cols` and `::: card` for layouts like the previous slide {.fragment}
- `<!-- bg: photo.jpg; tier: core -->` slide settings at the top {.fragment}
- `?core` opens the short version, `?draft` shows review notes {.fragment}

The full tour is the [syntax deck](/?src=examples/syntax/talk.md). {.small .muted}

---

<!-- auto-animate -->

## Plugins add syntax {data-id=t}

```grid {size=1x8 index id=intro}
0     list  accent !
1-3   A#    cool
4-6   B#    good
```

A ```` ```grid ```` code block becomes cells. {.small .muted}

---

<!-- auto-animate -->

## Plugins add syntax {data-id=t}

```grid {size=1x8 index id=intro}
0     list  accent
4-6   B#    good
5-7   A#    cool !
```

Same `id` on both slides, so the cells animate between them. More in the [grid deck](/?src=examples/grid/talk.md). {.small .muted}

---

## Code, as you'd expect

```js [2-3|5]
DeckMD.registerRun('clock', (sec) => {
  const tick = () => { sec.querySelector('.clock').textContent = new Date().toTimeString().slice(0, 8); };
  const id = setInterval(tick, 1000);
  tick();
  return () => clearInterval(id);   // runs when you leave the slide
});
```

Line highlights step through with **→**. Buttons and JS per slide: the [interactive deck](/?src=examples/interactive/talk.md). {.small .muted}

---

<!-- class: center -->

## Try it

```html
<script src="https://cdn.jsdelivr.net/npm/deckmd/js/boot.js"></script>
```

One line in an `index.html` next to `slides.md` (or open `index.html?src=talk.md`). `npx deckmd talk.md` packs it into one file. {.small}

[All example decks](/?deck-list) · [GitHub](https://github.com/qgp9/deckmd) · [npm](https://www.npmjs.com/package/deckmd)

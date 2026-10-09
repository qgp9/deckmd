# Buttons and JS

How to put buttons in a slide, or run JS when a slide is shown. Example deck: [`examples/interactive/`](../examples/interactive/talk.md).

Attaching JS to a presentation comes with side effects (timers left running, prints showing only the pre-click state). The approaches below provide only a minimal frame that limits those side effects. The rest is up to you.

| Approach | Where | When |
|---|---|---|
| 1. `onclick` | HTML inside the Markdown | One or two lines |
| 2. JS file next to the deck | `plugins: [demo.js]` | Behavior used only in this deck |
| 3. Proper plugin | `plugins/<name>/` | Shared by several decks, new syntax |
| 4. `run:` | Slide settings + JS from 2 or 3 | Runs **every time** the slide is shown (animations, timers) |

## 1. `onclick` directly in HTML

You can write HTML directly in the Markdown.

```markdown
<button onclick="const d = this.closest('section').querySelector('.answer'); d.hidden = !d.hidden">Show answer</button>
<div class="answer" hidden>42</div>
```

- Slides are rendered via `innerHTML`, so `<script>` inside the Markdown is **not executed**. Attributes such as `onclick` do work.
- One-line HTML gets wrapped in a paragraph (`<p>`). Expecting a sibling like `this.nextElementSibling` will miss, so search from `this.closest('section')`.

## 2. A JS file next to the deck

```yaml
plugins: [demo.js]      # path relative to the Markdown file (same path rules as styling.md)
```

```js
// demo.js
DeckMD.loadCSS('demo.css');                   // CSS next to this file (all loaded before the deck starts)
DeckMD.afterRender((sec) => {                 // once for each slide after it is rendered
  sec.querySelectorAll('button.count').forEach((b) => {
    let n = 0;
    b.addEventListener('click', () => { b.textContent = `Clicked ${++n}`; });
  });
});
```

The Markdown only keeps `<button class="count">Click me</button>`. When packing (E key, `build.mjs` — both offline and share), the JS and CSS go in too.

## 3. A proper plugin

Put the same kind of script as in 2 at deckmd's `plugins/<name>/<name>.js` and you can use it by name alone (`plugins: [grid]`). For syntax that turns code blocks into diagrams (`DeckMD.registerFence`), see [plugins.md](plugins.md). Example: [`plugins/grid/`](../plugins/grid/grid.js).

## 4. Running when a slide is shown: `run:`

```markdown
<!-- run: clock -->

## Current time

<div class="clock">--:--:--</div>
```

```js
// demo.js (or a plugin)
DeckMD.registerRun('clock', (sec) => {
  const el = sec.querySelector('.clock');
  const tick = () => { el.textContent = new Date().toTimeString().slice(0, 8); };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);             // called when leaving the slide
});
```

- Called **every time** the slide is shown (including on open, if the deck opens on that slide). Leave and come back, and it is called again.
- The returned function is called when **leaving** the slide. Stop timers and animations there.
- Several: `run: clock countup` (spaces or commas).
- Name lookup: registered with `DeckMD.registerRun` → otherwise a global function of the same name (`window.clock`) → otherwise a console warning.
- If one function throws, the error is logged to the console and the others and the deck keep running.
- Difference from `afterRender`: `afterRender` runs **once** when the slide is built (attaching behavior to buttons); `run` runs **every time it is shown** (things that start and stop).

## Printing and PDF (`?print-pdf`)

A PDF captures only the state at that moment.

- Slides with `run:` are **all run once** when the print view opens. So a counter shows its final value and a clock shows that moment's time. Write your functions so the end state is meaningful.
- Things that appear only after a click (the answers in 1 and 2, etc.) do not show up in the PDF. If the result matters, put the result screen on a separate following slide.

## Caveats

- Shortcuts: when an input field (`<input>`) has focus, reveal.js and the helper (E) ignore keys, so typing does not change slides.
- Slides are rendered once, when the deck opens. Every slide's `afterRender` runs up front (including slides not yet visible). Put heavy work in `run`.
- In a bundled file, a `run` function that calls an internet URL (an API, etc.) fails when offline.

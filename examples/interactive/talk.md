---
title: Buttons and JS (example)
size: 1920x1080
theme: reveal/white   # a reveal.js built-in theme
plugins: [demo.js]      # a file next to this Markdown (ways 2 and 4)
---

# Buttons and JS

Four ways to put a button on a slide and make it do something {.teaser}

Source: [examples/interactive/talk.md](https://github.com/qgp9/deckmd/blob/main/examples/interactive/talk.md) {.small .muted}

---

## 1. `onclick` right in the HTML

<button class="demo-btn" onclick="const d = this.closest('section').querySelector('.demo-answer'); d.hidden = !d.hidden">Show answer</button>
<div class="demo-answer" hidden>42</div>

A `<script>` inside Markdown doesn't run, but attributes like `onclick` do. Good for a line or two.
The button gets wrapped in a paragraph (`<p>`), so look it up from `this.closest('section')` rather than a sibling. {.small .muted}

---

## 2. A JS file next to the deck (`plugins: [demo.js]`)

<button class="count demo-btn">Click me</button>

The Markdown only has `class="count"`. `DeckMD.afterRender` in `demo.js` adds the behavior. {.small .muted}

---

## 3. A proper plugin (`plugins/<name>/`)

Things many decks share go in deckmd's `plugins/`, and you just write the name: `plugins: [grid]`.
`grid`, which turns code blocks into cell diagrams, is one. You write it the same way as in 2. {.small .muted}

---

<!-- run: clock -->

## 4. Run when this slide is shown (`run: clock`)

<div class="clock">--:--:--</div>

`<!-- run: clock -->` at the top of the slide, `DeckMD.registerRun('clock', sec => …)` in `demo.js`.
Return a cleanup function and the timer stops when you leave. {.small .muted}

---

<!-- run: countup -->

## Again every time you enter the slide

<div class="big-num" data-to="1024">0</div>

Go to another slide and come back, and it counts from 0 again. {.small .muted}

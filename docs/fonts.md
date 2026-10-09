# Fonts

For themes and CSS as a whole, see [styling.md](styling.md). This document covers just fonts, in detail.

Fonts feel hard because three separate things are tangled together. Taken one at a time, it's simple.

| What | Where it's decided |
|---|---|
| **Which font to use** | The theme's CSS variables `--r-main-font` (body), `--r-heading-font` (headings), `--r-code-font` (code) |
| **Downloading the font files** | The Pretendard CSS that `boot.js` loads from the CDN (`vendor/` with `data-local`). Downloaded whether used or not |
| **Size** | `--r-main-font-size` (default 44px, at 1920x1080) |

Changing a variable only changes the "font name to use". If that font isn't on the computer, the browser moves on to the next candidate (like a `font-family` list). If you need the font file, you have to load it separately.

## Defaults

The default theme (`ember`) uses `"Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`. Pretendard (a font that covers both Latin and Korean) is downloaded from the CDN by `boot.js`.

## 1. Changing the font: one line of `style:`

To change a single deck, write the CSS directly with `style:` in the Markdown front matter.

```yaml
---
title: Talk
style: ":root { --r-main-font: Georgia, serif; }"
---
```

For multiple lines, use `|`.

```yaml
style: |
  :root {
    --r-main-font: "Noto Serif KR", Georgia, serif;
    --r-code-font: "D2Coding", ui-monospace, monospace;
    --r-main-font-size: 40px;
  }
```

To apply it to every deck, use the same key in `deck.config.js` (the config's `style` and the front matter's `style` are combined, and the front matter comes later so it wins).

```js
window.DeckConfig = {
  style: ':root { --r-main-font: Georgia, serif; }',
};
```

`style:` is added after the theme and `css:` files, so it overrides the theme's values. Other colors and spacing can be changed the same way (variable names are in the comment at the top of `css/base.css`).

Writing `<style>…</style>` at the top of the Markdown body works the same (HTML passes through as is). Even inside a slide, it's moved after the theme to apply, and a slide that contained only `<style>` is removed rather than left empty. That said, the front matter is tidier, and only `style:` can go in the config (`deck.config.js`).

> `theme:` replaces the whole look, so using it just to change a font makes the rest of the look disappear too. To change only fonts, use `style:` or `css:`.

## 2. Using your own font files

Put the CSS in a separate file and load the font with `@font-face`.

```css
/* fonts.css */
@font-face { font-family: "MyFont"; src: url("fonts/MyFont.woff2") format("woff2"); }
:root { --r-main-font: "MyFont", sans-serif; }
```

```yaml
css: [fonts.css]        # path relative to the Markdown. /fonts.css is relative to index.html
```

Files in `url(…)` are included in the file when packing (both offline and share), so they show up offline too. But `url(…)` written in `style:` is not included, so when using font files, put them in a CSS file.

## 3. Using web fonts (Google Fonts, etc.)

```css
/* fonts.css */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");
:root { --r-main-font: "Inter", "Pretendard Variable", sans-serif; }
```

When packing, the `@import`ed CSS is downloaded and inlined in place, and the font files inside it (`url(…)`) are included in the file too. So the bundled file displays offline as well. Packing does need internet, though. When packing from the command line (`build.mjs`), Google Fonts may serve a different format (ttf) tailored to the requester (Node) (the E key gets exactly what the browser receives). If it looks different, download the files you want yourself as in section 2.

## 4. Not downloading fonts at all (leaving out Pretendard)

Pretendard is downloaded even for decks with no Korean text. To leave it out, in the launcher page `index.html`:

```html
<script src="deckmd/js/boot.js" data-skip="font"></script>
```

This can't be done from the config file (`deck.config.js`), because `boot.js` builds its list before reading the config.
Bundled files follow this attribute too, so the font isn't included and the file gets smaller.

After leaving it out, also set the variable so it falls back to system fonts.

```yaml
style: ":root { --r-main-font: system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif; }"
```

## Which value wins

Whatever is loaded later wins.

```
reveal.css → css/base.css → theme → config css → front matter css → config style → front matter style → `<style>` in Markdown
```

## Common problems

- **I changed the font but nothing changed**: there's a typo in the name, or the font isn't on this computer so the next candidate was used. Check the computed `font-family` of `.reveal` in the developer tools.
- **Only Korean text looks off**: put a font that covers Korean (`"Pretendard Variable"`, `"Noto Sans KR"`, etc.) after the Latin font in the list.
- **It looks different on the presenting computer**: that computer doesn't have the font. Fix it with section 2 (bundle the file along).

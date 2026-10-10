# Pack and unpack

Pack a deck into a single HTML file. Once a finished deck is packed, it keeps opening exactly as it is even if deckmd changes later (a "frozen copy"). You can also extract your own files from a bundled file again (unpacking).

## Two kinds of bundle

| Bundle | Contents | Result |
|---|---|---|
| **Offline** (`offline`) | Everything: libraries, fonts, deckmd code, theme, plugins, Markdown, images | One file, 4 MB + images. Opens without internet |
| **Share** (`share`) | Libraries and fonts as CDN links, everything else embedded | One file, tens of KB + images. Needs internet |

Most of the size is the Pretendard font (about 2.7 MB) and code highlighting (about 0.9 MB).

## In the browser: the E key

While viewing a deck, press **E** → "Offline" or "Share" → the file is downloaded. No shell needed.

- Works when the deck was opened through a web server, or when you opened an already bundled file. A bundled file can be repacked as the other kind (offline → share).
- For a deck opened without a server (`file://`), the browser blocks reading the files next to the deck (images, CSS, JS), so they are left out. Libraries and fonts from the CDN are still read.

## On the command line: build.mjs

Does the same packing as the E key, from the command line. Use it to pack without a person in the loop (agents, scripts) or to repack many decks at once.

```bash
cd deckmd && npm install && cd ..                    # once (jsdom, Node 22 or later)
node deckmd/tools/build.mjs slides/x/deck.md          # → slides/x/dist/x.offline.html
node deckmd/tools/build.mjs slides/x/deck.md --share  # → slides/x/dist/x.share.html
node deckmd/tools/build.mjs slides/x/index.html       # a deck written in HTML
npx deckmd slides/x/deck.md                           # without a deckmd folder (npm)
```

- It opens the launcher page in jsdom as a browser would and runs `boot.js → deck.js → pack.js` unchanged. So the result is the same as with the E key (the rules live in one place, `js/pack.js`).
- The Markdown must be under the launcher page's folder, because the page opens only Markdown under it. The launcher page is the `index.html` of the [project](usage.md#the-project-and--c) found from the current folder upwards (you can run it from a subfolder), or without a project the current folder. A deck outside it (`../other/talk.md`) is refused right away, with the command that works: `cd ../other && npx deckmd talk.md`. `-C path` starts in another folder first. (Any file that isn't an HTML page counts as Markdown. A link inside the folder counts as inside. To look at a deck that is somewhere else, `cd` there and use `npx deckmd serve`, then press **E**.)
- The `index.html` of the project is used as the launcher page, so the deck is packed with the same libraries and settings as in the browser (`data-local`, `data-skip`, `data-config`, tags you wrote by hand). If there is none, a one-line `boot.js` launcher page is generated.
- Files are read from disk. Libraries (CDN URLs) come from the local copy in `vendor/` if present, otherwise from the internet.
- If the launcher page loads deckmd from the CDN (`…/npm/deckmd@version/…`) and that version matches this deckmd, the files in this folder are used. If it differs, you are told and the CDN copy is read.
- If the output file already exists, it is an error (`--force` to overwrite, `-o` for another name). The sources (input, launcher page, config) are never overwritten, even with `--force`.
- Files that could not be found and external URLs that were not embedded are reported at the end.

## What goes in

- **Markdown**: the source as is (`<script type="text/markdown">`). The browser renders it when the file is opened.
- **Images**: local files referenced by `![](…)`, HTML `src`, `poster` and `data-background-image`, and the slide setting `bg:`. They are stored in a `<script type="application/json" id="deck-assets">` table and swapped in at render time (the Markdown text stays unchanged). Internet URLs (`https://…`, `//…`) are not embedded.
- **CSS**: the theme and `css:` files, including the `url(…)` and `@import` inside them (fonts and images become data URIs). `url(…)` in `style:` or in a `<style>` inside a slide is not embedded → if you need a file, put it in a `css:` file.
- **JS**: deckmd code, plugins, and the CSS plugins load (including anything loaded at runtime).
- **Licenses**: the top comment lists the bundled libraries and fonts with links to their license texts (`js/notices.js`).

Not found (rare): reference-style images `![][id]`, `srcset`. These are reported when packing.

## Unpacking: --unpack

Extracts **only your own files** from a bundled file, back to their original locations. Libraries (CDN) and deckmd's own files are not extracted.

```bash
node deckmd/tools/build.mjs slides/x/dist/x.offline.html --unpack       # → slides/x/dist/x.offline/
node deckmd/tools/build.mjs x.offline.html --unpack -o out-dir/
```

- What is extracted: the Markdown, `deck.config.js`, the deck's CSS and JS (`css:`, `plugins: [./x.js]`, your own theme), images.
- Files are told apart by marks added at pack time: `data-from="deckmd"` (deckmd's files, those under boot.js), `data-file="original location"` (your files, relative to the launcher page), and `data-path` for the Markdown.
- Put `deckmd/` and `index.html` next to the extracted files and you can pack again, with the same result as the first time.
- Fonts and images embedded in your CSS (data URIs) stay inside the CSS, since their original names are unknown.
- A bundled deck that was written in HTML cannot be unpacked yet.
- If the output already exists, it is an error; `--force` overwrites.

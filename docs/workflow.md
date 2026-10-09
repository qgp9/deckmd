# Workflow

No setup fits every case, so we pick the use cases and shape things around them.

> **One copy of deckmd, one folder per deck. Finished decks are packed into one file and frozen.**

Once a finished deck is packed into a single `offline` file, later changes to deckmd do not affect it. That is why it is safe to keep one copy of deckmd and keep updating it, instead of copying it into every deck.

## Intended use cases (in priority order)

1. **Your own talks repository**: talks keep accumulating in one repository. This is what everything is optimized for.
2. **Handing it to someone else**: a colleague receives it and makes one talk. No installation, no git.
3. **Developing deckmd itself**: inside this repository. `examples/` is a miniature of 1, so it is tested with the same structure.

## 1. Your own talks repository

```
talks-repo/
  deckmd/                       ← this repository (git submodule, pinned to a tag)
  index.html                    ← templates/index.html (a one-line boot.js)
  deck.config.js                ← templates/deck.config.js (scan: ['talks/*'])
  themes/my/my.css              ← (optional) your shared theme (images and fonts in the same folder). theme: /themes/my in a deck's front matter or the config
  talks/
    2026-10-kosesfi/
      talk.md  img/
      dist/2026-10-kosesfi.offline.html    ← pack and commit when done = frozen copy
    2026-11-next-talk/
      talk.md
```

- **Getting deckmd**: git submodule. Pin it to a tag and upgrade only deliberately. A subtree also works but mixes deckmd's history into yours. Fork only if you are going to modify deckmd.
- **Launcher page**: one per repository, not one per deck. `boot.js` loads everything else relative to its own location (`deckmd/js/`), so this one line is the only path.
- **Decks go under `talks/`**: at the top level, `index.html` would hide the web server's directory listing, so the deck list could not be built automatically.
- **New deck**: copy `deckmd/templates/talk.md` to `talks/<date-name>/talk.md` and start from there.
- **Deck-specific CSS, plugins and images**: keep them in that deck's folder and reference them from the front matter with relative paths.
- **Avoid**: copying deckmd into each deck (fixes drift apart), symlinks (they break on Windows, in zip files and on GitHub Pages).

## 2. Handing it to someone else

- Hand over just the one-line launcher page (`<script src="https://cdn.jsdelivr.net/npm/deckmd@version/js/boot.js">`) plus `talk.md` (jsDelivr serves the npm package `deckmd`). The recipient writes their own `talk.md` using the syntax guide (`examples/syntax/talk.md`, in the repository). It opens even without a server, via a file picker.
- For a finished deck, handing over the single bundled file (E key) is enough.
- The offline zip (`tools/release.mjs`) only exists as a tool; distributing it is on hold. Anyone who needs to work without internet can clone the repository and run `localize.mjs`.
- Once they start accumulating several talks, switch to the structure in 1.

## 3. Editor (later)

Does not exist yet (planned). If added, it would live inside deckmd (`deckmd/editor/`), and its unit of work would be the whole repository.
- Run a server at the top of the repository → deck list → edit `talk.md` → preview with the same `deck.js` → pack with a button.
- In Chrome and Edge, picking the repository folder once would make it work without Node (File System Access API).
- Committing directly to GitHub could come later, on top of the same unit.

## Structure of this repository

- The runtime is at the top level (`js/`, `css/`, `themes/`, `plugins/`) → the submodule path (`deckmd/js/boot.js`) and the CDN URL stay short.
- Development material is in subfolders: `tools/`, `templates/`, `examples/`, `docs/`.
- One folder per plugin (`plugins/grid/grid.js`, `grid.css`) → stays tidy even when images and data are added.
- Libraries come from the CDN by default, and `vendor/` is not in git (fetch it with `tools/localize.mjs`). Upgrading a library = editing the URL in `js/boot.js`. deckmd's own version is in `package.json`.
- Releases: the npm package `deckmd` (`files` in `package.json`: runtime, templates, tools, user docs) → jsDelivr CDN. The offline zip (`tools/release.mjs`) is on hold, and a single bundled script (`deckmd.min.js`) was decided against.

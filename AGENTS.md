# AGENTS.md

Instructions for coding agents (and a short map for people) working in this repository.

## What this is

deckmd turns Markdown into reveal.js decks (npm package `deckmd`: `npx deckmd init | add | serve | <deck.md>`). There is no build step: the browser runtime is `js/`, the command-line tools are `tools/` (Node 22 or later). File map: `docs/internals.md`. User docs: `docs/README.md`.

## Commands

- `npm install` (jsdom is needed for packing and for the tests)
- `npm test` = `node --test tests/build.test.mjs` (about a minute; it runs the real CLI and writes `tests/out/`)
- Browser tests: `node tools/build.mjs serve --port 8000`, then open `http://localhost:8000/tests/browser.html` (run `npm test` first: some cases open bundles it writes to `tests/out/`)
- Look at a deck: `node tools/build.mjs serve examples/grid/talk.md`

## Conventions

- Code, comments, docs and commit messages are English. Match the surrounding style: comments say why, in plain sentences, and are as dense as their neighbours.
- A behavior change comes with a test (`tests/build.test.mjs`, or a case in `tests/browser.html`) and with docs: the matching `docs/*.md` and both `README.md` and `README.ko.md` when it is user-visible.
- `js/deck.js` stays small. Optional features are plugins in `plugins/<name>/` (see `docs/plugins.md`).
- `serve` and `?src` are deliberately restrictive (policy in the header of `tools/serve.mjs` and in `docs/usage.md`). Do not widen what is served or opened.
- Do not commit `notes/`, `tests/out/`, `vendor/`, `dist/`, or anyone's private decks.

## Git and pull requests

- Branch names carry a type prefix: `feat/`, `fix/`, `docs/`, `chore/`. Open a PR to `main`; the maintainer merges it with "Rebase and merge".
- Pushing to a PR branch starts automatic reviews (Copilot, opencode); a comment alone does not. Check each finding against the code before acting; answer a wrong finding with a comment, not a change.
- Text an AI agent writes on GitHub (comments, reviews, issue bodies) starts with a line saying so. Claude Code uses `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Commit messages end with the agent's `Co-Authored-By` trailer; PR descriptions end with the same 🤖 line.

## Releases (maintainer only)

Version bumps, tags and `npm publish` are the maintainer's. Do not bump a version, tag, or publish unless asked. The flow: after merge, `npm version <minor|patch> --no-git-tag-version`, commit `x.y.z`, annotated tag `vX.Y.Z`; `npm publish` runs `scripts/check-release.mjs` (clean tree, HEAD tagged, versions agree).

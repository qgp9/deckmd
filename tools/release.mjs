#!/usr/bin/env node
// Make the offline zip for GitHub releases (a presentation repository skeleton for use without internet). Distribution is on hold — npm is the current distribution.
//
//   node tools/release.mjs            → dist/deckmd-<version>-offline.zip  (version from package.json)
//   node tools/release.mjs --force    overwrite if it exists
//
// Inside the zip (the repository layout in docs/usage.md; viewable with deckmd/tools/serve.sh right after unzipping):
//   deckmd-<version>/
//     deckmd/                 deckmd: committed files (git archive HEAD) + vendor/ (libraries, fonts and their LICENSEs; only the used ones from what localize.mjs downloaded)
//     index.html              templates/index.html with data-local (read from vendor/)
//     deck.config.js          templates/deck.config.js
//     slides/example/deck.md   templates/deck.md
//     README.md               how to start
// Uncommitted changes are not included (reported if any). npm is separate: npm publish (files in package.json).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (msg) => { console.error(msg); process.exit(1); };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });
const force = process.argv.includes('--force');

const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const name = `deckmd-${version}`;
const DIST = path.join(ROOT, 'dist');
const stage = path.join(DIST, name);
const zip = path.join(DIST, `${name}-offline.zip`);
if (fs.existsSync(zip) && !force) die(`already exists: ${path.relative(process.cwd(), zip)} (use --force to overwrite)`);

const dirty = run('git', ['status', '--porcelain', '--untracked-files=no']).trim();
if (dirty) console.warn(`note: uncommitted changes are not included (uses HEAD)\n${dirty.replace(/^/gm, '  ')}`);

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(stage, 'deckmd'), { recursive: true });

// 1. deckmd: committed files. Tests and hidden files (.claude etc.) are left out
const tar = run('git', ['archive', '--format=tar', 'HEAD'], { encoding: 'buffer', maxBuffer: 1 << 30 });
execFileSync('tar', ['-x', '-C', path.join(stage, 'deckmd')], { input: tar });
for (const f of fs.readdirSync(path.join(stage, 'deckmd'))) {
  if (f.startsWith('.') || f === 'tests') fs.rmSync(path.join(stage, 'deckmd', f), { recursive: true, force: true });
}

// 2. vendor/: download with localize.mjs (skips what exists), copy only what the boot.js list points to (fonts in CSS etc. follow)
run(process.execPath, [path.join(ROOT, 'tools/localize.mjs')], { stdio: 'inherit' });
const ctx = { window: {}, document: { currentScript: null } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/boot.js'), 'utf8'), ctx);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/notices.js'), 'utf8'), ctx);
const { list, localPath, reveal, revealThemes } = ctx.window.DeckBoot;
const copied = new Set();
function copyVendor(url) {
  const rel = localPath(url.split(/[?#]/)[0]);
  if (copied.has(rel)) return;
  copied.add(rel);
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) die(`not in vendor: ${rel} (node tools/localize.mjs)`);
  fs.mkdirSync(path.dirname(path.join(stage, 'deckmd', rel)), { recursive: true });
  fs.copyFileSync(src, path.join(stage, 'deckmd', rel));
  if (/\.css$/i.test(rel)) {
    for (const m of fs.readFileSync(src, 'utf8').matchAll(/url\((["']?)([^"')]+)\1\)/g)) {
      if (!/^(data:|#)/.test(m[2])) copyVendor(new URL(m[2], url).href);
    }
  }
}
for (const [, file] of list) if (/^https?:/.test(file)) copyVendor(file);
for (const t of revealThemes) copyVendor(`${reveal}theme/${t}.css`);
for (const l of ctx.window.DeckNotices.urls([...copied].map(r => `https://${r.slice(7)}`).concat('js/md-spans.js'))) copyVendor(l);   // license texts (js/notices.js)

// 3. Presentation repository skeleton
const tpl = f => fs.readFileSync(path.join(ROOT, 'templates', f), 'utf8');
const index = tpl('index.html').replace('<script src="deckmd/js/boot.js"></script>', '<script src="deckmd/js/boot.js" data-local></script>');
if (!index.includes('data-local></script>')) die('could not find the boot.js tag in templates/index.html');
fs.writeFileSync(path.join(stage, 'index.html'), index);
fs.writeFileSync(path.join(stage, 'deck.config.js'), tpl('deck.config.js'));
fs.mkdirSync(path.join(stage, 'slides/example'), { recursive: true });
fs.writeFileSync(path.join(stage, 'slides/example/deck.md'), tpl('deck.md'));
fs.writeFileSync(path.join(stage, 'README.md'), `# deckmd ${version} (offline)

reveal.js slide decks from a single Markdown file. Libraries and fonts are in \`deckmd/vendor/\`, so it works without internet.

\`\`\`
deckmd/                 deckmd (see deckmd/README.md)
index.html              launcher page (data-local = read from vendor/)
deck.config.js          config (deck list etc.)
slides/example/deck.md   sample deck. Start a new talk by copying it to slides/<name>/deck.md
\`\`\`

1. Start a web server: \`deckmd/tools/serve.sh\` (Windows: double-click \`deckmd\\tools\\serve.cmd\`, not yet tested on Windows)
2. Open \`http://localhost:8000/\` in a browser → pick a deck. Edit and reload
3. When done, pack into one file: press **E** while viewing the deck. From the command line: \`node deckmd/tools/build.mjs slides/example/deck.md\` (once, while online: \`cd deckmd && npm install\`)

If you open index.html directly without a server, you have to pick the Markdown yourself, and images and CSS next to the deck are left out when packing.

## License

deckmd is MIT (\`deckmd/LICENSE\`). Libraries and fonts in \`deckmd/vendor/\` follow their own licenses; the texts are in \`LICENSE\` in each package folder:
reveal.js · markdown-it · markdown-it-attrs · markdown-it-container · js-yaml (MIT), highlight.js (BSD-3-Clause, inside reveal's highlight plugin),
Pretendard · League Gothic · Source Sans Pro fonts (SIL Open Font License 1.1).
`);

// 4. zip
fs.rmSync(zip, { force: true });
run('zip', ['-qrX', path.basename(zip), name], { cwd: DIST });
fs.rmSync(stage, { recursive: true, force: true });
const mb = (fs.statSync(zip).size / 1024 / 1024).toFixed(1);
console.log(`${path.relative(process.cwd(), zip)}  ${mb} MB  (vendor ${copied.size} files)`);

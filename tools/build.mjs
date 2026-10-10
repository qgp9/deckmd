#!/usr/bin/env node
// Pack / unpack a deck — the same job as the E key in the browser, from the command line.
//
//   npx deckmd init [dir] [--cdn | --repo] [--single | --multi]   start a deck (index.html + slides.md) or a talks repository (slides/<name>/deck.md)  (npx deckmd init --help)
//   npx deckmd add <name> [title]               add a deck: slides/<name>/deck.md in a project (or ./<name>.md without one) from the starter  (npx deckmd add --help)
//   npx deckmd serve [file.md|folder …] [--port N] [--open]   a web server to write with: the project, one deck, a deck list or the decks in a folder  (npx deckmd serve --help)
//   node tools/build.mjs talk.md [--offline]    → <deck folder>/dist/<name>.offline.html   one file with everything inside (opens without internet, default)
//   node tools/build.mjs talk.md --share        → <deck folder>/dist/<name>.share.html     libraries and fonts from the CDN (small, needs internet)
//   node tools/build.mjs index.html             a page with slides written directly works too (that page is the launcher page)
//   node tools/build.mjs packed.html --unpack   take the user files (Markdown, config, CSS, JS, images) out of a bundled file back to their original places
//                                                (except libraries (CDN URLs) and deckmd's files) → <bundled file name>/ folder
//   From npm: npx deckmd talk.md [--share | --unpack] (no deckmd folder needed)
//   The Markdown must be inside the deckmd project (the folder with the launcher index.html, found from the current folder upwards); with no project,
//   inside the current folder. Run it from anywhere in the project. -C <folder> starts there instead (before the command: deckmd -C slides/talk talk.md)
//   -o out     pack: output file, unpack: folder to extract into
//   --force    overwrite the output if it exists (otherwise an error). Never the originals (input, launcher page, config), even with --force
//
// Packing opens the launcher page in jsdom like a browser: boot.js → deck.js → pack.js run as is, and the result is the same as the E key (one set of rules, in pack.js).
//   Launcher page: for a .md input, the index.html of the project (found from the current folder upwards; or in the current folder), else a one-line boot.js page. For .html, that page
//   Files are read from disk. Libraries (CDN URLs) from the local copy in vendor/ if there is one, else from the internet.
//   If the launcher page loads deckmd from the CDN (…/npm/deckmd@version/…), this folder's files are used when the version matches this deckmd
//   Needs jsdom (Node 22 or later): npm install in the deckmd folder (not needed for unpacking)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findProject, isInside, isLauncher, shq } from './project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODES = ['offline', 'share'];

// ── Options ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
// -C <folder> (like git): run as if started in that folder; the project is looked for from there. It doesn't have to be the project's top.
while (args[0] === '-C') {
  const dir = args[1];
  if (!dir || dir.startsWith('-')) { console.error('-C needs a folder  (--help)'); process.exit(1); }
  try { process.chdir(dir); } catch { console.error(`-C: not a folder: ${dir}`); process.exit(1); }
  args.splice(0, 2);
}
if (args[0] === 'init') { (await import('./init.mjs')).init(args.slice(1)); process.exit(process.exitCode ?? 0); }
if (args[0] === 'serve') { await (await import('./serve.mjs')).serve(args.slice(1)); process.exit(0); }
if (args[0] === 'add') { (await import('./add.mjs')).add(args.slice(1)); process.exit(process.exitCode ?? 0); }
if (args.includes('--help') || args.includes('-h') || !args.some(a => !a.startsWith('-'))) {
  const lines = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
  console.log(lines.slice(0, lines.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));   // top comment
  process.exit(0);
}
const die = (msg) => { console.error(`${msg}  (--help)`); process.exit(1); };
const oi = args.indexOf('-o');
const OUT_ARG = oi >= 0 ? args[oi + 1] : null;
if (oi >= 0 && (!OUT_ARG || OUT_ARG.startsWith('-'))) die('-o needs an output name after it');
const inputs = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-o');
if (inputs.length > 1) die(`only one input: ${inputs.join(', ')}`);
for (const a of args) if (a.startsWith('-') && !['-o', '--force', '--unpack', ...MODES.map(m => `--${m}`)].includes(a)) die(`unknown option: ${a}`);
const modes = MODES.filter(m => args.includes(`--${m}`));
if (modes.length > 1) die(`only one bundle mode: ${modes.map(m => `--${m}`).join(' ')}`);
const UNPACK = args.includes('--unpack');
if (UNPACK && modes.length) die('--unpack cannot be used together with a bundle mode option');
const MODE = modes[0] || 'offline';
const FORCE = args.includes('--force');

const INPUT = path.resolve(inputs[0]);
if (!fs.existsSync(INPUT)) die(`not found: ${inputs[0]}`);
const posix = p => p.split(path.sep).join('/');
const show = p => posix(path.relative(process.cwd(), p)) || '.';
const size = n => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

if (UNPACK) unpack(); else await pack();

// ── Pack ─────────────────────────────────────────────────────────
async function pack() {
  // The launcher page is the index.html of the deckmd project the command runs in (found from the current folder upwards, like git finds its
  // repository), or, with no project, one made in memory in the current folder. deck.js opens only Markdown under the page's folder (?src),
  // so a deck outside that folder can't be opened: say so here, before jsdom, and say what to run.
  // Compared by the written path, like deck.js does (no realpath): a link inside the folder counts as inside.
  const project = /\.html?$/i.test(INPUT) ? null : findProject(process.cwd());
  const baseDir = project ? project.root : process.cwd();
  if (!/\.html?$/i.test(INPUT) && !isInside(INPUT, baseDir)) {
    console.error(`${inputs[0]} is outside ${project ? `the deckmd project at ${show(baseDir)}` : 'the current folder'}: the launcher page is ${project ? 'there' : 'here'} and only opens Markdown under it.\nRun it from the deck's folder:  cd ${shq(show(path.dirname(INPUT)))} && npx deckmd ${shq(path.basename(INPUT))}`);
    process.exit(1);
  }
  let jsdom;
  try { jsdom = (await import('jsdom')).default; } catch { die('packing needs jsdom: run npm install in the deckmd folder'); }
  const { JSDOM, VirtualConsole, requestInterceptor } = jsdom;

  // The library URL ↔ vendor/ path rule is in js/boot.js (shared with the browser)
  const ctx = { window: {}, document: { currentScript: null } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/boot.js'), 'utf8'), ctx);
  const { localPath } = ctx.window.DeckBoot;

  const PAGE = /\.html?$/i.test(INPUT);
  const pagePath = PAGE ? INPUT : path.join(baseDir, 'index.html');
  const pageDir = path.dirname(pagePath);
  const launcher = !PAGE && fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : null;
  const useLauncher = !!launcher && isLauncher(launcher);
  const pageHtml = PAGE ? fs.readFileSync(pagePath, 'utf8') : useLauncher ? launcher : `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>deck</title>
</head>
<body>
<div class="reveal"><div class="slides"></div></div>
<script src="${posix(path.relative(pageDir, path.join(ROOT, 'js/boot.js')))}"></script>
</body>
</html>
`;

  // Output name: the file name (the folder name for common names like deck.md, slides.md, index.html)
  const base0 = path.basename(INPUT).replace(/\.(md|markdown|html?)$/i, '');
  const name = /^(talk|deck|index|slides|readme)$/i.test(base0) ? path.basename(path.dirname(INPUT)) : base0;
  const out = path.resolve(OUT_ARG || path.join(path.dirname(INPUT), 'dist', `${name}.${MODE}.html`));
  if ([INPUT, pagePath, path.join(pageDir, 'deck.config.js')].includes(out)) die(`output file is the same as an original: ${show(out)}`);
  if (fs.existsSync(out) && !FORCE) die(`already exists: ${show(out)} (use --force to overwrite)`);

  // Page URL = the file path as is (http://deck.local/<absolute path>). Any file on disk as if on the same server
  const HOST = 'http://deck.local';
  const toUrl = p => HOST + pathToFileURL(p).pathname;
  const toFile = u => fileURLToPath(`file://${new URL(u).pathname}`);
  const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf' };
  const mimeOf = u => MIME[path.extname(new URL(u).pathname).toLowerCase()] || 'application/octet-stream';
  const pageUrl = toUrl(pagePath);
  // When the launcher page loads deckmd from the CDN (…/npm/deckmd@version/js/boot.js, …/gh/account/deckmd@vversion/…)
  const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const SELF = /^https:\/\/cdn\.jsdelivr\.net\/(?:npm\/deckmd|gh\/[^/]+\/deckmd)@v?([^/]+)\/(.+)$/;
  const warned = new Set();
  // URL → content. null if missing (404)
  async function load(u) {
    const url = new URL(u);
    if (url.origin === HOST) {
      if (url.href.split(/[?#]/)[0] === pageUrl) return Buffer.from(pageHtml);
      const f = toFile(url.href);
      return fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null;
    }
    const clean = url.href.split(/[?#]/)[0];
    const self = SELF.exec(clean);                                             // deckmd itself on the CDN: this folder's files if the version matches
    if (self && self[1] === VERSION) { const f = path.join(ROOT, self[2]); return fs.existsSync(f) ? fs.readFileSync(f) : null; }
    if (self && !warned.has(self[1])) { warned.add(self[1]); console.warn(`  · deckmd@${self[1]} differs from this deckmd (${VERSION}), so it is read from the CDN`); }
    const v = path.join(ROOT, localPath(clean));                               // library: the local copy if there is one
    if (fs.existsSync(v)) return fs.readFileSync(v);
    const res = await fetch(url.href);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  const respond = async (u) => {
    const buf = await load(u).catch(() => null);
    return buf ? new Response(buf, { headers: { 'Content-Type': mimeOf(u) } }) : new Response('', { status: 404 });
  };

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('error', (...a) => errors.push(a.join(' ')));
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) errors.push(e.message); });
  const src = PAGE ? '' : `?src=${encodeURIComponent(posix(path.relative(pageDir, INPUT)))}`;
  const dom = new JSDOM(pageHtml, {
    url: pageUrl + src, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    resources: { interceptors: [requestInterceptor(req => respond(req.url))] },
    beforeParse(w) {
      // Missing in jsdom: fetch (used by pack.js), matchMedia and ResizeObserver (used by reveal.js)
      w.fetch = async (u) => {
        const url = new URL(String(u), w.location.href).href;
        const buf = await load(url).catch(() => null);
        return { ok: !!buf, status: buf ? 200 : 404, text: async () => buf.toString('utf8'), blob: async () => new w.Blob([buf], { type: mimeOf(url) }) };
      };
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    },
  });
  const w = dom.window;
  const failed = () => /Can't open the deck/.test(w.document.body?.textContent || '');            // deck.js fail() screen
  for (let i = 0; i < 300; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (failed() || (w.DeckPack && w.document.querySelectorAll('.slides > section').length)) break;
  }
  if (!w.DeckPack || failed() || !w.document.querySelectorAll('.slides > section').length) {
    const msg = (w.document.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    console.error(`could not open the deck: ${show(INPUT)}${msg ? `\n  screen: ${msg}` : ''}${errors.length ? `\n  ${errors.slice(0, 5).join('\n  ')}` : ''}`);
    process.exit(1);
  }
  const res = await w.DeckPack.pack(MODE, () => {});
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, res.html);
  console.log(`${show(out)}  ${size(Buffer.byteLength(res.html))}  (${MODE})`);
  if (res.missing.length) console.warn(`  ! not found, not embedded: ${res.missing.join(', ')}`);
  if (res.external?.length) console.warn(`  ! external references (not embedded, needed when opening): ${res.external.join(', ')}`);
  w.close();
  process.exit(0);               // exit even if reveal.js timers remain
}

// ── Unpack ───────────────────────────────────────────────────────
// Split by the marks pack.js left when packing: data-from="deckmd" = deckmd's files, data-src https:// = libraries → not extracted.
// data-file = original location of a user file (relative to the launcher page), the Markdown has data-path, images are in the deck-assets table (relative to the Markdown; starting with '/', to the launcher page).
// Fonts and images embedded as data: inside user CSS are left as is, since their original names are unknown.
function unpack() {
  const html = fs.readFileSync(INPUT, 'utf8');
  const outDir = path.resolve(OUT_ARG || INPUT.replace(/\.html?$/i, ''));
  const unsafe = s => s.replace(/<\\\/script/gi, '</script');
  const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m => [m[1], (m[2] ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')]));
  const files = new Map();        // extract location → content
  const skipped = [], kept = [];
  let mdPath = null;
  for (const m of html.matchAll(/<(style|script)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const a = attrs(m[2]);
    const text = unsafe(m[3]).replace(/^\n/, '').replace(/\n$/, '');
    if (a.type === 'text/markdown') { mdPath = a['data-path'] || 'talk.md'; files.set(mdPath, text.endsWith('\n') ? text : `${text}\n`); continue; }
    if (a.id === 'deck-meta') { console.error('bundled files of pages with slides written directly (HTML decks) cannot be unpacked yet'); process.exit(1); }
    if (!a['data-src']) continue;
    if (a['data-from'] === 'deckmd' || /^https?:/.test(a['data-src'])) { skipped.push(a['data-src']); continue; }
    const where = a['data-file'] || a['data-src'];              // older bundles without marks: the written path as is
    files.set(where, text);
    if (m[1] === 'style' && /url\(\s*["']?data:/.test(text)) kept.push(where);
  }
  const table = /<script type="application\/json" id="deck-assets">([\s\S]*?)<\/script>/.exec(html);
  if (table) {
    const mdDir = path.posix.dirname(mdPath || 'talk.md');
    for (const [ref, uri] of Object.entries(JSON.parse(unsafe(table[1])))) {
      const m = /^data:[^;,]*(;base64)?,(.*)$/s.exec(uri);
      if (!m) continue;
      const where = ref.startsWith('/') ? ref.replace(/^\/+/, '') : path.posix.join(mdDir, decodeURI(ref));
      files.set(where, m[1] ? Buffer.from(m[2], 'base64') : decodeURIComponent(m[2]));
    }
  }
  if (!files.size) die('no user files to extract (is this a file packed with deckmd?)');

  const plan = [...files].map(([where, data]) => [path.resolve(outDir, path.posix.normalize(where)), where, data]);
  const outside = plan.filter(([abs]) => !abs.startsWith(outDir + path.sep));
  if (outside.length) console.warn(`  ! skipped, outside the extract folder: ${outside.map(p => p[1]).join(', ')}`);
  const todo = plan.filter(p => !outside.includes(p));
  const exist = todo.filter(([abs]) => fs.existsSync(abs));
  if (exist.length && !FORCE) die(`already exists: ${exist.map(([abs]) => show(abs)).join(', ')} (use --force to overwrite)`);
  for (const [abs, , data] of todo) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, data); }
  console.log(`${show(outDir)}/  ${todo.length} files: ${todo.map(p => p[1]).join(', ')}`);
  if (skipped.length) console.log(`  (not extracted: ${skipped.length} libraries / deckmd files)`);
  if (kept.length) console.warn(`  ! fonts and images embedded in CSS are left as is (original names unknown): ${kept.join(', ')}`);
}

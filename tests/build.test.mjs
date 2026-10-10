// Pack / unpack (tools/build.mjs) tests — node --test tests/build.test.mjs  (needs jsdom: npm install)
// Output stays in tests/out/ (tests/browser.html opens it again in the browser).
// Bundles that embed libraries use the local copy in vendor/, or the internet if there is none.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests/out');
const BUILD = path.join(ROOT, 'tools/build.mjs');

function build(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [BUILD, ...args], { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout, err: r.stderr };
}
// Make one output file and return its content
function make(input, name, ...flags) {
  const out = path.join(OUT, name);
  const r = build([input, ...flags, '-o', out, '--force']);
  assert.ok(r.ok, r.err);
  return { html: fs.readFileSync(out, 'utf8'), ...r };
}
// Look at tags only: text inside <script>/<style> (embedded library code) is removed
const tags = html => html.replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2>)/g, '$1$3');
const keys = html => [...tags(html).matchAll(/<(?:script|style|link)\b[^>]*\bdata-src="([^"]+)"/g)].map(m => m[1]);
const links = html => [...tags(html).matchAll(/<(?:script|link|img)\b[^>]*?\s(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('data:'));
const external = html => links(html).filter(u => /^https?:/.test(u));

before(() => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
});

test('offline: everything inside, no outside references', () => {
  const { html } = make('examples/grid/talk.md', 'grid.offline.html', '--offline');
  assert.deepEqual(external(html), []);
  assert.deepEqual(links(html), []);
  const k = keys(html);
  for (const want of ['js/defaults.js', 'js/deck.js', 'js/pack.js', 'css/base.css', 'themes/solarized/solarized.css', 'plugins/grid/grid.js', 'plugins/grid/grid.css', 'deck.config.js']) assert.ok(k.includes(want), want);
  assert.ok(k.some(x => x.startsWith('https://cdn.jsdelivr.net/npm/reveal.js@')), 'library keys are CDN URLs');
  assert.match(html, /url\(["']?data:font\/woff2;base64,/);
  assert.match(html, /<script type="text\/markdown" data-base="[^"]*" data-path="examples\/grid\/talk\.md">/, 'original location of the Markdown');
  assert.match(html, /<!-- Included libraries and fonts[\s\S]*reveal\.js — MIT — https:\/\/cdn\.jsdelivr\.net\/npm\/reveal\.js@[^/]+\/LICENSE[\s\S]*Pretendard font — OFL-1\.1/, 'license comment');
});

test('share: libraries as CDN links, the rest inside', () => {
  const { html } = make('examples/grid/talk.md', 'grid.share.html', '--share');
  const ext = external(html);
  assert.ok(ext.length >= 10 && ext.every(u => u.startsWith('https://cdn.jsdelivr.net/')), ext.join('\n'));
  assert.equal(links(html).length, ext.length, 'no local links');
  assert.ok(keys(html).includes('js/deck.js'));
});

test('deck written in HTML', () => {
  const { html } = make('examples/page/index.html', 'page.offline.html', '--offline');
  assert.deepEqual(external(html), []);
  assert.match(html, /src="data:image\/svg\+xml;base64,/, 'image attributes replaced directly');
});

test('assets: embedded; missing ones and outside references are warned about', () => {
  const { html, err } = make('tests/fixtures/assets/talk.md', 'assets.offline.html', '--offline');
  const table = JSON.parse(/<script type="application\/json" id="deck-assets">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.deepEqual(Object.keys(table), ['img/dot.svg', 'img/clip.mp4']);
  assert.match(table['img/clip.mp4'], /^data:video\/mp4;base64,/);
  assert.match(err, /not found, not embedded: img\/none\.png/);
  assert.match(err, /external references.*https:\/\/example\.com\/x\.png/);
});

test('the other test decks pack too (browser.html opens them)', () => {
  make('examples/syntax/talk.md', 'syntax.offline.html', '--offline');
  make('tests/fixtures/parse/talk.md', 'parse.offline.html', '--offline');
  make('tests/fixtures/headings/talk.md', 'headings.offline.html', '--offline');
});

test('non-ASCII and space in paths', () => {
  const dir = path.join(OUT, 'ünïcode dir');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'tests/fixtures/parse/talk.md'), path.join(dir, 'talk.md'));
  const r = build(['talk.md', '--offline', '-o', 'résult file.html'], dir);   // a place without a launcher page → one-line boot.js page
  assert.ok(r.ok, r.err);
  const html = fs.readFileSync(path.join(dir, 'résult file.html'), 'utf8');
  assert.deepEqual(external(html), []);
  assert.match(html, /inside-code/);
});

test('overwrite: error if it exists, overwritten with --force, never the originals even with --force', () => {
  const out = path.join(OUT, 'overwrite.html');
  assert.ok(build(['examples/grid/talk.md', '-o', out]).ok);
  const again = build(['examples/grid/talk.md', '-o', out]);
  assert.ok(!again.ok);
  assert.match(again.err, /already exists/);
  assert.ok(build(['examples/grid/talk.md', '-o', out, '--force']).ok);
  for (const src of ['index.html', 'deck.config.js', 'examples/grid/talk.md']) {
    const r = build(['examples/grid/talk.md', '-o', src, '--force']);
    assert.ok(!r.ok, src);
    assert.match(r.err, /same as an original/);
  }
});

test('option checks', () => {
  for (const [args, msg] of [
    [['examples/grid/talk.md', '--bogus'], /unknown option/],
    [['examples/grid/talk.md', '--offline', '--share'], /only one bundle mode/],
    [['examples/grid/talk.md', '-o'], /-o needs/],
    [['examples/grid/talk.md', 'examples/syntax/talk.md'], /only one input/],
    [['examples/grid/talk.md', '--share', '--unpack'], /cannot be used together/],
    [['examples/grid/talk.md', '--folder'], /unknown option/],
  ]) {
    const r = build(args);
    assert.ok(!r.ok, args.join(' '));
    assert.match(r.err, msg);
  }
});

test("paths starting with '/' are relative to the launcher page (wherever the deck is)", () => {
  const dir = path.join(OUT, 'slash/deep/er');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'talk.md'), '---\ntitle: t\ntheme: /themes/ember/ember.css\n---\n\n## a\n');
  const { html, err } = make(path.relative(ROOT, path.join(dir, 'talk.md')), 'slash.html', '--offline');
  assert.ok(keys(html).includes('themes/ember/ember.css'), 'theme relative to the launcher page is included');
  assert.doesNotMatch(err, /not found, not embedded/, 'no not-found warning');
});

test('a theme path that is a directory means the <name>.css inside it', () => {
  const dir = path.join(OUT, 'theme-dir');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, theme] of [['abs', '/themes/ember'], ['slash', '/themes/ember/'], ['rel', '../../../themes/ember']]) {
    fs.writeFileSync(path.join(dir, `${name}.md`), `---\ntitle: t\ntheme: ${theme}\n---\n\n## a\n`);
    const { html, err } = make(path.relative(ROOT, path.join(dir, `${name}.md`)), `theme-dir-${name}.html`, '--offline');
    assert.ok(keys(html).some(k => k.endsWith('themes/ember/ember.css')), theme);
    assert.doesNotMatch(err, /not found, not embedded/, `${theme}: no not-found warning`);
  }
});

test('theme: reveal/white = reveal.js built-in theme (offline embeds it, share leaves the URL)', () => {
  const dir = path.join(OUT, 'reveal-theme');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'talk.md'), '---\ntitle: t\ntheme: reveal/white\n---\n\n## a\n');
  const src = path.relative(ROOT, path.join(dir, 'talk.md'));
  const want = /^https:\/\/cdn\.jsdelivr\.net\/npm\/reveal\.js@[^/]+\/dist\/theme\/white\.css$/;
  const off = make(src, 'reveal-theme.offline.html', '--offline');
  assert.ok(keys(off.html).some(k => want.test(k)), 'offline: theme is included');
  assert.deepEqual(external(off.html), []);
  const share = make(src, 'reveal-theme.share.html', '--share');
  assert.ok(!keys(share.html).some(k => want.test(k)), 'share: not embedded (deck.js loads it from the CDN)');
});

test('plugin given as a URL: offline embeds it (and the CSS the plugin loads), share leaves the URL', async () => {
  // A server on another origin (separate process, so it answers while build runs via spawnSync). Serves the repository files as is
  const srv = spawn(process.execPath, ['-e', `
    const http = require('http'), fs = require('fs'), path = require('path');
    const s = http.createServer((q, r) => {
      const f = path.join(${JSON.stringify(ROOT)}, decodeURIComponent(q.url.split('?')[0]));
      fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': f.endsWith('.css') ? 'text/css' : 'text/javascript' }); r.end(b); } });
    }).listen(0, '127.0.0.1', () => console.log(s.address().port));`]);
  try {
    const port = await new Promise((ok, no) => { srv.stdout.once('data', d => ok(String(d).trim())); srv.once('error', no); });
    const url = `http://127.0.0.1:${port}/plugins/grid/grid.js`;
    const dir = path.join(OUT, 'url-plugin');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'talk.md'), `---\ntitle: t\nplugins: [${url}]\n---\n\n## a\n\n\`\`\`grid {size=1x4}\n0 x cool\n\`\`\`\n`);
    const src = path.relative(ROOT, path.join(dir, 'talk.md'));
    const off = make(src, 'url-plugin.offline.html', '--offline');
    for (const k of [url, url.replace(/\.js$/, '.css')]) assert.ok(keys(off.html).includes(k), `offline: ${k}`);
    assert.deepEqual(external(off.html), []);
    const share = make(src, 'url-plugin.share.html', '--share');
    assert.ok(!keys(share.html).includes(url), 'share: not embedded (deck.js loads it by URL)');
  } finally { srv.kill(); }
});

// npx deckmd init: [--cdn | --repo] where deckmd comes from, [--single | --multi] how the decks are laid out
const tree = dir => fs.readdirSync(dir, { recursive: true }).filter(f => fs.statSync(path.join(dir, f)).isFile()).map(f => f.split(path.sep).join('/')).sort();
const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const SINGLE = ['index.html', 'slides.md'];
const MULTI = ['deck.config.js', 'index.html', 'slides/first-deck/deck.md'];

test('init (default = cdn, single): index.html + slides.md, deckmd from the CDN at this version; again → stops, changes nothing', () => {
  const dir = path.join(OUT, 'init-cdn');
  fs.mkdirSync(dir, { recursive: true });
  const r = build(['init'], dir);
  assert.ok(r.ok, r.err);
  assert.deepEqual(tree(dir), SINGLE);
  const index = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(index.includes(`https://cdn.jsdelivr.net/npm/deckmd@${PKG_VERSION}/js/boot.js`));
  assert.doesNotMatch(index, /VERSION|"deckmd\/js\/boot\.js"/);
  fs.writeFileSync(path.join(dir, 'slides.md'), '# mine\n');
  const again = build(['init'], dir);
  assert.ok(!again.ok);
  for (const f of SINGLE) assert.ok(again.err.includes(f), `lists ${f}`);
  assert.equal(fs.readFileSync(path.join(dir, 'slides.md'), 'utf8'), '# mine\n', 'not overwritten');
});

test('init --multi: index.html, deck.config.js and slides/first-deck/deck.md; one existing file stops it before anything is created', () => {
  const dir = path.join(OUT, 'init-multi');
  fs.mkdirSync(dir, { recursive: true });
  assert.ok(build(['init', '--multi'], dir).ok);
  assert.deepEqual(tree(dir), MULTI);
  assert.match(fs.readFileSync(path.join(dir, 'deck.config.js'), 'utf8'), /home: 'list'/);

  const part = path.join(OUT, 'init-partial/sub');                 // a folder argument works too
  fs.mkdirSync(part, { recursive: true });
  fs.writeFileSync(path.join(part, 'deck.config.js'), 'mine');
  const r = build(['init', 'sub', '--multi'], path.dirname(part));
  assert.ok(!r.ok);
  assert.match(r.err, /deck\.config\.js/);
  assert.deepEqual(tree(part), ['deck.config.js'], 'nothing else created');
  assert.ok(build(['init', 'new/place'], path.dirname(part)).ok);
  assert.deepEqual(tree(path.join(path.dirname(part), 'new/place')), SINGLE);
  assert.ok(build(['init', 'sub'], path.dirname(part)).ok, '--single creates no deck.config.js, so an existing one is fine');
});

test('init --repo: also deckmd/ (the runtime, not tests or vendor); an existing deckmd/ stops it, but not --cdn', () => {
  const dir = path.join(OUT, 'init-repo');
  fs.mkdirSync(dir, { recursive: true });
  const r = build(['init', '--repo', '--multi'], dir);
  assert.ok(r.ok, r.err);
  const files = tree(dir);
  for (const f of [...MULTI, 'deckmd/js/boot.js', 'deckmd/js/deck.js', 'deckmd/css/base.css', 'deckmd/themes/ember/ember.css', 'deckmd/plugins/grid/grid.js',
    'deckmd/templates/deck.md', 'deckmd/tools/build.mjs', 'deckmd/package.json', 'deckmd/LICENSE']) assert.ok(files.includes(f), f);
  assert.ok(!files.some(f => /^deckmd\/(vendor|tests|examples|node_modules)\//.test(f)));
  assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /src="deckmd\/js\/boot\.js"/);
  assert.ok(!build(['init', '--repo', '--multi'], dir).ok, 'again');

  const only = path.join(OUT, 'init-only-deckmd');
  fs.mkdirSync(path.join(only, 'deckmd'), { recursive: true });
  const refused = build(['init', '--repo'], only);
  assert.ok(!refused.ok);
  assert.match(refused.err, /deckmd\//);
  assert.deepEqual(tree(only), [], 'nothing created');
  assert.ok(build(['init'], only).ok, '--cdn does not mind a deckmd/ folder');
});

test('init: option errors and help', () => {
  for (const [args, msg] of [[['--cdn', '--repo'], /only one of --cdn, --repo/], [['--single', '--multi'], /only one of --single, --multi/],
    [['--nope'], /unknown option: --nope/], [['a', 'b'], /only one folder/]]) {
    const r = build(['init', ...args], OUT);
    assert.ok(!r.ok, args.join(' '));
    assert.match(r.err, msg);
  }
  const help = build(['init', '--help'], OUT);
  assert.ok(help.ok);
  assert.match(help.out, /--cdn.*--repo.*--single.*--multi/s);
  assert.doesNotMatch(help.out, /import fs/);
});

test('init: every combination makes a project that packs (offline, no outside references)', () => {
  for (const mode of ['cdn', 'repo']) for (const layout of ['single', 'multi']) {
    const dir = path.join(OUT, `init-pack-${mode}-${layout}`);
    fs.mkdirSync(dir, { recursive: true });
    assert.ok(build(['init', `--${mode}`, `--${layout}`], dir).ok);
    const r = build([layout === 'single' ? 'slides.md' : 'slides/first-deck/deck.md', '--offline'], dir);
    assert.ok(r.ok, `${mode} ${layout}: ${r.err}`);
    const packed = tree(dir).filter(f => /\.offline\.html$/.test(f));
    assert.equal(packed.length, 1, `${mode} ${layout}: ${packed}`);
    const html = fs.readFileSync(path.join(dir, packed[0]), 'utf8');
    assert.deepEqual(external(html), [], `${mode} ${layout}`);
    assert.match(html, /Talk title/);
  }
});

test('add <name> [title]: slides/<name>/deck.md from the starter, title and date filled in; never overwrites', () => {
  const dir = path.join(OUT, 'add');
  fs.mkdirSync(dir, { recursive: true });
  const bare = build(['add', 'x'], dir);
  assert.ok(!bare.ok);
  assert.match(bare.err, /doesn't look like a --multi deckmd repository/);
  assert.ok(build(['init', '--multi'], dir).ok);

  const r = build(['add', 'my-slide-dir', 'My', 'slide', 'title'], dir);   // an unquoted title is joined
  assert.ok(r.ok, r.err);
  const md = fs.readFileSync(path.join(dir, 'slides/my-slide-dir/deck.md'), 'utf8');
  assert.match(md, /^---\ntitle: "My slide title"\n/);
  assert.match(md, /^# My slide title$/m);
  assert.doesNotMatch(md, /Talk title|2026-00-00/);
  assert.match(md, new RegExp(`· ${new Date().toLocaleDateString('sv-SE')}\\]`));

  assert.ok(build(['add', 'quick-demo'], dir).ok);
  assert.match(fs.readFileSync(path.join(dir, 'slides/quick-demo/deck.md'), 'utf8'), /^---\ntitle: "Quick demo"\n/, 'title from the name');

  const again = build(['add', 'my-slide-dir', 'Other'], dir);
  assert.ok(!again.ok);
  assert.match(again.err, /already exists: slides\/my-slide-dir\/deck\.md/);
  assert.equal(fs.readFileSync(path.join(dir, 'slides/my-slide-dir/deck.md'), 'utf8'), md, 'not overwritten');

  for (const bad of ['../x', 'a/b', '.hidden', 'a:b', 'what?']) {
    const e = build(['add', bad], dir);
    assert.ok(!e.ok, bad);
    assert.match(e.err, /is a folder name/);
  }
  assert.ok(!build(['add'], dir).ok);
  assert.ok(!build(['add', 'x', '--nope'], dir).ok);
  assert.match(build(['add', '--help'], dir).out, /add <name> \[title\]/);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'slides')).sort(), ['first-deck', 'my-slide-dir', 'quick-demo'], 'invalid names created nothing');
});

test('add: a title with quotes and colons is still valid front matter, and the new deck packs', () => {
  const dir = path.join(OUT, 'add-pack');
  fs.mkdirSync(dir, { recursive: true });
  assert.ok(build(['init', '--multi'], dir).ok);
  assert.ok(build(['add', 'odd', 'He said "hi": it\'s #1'], dir).ok);
  const r = build(['slides/odd/deck.md', '--offline'], dir);
  assert.ok(r.ok, r.err);
  const packed = fs.readdirSync(path.join(dir, 'slides/odd/dist')).find(f => /\.offline\.html$/.test(f));
  const html = fs.readFileSync(path.join(dir, 'slides/odd/dist', packed), 'utf8');
  assert.match(html, /<title>He said &quot;hi&quot;: it's #1<\/title>|<title>He said "hi": it's #1<\/title>/);
});

// npx deckmd serve: one deck, a deck list, or the current folder
async function withServe(args, cwd, fn) {
  const child = spawn(process.execPath, [BUILD, 'serve', ...args, '--port', '0'], { cwd });
  let err = '', printed = '';
  child.stderr.on('data', d => { err += d; });
  try {
    const base = await new Promise((ok, no) => {
      const giveUp = setTimeout(() => no(new Error(`serve printed no address in 10 s. stdout: ${printed} stderr: ${err}`)), 10000);   // never wait forever
      child.stdout.on('data', (d) => { printed += d; const m = /http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+\//.exec(printed); if (m) { clearTimeout(giveUp); ok(m[0]); } });
      child.once('exit', (code) => { clearTimeout(giveUp); no(new Error(`serve exited ${code}: ${err}`)); });
    });
    return await fn(base, printed);
  } finally { child.kill(); }
}
const get = async (url) => { const r = await fetch(url); return { status: r.status, type: r.headers.get('content-type'), text: await r.text() }; };
const raw = (base, p) => new Promise((ok, no) => { const u = new URL(base); http.get({ host: u.hostname, port: u.port, path: p }, r => { r.resume(); ok(r.statusCode); }).on('error', no); });   // no URL cleaning: '..' stays

test('serve my-deck.md: a launcher page and a config made on the fly, deckmd from the package, files from disk', async () => {
  const dir = path.join(OUT, 'serve-one');
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'tests/fixtures/assets/img/dot.svg'), path.join(dir, 'img/dot.svg'));
  fs.writeFileSync(path.join(dir, 'my deck.md'), '---\ntitle: Served\n---\n\n# One\n\n![](img/dot.svg)\n');
  fs.writeFileSync(path.join(dir, '.secret'), 'no');
  for (const f of ['key.pem', 'data.sqlite', 'backup.zip', 'id_rsa']) fs.writeFileSync(path.join(dir, f), 'private');   // not slide or web files
  for (const f of ['notes.txt', 'data.csv', 'font.woff2']) fs.writeFileSync(path.join(dir, f), 'ok');
  await withServe(['my deck.md'], dir, async (base) => {
    for (const p of ['key.pem', 'data.sqlite', 'backup.zip', 'id_rsa']) {
      const r = await get(base + p);
      assert.equal(r.status, 404, p);
      assert.match(r.text, /this file type is not served/, p);
    }
    for (const p of ['notes.txt', 'data.csv', 'font.woff2']) assert.equal((await get(base + p)).status, 200, p);
    const index = await get(base);
    assert.equal(index.status, 200);
    assert.match(index.type, /text\/html/);
    assert.match(index.text, /src="\/_deckmd\/js\/boot\.js" data-config="\/_deckmd\/config\.js"/);
    const cfg = (await get(`${base}_deckmd/config.js`)).text;
    assert.match(cfg, /"home": "deck"/);
    assert.match(cfg, /"src": "my deck\.md"/);
    assert.match((await get(`${base}my%20deck.md`)).text, /title: Served/);
    assert.match((await get(`${base}img/dot.svg`)).type, /image\/svg\+xml/);
    for (const p of ['_deckmd/js/deck.js', '_deckmd/js/boot.js', '_deckmd/css/base.css', '_deckmd/themes/ember/ember.css', '_deckmd/plugins/grid/grid.js']) assert.equal((await get(base + p)).status, 200, p);
    assert.equal((await get(`${base}my%20deck.md`)).text, fs.readFileSync(path.join(dir, 'my deck.md'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'my deck.md'), '# Edited\n');
    assert.equal((await get(`${base}my%20deck.md`)).text, '# Edited\n', 'read from disk on every request');
    for (const p of ['_deckmd/package.json', '_deckmd/tools/build.mjs', '_deckmd/tests/build.test.mjs', '.secret', 'nope.txt']) assert.equal((await get(base + p)).status, 404, p);
    for (const p of ['/%2e%2e/x', '/_deckmd/js/../package.json', '/img/%2e%2e/%2e%2e/x', '/..%5c..%5cx']) assert.ok([400, 404].includes(await raw(base, p)), p);
  });
});

test('serve a.md b.md: a deck list (decks in different folders keep their paths)', async () => {
  const dir = path.join(OUT, 'serve-list');
  fs.mkdirSync(path.join(dir, 'a'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'b'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'a/one.md'), '# One\n');
  fs.writeFileSync(path.join(dir, 'b/two.md'), '# Two\n');
  await withServe(['a/one.md', 'b/two.md'], dir, async (base) => {
    const cfg = (await get(`${base}_deckmd/config.js`)).text;
    assert.match(cfg, /"home": "list"/);
    assert.match(cfg, /"src": "a\/one\.md"/);
    assert.match(cfg, /"src": "b\/two\.md"/);
    assert.equal((await get(`${base}b/two.md`)).status, 200);
  });
});

test('serve (no files): the current folder as it is: its own index.html, folder listings deck.js can scan, no dot files', async () => {
  const dir = path.join(OUT, 'serve-project');
  fs.mkdirSync(dir, { recursive: true });
  assert.ok(build(['init', '--multi'], dir).ok);
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.git/config'), 'secret');
  await withServe([], dir, async (base) => {
    assert.equal((await get(base)).text, fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), "the project's own index.html");
    assert.equal((await get(`${base}_deckmd/config.js`)).status, 404, 'no generated config without files');
    const top = (await get(`${base}slides/`)).text;
    assert.match(top, /href="first-deck\/"/);
    assert.match((await get(`${base}slides/first-deck/`)).text, /href="deck\.md"/);
    assert.equal((await get(`${base}slides/first-deck/deck.md`)).status, 200);
    assert.doesNotMatch((await get(base + 'slides')).text, /secret/);
    assert.equal((await get(`${base}.git/config`)).status, 404);
    assert.doesNotMatch((await get(`${base}slides/`)).text, /\.git/);
  });
  // without files it needs a deckmd index.html: there is a project to serve, or there is nothing to serve
  const bare = path.join(OUT, 'serve-bare');
  fs.mkdirSync(bare, { recursive: true });
  fs.writeFileSync(path.join(bare, 'x.md'), '# x\n');
  const none = build(['serve', '--port', '0'], bare);
  assert.ok(!none.ok);
  assert.match(none.err, /There is no index\.html here, so there is no project to serve/);
  assert.match(none.err, /npx deckmd serve my-deck\.md/);
  assert.match(none.err, /npx deckmd init/);
  fs.writeFileSync(path.join(bare, 'index.html'), '<html><body>my own site</body></html>');
  const foreign = build(['serve', '--port', '0'], bare);
  assert.ok(!foreign.ok);
  assert.match(foreign.err, /index\.html here doesn't load deckmd/);
  fs.writeFileSync(path.join(bare, 'index.html'), '<!-- <script src="deckmd/js/boot.js"></script> just a comment -->\n<html></html>');
  assert.ok(!build(['serve', '--port', '0'], bare).ok, 'a comment about boot.js is not a launcher');
  fs.writeFileSync(path.join(bare, 'index.html'), "<script src='https://cdn.jsdelivr.net/npm/deckmd@0.2.1/js/boot.js'></script>");
  await withServe([], bare, async (base) => assert.match((await get(`${base}x.md`)).text, /# x/));       // a launcher from the CDN counts
  fs.writeFileSync(path.join(bare, 'index.html'), '<script src="js/deck.js"></script>');
  await withServe([], bare, async (base) => assert.equal((await get(`${base}x.md`)).status, 200));      // so does one that lists the tags itself
});

test('serve: never your home folder or one above it', () => {
  for (const dir of [os.homedir(), path.dirname(os.homedir())]) {
    const r = build(['serve', '--port', '0'], dir);
    assert.ok(!r.ok, dir);
    assert.match(r.err, /won't serve .* it is your home folder or one above it/);
  }
});

test('serve a.md inside a project: its index.html and deck.config.js are used, only home, src and decks are replaced', async () => {
  const proj = path.join(OUT, 'serve-project-file');
  fs.mkdirSync(path.join(proj, 'sub'), { recursive: true });
  const index = '<!doctype html>\n<!-- data-config="x.js" is just a comment here -->\n<script src="deckmd/js/boot.js"></script>\n';
  fs.writeFileSync(path.join(proj, 'index.html'), index);
  fs.writeFileSync(path.join(proj, 'deck.config.js'), "window.DeckConfig = {\n  title: 'Mine',\n  theme: 'catppuccin',\n  home: 'list',\n};\n");
  fs.writeFileSync(path.join(proj, 'sub/a.md'), '# A\n');
  await withServe(['sub/a.md'], proj, async (base, printed) => {
    assert.match(printed, /using index\.html and deck\.config\.js from this folder/);
    assert.equal((await get(base)).text, index, "the project's own index.html, not a generated one");
    const cfg = (await get(`${base}deck.config.js`)).text;                 // what the project's page asks for
    assert.ok(cfg.includes("theme: 'catppuccin'") && cfg.includes("title: 'Mine'"), "the project's settings stay");
    assert.match(cfg, /"home": "deck"/);
    assert.match(cfg, /"src": "sub\/a\.md"/);
    assert.equal((await get(`${base}_deckmd/config.js`)).text, cfg, 'the same for a generated launcher');
    fs.writeFileSync(path.join(proj, 'deck.config.js'), "window.DeckConfig = { theme: 'solarized' };\n");
    assert.ok((await get(`${base}deck.config.js`)).text.includes("theme: 'solarized'"), 'read on every request');
  });
  // a custom data-config on the real tag is the file that gets extended
  fs.writeFileSync(path.join(proj, 'index.html'), '<script src="deckmd/js/boot.js" data-config="my.config.js"></script>\n');
  fs.writeFileSync(path.join(proj, 'my.config.js'), "window.DeckConfig = { title: 'Custom' };\n");
  await withServe(['sub/a.md'], proj, async (base, printed) => {
    assert.match(printed, /using index\.html and my\.config\.js/);
    const cfg = (await get(`${base}my.config.js`)).text;
    assert.ok(cfg.includes("title: 'Custom'") && /"src": "sub\/a\.md"/.test(cfg));
  });
  // only a config, no index.html: the generated launcher with the project's settings
  fs.rmSync(path.join(proj, 'index.html'));
  await withServe(['sub/a.md'], proj, async (base, printed) => {
    assert.match(printed, /using my\.config\.js|using deck\.config\.js/);
    assert.match((await get(base)).text, /\/_deckmd\/js\/boot\.js/);
    assert.match((await get(`${base}_deckmd/config.js`)).text, /"src": "sub\/a\.md"/);
  });
  // a config that can't be extended (data-config="none"): not used, said out loud
  fs.writeFileSync(path.join(proj, 'index.html'), '<script src="deckmd/js/boot.js" data-config="none"></script>\n');
  await withServe(['sub/a.md'], proj, async (base, printed) => {
    assert.match(printed, /not using index\.html or deck\.config\.js here: the project's config can't be extended/);
    assert.doesNotMatch((await get(`${base}_deckmd/config.js`)).text, /Custom|catppuccin|solarized/);
    assert.match((await get(base)).text, /\/_deckmd\/js\/boot\.js/, 'the generated launcher');
  });
});

test('serve x.md without a project: only the deck folders, top-level css, themes/ css/ js/ plugins/ and the allowed types are served', async () => {
  const dir = path.join(OUT, 'serve-policy');
  for (const d of ['slides/a/img', 'slides/b', 'private', 'themes', 'plugins/p', 'assets']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const put = (rel, text = 'x') => fs.writeFileSync(path.join(dir, rel), text);
  put('slides/a/deck.md', '# A\n'); put('slides/a/img/x.png'); put('slides/a/notes.pem');
  put('slides/b/other.md'); put('private/secret.txt'); put('assets/logo.png'); put('themes/t.css'); put('plugins/p/p.js');
  put('top.css'); put('top.json'); put('README.md'); put('index.html', '<html>my own site</html>');
  await withServe(['slides/a/deck.md'], dir, async (base, printed) => {
    assert.match(printed, /index\.html here doesn't load deckmd .* so it is not used/);
    assert.match((await get(base)).text, /_deckmd\/js\/boot\.js/, 'the generated launcher, not that index.html');
    for (const p of ['slides/a/deck.md', 'slides/a/img/x.png', 'themes/t.css', 'plugins/p/p.js', 'top.css', '_deckmd/config.js']) assert.equal((await get(base + p)).status, 200, p);
    for (const [p, why] of [['slides/b/other.md', /outside the folders of your decks/], ['private/secret.txt', /outside the folders/], ['assets/logo.png', /outside the folders/],
      ['README.md', /outside the folders/], ['top.json', /outside the folders/], ['slides/', /outside the folders/], ['slides/a/notes.pem', /file type/]]) {
      const r = await get(base + p);
      assert.equal(r.status, 404, p);
      assert.match(r.text, why, p);
    }
    const list = (await get(`${base}slides/a/`)).text;
    assert.match(list, /href="deck\.md"/);
    assert.match(list, /href="img\/"/);
    assert.doesNotMatch(list, /notes\.pem/, 'not listed either');
  });
});

test('serve: the current folder is the root of the site; a deck outside it is refused with the command that works', async () => {
  const top = path.join(OUT, 'serve-root');
  fs.mkdirSync(path.join(top, 'work/slides/a'), { recursive: true });
  fs.mkdirSync(path.join(top, 'work/shared'), { recursive: true });
  fs.mkdirSync(path.join(top, 'other'), { recursive: true });
  fs.writeFileSync(path.join(top, 'work/slides/a/deck.md'), '# A\n\n![](../../shared/dot.svg)\n');
  fs.copyFileSync(path.join(ROOT, 'tests/fixtures/assets/img/dot.svg'), path.join(top, 'work/shared/dot.svg'));
  fs.writeFileSync(path.join(top, 'other/x.md'), '# X\n');
  const work = path.join(top, 'work');
  // a deck in a subfolder: what is next to it, and elsewhere under the current folder, is served (the old root was the deck's own folder)
  await withServe(['slides/a/deck.md'], work, async (base) => {
    assert.match((await get(`${base}_deckmd/config.js`)).text, /"src": "slides\/a\/deck\.md"/);
    assert.equal((await get(`${base}shared/dot.svg`)).status, 404, 'without a project: the folders of the decks only');
    assert.equal((await get(`${base}../other/x.md`)).status, 404, 'nothing above the current folder');
  });
  fs.writeFileSync(path.join(work, 'index.html'), '<script src="deckmd/js/boot.js"></script>\n');          // with a project: the whole folder
  await withServe(['slides/a/deck.md'], work, async (base) => {
    assert.equal((await get(`${base}shared/dot.svg`)).status, 200, 'an image from a sibling folder resolves');
    assert.equal((await get(`${base}../other/x.md`)).status, 404, 'nothing above the current folder');
  });
  fs.rmSync(path.join(work, 'index.html'));
  for (const input of ['../other/x.md', path.join(top, 'other/x.md')]) {
    const r = build(['serve', input, '--port', '0'], work);
    assert.ok(!r.ok, input);
    assert.match(r.err, /is outside the current folder/);
    assert.match(r.err, /cd \.\.\/other && npx deckmd serve x\.md/);
  }
  assert.ok(!build(['serve', 'slides/a/deck.md', '../other/x.md', '--port', '0'], work).ok, 'one deck outside is enough to refuse');
});

const withHost = (base, p, hostHeader) => new Promise((ok, no) => {                    // a request with a chosen Host header
  const u = new URL(base);
  http.get({ host: u.hostname, port: u.port, path: p, headers: { host: hostHeader } }, r => { r.resume(); ok(r.statusCode); }).on('error', no);
});

test('serve: a request with someone else\'s Host is refused (DNS rebinding); localhost, IP addresses and --host name are fine', async () => {
  const dir = path.join(OUT, 'serve-host');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'a.md'), '# secret\n');
  await withServe(['a.md'], dir, async (base) => {
    const port = new URL(base).port;
    for (const h of ['evil.example', `evil.example:${port}`, `localhost.evil.example:${port}`, 'a.md', `127.0.0.1.evil.example:${port}`, 'evil.example.', `x@${port}`]) {
      for (const p of ['/a.md', '/', '/_deckmd/js/deck.js']) assert.equal(await withHost(base, p, h), 403, `${h} ${p}`);
    }
    for (const h of [`localhost:${port}`, 'localhost', `127.0.0.1:${port}`, `[::1]:${port}`, `192.168.1.20:${port}`, `LOCALHOST:${port}`]) assert.equal(await withHost(base, '/a.md', h), 200, h);
  });
  await withServe(['a.md', '--host', '127.0.0.1'], dir, async (base) => {
    assert.equal(await withHost(base, '/a.md', 'evil.example'), 403);
    assert.equal(await withHost(base, '/a.md', '127.0.0.1'), 200);
  });
});

test('serve: a symbolic link is followed only while it stays inside the served folder (or deckmd itself)', async (t) => {
  if (process.platform === 'win32') return t.skip('symlinks need privileges on Windows');
  const dir = path.join(OUT, 'serve-links/site'), outside = path.join(OUT, 'serve-links/outside');
  fs.mkdirSync(path.join(dir, 'inner'), { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ok.md'), '# ok\n');
  fs.writeFileSync(path.join(dir, 'index.html'), '<script src="deckmd/js/boot.js"></script>\n');   // a project: served as it is
  fs.writeFileSync(path.join(dir, 'inner/a.txt'), 'inner');
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'top secret');
  fs.symlinkSync('ok.md', path.join(dir, 'link-file-in.md'));                       // stays inside
  fs.symlinkSync('inner', path.join(dir, 'link-dir-in'));
  fs.symlinkSync(outside, path.join(dir, 'link-dir-out'));                       // leaves the folder
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(dir, 'link-file-out'));
  fs.mkdirSync(path.join(dir, 'deckmd'));                                        // a deckmd/ that links to the package: only its public folders are served through it
  for (const d of ['js', 'themes']) fs.symlinkSync(path.join(ROOT, d), path.join(dir, 'deckmd', d));   // (not ROOT itself: tests/out is inside ROOT, that would be a loop)
  fs.symlinkSync(path.join(ROOT, 'package.json'), path.join(dir, 'deckmd/package.json'));
  fs.symlinkSync(path.join(ROOT, 'package.json'), path.join(dir, 'link-pkg'));
  fs.symlinkSync(path.join(ROOT, 'tools'), path.join(dir, 'deckmd/tools'));
  try { await withServe([], dir, async (base) => {
    assert.equal((await get(`${base}link-file-in.md`)).status, 200);
    assert.equal((await get(`${base}link-dir-in/a.txt`)).text, 'inner');
    assert.equal((await get(`${base}deckmd/js/deck.js`)).status, 200);
    assert.equal((await get(`${base}deckmd/themes/ember/ember.css`)).status, 200);
    for (const p of ['link-dir-out/secret.txt', 'link-file-out', 'link-dir-out/', 'link-pkg', 'deckmd/package.json', 'deckmd/tools/build.mjs']) {
      const r = await get(base + p);
      assert.equal(r.status, 403, p);
      assert.doesNotMatch(r.text, /top secret/, p);
    }
  }); } finally {
    for (const l of fs.readdirSync(dir)) if (fs.lstatSync(path.join(dir, l)).isSymbolicLink()) fs.unlinkSync(path.join(dir, l));   // leave no links behind
    for (const l of fs.readdirSync(path.join(dir, 'deckmd'))) fs.unlinkSync(path.join(dir, 'deckmd', l));
  }
});

test('serve: a link inside an allowed folder can not lead past the policy (another folder, a dot folder, a key file under a harmless name)', async (t) => {
  if (process.platform === 'win32') return t.skip('symlinks need privileges on Windows');
  const dir = path.join(OUT, 'serve-links-policy');
  for (const d of ['slides/a', 'private', '.secrets', 'shared']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const put = (rel, text) => fs.writeFileSync(path.join(dir, rel), text);
  put('slides/a/deck.md', '# A\n'); put('private/secret.txt', 'S3CRET'); put('.secrets/token.txt', 'TOKEN'); put('key.pem', 'PEM'); put('shared/pic.png', 'png');
  fs.symlinkSync('../../private', path.join(dir, 'slides/a/private'));
  fs.symlinkSync('../../.secrets', path.join(dir, 'slides/a/hidden'));
  fs.symlinkSync('../../key.pem', path.join(dir, 'slides/a/key.txt'));
  fs.symlinkSync('../../shared', path.join(dir, 'slides/a/shared'));
  const blocked = ['slides/a/private/secret.txt', 'slides/a/hidden/token.txt', 'slides/a/key.txt', 'slides/a/private/', 'slides/a/hidden/'];
  // without a project: the policy applies to where the link ends up, so another folder, a dot folder and a key file stay hidden
  await withServe(['slides/a/deck.md'], dir, async (base) => {
    assert.equal((await get(`${base}slides/a/deck.md`)).status, 200);
    for (const p of blocked) {
      const r = await get(base + p);
      assert.equal(r.status, 404, p);
      assert.doesNotMatch(r.text, /S3CRET|TOKEN|PEM/, p);
    }
    assert.equal((await get(`${base}slides/a/shared/pic.png`)).status, 404, 'another folder than the deck folders, even through a link');
    assert.doesNotMatch((await get(`${base}slides/a/`)).text, /href="(hidden|private|key\.txt)/, 'links to hidden things are not even listed');
  });
  // in a project: the folder is served as a whole, but dot folders and other types still are not, however they are reached
  put('index.html', '<script src="deckmd/js/boot.js"></script>\n');
  await withServe([], dir, async (base) => {
    for (const p of ['slides/a/hidden/token.txt', 'slides/a/key.txt', 'key.pem', '.secrets/token.txt']) {
      const r = await get(base + p);
      assert.equal(r.status, 404, p);
      assert.doesNotMatch(r.text, /TOKEN|PEM/, p);
    }
    assert.equal((await get(`${base}slides/a/private/secret.txt`)).text, 'S3CRET', 'a project serves its folders, also through a link inside the folder');
    assert.equal((await get(`${base}slides/a/shared/pic.png`)).status, 200);
  });
});

test('serve: a deck.config.js that is a link out of the folder is refused on both endpoints; one that stays inside works', async (t) => {
  if (process.platform === 'win32') return t.skip('symlinks need privileges on Windows');
  const top = path.join(OUT, 'serve-config-link');
  const dir = path.join(top, 'site');
  for (const d of [path.join(dir, 'slides/a'), path.join(dir, 'shared'), path.join(dir, '.hidden'), path.join(top, 'outside')]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(dir, 'slides/a/deck.md'), '# A\n');
  fs.writeFileSync(path.join(dir, 'index.html'), '<script src="deckmd/js/boot.js"></script>\n');
  fs.writeFileSync(path.join(top, 'outside/outside.js'), 'window.OUTSIDE_MARKER = 1;\n');
  fs.writeFileSync(path.join(dir, 'shared/real.config.js'), "window.DeckConfig = { title: 'real' };\n");
  fs.writeFileSync(path.join(dir, '.hidden/hidden.config.js'), "window.DeckConfig = { title: 'hidden' };\n");
  fs.writeFileSync(path.join(dir, 'shared/config.pem'), "window.DeckConfig = { title: 'pem' };\n");
  const link = path.join(dir, 'deck.config.js');
  for (const [target, ok] of [['../outside/outside.js', false], ['.hidden/hidden.config.js', false], ['shared/real.config.js', true]]) {
    fs.rmSync(link, { force: true });
    fs.symlinkSync(target, link);
    await withServe(['slides/a/deck.md'], dir, async (base) => {
      for (const p of ['deck.config.js', '_deckmd/config.js']) {
        const r = await get(base + p);
        if (ok) { assert.equal(r.status, 200, `${target} ${p}`); assert.match(r.text, /title: 'real'/); }
        else { assert.equal(r.status, 403, `${target} ${p}`); assert.doesNotMatch(r.text, /OUTSIDE_MARKER|hidden/, `${target} ${p}`); }
      }
    });
  }
  fs.rmSync(link, { force: true });                                                  // a served type is needed too: a link to a .pem is not a config
  fs.symlinkSync('shared/config.pem', link);
  await withServe(['slides/a/deck.md'], dir, async (base) => assert.equal((await get(`${base}deck.config.js`)).status, 403));
});

test('serve --host 0.0.0.0 warns that the folder is open to the network (and the default does not)', async () => {
  const dir = path.join(OUT, 'serve-warn');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'x.md'), '# x\n');
  await withServe(['x.md', '--host', '0.0.0.0'], dir, async (base, printed) => {
    assert.match(printed, /WARNING: --host 0\.0\.0\.0 opens the folders of your decks .* to your network/);
    assert.equal((await get(`${base}x.md`)).status, 200);
  });
  await withServe(['x.md'], dir, async (base, printed) => assert.doesNotMatch(printed, /WARNING/));
});

test('serve: errors and help', () => {
  const dir = path.join(OUT, 'serve-errors');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'x.txt'), 'x');
  for (const [args, msg] of [[['missing.md'], /not found: missing\.md/], [['x.txt'], /serve takes Markdown files/], [['--port', 'abc'], /--port needs a number/],
    [['--port'], /--port needs a number/], [['--nope'], /unknown option: --nope/], [['--host'], /--host needs/]]) {
    const r = build(['serve', ...args], dir);
    assert.ok(!r.ok, args.join(' '));
    assert.match(r.err, msg);
  }
  const help = build(['serve', '--help'], dir);
  assert.ok(help.ok);
  assert.match(help.out, /serve my-deck\.md/);
  assert.doesNotMatch(help.out, /import fs/);
});

test('pack: Markdown outside the current folder is refused before anything starts, with the command that works', (t) => {
  const top = path.join(OUT, 'pack-outside');
  const work = path.join(top, 'work'), other = path.join(top, 'other');
  fs.mkdirSync(path.join(work, 'talks/a'), { recursive: true });
  fs.mkdirSync(other, { recursive: true });
  for (const f of ['talk.md', 'd.markdown', 't.txt']) fs.writeFileSync(path.join(other, f), '# x\n');   // anything that is not an HTML page counts as Markdown
  fs.writeFileSync(path.join(work, 'talks/a/talk.md'), '# in\n');
  for (const input of ['../other/talk.md', path.join(other, 'talk.md'), '../other/d.markdown', '../other/t.txt']) {
    const r = build([input, '--offline'], work);
    assert.ok(!r.ok, input);
    assert.match(r.err, /is outside the current folder: the launcher page is here and only opens Markdown under it/);
    assert.match(r.err, new RegExp(`cd \\.\\./other && npx deckmd ${path.basename(input).replace('.', '\\.')}`));
    assert.doesNotMatch(r.err, /Can't open the deck|Resume presentation|deck\.config\.js/, 'no browser error screen, no unrelated lines');
    assert.equal(r.out, '', 'nothing printed as a result');
  }
  assert.ok(!fs.existsSync(path.join(other, 'dist')) && !fs.existsSync(path.join(work, 'dist')), 'no output folder anywhere');
  // under the current folder: as before, without and with an index.html
  assert.ok(build(['talks/a/talk.md', '--offline'], work).ok);
  assert.ok(build(['init', '--multi'], work).ok);
  assert.ok(build(['slides/first-deck/deck.md', '--offline'], work).ok);
  // judged by the written path like deck.js does: a link inside the folder counts as inside
  if (process.platform !== 'win32') {
    fs.symlinkSync('../other', path.join(work, 'linked'));
    try { assert.ok(build(['linked/talk.md', '--offline'], work).ok, 'a link inside the folder'); } finally { fs.unlinkSync(path.join(work, 'linked')); }
  } else t.diagnostic('symlinks skipped on Windows');
  // an HTML page is the launcher itself: no such rule
  const page = build([path.join(ROOT, 'examples/page/index.html'), '--offline', '-o', path.join(top, 'page.html')], work);
  assert.ok(page.ok, page.err);
});

test('DeckMD.version equals package.json (npm version bumps both)', () => {
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const m = /^\s*version: '([^']*)',/m.exec(fs.readFileSync(path.join(ROOT, 'js/deck.js'), 'utf8'));
  assert.equal(m?.[1], version);
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, version, 'package-lock.json');
  assert.equal(lock.packages[''].version, version, 'package-lock.json packages[""]');
});

test("images starting with '/' are relative to the launcher page too (files outside the deck folder are included)", () => {
  const dir = path.join(OUT, 'slash-img');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'talk.md'), '---\ntitle: t\n---\n\n## a\n\n![](/tests/fixtures/assets/img/dot.svg)\n\n![](//example.com/x.png)\n');
  const { html, err } = make(path.relative(ROOT, path.join(dir, 'talk.md')), 'slash-img.html', '--offline');
  const table = JSON.parse(/<script type="application\/json" id="deck-assets">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.deepEqual(Object.keys(table), ['/tests/fixtures/assets/img/dot.svg']);
  assert.match(table['/tests/fixtures/assets/img/dot.svg'], /^data:image\/svg\+xml;base64,/);
  assert.match(err, /\/\/example\.com/, 'protocol-relative URLs are reported as outside references');
});

test('unpack: only user files back to their places; packing again gives the same result', () => {
  // The real-world layout: deckmd/ inside a presentation repository (here a link pointing to this repository)
  const repo = path.join(OUT, 'unpack-repo');
  const w = (f, t) => { fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); fs.writeFileSync(path.join(repo, f), t); };
  fs.mkdirSync(repo, { recursive: true });
  fs.symlinkSync(ROOT, path.join(repo, 'deckmd'), 'junction');
  w('index.html', fs.readFileSync(path.join(ROOT, 'templates/index.html'), 'utf8'));
  w('deck.config.js', "window.DeckConfig = { theme: 'catppuccin', css: ['my.css'] };\n");
  w('my.css', ':root { --accent: #f0f; }\n');
  w('talks/t1/talk.md', '---\ntitle: t\ncss: [talk.css]\nplugins: [./hello.js, grid]\n---\n\n## One\n\n![](img/a.svg)\n');
  w('talks/t1/talk.css', '.reveal h2 { color: #0c0; }\n');
  w('talks/t1/hello.js', "DeckMD.loadCSS('./hello.css');\n");
  w('talks/t1/hello.css', 'h2 { text-decoration: underline; }\n');
  w('talks/t1/img/a.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>\n');
  const packed = path.join(OUT, 'unpack.offline.html');
  let r = build(['talks/t1/talk.md', '-o', packed, '--force'], repo);
  assert.ok(r.ok, r.err);

  const back = path.join(OUT, 'unpack-back');
  r = build([packed, '--unpack', '-o', back]);
  assert.ok(r.ok, r.err);
  const got = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => (e.isDirectory() ? walk(path.join(d, e.name)) : got.push(path.relative(back, path.join(d, e.name)).split(path.sep).join('/'))));
  walk(back);
  const want = ['deck.config.js', 'my.css', 'talks/t1/talk.md', 'talks/t1/talk.css', 'talks/t1/hello.js', 'talks/t1/hello.css', 'talks/t1/img/a.svg'];
  assert.deepEqual(got.sort(), [...want].sort(), 'only user files (no deckmd files or libraries)');
  for (const f of want) assert.equal(fs.readFileSync(path.join(back, f), 'utf8'), fs.readFileSync(path.join(repo, f), 'utf8'), f);

  assert.ok(!build([packed, '--unpack', '-o', back]).ok, 'error if it already exists');
  assert.ok(build([packed, '--unpack', '-o', back, '--force']).ok);

  // Adding just deckmd/ and index.html to what was extracted lets it be packed again, with the same result
  fs.symlinkSync(ROOT, path.join(back, 'deckmd'), 'junction');
  fs.copyFileSync(path.join(repo, 'index.html'), path.join(back, 'index.html'));
  const again = path.join(OUT, 'unpack.again.html');
  r = build(['talks/t1/talk.md', '-o', again, '--force'], back);
  assert.ok(r.ok, r.err);
  assert.equal(fs.readFileSync(again, 'utf8'), fs.readFileSync(packed, 'utf8'));
});

test('launcher page loading deckmd from the CDN: same version uses this folder\'s files, another version is reported and read from the CDN', () => {
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const dir = path.join(OUT, 'cdn-self');
  fs.mkdirSync(path.join(dir, 'talks/t1'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'talks/t1/talk.md'), '---\ntitle: t\ntheme: catppuccin\nplugins: [grid]\n---\n\n## One\n');
  const page = v => fs.readFileSync(path.join(ROOT, 'templates/index.html'), 'utf8').replace('deckmd/js/boot.js', `https://cdn.jsdelivr.net/npm/deckmd@${v}/js/boot.js`);
  fs.writeFileSync(path.join(dir, 'index.html'), page(version));       // not published yet, so not on the CDN → if it packs, the local files were used
  const r = build(['talks/t1/talk.md', '-o', path.join(OUT, 'cdn-self.html'), '--force'], dir);
  assert.ok(r.ok, r.err);
  const html = fs.readFileSync(path.join(OUT, 'cdn-self.html'), 'utf8');
  for (const k of ['js/deck.js', 'themes/catppuccin/catppuccin.css', 'plugins/grid/grid.js']) assert.match(html, new RegExp(`data-src="${k}" data-from="deckmd"`), k);
  assert.deepEqual(external(html), []);

  fs.writeFileSync(path.join(dir, 'index.html'), page('0.0.0-none'));
  const other = build(['talks/t1/talk.md', '-o', path.join(OUT, 'cdn-other.html'), '--force'], dir);
  assert.match(other.err, /deckmd@0\.0\.0-none differs from this deckmd \(.+\), so it is read from the CDN/);
});

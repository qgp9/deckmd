// Pack / unpack (tools/build.mjs) tests — node --test tests/build.test.mjs  (needs jsdom: npm install)
// Output stays in tests/out/ (tests/browser.html opens it again in the browser).
// Bundles that embed libraries use the local copy in vendor/, or the internet if there is none.
import { test, before, after } from 'node:test';
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
// init, add and serve are tried outside this repository: it is itself a deckmd project (its index.html), so a folder under it is not "no project"
const SANDBOX = path.join(fs.realpathSync(os.tmpdir()), `deckmd-tests-${process.pid}`);

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
  fs.rmSync(SANDBOX, { recursive: true, force: true });
  fs.mkdirSync(SANDBOX, { recursive: true });
});
after(() => fs.rmSync(SANDBOX, { recursive: true, force: true }));

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
  const dir = path.join(SANDBOX, 'init-cdn');
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
  const dir = path.join(SANDBOX, 'init-multi');
  fs.mkdirSync(dir, { recursive: true });
  assert.ok(build(['init', '--multi'], dir).ok);
  assert.deepEqual(tree(dir), MULTI);
  assert.match(fs.readFileSync(path.join(dir, 'deck.config.js'), 'utf8'), /home: 'list'/);

  const part = path.join(SANDBOX, 'init-partial/sub');                 // a folder argument works too
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
  const dir = path.join(SANDBOX, 'init-repo');
  fs.mkdirSync(dir, { recursive: true });
  const r = build(['init', '--repo', '--multi'], dir);
  assert.ok(r.ok, r.err);
  const files = tree(dir);
  for (const f of [...MULTI, 'deckmd/js/boot.js', 'deckmd/js/deck.js', 'deckmd/css/base.css', 'deckmd/themes/ember/ember.css', 'deckmd/plugins/grid/grid.js',
    'deckmd/templates/deck.md', 'deckmd/tools/build.mjs', 'deckmd/package.json', 'deckmd/LICENSE']) assert.ok(files.includes(f), f);
  assert.ok(!files.some(f => /^deckmd\/(vendor|tests|examples|node_modules)\//.test(f)));
  assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /src="deckmd\/js\/boot\.js"/);
  assert.ok(!build(['init', '--repo', '--multi'], dir).ok, 'again');

  const only = path.join(SANDBOX, 'init-only-deckmd');
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
    const r = build(['init', ...args], SANDBOX);
    assert.ok(!r.ok, args.join(' '));
    assert.match(r.err, msg);
  }
  const help = build(['init', '--help'], SANDBOX);
  assert.ok(help.ok);
  assert.match(help.out, /--cdn.*--repo.*--single.*--multi/s);
  assert.doesNotMatch(help.out, /import fs/);
});

test('init: every combination makes a project that packs (offline, no outside references)', () => {
  for (const mode of ['cdn', 'repo']) for (const layout of ['single', 'multi']) {
    const dir = path.join(SANDBOX, `init-pack-${mode}-${layout}`);
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
  const dir = path.join(SANDBOX, 'add');
  fs.mkdirSync(dir, { recursive: true });
  const bare = build(['add', 'x'], dir);                                   // no project: a deck on its own, next to where you are
  assert.ok(bare.ok, bare.err);
  assert.match(bare.out, /No deckmd project here/);
  assert.ok(fs.existsSync(path.join(dir, 'x.md')) && !fs.existsSync(path.join(dir, 'slides')));
  assert.ok(!build(['add', 'x'], dir).ok, 'never overwrites');
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
    assert.match(e.err, /is a folder or file name/);
  }
  assert.ok(!build(['add'], dir).ok);
  assert.ok(!build(['add', 'x', '--nope'], dir).ok);
  assert.match(build(['add', '--help'], dir).out, /add <name> \[title\]/);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'slides')).sort(), ['first-deck', 'my-slide-dir', 'quick-demo'], 'invalid names created nothing');
});

test('init inside a project is refused unless --force; add finds the project from a subfolder and puts the deck at its top', () => {
  const dir = path.join(SANDBOX, 'tree-init-add');
  fs.mkdirSync(path.join(dir, 'sub/deeper'), { recursive: true });
  assert.ok(build(['init', '--multi'], dir).ok);
  const nested = build(['init', 'sub'], dir);                                   // a folder that does not exist yet, inside the project
  assert.ok(!nested.ok);
  assert.match(nested.err, /is inside the deckmd project at .*tree-init-add/);
  assert.match(nested.err, /--force/);
  assert.ok(!fs.existsSync(path.join(dir, 'sub/index.html')), 'nothing was changed');
  assert.ok(!build(['init'], path.join(dir, 'sub/deeper')).ok, 'from a folder inside it too');
  assert.ok(build(['init', '--force'], path.join(dir, 'sub/deeper')).ok, '--force starts one anyway');
  assert.ok(fs.existsSync(path.join(dir, 'sub/deeper/index.html')));
  assert.match(build(['init'], dir).err, /already exists/, 'in the project itself it is the usual "already exists"');

  const r = build(['add', 'talk-two', 'Two'], path.join(dir, 'slides/first-deck'));
  assert.ok(r.ok, r.err);
  assert.ok(fs.existsSync(path.join(dir, 'slides/talk-two/deck.md')), 'at the top of the project, not where you were');
  assert.ok(!fs.existsSync(path.join(dir, 'slides/first-deck/slides')));
  assert.match(r.out, /created \.\.\/talk-two\/deck\.md/);
  const c = build(['-C', dir, 'add', 'talk-three'], os.tmpdir());
  assert.ok(c.ok, c.err);
  assert.ok(fs.existsSync(path.join(dir, 'slides/talk-three/deck.md')), '-C: the project is looked for there');
});

test('add: a title with quotes and colons is still valid front matter, and the new deck packs', () => {
  const dir = path.join(SANDBOX, 'add-pack');
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
  const dir = path.join(SANDBOX, 'serve-one');
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
  const dir = path.join(SANDBOX, 'serve-list');
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
  const dir = path.join(SANDBOX, 'serve-project');
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
  const bare = path.join(SANDBOX, 'serve-bare');
  fs.mkdirSync(bare, { recursive: true });
  fs.writeFileSync(path.join(bare, 'x.md'), '# x\n');
  const none = build(['serve', '--port', '0'], bare);
  assert.ok(!none.ok);
  assert.match(none.err, /no deckmd project here or in the 4 folders above/);
  assert.match(none.err, /npx deckmd serve my-deck\.md/);
  assert.match(none.err, /npx deckmd init/);
  fs.writeFileSync(path.join(bare, 'index.html'), '<html><body>my own site</body></html>');
  const foreign = build(['serve', '--port', '0'], bare);
  assert.ok(!foreign.ok);
  assert.match(foreign.err, /no deckmd project here/);
  fs.writeFileSync(path.join(bare, 'index.html'), '<!-- <script src="deckmd/js/boot.js"></script> just a comment -->\n<html></html>');
  assert.ok(!build(['serve', '--port', '0'], bare).ok, 'a comment about boot.js is not a launcher');
  fs.writeFileSync(path.join(bare, 'index.html'), "<script src='https://cdn.jsdelivr.net/npm/deckmd@0.2.1/js/boot.js'></script>");
  await withServe([], bare, async (base) => assert.match((await get(`${base}x.md`)).text, /# x/));       // a launcher from the CDN counts
  fs.writeFileSync(path.join(bare, 'index.html'), '<script src="js/deck.js"></script>');
  await withServe([], bare, async (base) => assert.equal((await get(`${base}x.md`)).status, 200));      // so does one that lists the tags itself
});

test('serve: a project is never looked for in your home folder or above it', () => {
  for (const dir of [os.homedir(), path.dirname(os.homedir())]) {
    const r = build(['serve', '--port', '0'], dir);
    assert.ok(!r.ok, dir);
    assert.match(r.err, /no deckmd project here/);
  }
});

test('serve a.md inside a project: its index.html and deck.config.js are used, only home, src and decks are replaced', async () => {
  const proj = path.join(SANDBOX, 'serve-project-file');
  fs.mkdirSync(path.join(proj, 'sub'), { recursive: true });
  const index = '<!doctype html>\n<!-- data-config="x.js" is just a comment here -->\n<script src="deckmd/js/boot.js"></script>\n';
  fs.writeFileSync(path.join(proj, 'index.html'), index);
  fs.writeFileSync(path.join(proj, 'deck.config.js'), "window.DeckConfig = {\n  title: 'Mine',\n  theme: 'catppuccin',\n  home: 'list',\n};\n");
  fs.writeFileSync(path.join(proj, 'sub/a.md'), '# A\n');
  await withServe(['sub/a.md'], proj, async (base, printed) => {
    assert.match(printed, /project: .*serve-project-file\n/);
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
        const cfg = (await get(`${base}my.config.js`)).text;
    assert.ok(cfg.includes("title: 'Custom'") && /"src": "sub\/a\.md"/.test(cfg));
  });
  // a config that can't be extended (data-config="none"): not used, said out loud
  fs.writeFileSync(path.join(proj, 'index.html'), '<script src="deckmd/js/boot.js" data-config="none"></script>\n');
  await withServe(['sub/a.md'], proj, async (base, printed) => {
    assert.match(printed, /not using the project's index\.html or config: it can't be extended/);
    assert.doesNotMatch((await get(`${base}_deckmd/config.js`)).text, /Custom|catppuccin|solarized/);
    assert.match((await get(base)).text, /\/_deckmd\/js\/boot\.js/, 'the generated launcher');
  });
});

test('serve x.md without a project: only the folders of the decks (and a made-up page above them) are served, by allowed types', async () => {
  const dir = path.join(SANDBOX, 'serve-policy');
  for (const d of ['slides/a/img', 'slides/b', 'slides/c', 'private']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const put = (rel, text = 'x') => fs.writeFileSync(path.join(dir, rel), text);
  put('slides/a/deck.md', '# A\n'); put('slides/a/img/x.png'); put('slides/a/notes.pem'); put('slides/b/other.md');
  put('slides/c/hidden.md'); put('slides/notes.txt'); put('private/secret.txt'); put('top.css'); put('index.html', '<html>my own site</html>');
  await withServe(['slides/a/deck.md', 'slides/b/other.md'], dir, async (base, printed) => {
    assert.doesNotMatch(printed, /project:/);
    assert.match((await get(base)).text, /_deckmd\/js\/boot\.js/, 'the made-up page at the common folder of the decks (slides/), not that index.html');
    const cfg = (await get(`${base}_deckmd/config.js`)).text;
    assert.match(cfg, /"src": "a\/deck\.md"/);
    assert.match(cfg, /"src": "b\/other\.md"/);
    for (const p of ['a/deck.md', 'a/img/x.png', 'b/other.md', '_deckmd/js/deck.js']) assert.equal((await get(base + p)).status, 200, p);
    for (const [p, why] of [['c/hidden.md', /outside the folders of your decks/], ['notes.txt', /outside the folders/], ['a/notes.pem', /file type/]]) {
      const r = await get(base + p);
      assert.equal(r.status, 404, p);
      assert.match(r.text, why, p);
    }
    assert.equal(await raw(base, '/../private/secret.txt'), 404, 'nothing above the common folder');
    assert.equal(await raw(base, '/../top.css'), 404);
    const list = (await get(`${base}a/`)).text;
    assert.match(list, /href="deck\.md"/);
    assert.match(list, /href="img\/"/);
    assert.doesNotMatch(list, /notes\.pem/, 'not listed either');
  });
  // one deck: its own folder is the site
  await withServe(['slides/a/deck.md'], dir, async (base) => {
    assert.match((await get(`${base}_deckmd/config.js`)).text, /"src": "deck\.md"/);
    assert.equal((await get(`${base}img/x.png`)).status, 200);
    assert.equal(await raw(base, '/../b/other.md'), 404);
  });
});

test('serve: in a project the whole tree is the site, from any folder in it; a deck outside it (or outside the folder, without one) is refused with the command that works', async () => {
  const top = path.join(SANDBOX, 'serve-root');
  fs.mkdirSync(path.join(top, 'work/slides/a'), { recursive: true });
  fs.mkdirSync(path.join(top, 'work/shared'), { recursive: true });
  fs.mkdirSync(path.join(top, 'work/node_modules/m'), { recursive: true });
  fs.mkdirSync(path.join(top, 'other'), { recursive: true });
  fs.writeFileSync(path.join(top, 'work/slides/a/deck.md'), '# A\n\n![](../../shared/dot.svg)\n');
  fs.copyFileSync(path.join(ROOT, 'tests/fixtures/assets/img/dot.svg'), path.join(top, 'work/shared/dot.svg'));
  fs.writeFileSync(path.join(top, 'work/node_modules/m/index.js'), 'x');
  fs.writeFileSync(path.join(top, 'other/x.md'), '# X\n');
  const work = path.join(top, 'work');
  // no project: the folder of the deck only, nothing above, and the image of a sibling folder is out of reach
  await withServe(['slides/a/deck.md'], work, async (base) => {
    assert.match((await get(`${base}_deckmd/config.js`)).text, /"src": "deck\.md"/);
    assert.equal(await raw(base, '/../../shared/dot.svg'), 404, 'without a project: the folders of the decks only');
    assert.equal(await raw(base, '/../../other/x.md'), 404);
  });
  fs.writeFileSync(path.join(work, 'index.html'), '<script src="deckmd/js/boot.js"></script>\n');          // a project: the whole folder
  await withServe(['slides/a/deck.md'], work, async (base) => {
    assert.match((await get(`${base}deck.config.js`)).text, /"src": "slides\/a\/deck\.md"/);
    assert.equal((await get(`${base}shared/dot.svg`)).status, 200, 'an image from a sibling folder resolves');
    assert.equal((await get(`${base}node_modules/m/index.js`)).status, 404, 'no node_modules');
    assert.equal(await raw(base, '/../other/x.md'), 404, 'nothing above the project');
  });
  // from a folder inside the project: the project is found upwards, the deck is named from where you are, and the site is the same
  await withServe(['deck.md'], path.join(work, 'slides/a'), async (base, printed) => {
    assert.match(printed, /project: .*work \(found 2 folders up\)/);
    assert.match((await get(`${base}deck.config.js`)).text, /"src": "slides\/a\/deck\.md"/);
    assert.equal((await get(`${base}shared/dot.svg`)).status, 200);
  });
  // -C: as if you had started there
  const viaC = spawnSync(process.execPath, [BUILD, '-C', 'work/slides/a', 'serve', '--help'], { cwd: top, encoding: 'utf8' });
  assert.equal(viaC.status, 0);
  // a folder: every Markdown in it
  fs.mkdirSync(path.join(work, 'slides/b/deep/er'), { recursive: true });
  fs.writeFileSync(path.join(work, 'slides/b/deck.md'), '# B\n');
  fs.writeFileSync(path.join(work, 'slides/b/deep/c.md'), '# C\n');
  fs.writeFileSync(path.join(work, 'slides/b/deep/er/too-deep.md'), '# D\n');
  await withServe(['../slides'], path.join(work, 'shared'), async (base) => {
    const cfg = (await get(`${base}deck.config.js`)).text;
    assert.match(cfg, /"slides\/a\/deck\.md"/);
    assert.match(cfg, /"slides\/b\/deck\.md"/);
    assert.match(cfg, /"slides\/b\/deep\/c\.md"/);
    assert.doesNotMatch(cfg, /too-deep/, 'two levels deep');
  });
  assert.ok(!build(['serve', 'shared', '--port', '0'], work).ok, 'a folder without Markdown');
  // a deck outside the project
  const out = build(['serve', '../other/x.md', '--port', '0'], work);
  assert.ok(!out.ok);
  assert.match(out.err, /is outside the deckmd project at .*work/);
  assert.match(out.err, /cd \.\.\/other && npx deckmd serve x\.md/);
  fs.rmSync(path.join(work, 'index.html'));
  for (const input of ['../other/x.md', path.join(top, 'other/x.md')]) {
    const r = build(['serve', input, '--port', '0'], work);
    assert.ok(!r.ok, input);
    assert.match(r.err, /is outside the current folder/);
    assert.match(r.err, /cd \.\.\/other && npx deckmd serve x\.md/);
  }
  assert.ok(!build(['serve', 'slides/a/deck.md', '../other/x.md', '--port', '0'], work).ok, 'one deck outside is enough to refuse');
});

test('review fixes: data-src is not a launcher; hidden or linked-out decks are refused; a linked deck is scanned; retry commands are quoted', async (t) => {
  const dir = path.join(SANDBOX, 'tree-review');
  fs.mkdirSync(path.join(dir, 'proj/slides/ok'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'proj/.hid'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'proj/node_modules/m'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'my other'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'proj/slides/ok/deck.md'), '# ok\n');
  fs.writeFileSync(path.join(dir, 'proj/.hid/h.md'), '# h\n');
  fs.writeFileSync(path.join(dir, 'proj/node_modules/m/n.md'), '# n\n');
  fs.writeFileSync(path.join(dir, 'my other/x.md'), '# x\n');
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'TOP SECRET');
  // data-src="boot.js" does not load deckmd: not a project
  fs.writeFileSync(path.join(dir, 'proj/index.html'), '<script data-src="deckmd/js/boot.js"></script>\n');
  const none = build(['serve', '--port', '0'], path.join(dir, 'proj'));
  assert.ok(!none.ok);
  assert.match(none.err, /no deckmd project here/);
  fs.writeFileSync(path.join(dir, 'proj/index.html'), '<script src="deckmd/js/boot.js" data-type="text/markdown" data-id="deck-meta"></script>\n');   // data-* attributes are not a deck inside
  assert.ok(build(['serve', '--help'], dir).ok);
  const annotated = spawnSync(process.execPath, ['--input-type=module', '-e', `import { isLauncher } from ${JSON.stringify(new URL('../tools/project.mjs', import.meta.url).href)}; process.exit(isLauncher(${JSON.stringify('<script src="deckmd/js/boot.js" data-type="text/markdown" data-id="deck-meta"></script>')}) ? 0 : 1)`]);
  assert.equal(annotated.status, 0, 'a launcher with data-type / data-id is still a launcher');
  fs.writeFileSync(path.join(dir, 'proj/index.html'), '<script src="deckmd/js/boot.js"></script>\n');
  // never-served places are refused as decks, with or without a project
  for (const [cwd, file] of [[path.join(dir, 'proj'), '.hid/h.md'], [path.join(dir, 'proj'), 'node_modules/m/n.md']]) {
    const r = build(['serve', file, '--port', '0'], cwd);
    assert.ok(!r.ok, file);
    assert.match(r.err, /dot folder or node_modules/, file);
  }
  fs.rmSync(path.join(dir, 'proj/index.html'));
  const r2 = build(['serve', '.hid/h.md', '--port', '0'], path.join(dir, 'proj'));
  assert.ok(!r2.ok && /dot folder or node_modules/.test(r2.err), 'without a project');
  // the retry command quotes what has a space
  const q = build(['serve', '../my other/x.md', '--port', '0'], path.join(dir, 'proj'));
  assert.match(q.err, /cd '\.\.\/my other' && npx deckmd serve x\.md/);
  if (process.platform === 'win32') return t.skip('symlinks need privileges on Windows');
  fs.writeFileSync(path.join(dir, 'proj/index.html'), '<script src="deckmd/js/boot.js"></script>\n');
  fs.symlinkSync('../../secret.txt', path.join(dir, 'proj/slides/leak.md'));               // a .md that is really a file outside the project
  fs.symlinkSync('ok/deck.md', path.join(dir, 'proj/slides/linked.md'));                    // a link that stays inside
  const leak = build(['serve', 'slides/leak.md', '--port', '0'], path.join(dir, 'proj'));
  assert.ok(!leak.ok);
  assert.match(leak.err, /symbolic link that leaves the deckmd project/);
  await withServe(['slides'], path.join(dir, 'proj'), async (base) => {                     // a scan follows the safe link and drops the other
    const cfg = (await get(`${base}deck.config.js`)).text;
    assert.match(cfg, /"slides\/linked\.md"/);
    assert.doesNotMatch(cfg, /leak\.md/);
  });
});

const withHost = (base, p, hostHeader) => new Promise((ok, no) => {                    // a request with a chosen Host header
  const u = new URL(base);
  http.get({ host: u.hostname, port: u.port, path: p, headers: { host: hostHeader } }, r => { r.resume(); ok(r.statusCode); }).on('error', no);
});

test('serve: a request with someone else\'s Host is refused (DNS rebinding); localhost, IP addresses and --host name are fine', async () => {
  const dir = path.join(SANDBOX, 'serve-host');
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
  const dir = path.join(SANDBOX, 'serve-links/site'), outside = path.join(SANDBOX, 'serve-links/outside');
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
  const dir = path.join(SANDBOX, 'serve-links-policy');
  for (const d of ['slides/a', 'private', '.secrets', 'shared']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const put = (rel, text) => fs.writeFileSync(path.join(dir, rel), text);
  put('slides/a/deck.md', '# A\n'); put('private/secret.txt', 'S3CRET'); put('.secrets/token.txt', 'TOKEN'); put('key.pem', 'PEM'); put('shared/pic.png', 'png');
  fs.symlinkSync('../../private', path.join(dir, 'slides/a/private'));
  fs.symlinkSync('../../.secrets', path.join(dir, 'slides/a/hidden'));
  fs.symlinkSync('../../key.pem', path.join(dir, 'slides/a/key.txt'));
  fs.symlinkSync('../../shared', path.join(dir, 'slides/a/shared'));
  // without a project: the policy applies to where the link ends up, so another folder, a dot folder and a key file stay hidden
  await withServe(['slides/a/deck.md'], dir, async (base) => {           // the site is slides/a: a link out of it leads nowhere
    assert.equal((await get(`${base}deck.md`)).status, 200);
    for (const p of ['private/secret.txt', 'hidden/token.txt', 'key.txt', 'private/', 'hidden/']) {
      const r = await get(base + p);
      assert.equal(r.status, 403, p);
      assert.doesNotMatch(r.text, /S3CRET|TOKEN|PEM/, p);
    }
    assert.equal((await get(`${base}shared/pic.png`)).status, 403, 'another folder than the deck folders, even through a link');
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
  const top = path.join(SANDBOX, 'serve-config-link');
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

const rawReq = (base, p, { headers = {}, method = 'GET' } = {}) => new Promise((ok, no) => {      // status, headers and body, no URL cleaning and no redirects followed
  const u = new URL(base);
  http.request({ host: u.hostname, port: u.port, path: p, method, headers }, (r) => {
    const chunks = [];
    r.on('data', c => chunks.push(c));
    r.on('end', () => ok({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
  }).on('error', no).end();
});

test('serve: a folder without its trailing slash redirects to an encoded path, and no request can end the server', async (t) => {
  const dir = path.join(SANDBOX, 'serve-redirect');
  const names = ['\ubc1c\ud45c', 'C#', 'a b', '100%', 'slides', 'q?x'];                                   // non-ASCII, #, space, %, ?
  for (const n of names) { fs.mkdirSync(path.join(dir, n), { recursive: true }); fs.writeFileSync(path.join(dir, n, 'x.md'), '# x\n'); }
  fs.writeFileSync(path.join(dir, 'index.html'), '<script src="deckmd/js/boot.js"></script>\n');
  const locked = path.join(dir, 'locked');
  const canLock = process.platform !== 'win32' && process.getuid?.() !== 0;                                 // root can read anything
  fs.mkdirSync(locked, { recursive: true });
  fs.writeFileSync(path.join(locked, 'y.md'), '# y\n');
  if (canLock) fs.chmodSync(locked, 0o000);
  try {
    await withServe([], dir, async (base) => {
      for (const n of names) {
        const enc = encodeURIComponent(n);
        const r = await rawReq(base, `/${enc}`);
        assert.equal(r.status, 301, n);
        assert.equal(r.headers.location, `/${enc}/`, `${n}: the redirect keeps the path as it was sent`);
        const list = await rawReq(base, `/${enc}/`);
        assert.equal(list.status, 200, n);
        assert.match(list.body.toString(), /href="x\.md"/, n);
      }
      const slashes = await rawReq(base, '/%2f%2fslides');                                              // not a scheme-relative address
      assert.equal(slashes.status, 301);
      assert.ok(/^\/[^/]/.test(slashes.headers.location), `one leading slash: ${slashes.headers.location}`);
      if (canLock) {
        const r = await rawReq(base, '/locked/');
        assert.equal(r.status, 403, 'a folder that can not be read is answered, not fatal');
        assert.match(r.body.toString(), /can't be read/);
      }
      assert.equal((await rawReq(base, '/index.html')).status, 200, 'the server is still up');
    });
  } finally { if (canLock) fs.chmodSync(locked, 0o755); }
});

test('serve x.md without a project: a deck whose folder or file is reached through a link inside the folder is served', async (t) => {
  if (process.platform === 'win32') return t.skip('symlinks need privileges on Windows');
  const dir = path.join(SANDBOX, 'serve-linked-deck');
  for (const d of ['real/a', 'slides/b', 'other']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.writeFileSync(path.join(dir, 'real/a/deck.md'), '# A\n');
  fs.writeFileSync(path.join(dir, 'real/b.md'), '# B\n');
  fs.writeFileSync(path.join(dir, 'other/secret.txt'), 'secret');
  fs.symlinkSync('../real/a', path.join(dir, 'slides/a'));                                       // the deck's folder is a link
  fs.symlinkSync('../../real/b.md', path.join(dir, 'slides/b/deck.md'));                         // the deck itself is a link
  await withServe(['slides/a/deck.md'], dir, async (base) => {
    assert.equal((await get(`${base}deck.md`)).text, '# A\n');
    assert.equal((await get(`${base}other/secret.txt`)).status, 404, 'the rest is still hidden');
  });
  await withServe(['slides/b/deck.md'], dir, async (base) => assert.equal((await get(`${base}deck.md`)).text, '# B\n'));
});

test('serve: files are streamed and answer Range requests (video seeking, Safari)', async () => {
  const dir = path.join(SANDBOX, 'serve-range');
  fs.mkdirSync(dir, { recursive: true });
  const body = Buffer.alloc(300 * 1024);                                                              // bigger than one stream chunk
  for (let i = 0; i < body.length; i++) body[i] = i % 251;
  fs.writeFileSync(path.join(dir, 'clip.mp4'), body);
  fs.writeFileSync(path.join(dir, 'empty.txt'), '');
  fs.writeFileSync(path.join(dir, 'index.html'), '<script src="deckmd/js/boot.js"></script>\n');
  await withServe([], dir, async (base) => {
    const whole = await rawReq(base, '/clip.mp4');
    assert.equal(whole.status, 200);
    assert.equal(whole.headers['accept-ranges'], 'bytes');
    assert.equal(whole.headers['content-length'], String(body.length));
    assert.ok(whole.body.equals(body), 'the whole file, byte for byte');
    const n = body.length;
    for (const [range, from, to] of [['bytes=0-3', 0, 3], ['bytes=10-', 10, n - 1], ['bytes=-100', n - 100, n - 1], ['bytes=1000-999999999', 1000, n - 1], [`bytes=${n - 1}-${n - 1}`, n - 1, n - 1]]) {
      const r = await rawReq(base, '/clip.mp4', { headers: { range } });
      assert.equal(r.status, 206, range);
      assert.equal(r.headers['content-range'], `bytes ${from}-${to}/${n}`, range);
      assert.equal(r.headers['content-length'], String(to - from + 1), range);
      assert.ok(r.body.equals(body.subarray(from, to + 1)), `${range}: the right bytes`);
    }
    for (const range of [`bytes=${n}-`, 'bytes=999999999-', 'bytes=-0', 'bytes=5-2']) {
      const r = await rawReq(base, '/clip.mp4', { headers: { range } });
      assert.equal(r.status, 416, range);
      assert.equal(r.headers['content-range'], `bytes */${n}`, range);
    }
    for (const range of ['bytes=abc', 'bytes=0-1,3-4', 'items=0-1', 'bytes=-']) {                    // not one valid range: ignored, the whole file
      const r = await rawReq(base, '/clip.mp4', { headers: { range } });
      assert.equal(r.status, 200, range);
      assert.equal(r.body.length, n, range);
    }
    const head = await rawReq(base, '/clip.mp4', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-length'], String(n));
    assert.equal(head.body.length, 0);
    const empty = await rawReq(base, '/empty.txt', { headers: { range: 'bytes=0-' } });
    assert.equal(empty.status, 416, 'an empty file has no range to give');
    assert.equal((await rawReq(base, '/empty.txt')).headers['content-length'], '0');
  });
});

test('serve --host 0.0.0.0 warns that the folder is open to the network (and the default does not)', async () => {
  const dir = path.join(SANDBOX, 'serve-warn');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'x.md'), '# x\n');
  await withServe(['x.md', '--host', '0.0.0.0'], dir, async (base, printed) => {
    assert.match(printed, /WARNING: --host 0\.0\.0\.0 opens the folders of your decks .* to your network/);
    assert.equal((await get(`${base}x.md`)).status, 200);
  });
  await withServe(['x.md'], dir, async (base, printed) => assert.doesNotMatch(printed, /WARNING/));
});

test('serve: errors and help', () => {
  const dir = path.join(SANDBOX, 'serve-errors');
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
  const top = path.join(SANDBOX, 'pack-outside');
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

test('pack: examples inside code spans and fenced code blocks are not references (no missing-file report)', () => {
  const dir = path.join(OUT, 'code-refs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'talk.md'), [
    '---', 'title: t', '---', '', '## a', '',
    'Use `<!-- bg: photo.jpg; tier: core -->` or ``![](span.png)`` to set things.', '',
    '```md', '![](fenced.png)', '<!-- bg: fenced-bg.jpg -->', '```', '',
    '~~~', '![](tilde.png)', '~~~', '',
    'A stray ` backtick here,', '', '![](/tests/fixtures/assets/img/dot.svg)', '', 'and another ` one later.', ''].join('\n'));
  const { html, err } = make(path.relative(ROOT, path.join(dir, 'talk.md')), 'code-refs.html', '--offline');
  assert.doesNotMatch(err, /photo\.jpg|span\.png|fenced|tilde/, 'nothing reported as missing');
  const table = JSON.parse(/<script type="application\/json" id="deck-assets">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.deepEqual(Object.keys(table), ['/tests/fixtures/assets/img/dot.svg'], 'only the real image is embedded');
});

// The grid plugin's fence functions run on their own (no browser): DeckMD is stubbed with what the plugin uses
function gridFences() {
  const fences = {};
  const DeckMD = { esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), loadCSS() {}, registerFence: (n, f) => { fences[n] = f; },
    md: { renderInline: s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') } };
  new Function('DeckMD', fs.readFileSync(path.join(ROOT, 'plugins/grid/grid.js'), 'utf8'))(DeckMD);
  return fences;
}

test('grid: data lines fill the cells (Markdown inside), commands add colors; as=table and ```table draw a <table>', () => {
  const { grid, table } = gridFences();
  const code = ['| Name | Q1 | Q2 |', '|:-----|---:|:--:|', '| A | 10 | 12 |', 'B3:C3 good', '| B | 7 | **9** |', 'A2 !', 'C1 "x|y"'].join('\n');
  const t = table(code, { id: 't' });
  assert.match(t, /^<table class="grid-table"><thead><tr><th class="cell"[^>]*text-align:left[^>]*>Name<\/th>/, 'the first row is the header when there is a |---| line');
  assert.match(t, /<td class="cell tint is-good" data-id="t-7" style="text-align:right">7<\/td><td class="cell tint is-good" data-id="t-8" style="text-align:center"><strong>9<\/strong><\/td>/, 'B3:C3 is row 3, columns B and C: the header row counts as row 1');
  assert.match(t, /<td class="cell hl" data-id="t-3" style="text-align:left">A<\/td>/, 'A2 highlighted, column A is left-aligned');
  assert.match(t, /style="text-align:right">10<\/td>/);
  assert.match(t, /<th class="cell" data-id="t-2" style="text-align:center" scope="col">x\|y<\/th>/, 'a command label is plain text');
  assert.equal(grid(code, { id: 't', as: 'table' }), t, 'as=table is the same as ```table');
  const g = grid(code, { id: 'g' });
  assert.match(g, /^<div class="grid" style="--cols:3">/);
  assert.match(g, /<b><strong>9<\/strong><\/b>/, 'Markdown in a data cell');
  assert.match(g, /is-good/);
  assert.equal((g.match(/class="cell/g) || []).length, 9, 'a grid of the data: 3 rows x 3 columns, the |---| line is not a row');
  // no separator line: no header; more commands than data grow the table; an empty one is all empty cells
  assert.doesNotMatch(table('| a | b |\n| c | d |', {}), /<thead>/);
  assert.match(table('| a | b |\nB4 end', {}), /data-id="g-7"[^>]*>end<\/td>/);
  assert.equal((table('', { size: '2x3' }).match(/<td/g) || []).length, 6);
  assert.throws(() => table('| a | b | c |', { size: '1x2' }), /3|size/);
  assert.throws(() => grid('A1 x', { as: 'list' }), /as=list/);
  for (const [bad, why] of [['A0 x', /rows start at 1/], ['A0:B2 x', /rows start at 1/], ['0:1 x', /rows start at 1/]]) assert.throws(() => grid(bad, { size: '2x2' }), why, bad);
  assert.throws(() => grid('A1 x', { size: 'axb' }), /bad size="axb"/);
  for (const z of ['0x5', '5x0', '0x0']) assert.throws(() => grid('', { size: z }), /bad size=/, z);
  assert.match(grid('', { size: '1x1', start: '2' }), /class="grid"/, 'start=2 is allowed, as the message says');
  // reversed ranges work like the rectangles do (either order); an unclosed quote is an error, not a label with a stray quote
  const cellsOn = (code, a) => (grid(code, a).match(/cell tint is-good/g) || []).length;
  assert.equal(cellsOn('C:A good', { size: '2x3' }), 6, 'a reversed column range');
  assert.equal(cellsOn('A:C good', { size: '2x3' }), 6);
  assert.equal(cellsOn('2:1 good', { size: '2x3' }), 6, 'a reversed row range');
  assert.throws(() => grid('B2 "unclosed', { size: '3x3' }), /unclosed quote/);
  assert.match(grid('B2 "two words" good', { size: '3x3' }), /two words/);
  assert.throws(() => grid('A1 x', { size: '1000x1000' }), /too many cells/);
  assert.throws(() => grid('A1 x', { cols: 'abc' }), /bad cols/);
  assert.throws(() => grid('| a | b | c |', { cols: '2' }), /table has 3 columns but cols=2/);
  assert.throws(() => grid('| a | b |', { cols: 'abc' }), /bad cols/, 'checked before the data decides the width');
  for (const bad of [true, '', ' 8 ', '8.0', '0', '-2', '1e1']) assert.throws(() => grid('A1 x', { cols: bad }), /bad cols/, `cols=${JSON.stringify(bad)} (a bare cols, spaces, decimals, zero, negative, exponent)`);
  assert.match(grid('A1 x', { cols: '8' }), /--cols:8/);
  assert.throws(() => grid('A1 x', { cols: '2', size: '4x8' }), /disagree/);
  assert.match(grid('A1 x', { cols: '8', size: '4x8' }), /--cols:8/, 'the same number twice is fine');
  assert.throws(() => grid('B2// note', { size: '3x3' }), /can't read cell spec/, 'a // needs a space before it to be a comment (so http://x works unquoted)');
  assert.match(grid('| a | b |', { cols: '4' }), /--cols:2/, 'cols is only the default width: the data decides');
  // comments: // to the end of the line, except inside quotes; a trailing one after a quoted label is still a comment
  assert.match(grid('B2 "a // b" good', { size: '3x3' }), /<b>a \/\/ b<\/b>/, 'a quoted // is text');
  assert.match(grid('B2 "http://x.y" good // a note', { size: '3x3' }), /<b>http:\/\/x\.y<\/b>/);
  assert.doesNotMatch(grid('B2 hi // a note', { size: '3x3' }), /note/, 'an unquoted // starts a comment');
  assert.throws(() => grid('A1 x', { size: '1x1', start: 'abc' }), /bad start=/);
  assert.throws(() => grid('3-1 x', { size: '1x5' }), /bad cell number/, 'a reversed NUMBER range stays an error (numbers have an order)');
  assert.throws(() => grid('1-3> a b c', { size: '1x5' }), /fills in order from ONE cell/);
  assert.throws(() => grid('A1:B2> a b', { size: '3x3' }), /fills in order from ONE cell/);
  assert.match(grid('B2> a b', { size: '3x3' }), /<b>b<\/b>/, 'a single cell start still works (Excel address)');
  // a typo in a range must fail at once, not loop over millions of cells; and a |---| line as wide as the header
  for (const bad of ['A1:ZZZ999 x', 'A1:A1000000 x', '1-99999999 x', '1:1000000 x']) {
    const t0 = Date.now();
    assert.throws(() => grid(bad, { size: '2x3' }), /more than 10000 cells|outside the grid|too many/, bad);
    assert.ok(Date.now() - t0 < 500, `${bad} fails quickly`);
  }
  assert.throws(() => table('| a | b | c |\n|---|---|\n| 1 | 2 | 3 |', {}), /\|---\| line has 2 cells but the header row has 3/);
  assert.throws(() => grid('A1 x', { size: '1x1', h: 'abc' }), /bad h=/);
  assert.match(table('| a | b |\n|---|---|\n| c | d |', {}), /<th class="cell" data-id="g-0" scope="col">a<\/th>/, 'header cells say they are column headers');
  assert.equal(grid(code, { id: 't', as: ' Table ' }), t, 'as is read without case and spaces');
  assert.equal(grid(code, { id: 't', as: '"table"' }), t, 'and without quotes');
  assert.equal(table(code, { id: 't', as: 'table' }), t);
  assert.throws(() => table(code, { as: 'grid' }), /as=grid: this block is a table/, '```table {as=grid} is a conflict, not silently a table');
  // a color is a theme name or #hex only: anything else is text (so it can't reach the style attribute)
  const sneaky = grid('A1 red;--x:1 ><b>', { size: '1x1' });
  assert.doesNotMatch(sneaky, /--c:/, 'no custom color reached the cell');
  assert.match(sneaky, /<b>red;--x:1 &gt;&lt;b&gt;<\/b>/, 'it is the (escaped) text of the cell');
});

// The source plugin on its own: a DOM (jsdom) and a stub of DeckMD / Reveal, no browser
async function sourcePlugin(query = '', frontMatter = '') {
  const { JSDOM } = (await import('jsdom')).default;
  const dom = new JSDOM('<div class="slides"></div>', { url: `http://x.test/${query}` });
  const { document } = dom.window;
  const hooks = [], handlers = [], slid = [];
  const Reveal = { on: (type, fn) => handlers.push([type, fn]), slide: (h, v) => slid.push([h, v]) };
  const DeckMD = { sources: new WeakMap(), slideInfo: new WeakMap(), frontMatter, loadCSS() {}, afterRender: fn => hooks.push(fn) };
  new Function('DeckMD', 'document', 'location', 'window', 'Reveal', fs.readFileSync(path.join(ROOT, 'plugins/source/source.js'), 'utf8'))(DeckMD, document, dom.window.location, { Reveal }, Reveal);
  const slide = (text, attrs = {}) => {
    const sec = document.createElement('section');
    Object.entries(attrs).forEach(([k, v]) => sec.setAttribute(k, v));
    document.querySelector('.slides').appendChild(sec);
    if (text != null) DeckMD.sources.set(sec, text);
    return sec;
  };
  const run = sec => hooks.forEach(h => h(sec, DeckMD));
  return { document, slide, run, handlers, slid, hooks, slideInfo: DeckMD.slideInfo };
}

test('source plugin: a stack with the slide and a source slide under it; escaped text; off per slide, by ?source=off, and for HTML decks', async () => {
  const p = await sourcePlugin();
  const a = p.slide('<!-- class: center -->\n# A <b>x</b>');
  const built = p.slide('<!-- fit -->\n\n## Built (cont.)\n\nbody');                                  // a deck split by headings: DeckMD.sources is text deckmd built
  p.slideInfo.set(built, { withoutNotes: 'body' });                                                // the lines of the file are what the source slide shows
  const off = p.slide('# no', { 'data-source': 'off' });
  const html = p.slide(null);                                             // a deck written in HTML: no Markdown to show
  [a, off, html, built].forEach(p.run);
  const stack = p.document.querySelector('.slides > section');
  assert.equal(stack.children.length, 2);
  assert.equal(stack.firstElementChild, a, 'the slide itself comes first');
  const code = stack.querySelector('.source-slide pre code.language-markdown');
  assert.equal(code.textContent, '<!-- class: center -->\n# A <b>x</b>');
  assert.equal(code.querySelector('b'), null, 'tags are text, not elements');
  assert.equal(p.document.querySelectorAll('.source-slide').length, 2, 'not under data-source=off, not under a slide without Markdown');
  assert.equal(p.document.querySelectorAll('.slides > section').length, 4);
  assert.equal([...p.document.querySelectorAll('.source-slide code')].pop().textContent, 'body', 'the lines of the file (slideInfo), not the text that was built (<!-- fit -->, a title)');
  const own = p.slide('<!-- a slide that is a stack of its own -->');       // raw HTML <section>s inside a Markdown slide
  own.innerHTML = '<section>top</section><section>below</section>';
  p.run(own);
  assert.ok(own.parentElement.classList.contains('slides'), 'still directly in .slides: not wrapped again');
  assert.equal(own.children.length, 2);
  assert.equal(p.document.querySelectorAll('.source-slide').length, 2, 'still just the two: nothing added for a slide that is a stack');
  const q = await sourcePlugin('?source=off');
  q.run(q.slide('# x'));
  assert.equal(q.document.querySelectorAll('.source-slide').length, 0, '?source=off');
});

test('source plugin: the first slide has one more page before its source: the front matter', async () => {
  const p = await sourcePlugin('', '---\ntitle: t\nplugins: [source]\n---');
  const a = p.slide('# A'), b = p.slide('# B'), skipped = p.slide('# C', { 'data-source': 'off' });
  [a, b, skipped].forEach(p.run);
  const [s1, s2] = p.document.querySelectorAll('.slides > section');
  assert.deepEqual([...s1.children].map(c => c.className), ['', 'source-slide front-matter', 'source-slide'], 'slide, front matter, its source');
  assert.equal(s1.querySelector('.front-matter code').textContent, '---\ntitle: t\nplugins: [source]\n---');
  assert.equal(s1.querySelector('.source-slide:not(.front-matter) code').textContent, '# A');
  assert.equal(s2.querySelectorAll('.front-matter').length, 0, 'only the first slide');
  assert.equal(s2.children.length, 2);
  const late = await sourcePlugin('', '---\ntitle: t\n---');                // the first slide is off: the front matter goes to the next slide that has a source
  const off1 = late.slide('# off', { 'data-source': 'off' }), next = late.slide('# next'), after = late.slide('# after');
  [off1, next, after].forEach(late.run);
  const stacks = late.document.querySelectorAll('.slides > section');
  assert.equal(late.document.querySelectorAll('.front-matter').length, 1, 'exactly once, not lost');
  assert.ok(stacks[1].querySelector('.front-matter'), 'on the next slide that has a source');
  assert.equal(stacks[2].querySelectorAll('.front-matter').length, 0);
  const none = await sourcePlugin('', '');                                   // no front matter: nothing extra
  none.run(none.slide('# A'));
  assert.equal(none.document.querySelectorAll('.front-matter').length, 0);
});

test('source plugin: leaving a source sideways forgets the remembered position (no redirect, so a link into a source still works)', async () => {
  const p = await sourcePlugin();
  p.run(p.slide('# a'));
  const [[type, onSlide]] = p.handlers;
  assert.equal(type, 'slidechanged');
  assert.equal(p.handlers.length, 1, 'registered once, however many slides');
  const src = p.document.querySelector('.source-slide'), top = p.document.querySelector('.slides section section'), stack = src.parentElement;
  stack.setAttribute('data-previous-indexv', '1');                       // what reveal sets when you leave a stack on its source
  onSlide({ currentSlide: src, previousSlide: undefined, indexh: 2, indexv: 1 });          // the first event (opened on #/2/1)
  onSlide({ currentSlide: top, previousSlide: src, indexh: 2, indexv: 0 });                // ↑ in the same stack: nothing to forget
  assert.equal(stack.getAttribute('data-previous-indexv'), '1');
  onSlide({ currentSlide: top, previousSlide: src, indexh: 3, indexv: 0 });                // → from the source: forget, so ← comes back to the top slide
  assert.equal(stack.getAttribute('data-previous-indexv'), '0');
  onSlide({ currentSlide: src, previousSlide: top, indexh: 5, indexv: 1 });                // a jump to a source on purpose (a link) is not redirected
  assert.deepEqual(p.slid, []);
});

test('source plugin: packs with the deck (the plugin and its CSS go into the bundle)', () => {
  const { html } = make('tests/fixtures/source/talk.md', 'source.offline.html', '--offline');
  const k = keys(html);
  assert.ok(k.includes('plugins/source/source.js') && k.includes('plugins/source/source.css'), k.join(' '));
  assert.deepEqual(external(html), []);
});

// The math plugin: the Markdown rules with the real markdown-it and KaTeX (from vendor/ if there is a copy, else the internet, like the pack tests)
const fromVendorOrNet = async (url) => {
  const local = path.join(ROOT, 'vendor', url.replace(/^https?:\/\//, ''));
  return fs.existsSync(local) ? fs.readFileSync(local, 'utf8') : (await fetch(url)).text();
};
async function mathMarkdown(config = {}) {
  const run = (code, ...args) => { const m = { exports: {} }; new Function('module', 'exports', 'window', 'self', ...args.map(a => a[0]), code)(m, m.exports, win, win, ...args.map(a => a[1])); return m.exports; };
  const win = {};
  const markdownit = run(await fromVendorOrNet('https://cdn.jsdelivr.net/npm/markdown-it@15.0.2/dist/browser/markdown-it.umd.min.js'));
  win.katex = run(await fromVendorOrNet('https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.js'));
  const md = markdownit({ html: true });
  const loads = [], queue = [];
  const DeckMD = { esc: x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), register: ({ libs }) => ({ libs, css: libs.filter(u => /\.css/.test(u)), js: libs.filter(u => !/\.css/.test(u)) }), loadCSS() {}, load: u => loads.push(u),
    init: fn => queue.push(fn), md, config, source: config.source ?? '$x$', frontMatter: config.frontMatter ?? '' };
  new Function('DeckMD', 'window', fs.readFileSync(path.join(ROOT, 'plugins/math/math.js'), 'utf8'))(DeckMD, win);
  assert.equal(md.renderer.rules.math_inline, undefined, 'nothing is set up before DeckMD.init runs');
  queue.forEach(fn => fn(DeckMD));
  return { md, loads };
}

test('math plugin: $…$ and $$…$$ reach KaTeX as written; money, escapes and code stay text; a mistake is shown in place', async () => {
  const { md, loads } = await mathMarkdown();
  const html = s => md.render(s);
  assert.match(html('Euler $e^{i\\pi}+1=0$ ok'), /<span class="katex">/);
  assert.match(html('$x_1 + y_2$ and a_b c_d'), /class="katex"[\s\S]*a_b c_d/, 'the underscore in the formula is not emphasis; outside it still is text');
  assert.doesNotMatch(html('costs $5 and $10 total'), /katex/, 'money');
  assert.doesNotMatch(html('between $5-$10 range'), /katex/);
  assert.doesNotMatch(html('\\$x\\$ stays'), /katex/, 'escaped');
  assert.match(html('\\$x\\$ stays'), /\$x\$ stays/);
  assert.doesNotMatch(html('code `$x$` here'), /katex/);
  assert.doesNotMatch(html('```\n$x$\n```'), /katex/, 'fenced code');
  assert.doesNotMatch(html('$ not math $ and $unclosed'), /katex/);
  const block = html('$$\na^2+b^2=c^2\n$$');
  assert.match(block, /^<div class="math-block"><span class="katex-display">/);
  assert.match(html('$$ x $$'), /math-block/, 'one line is a block');
  assert.match(html('inside $$y$$ a sentence'), /^<p>inside <span class="katex-display">/);
  assert.match(html('\\(a_i\\) and \\[b_j\\]'), /katex[\s\S]*katex-display/);
  assert.equal(md.render('$$\nnever closed').includes('katex'), false);
  // a block must not swallow what follows: text after a one-line $$ … $$, and a blank line inside, both fall back
  const trail = html('$$ x $$ trailing text\n\nmore text between\n\n$$\ny\n$$');
  assert.equal((trail.match(/class="katex-display"/g) || []).length, 2, 'the formula with text after it, and the later block');
  assert.match(trail, /trailing text<\/p>/);
  assert.match(trail, /<p>more text between<\/p>/, 'the paragraph between is still a paragraph');
  assert.doesNotMatch(html('$$\na\n\nb\n$$'), /katex/, 'a blank line inside is not a block (TeX does not allow one either)');
  const bad = html('bad $\\frac{1$ here');
  assert.match(bad, /<span class="math-error" title="KaTeX parse error[^"]*">\\frac\{1<\/span>/, 'the TeX and the message, in place');
  assert.deepEqual(loads.length, 2, 'the KaTeX css and js are asked for when the Markdown has a $');
  const html_ = await mathMarkdown({ math: { output: 'html' } });
  assert.doesNotMatch(html_.md.render('$x$'), /<math/, 'output: html has no MathML');
  const ml = await mathMarkdown({ math: { output: 'mathml' } });
  assert.match(ml.md.render('$x$'), /<math/);
  assert.equal(ml.loads.length, 1, 'output: mathml needs no CSS (and so no fonts): only the js');
  for (const text of ['no formulas in this deck', 'costs $5 and $10', 'shell: `$ npm i` and \\$x\\$', '```sh\n$ echo $HOME $PATH\n```\n\nplain', '---\ntitle: $x$ in the front matter\n---\n\nbody']) {
    const none = await mathMarkdown({ source: text, frontMatter: text.startsWith('---') ? '---\ntitle: $x$ in the front matter\n---' : '' });
    assert.equal(none.loads.length, 0, `no formula, so no KaTeX: ${JSON.stringify(text)}`);
  }
  const some = await mathMarkdown({ source: 'money $5 but also $x_1$ here' });
  assert.equal(some.loads.length, 2, 'a real formula next to money loads it');
  assert.equal((await mathMarkdown({ source: '- a list\n\n  $$ y $$\n\n> quote $z$' })).loads.length, 2, 'inside a list and a quote too')
});

test('math plugin: libraries it asks for are known to localize (tools/libs.mjs) and go into the bundle; fonts are woff2 only', async () => {
  const notices = { list: [] };
  const found = (await import(path.join(ROOT, 'tools/libs.mjs'))).pluginLibs(ROOT, notices);
  assert.deepEqual(found.map(f => f.plugin), ['math'], 'only the plugins that register something');
  assert.deepEqual(found[0].libs, ['https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.css', 'https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.js']);
  assert.ok(notices.list.some(n => n.name === 'KaTeX' && n.spdx === 'MIT'), 'its license entry is added too');
  const { html } = make('tests/fixtures/math/talk.md', 'math.offline.html', '--offline');
  const k = keys(html);
  for (const want of ['plugins/math/math.js', 'plugins/math/math.css', 'https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.js', 'https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.css']) assert.ok(k.includes(want), want);
  assert.deepEqual(external(html), []);
  assert.match(html, /data:font\/woff2;base64,/);
  assert.doesNotMatch(html, /data:font\/ttf|format\("truetype"\)|format\("woff"\)/, 'the older font formats are left out');
  assert.match(html, /KaTeX — MIT/, 'in the license list at the top');
  const share = make('tests/fixtures/math/talk.md', 'math.share.html', '--share').html;
  assert.ok(!keys(share).some(x => /katex/.test(x)), 'share: KaTeX stays a CDN file');
  assert.ok(share.includes('katex@0.18.7'));
});

test('pack: a font-face keeps only its woff2, whatever the order of the formats; local() and a list without woff2 stay', () => {
  const dir = path.join(OUT, 'fonts-order');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['a.ttf', 'a.woff', 'a.woff2', 'b.woff', 'b.woff2', 'c.woff2', 'c.woff', 'd.ttf', 'd.woff', 'e.woff2', 'e.woff', 'f.woff', 'f.woff2', 'g.woff2', 'g.woff']) fs.writeFileSync(path.join(dir, f), `font ${f}`);
  fs.writeFileSync(path.join(dir, 'more.css'), '@font-face{font-family:G;src:url(g.woff2) format("woff2"),url(g.woff) format("woff")}');
  fs.writeFileSync(path.join(dir, 'fonts.css'), [
    '@IMPORT URL(more.css);',                                                                                                    // at-rule and function names are not case sensitive
    '@font-face{font-family:A;src:url(a.ttf) format("truetype"),url(a.woff) format("woff"),url(a.woff2) format("woff2")}',      // woff2 last
    '@font-face{font-family:B;src:local("B Local"),url(b.woff) format("woff"),url(b.woff2) format("woff2")}',
    '@font-face{font-family:C;src:url(c.woff2),url(c.woff)}',                                                                    // no format() hints
    '@font-face{font-family:D;src:url(d.ttf) format("truetype"),url(d.woff) format("woff")}',                                    // no woff2: both stay
    '@font-face{font-family:F;src:URL(f.woff) FORMAT("woff"),URL(f.woff2) FORMAT("woff2")}',
    '.x{--font-src:url(e.woff2) format("woff2"),url(e.woff) format("woff")}',                                                  // not a @font-face: left as written
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'talk.md'), '---\ntitle: fonts\ncss: [fonts.css]\n---\n\n## a\n');
  const { html } = make(path.relative(ROOT, path.join(dir, 'talk.md')), 'fonts-order.html', '--offline');
  const css = /<style data-src="[^"]*fonts\.css"[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1] || '';
  const count = (re) => (css.match(re) || []).length;
  assert.equal(count(/data:font\/woff2;/g), 6, 'A, B, C, F and the imported G: their woff2; and the custom property keeps its own');
  assert.equal(count(/data:font\/ttf;/g), 1, 'only D keeps its ttf');
  assert.equal(count(/data:font\/woff;/g), 2, 'D keeps its woff, and the custom property its woff (outside @font-face nothing is dropped)');
  assert.match(css, /local\("B Local"\)/);
});

test('site: the demo site lists the examples (the source plugin added, except the hand-split readme ones) and the two READMEs as decks', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/site.mjs')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const cfg = fs.readFileSync(path.join(ROOT, '_site/deck.config.js'), 'utf8');
  const decks = JSON.parse(/DeckConfig = (\{[\s\S]*\});/.exec(cfg)[1]).decks;
  const by = Object.fromEntries(decks.map(d => [d.src, d]));
  assert.deepEqual(by['examples/syntax/talk.md'].plugins, ['source']);
  assert.equal(by['examples/readme/rewrite.md'].plugins, undefined, 'the readme example is left as it is');
  for (const f of ['README.md', 'README.ko.md']) {
    assert.deepEqual([by[f]?.plugins, by[f]?.core], [['source'], false], f);
    assert.ok(fs.existsSync(path.join(ROOT, '_site', f)), `${f} is copied into the site`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, '_site/docs/usage.md')), 'the docs the READMEs link to are there too');
  assert.equal(decks[0].src, 'examples/intro/talk.md', 'the home deck first');
});

test('README: the TL;DR block runs as written (here-doc, both packs) and the sizes it quotes are about right; the Korean one has the same commands', (t) => {
  if (process.platform === 'win32') return t.skip('the block is a POSIX shell script (sh, a here-doc)');
  const block = file => /## TL;DR\s+```bash\n([\s\S]*?)```/.exec(fs.readFileSync(path.join(ROOT, file), 'utf8'))?.[1];
  const en = block('README.md'), ko = block('README.ko.md');
  assert.ok(en && ko, 'a TL;DR bash block in both READMEs');
  // The block line by line: a shell line (the aligned comment after it, two or more spaces then #, differs by language) or a line of a here-doc body, which is
  // kept exactly as written: a # in the body is Markdown (a heading), not a comment, and 'npx deckmd' in it is deck text, not a command
  const lines = (text) => {
    const out = [];
    let end = null;
    for (const line of text.split('\n')) {
      if (end) { out.push({ body: true, line }); if (line === end) end = null; continue; }
      const shell = line.replace(/\s{2,}#.*$/, '').trimEnd();
      if (shell) out.push({ body: false, line: shell });
      end = /<<-?\s*["']?(\w+)["']?$/.exec(shell)?.[1] ?? null;
    }
    assert.equal(end, null, `the block has a here-doc that is never closed (${end})`);
    return out;
  };
  const commands = text => lines(text).map(l => l.line);
  assert.deepEqual(commands(ko), commands(en), 'the same commands, and the same deck in the here-doc, in README.ko.md');
  assert.ok(commands(en).includes('# Hello deckmd'), 'the here-doc body is kept, headings included');
  const script = lines(en).map(l => (l.body ? l.line : l.line.replaceAll('npx deckmd', `node ${JSON.stringify(BUILD)}`))).join('\n');             // npx deckmd = this checkout
  // the files the README says it makes (# → dist/…): they must come out, and be about the size it says
  const claimed = [...en.matchAll(/→ (dist\/[^\s:]+)/g)].map(m => m[1].replace(/[.,)\]`'"]+$/, ''));                 // a trailing . , ) ` is punctuation of the sentence, not of the name
  const named = kind => claimed.filter(f => f.includes(`.${kind}.`));
  assert.ok(named('share').length === 1 && named('offline').length === 1, `the README block should name one share and one offline file (…share.html, …offline.html); it names: ${claimed.join(', ') || 'none'}`);
  const dir = path.join(SANDBOX, 'tldr');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync('sh', ['-c', script], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stderr}${r.stdout}`);
  for (const f of claimed) assert.ok(fs.existsSync(path.join(dir, f)), `${f}: the README says the block makes it, but it does not (update the README, or this test)`);
  const size = kind => fs.statSync(path.join(dir, named(kind)[0])).size;
  const share = size('share'), offline = size('offline');
  // the README says "about 100 KB" and "4 MB": when a bundle grows out of these ranges, update the numbers in README.md and README.ko.md
  assert.ok(share > 50 * 1024 && share < 300 * 1024, `share bundle ${share} bytes: the README says about 100 KB`);
  assert.ok(offline > 3 * 1048576 && offline < 6 * 1048576, `offline bundle ${offline} bytes: the README says 4 MB`);
});

test('unpack: only user files back to their places; packing again gives the same result', () => {
  // The real-world layout: deckmd/ inside a presentation repository (here a link pointing to this repository)
  const repo = path.join(SANDBOX, 'unpack-repo');
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
  const packed = path.join(SANDBOX, 'unpack.offline.html');
  let r = build(['talks/t1/talk.md', '-o', packed, '--force'], repo);
  assert.ok(r.ok, r.err);

  const back = path.join(SANDBOX, 'unpack-back');
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
  const again = path.join(SANDBOX, 'unpack.again.html');
  r = build(['talks/t1/talk.md', '-o', again, '--force'], back);
  assert.ok(r.ok, r.err);
  assert.equal(fs.readFileSync(again, 'utf8'), fs.readFileSync(packed, 'utf8'));
});

test('launcher page loading deckmd from the CDN: same version uses this folder\'s files, another version is reported and read from the CDN', () => {
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const dir = path.join(SANDBOX, 'cdn-self');
  fs.mkdirSync(path.join(dir, 'talks/t1'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'talks/t1/talk.md'), '---\ntitle: t\ntheme: catppuccin\nplugins: [grid]\n---\n\n## One\n');
  const page = v => fs.readFileSync(path.join(ROOT, 'templates/index.html'), 'utf8').replace('deckmd/js/boot.js', `https://cdn.jsdelivr.net/npm/deckmd@${v}/js/boot.js`);
  fs.writeFileSync(path.join(dir, 'index.html'), page(version));       // not published yet, so not on the CDN → if it packs, the local files were used
  const r = build(['talks/t1/talk.md', '-o', path.join(SANDBOX, 'cdn-self.html'), '--force'], dir);
  assert.ok(r.ok, r.err);
  const html = fs.readFileSync(path.join(SANDBOX, 'cdn-self.html'), 'utf8');
  for (const k of ['js/deck.js', 'themes/catppuccin/catppuccin.css', 'plugins/grid/grid.js']) assert.match(html, new RegExp(`data-src="${k}" data-from="deckmd"`), k);
  assert.deepEqual(external(html), []);

  fs.writeFileSync(path.join(dir, 'index.html'), page('0.0.0-none'));
  const other = build(['talks/t1/talk.md', '-o', path.join(SANDBOX, 'cdn-other.html'), '--force'], dir);
  assert.match(other.err, /deckmd@0\.0\.0-none differs from this deckmd \(.+\), so it is read from the CDN/);
});

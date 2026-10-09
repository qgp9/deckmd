// Pack / unpack (tools/build.mjs) tests — node --test tests/build.test.mjs  (needs jsdom: npm install)
// Output stays in tests/out/ (tests/browser.html opens it again in the browser).
// Bundles that embed libraries use the local copy in vendor/, or the internet if there is none.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
const MULTI = ['deck.config.js', 'index.html', 'talks/first-talk/talk.md'];

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

test('init --multi: index.html, deck.config.js and talks/first-talk/talk.md; one existing file stops it before anything is created', () => {
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
    'deckmd/templates/talk.md', 'deckmd/tools/build.mjs', 'deckmd/package.json', 'deckmd/LICENSE']) assert.ok(files.includes(f), f);
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
    const r = build([layout === 'single' ? 'slides.md' : 'talks/first-talk/talk.md', '--offline'], dir);
    assert.ok(r.ok, `${mode} ${layout}: ${r.err}`);
    const packed = tree(dir).filter(f => /\.offline\.html$/.test(f));
    assert.equal(packed.length, 1, `${mode} ${layout}: ${packed}`);
    const html = fs.readFileSync(path.join(dir, packed[0]), 'utf8');
    assert.deepEqual(external(html), [], `${mode} ${layout}`);
    assert.match(html, /Talk title/);
  }
});

test('add <name> [title]: talks/<name>/talk.md from the starter, title and date filled in; never overwrites', () => {
  const dir = path.join(OUT, 'add');
  fs.mkdirSync(dir, { recursive: true });
  const bare = build(['add', 'x'], dir);
  assert.ok(!bare.ok);
  assert.match(bare.err, /doesn't look like a talks repository/);
  assert.ok(build(['init', '--multi'], dir).ok);

  const r = build(['add', 'my-slide-dir', 'My', 'slide', 'title'], dir);   // an unquoted title is joined
  assert.ok(r.ok, r.err);
  const md = fs.readFileSync(path.join(dir, 'talks/my-slide-dir/talk.md'), 'utf8');
  assert.match(md, /^---\ntitle: "My slide title"\n/);
  assert.match(md, /^# My slide title$/m);
  assert.doesNotMatch(md, /Talk title|2026-00-00/);
  assert.match(md, new RegExp(`· ${new Date().toLocaleDateString('sv-SE')}\\]`));

  assert.ok(build(['add', 'quick-demo'], dir).ok);
  assert.match(fs.readFileSync(path.join(dir, 'talks/quick-demo/talk.md'), 'utf8'), /^---\ntitle: "Quick demo"\n/, 'title from the name');

  const again = build(['add', 'my-slide-dir', 'Other'], dir);
  assert.ok(!again.ok);
  assert.match(again.err, /already exists: talks\/my-slide-dir\/talk\.md/);
  assert.equal(fs.readFileSync(path.join(dir, 'talks/my-slide-dir/talk.md'), 'utf8'), md, 'not overwritten');

  for (const bad of ['../x', 'a/b', '.hidden', 'a:b', 'what?']) {
    const e = build(['add', bad], dir);
    assert.ok(!e.ok, bad);
    assert.match(e.err, /is a folder name/);
  }
  assert.ok(!build(['add'], dir).ok);
  assert.ok(!build(['add', 'x', '--nope'], dir).ok);
  assert.match(build(['add', '--help'], dir).out, /add <name> \[title\]/);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'talks')).sort(), ['first-talk', 'my-slide-dir', 'quick-demo'], 'invalid names created nothing');
});

test('add: a title with quotes and colons is still valid front matter, and the new deck packs', () => {
  const dir = path.join(OUT, 'add-pack');
  fs.mkdirSync(dir, { recursive: true });
  assert.ok(build(['init', '--multi'], dir).ok);
  assert.ok(build(['add', 'odd', 'He said "hi": it\'s #1'], dir).ok);
  const r = build(['talks/odd/talk.md', '--offline'], dir);
  assert.ok(r.ok, r.err);
  const packed = fs.readdirSync(path.join(dir, 'talks/odd/dist')).find(f => /\.offline\.html$/.test(f));
  const html = fs.readFileSync(path.join(dir, 'talks/odd/dist', packed), 'utf8');
  assert.match(html, /<title>He said &quot;hi&quot;: it's #1<\/title>|<title>He said "hi": it's #1<\/title>/);
});

test('DeckMD.version equals package.json (npm version bumps both)', () => {
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const m = /^\s*version: '([^']*)',/m.exec(fs.readFileSync(path.join(ROOT, 'js/deck.js'), 'utf8'));
  assert.equal(m?.[1], version);
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

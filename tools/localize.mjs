#!/usr/bin/env node
// Download libraries and fonts into vendor/ → add data-local to the launcher page and it opens without internet.
//
//   node tools/localize.mjs            downloads the internet URLs in the js/boot.js list, reveal.js built-in themes (theme: reveal/…), the libraries plugins ask for
//                                      (DeckMD.register in plugins/*/*.js, see tools/libs.mjs) and license texts (js/notices.js) (skips what exists)
//   node tools/localize.mjs --force    download again
//
// Paths mirror the URL: https://cdn.jsdelivr.net/npm/x@1/a.js → vendor/cdn.jsdelivr.net/npm/x@1/a.js
// url(…) inside CSS (font files) is followed too. Since the path layout is the same, relative paths in the CSS still work.
// Bumping a version creates a separate new path. The old one can be deleted.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { pluginLibs } from './libs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {}, document: { currentScript: null } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/boot.js'), 'utf8'), ctx);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/notices.js'), 'utf8'), ctx);
const { list, localPath, reveal, revealThemes } = ctx.window.DeckBoot;
const force = process.argv.includes('--force');

let got = 0, kept = 0, bytes = 0;
async function get(url) {
  const file = path.join(ROOT, localPath(url.split(/[?#]/)[0]));
  let buf;
  if (!force && fs.existsSync(file)) { buf = fs.readFileSync(file); kept++; }
  else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    console.log(`  ${path.relative(ROOT, file)}  ${Math.round(buf.length / 1024)} KB`);
    got++; bytes += buf.length;
  }
  if (/\.css$/i.test(file)) {
    const css = buf.toString('utf8');
    for (const m of css.matchAll(/url\((["']?)([^"')]+)\1\)/g)) {
      if (/^(data:|#)/.test(m[2])) continue;
      if (/\.(woff|ttf)$/i.test(m[2]) && css.includes(m[2].replace(/\.(woff|ttf)$/i, '.woff2'))) continue;   // the same font as woff2 is there: skip the older formats
      await get(new URL(m[2], url).href);
    }
  }
}

for (const [, file] of list) if (/^https?:/.test(file)) await get(file);
for (const t of revealThemes) await get(`${reveal}theme/${t}.css`);     // for theme: reveal/white (small)
// Libraries the plugins in plugins/ declare with DeckMD.register (a font-face lists woff2, woff and ttf: woff2 is all a current browser uses, so the others are not downloaded)
const plugged = pluginLibs(ROOT, ctx.window.DeckNotices);
for (const { libs } of plugged) for (const url of libs) await get(url);
const remote = [...list.map(([, f]) => f).filter(f => /^https?:/.test(f)), ...revealThemes.map(t => `${reveal}theme/${t}.css`), ...plugged.flatMap(p => p.libs)];
for (const l of ctx.window.DeckNotices.urls([...remote, 'js/md-spans.js'])) await get(l);   // license texts (js/notices.js)
console.log(`vendor/: downloaded ${got} (${(bytes / 1024 / 1024).toFixed(1)} MB), already present ${kept}`);

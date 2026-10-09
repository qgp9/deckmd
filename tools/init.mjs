// deckmd init — start a talks repository (called by build.mjs: npx deckmd init)
//
//   npx deckmd init [dir] [--cdn | --repo] [--single | --multi]
//
//   Where deckmd comes from:
//   --cdn     (default) loaded from the jsDelivr CDN, pinned to this version. Nothing else to install; needs internet when you open a deck
//   --repo    also copies deckmd into deckmd/ (js, css, themes, plugins, templates, tools). You own the copy and the version; works offline with localize.mjs
//   How the decks are laid out:
//   --single  (default) one deck: index.html and slides.md (opening index.html shows it; no config needed)
//   --multi   a talks repository, one folder per deck: index.html, deck.config.js and slides/first-deck/deck.md (opening index.html lists the decks)
//   Creates the files in dir (default: the current folder). Nothing is overwritten: if any of them exists (with --repo also the deckmd/ folder), it stops and changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const USAGE = (lines => lines.slice(1, lines.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))(   // the top comment
  fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n'));
const SOURCES = ['cdn', 'repo'];
const LAYOUTS = ['single', 'multi'];
const COPY = ['js', 'css', 'themes', 'plugins', 'templates', 'tools', 'LICENSE', 'package.json'];   // what deckmd/ gets with --repo
const SKIP = new Set(['.DS_Store', 'node_modules', 'vendor', 'dist']);

export function init(args) {
  const die = (msg) => { console.error(msg); process.exit(1); };
  if (args.includes('--help') || args.includes('-h')) { console.log(USAGE); return; }
  for (const a of args) if (a.startsWith('-') && ![...SOURCES, ...LAYOUTS].map(m => `--${m}`).includes(a)) die(`unknown option: ${a}  (deckmd init --help)`);
  const pick = (names, label) => {
    const given = names.filter(m => args.includes(`--${m}`));
    if (given.length > 1) die(`only one of ${label}`);
    return given[0] || names[0];
  };
  const mode = pick(SOURCES, '--cdn, --repo');
  const layout = pick(LAYOUTS, '--single, --multi');
  const dirs = args.filter(a => !a.startsWith('-'));
  if (dirs.length > 1) die(`only one folder: ${dirs.join(', ')}`);
  const target = path.resolve(dirs[0] || '.');

  const deck = layout === 'single' ? 'slides.md' : 'slides/first-deck/deck.md';
  const files = [
    ['index.html', mode === 'cdn' ? read('templates/index.cdn.html').replace('deckmd@VERSION', `deckmd@${version}`) : read('templates/index.html')],
    ...(layout === 'multi' ? [['deck.config.js', read('templates/deck.config.js')]] : []),
    [deck, read('templates/deck.md')],
  ];
  const wanted = [...files.map(([rel]) => rel), ...(mode === 'repo' ? ['deckmd/'] : [])];
  const exists = wanted.filter(rel => fs.existsSync(path.join(target, rel)));
  if (exists.length) die(`Can't init here, already exists:\n${exists.map(r => `  ${r}`).join('\n')}\nNothing was changed. Remove them, or run it in an empty folder.`);

  fs.mkdirSync(target, { recursive: true });
  for (const [rel, text] of files) {
    fs.mkdirSync(path.dirname(path.join(target, rel)), { recursive: true });
    fs.writeFileSync(path.join(target, rel), text);
  }
  if (mode === 'repo') {
    for (const item of COPY) fs.cpSync(path.join(ROOT, item), path.join(target, 'deckmd', item), { recursive: true, filter: src => !SKIP.has(path.basename(src)) });
  }

  const at = path.relative(process.cwd(), target);
  const serve = mode === 'repo' ? 'deckmd/tools/serve.sh' : 'python3 -m http.server';
  console.log(`deckmd init (${mode}, ${layout})${at ? ` in ${at}/` : ''}
  created ${files.map(([rel]) => rel).join('\n  created ')}${mode === 'repo' ? `\n  created deckmd/   (a copy of deckmd ${version})` : `\n  deckmd ${version} is loaded from the CDN`}

Next:
  ${at ? `cd ${at} && ` : ''}${serve}       # any static web server works
  open http://localhost:8000/ and edit ${deck}
  when you're done: press E → Offline, or  npx deckmd ${deck}`);
}

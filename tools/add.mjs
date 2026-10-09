// deckmd add — add a deck to a talks repository (called by build.mjs: npx deckmd add)
//
//   npx deckmd add <name> [title]
//
//   Creates talks/<name>/talk.md from the starter deck (templates/talk.md) with the title and today's date filled in.
//   Run it at the top of a talks repository (npx deckmd init --multi). The title defaults to the name ("my-talk" → "My talk").
//   The deck shows up in the deck list on the next reload. Never overwrites.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const USAGE = (lines => lines.slice(1, lines.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))(   // the top comment
  fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n'));

export function add(args) {
  const die = (msg) => { console.error(msg); process.exit(1); };
  if (args.includes('--help') || args.includes('-h')) { console.log(USAGE); return; }
  for (const a of args) if (a.startsWith('-')) die(`unknown option: ${a}  (deckmd add --help)`);
  const [name, ...words] = args;
  if (!name) die(`Which folder name? npx deckmd add <name> [title]  (deckmd add --help)`);
  if (/[\\/:*?"<>|]/.test(name) || name.startsWith('.')) die(`<name> is a folder name under talks/: no / \\ : * ? " < > |, and it can't start with a dot (got "${name}")`);

  const top = process.cwd();
  if (!fs.existsSync(path.join(top, 'talks')) && !fs.existsSync(path.join(top, 'deck.config.js')))
    die(`This doesn't look like a talks repository (no talks/ or deck.config.js here).\nRun it at the top of one, or create one with: npx deckmd init --multi`);
  const rel = `talks/${name}/talk.md`;
  const file = path.join(top, rel);
  if (fs.existsSync(file)) die(`already exists: ${rel}`);

  const title = words.join(' ').trim() || name.replace(/[-_]+/g, ' ').replace(/^\p{L}/u, c => c.toUpperCase());
  const text = read('templates/talk.md')
    .replace(/^title: .*$/m, () => `title: ${JSON.stringify(title)}`)       // a JSON string is a valid YAML string, whatever the title has in it
    .replace(/^# Talk title$/m, () => `# ${title}`)
    .replace('2026-00-00', () => new Date().toLocaleDateString('sv-SE'));     // today, local time (YYYY-MM-DD)
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);

  console.log(`created ${rel}   (title: ${JSON.stringify(title)})
It's in the deck list on the next reload, or open index.html?src=${rel}`);
}

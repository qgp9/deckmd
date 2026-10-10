// deckmd add — add a deck (called by build.mjs: npx deckmd add)
//
//   npx deckmd add <name> [title]
//
//   Makes a deck from the starter deck (templates/deck.md) with the title and today's date filled in. The title defaults to the name ("my-talk" → "My talk").
//   In a deckmd project (found from the current folder upwards, like git does) it creates slides/<name>/deck.md at the top of the project, whatever
//   folder of it you are in. Outside a project it creates just ./<name>.md here. Never overwrites.
//   npx deckmd -C path add ...   run it as if you were in that folder
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findProject } from './project.mjs';

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
  if (/[\\/:*?"<>|]/.test(name) || name.startsWith('.')) die(`<name> is a folder or file name: no / \\ : * ? " < > |, and it can't start with a dot (got "${name}")`);

  const project = findProject(process.cwd());
  const file = project ? path.join(project.root, 'slides', name, 'deck.md') : path.resolve(`${name}.md`);
  const rel = path.relative(process.cwd(), file) || path.basename(file);
  if (fs.existsSync(file)) die(`already exists: ${rel}`);

  const title = words.join(' ').trim() || name.replace(/[-_]+/g, ' ').replace(/^\p{L}/u, c => c.toUpperCase());
  const text = read('templates/deck.md')
    .replace(/^title: .*$/m, () => `title: ${JSON.stringify(title)}`)       // a JSON string is a valid YAML string, whatever the title has in it
    .replace(/^# Talk title$/m, () => `# ${title}`)
    .replace('2026-00-00', () => new Date().toLocaleDateString('sv-SE'));     // today, local time (YYYY-MM-DD)
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);

  console.log(project
    ? `created ${rel}   (title: ${JSON.stringify(title)})${project.up ? `\n  in the project at ${project.root}` : ''}\nIt's in the deck list on the next reload, or: npx deckmd serve ${rel}`
    : `created ${rel}   (title: ${JSON.stringify(title)})\nNo deckmd project here, so it is a deck on its own.  npx deckmd serve ${rel}   (npx deckmd init starts a project)`);
}

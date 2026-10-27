// Finding the deckmd project (the "tree") a command runs in, the way git finds its repository: look in the folder you are in and then in the
// folders above it. What marks a project is a deckmd launcher page: an index.html that loads boot.js (or deck.js) and has no slides written in it.
// Used by serve, add, init and the packing in build.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MAX_UP = 4;                                   // how many folders above the start folder are looked at (slides/<name>/img/ is 3 below the project)

export const within = (child, base) => child === base || child.startsWith(base + path.sep);       // real paths: child is base or under it

// Your home folder, a folder above it, or the root of the disk (real path): too wide to be a project or a site
export function tooWide(real) {
  let home = null;
  try { home = fs.realpathSync(os.homedir()); } catch { /* no home: only the disk root counts */ }
  return real === path.parse(real).root || (!!home && within(home, real));
}

// A path for a command line to copy: quoted when it has spaces or shell characters
export const shq = s => /^[\w@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`;

// Is this HTML a deckmd launcher page? It loads boot.js (or deck.js) and has no slides inside it: a page with <section>s written in it, a Markdown
// or deck-meta script (a deck of its own, or a bundled deck) is a deck, not the launcher of a project. Another site's index.html loads neither.
// The index.html of an unpacked zip counts too: deckmd is inside it (deck.js as packing writes it), but the Markdown is a file next to it.
export function isLauncher(html) {
  // Tags only: the text inside script and style elements goes first (inlined deckmd holds strings like type="text/markdown" and <!--),
  // then the comments about the page
  const page = String(html).replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2>)/gi, '$1$3').replace(/<!--[\s\S]*?-->/g, '');
  const loadsDeckmd = /<script\b[^>]*\ssrc\s*=\s*["'](?:[^"']*\/)?(?:boot|deck)\.js(?:[?#][^"']*)?["']/i.test(page)
    || /<script\b(?=[^>]*\sdata-src="js\/deck\.js")(?=[^>]*\sdata-from="deckmd")[^>]*>/i.test(page);
  const hasDeckInside = /<section\b/i.test(page) || /<script\b[^>]*\stype\s*=\s*["']text\/markdown["']/i.test(page) || /<script\b[^>]*\sid\s*=\s*["']deck-meta["']/i.test(page);
  return loadsDeckmd && !hasDeckInside;
}

// The launcher page of the nearest project from `start` upwards: { root, up, index } (up = how many folders above start), or null.
// It never looks in your home folder or above it (and never in the root of the disk), and gives up after MAX_UP folders.
export function findProject(start = process.cwd()) {
  let dir;
  try { dir = fs.realpathSync(start); } catch { return null; }
  for (let up = 0; up <= MAX_UP; up++) {
    if (tooWide(dir)) return null;                                                                                    // the folder is your home or one above it, or the disk root
    const index = path.join(dir, 'index.html');
    try { if (fs.statSync(index).isFile() && isLauncher(fs.readFileSync(index, 'utf8'))) return { root: dir, up, index }; } catch { /* no index.html here */ }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// The nearest existing folder of a path that may not exist yet (init creates folders)
export function nearestExisting(p) {
  let dir = path.resolve(p);
  while (!fs.existsSync(dir)) { const parent = path.dirname(dir); if (parent === dir) break; dir = parent; }
  return dir;
}

// Is `child` the same as or inside `base` (written paths, both absolute)? Like deck.js does for ?src: by the path as written, no realpath
export const isInside = (child, base) => { const r = path.relative(base, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

// What to tell someone when no project was found
export const NOT_FOUND = `no deckmd project here or in the ${MAX_UP} folders above (what marks one is a deckmd index.html: a page that loads boot.js and has no slides written in it)`;

#!/usr/bin/env node
// Run by npm publish (the "prepublishOnly" script in package.json): publish only what is committed and tagged,
// so the npm package, the git tag and the commit agree. npm packs the files on disk, not the commit,
// so uncommitted edits would end up in the package without being in the tag.
// Checks: a clean working tree · HEAD tagged v<version> · package-lock.json and DeckMD.version (js/deck.js) say the same version.
// (npm version keeps those in step; pushing the commit and the tag to GitHub is up to you, before publishing.)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const lock = JSON.parse(read('package-lock.json'));
const said = {
  'package-lock.json': lock.version,
  'package-lock.json (packages[""])': lock.packages?.['']?.version,
  'js/deck.js (DeckMD.version)': /^\s*version: '([^']*)',/m.exec(read('js/deck.js'))?.[1],
};

const problems = [];
for (const [where, v] of Object.entries(said)) if (v !== version) problems.push(`${where} says ${v}, package.json says ${version} (npm version updates them together)`);
const dirty = git('status', '--porcelain');
if (dirty) problems.push(`there are uncommitted changes (npm publishes the files on disk, not the commit):\n${dirty.split('\n').map(l => `      ${l}`).join('\n')}`);
const tags = git('tag', '--points-at', 'HEAD').split('\n').filter(Boolean);
if (!tags.includes(`v${version}`)) problems.push(`HEAD is not tagged v${version} (tags on HEAD: ${tags.join(', ') || 'none'}). npm version <patch|minor> makes the commit and the tag`);

if (problems.length) {
  console.error(`Not publishing deckmd ${version}:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`deckmd ${version}: clean, HEAD is tagged v${version}`);

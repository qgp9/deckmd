#!/usr/bin/env node
// Called by npm version (the "version" script in package.json): copies the new version into DeckMD.version in js/deck.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const file = path.join(ROOT, 'js/deck.js');
const src = fs.readFileSync(file, 'utf8');
const out = src.replace(/^(\s*version: ')[^']*(',)/m, (m, a, b) => a + version + b);
if (out === src && !src.includes(`version: '${version}',`)) { console.error('could not find the version: \'…\' line in js/deck.js'); process.exit(1); }
fs.writeFileSync(file, out);
console.log(`js/deck.js: DeckMD.version = ${version}`);

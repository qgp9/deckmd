// What the plugins in plugins/ need from the internet: run each plugin file in a sandbox where DeckMD only records
// DeckMD.register({ libs: [...] }) and every other call does nothing (the call sits at the top of the file, so what comes after may fail harmlessly).
// Used by localize.mjs (download into vendor/) and the tests. A plugin may also add its license to DeckNotices.list; that is why the notices object is shared.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Anything you read, call or construct gives another harmless stand-in (and turns into '' as text)
const inert = () => new Proxy(function () {}, {
  get: (_, key) => (key === Symbol.toPrimitive ? () => '' : inert()),
  apply: () => inert(),
  construct: () => inert(),
});

export function pluginLibs(root, notices) {
  const dir = path.join(root, 'plugins');
  const found = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name, `${name}.js`);
    if (!fs.existsSync(file)) continue;
    const libs = [];
    const DeckMD = new Proxy({ register: (spec = {}) => libs.push(...[].concat(spec.libs ?? [])) }, { get: (t, k) => (k in t ? t[k] : inert()) });
    const window = {};
    const ctx = vm.createContext({ DeckMD, DeckNotices: notices, window, document: inert(), location: { search: '', href: 'http://localhost/' }, Reveal: inert(), console });
    window.DeckMD = DeckMD;
    window.DeckNotices = notices;
    try { vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file, timeout: 2000 }); } catch { /* after the register call: nothing to learn */ }
    if (libs.length) found.push({ plugin: name, libs });
  }
  return found;
}

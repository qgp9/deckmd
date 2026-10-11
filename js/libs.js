// libs.js — DeckLibs.libSpec(spec, who) reads what DeckMD.register accepts; DeckLibs.libOf(url) names the library a jsDelivr URL belongs to.
(() => {
  // What DeckMD.register({ libs }) accepts, read in one place: deck.js (the browser) and localize.mjs (through tools/libs.mjs) all call it, so they agree on the URLs.
  //   libs: ['https://…/x.min.js', …]                                   a list of URLs written out in full (the original form)
  //   libs: { katex: { npm: 'katex@0.18.7', files: ['dist/katex.min.css', 'dist/katex.min.js'], compat: 'exact', load: 'manual' }, … }   named libraries from jsDelivr
  //   an item may have github: 'user/repo@v1.2.3' instead of npm. Both need a version: a library without one cannot be pinned, localized or checked.
  // compat is required: it says how this plugin would accept another version of the library. It is Reserved: not active yet (nothing is negotiated, a second version of the same
  // library is an error); declaring it now keeps the plugin from having to be changed when negotiation arrives. Write 'exact' when unsure (and for a library with no semver), or 'none' / '' to say there is no policy.
  const RANGE = /^([\^~])(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;
  const parseVersion = v => { const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/.exec(v); return m && [m[1], m[2] ?? 0, m[3] ?? 0].map(Number); };   // 1.2 and v1 (a tag) count as 1.2.0 and 1.0.0
  const inRange = (version, range) => {                                       // ^1.2.3: same major (0.x: same minor, 0.0.x: same version) and not older; ~1.2.3: same minor and not older
    const v = parseVersion(version), [, op, a, b = 0, c = 0] = RANGE.exec(range), lo = [+a, +b, +c];
    if (!v) return false;
    const older = (() => { for (let i = 0; i < 3; i++) if (v[i] !== lo[i]) return v[i] < lo[i]; return false; })();
    const same = op === '~' || lo[0] > 0 ? (op === '~' ? 2 : 1) : lo[1] > 0 ? 2 : 3;     // how many leading numbers must be equal
    return !older && lo.slice(0, same).every((n, i) => v[i] === n);
  };
  const SOURCES = { npm: 'npm', github: 'gh' };
  function libItem(name, item, who, defaultLoad) {
    const at = (m) => new Error(`${who}: library '${name}': ${m}`);
    const kind = Object.keys(SOURCES).find(k => item[k] != null);
    if (!kind) throw at(`needs npm: 'name@version' or github: 'user/repo@version'`);
    const spec = String(item[kind]), i = spec.lastIndexOf('@');
    if (i < 1 || i === spec.length - 1) throw at(`${kind}: '${spec}' needs a version (name@version)`);
    const pkg = spec.slice(0, i), version = spec.slice(i + 1);
    if (!Array.isArray(item.files) || !item.files.length) throw at(`files: ['dist/x.min.js', …] is required (paths inside the package)`);
    for (const f of item.files) if (typeof f !== 'string' || !f.trim() || /^[a-z][a-z0-9+.-]*:|^\/\/|(^|\/)\.\.(\/|$)/i.test(f)) throw at(`files: '${f}' must be a path inside the package (no URL, no '..')`);
    if (typeof item.compat !== 'string') throw at(`compat is required: 'exact' (also for a library without semver versions), a range such as '^1.2', or 'none' (Reserved: not active yet; declaring it now avoids conflicts later)`);
    const compat = item.compat.trim();
    if (!['', 'none', 'exact'].includes(compat) && !RANGE.test(compat)) throw at(`compat: '${item.compat}' is not 'exact', 'none', '' or a range like '^1.2' / '~1.2.3'`);
    if (RANGE.test(compat) && !inRange(version, compat)) throw at(`version ${version} is outside its own compat '${compat}' (a range and a pinned version that disagree)`);
    const base = `https://cdn.jsdelivr.net/${SOURCES[kind]}/${pkg}@${version}/`;
    return { name, key: `${kind}:${pkg}`, version, compat, urls: item.files.map(f => base + String(f).replace(/^\.?\//, '')), load: item.load ?? defaultLoad };
  }
  function libSpec(spec = {}, who = 'register') {
    const load = spec.load === 'manual' ? 'manual' : 'auto', items = [];
    if (Array.isArray(spec.libs) || typeof spec.libs === 'string') items.push({ name: null, urls: [].concat(spec.libs), load });
    else for (const [name, item] of Object.entries(spec.libs ?? {})) {
      if (['libs', 'css', 'js', 'files'].includes(name)) throw new Error(`${who}: '${name}' cannot be a library name (it is part of the returned handle)`);
      items.push(libItem(name, item, who, load));
    }
    return { items, files: [].concat(spec.files ?? []), load };
  }
  // The library and version a jsDelivr URL names, or null: the key under which one version per library is allowed (also for a URL passed to DeckMD.load)
  const libOf = (url) => { const m = /^https:\/\/cdn\.jsdelivr\.net\/(npm|gh)\/((?:@[^/@]+\/)?[^/@]+(?:\/[^/@]+)?)@([^/]+)\//.exec(url); return m && { key: `${m[1] === 'gh' ? 'github' : 'npm'}:${m[2]}`, version: m[3] }; };
  window.DeckLibs = { libSpec, libOf };
})();

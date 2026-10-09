// notices.js — license list of the libraries and fonts that go into bundled files.
//   pack.js (E key; the command-line pack tools/build.mjs too): writes "what's included — license — license URL" in the comment at the top of the bundled file (comment)
//   tools/localize.mjs: downloads the LICENSE texts into vendor/ as well (urls)
// match = if a key (data-src) in the bundled file matches, that item is included. The version is read from the key (= the URL in boot.js), so it's not here.
// license = URL of the license text. If absent, the top of the key's package + LICENSE (https://cdn.jsdelivr.net/npm/x@1.2.3/LICENSE)
(() => {
  const pkgRoot = key => /^https?:\/\/.*?@[^/]+\//.exec(key)?.[0];
  const LIST = [
    { name: 'reveal.js', spdx: 'MIT', match: /\/npm\/reveal\.js@/ },
    { name: 'highlight.js (inside the reveal.js highlight plugin)', spdx: 'BSD-3-Clause', match: /\/reveal\.js@[^/]+\/dist\/plugin\/highlight\.js$/,
      license: () => ['https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/LICENSE'] },
    { name: 'markdown-it', spdx: 'MIT', match: /\/npm\/markdown-it@/ },
    { name: 'markdown-it-attrs', spdx: 'MIT', match: /\/npm\/markdown-it-attrs@/ },
    { name: 'markdown-it-container', spdx: 'MIT', match: /\/npm\/markdown-it-container@/ },
    { name: 'markdown-it-bracketed-spans (js/md-spans.js)', spdx: 'MIT', match: /(^|\/)js\/md-spans\.js$/,
      license: () => ['https://cdn.jsdelivr.net/npm/markdown-it-bracketed-spans@1.0.3/LICENSE'] },
    { name: 'js-yaml', spdx: 'MIT', match: /\/npm\/js-yaml@/ },
    { name: 'Pretendard font', spdx: 'OFL-1.1', match: /\/pretendard@/ },
    { name: 'League Gothic · Source Sans Pro fonts (reveal.js built-in themes)', spdx: 'OFL-1.1', match: /\/reveal\.js@[^/]+\/dist\/theme\//,
      license: k => ['league-gothic', 'source-sans-pro'].map(f => `${pkgRoot(k)}css/theme/fonts/${f}/LICENSE`) },
  ];
  const licenseOf = (n, key) => (n.license ? n.license(key) : [`${pkgRoot(key)}LICENSE`]);

  window.DeckNotices = {
    list: LIST,
    // keys → URLs of the LICENSE texts to download (localize.mjs)
    urls: keys => [...new Set(LIST.flatMap(n => keys.filter(k => n.match.test(k)).flatMap(k => licenseOf(n, k))))],
    // bundled HTML → license comment for what's inside it (<style|script data-src="key">). '' if nothing is inside
    comment(html) {
      const keys = [...html.matchAll(/<(?:style|script) data-src="([^"]+)"/g)].map(m => m[1]);
      const lines = LIST.map((n) => {
        const k = keys.find(x => n.match.test(x));
        return k && `  ${n.name} — ${n.spdx} — ${licenseOf(n, k).join(' ')}`;
      }).filter(Boolean);
      return lines.length ? `<!-- Included libraries and fonts (each under its own license; deckmd itself is MIT):\n${lines.join('\n')}\n-->\n` : '';
    },
  };
})();

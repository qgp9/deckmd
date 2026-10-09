// boot.js — the launcher page (index.html) only needs this one line:
//
//   <script src="deckmd/js/boot.js"></script>                     default: libraries and fonts from the CDN (jsDelivr)
//   <script src="deckmd/js/boot.js" data-local></script>          from the local copy in vendor/ (first run node deckmd/tools/localize.mjs)
//   <script src="deckmd/js/boot.js" data-skip="highlight"></script>   leave out (names: third column of the list below; several separated by commas or spaces)
//   <script src="deckmd/js/boot.js" data-config="my.config.js"></script>  config file (default: deck.config.js next to the page, none = no config)
//
// To change a library version, edit only the URL below. The local path is derived from the URL:
//   https://cdn.jsdelivr.net/npm/reveal.js@6.0.2/dist/reveal.js → vendor/cdn.jsdelivr.net/npm/reveal.js@6.0.2/dist/reveal.js
// If the page already has the same file (a tag with the same file name), that one is used and this is skipped → put tags in index.html only for what you want to manage yourself.
// The original form with every tag written out is templates/index.full.html.
(() => {
  const NPM = 'https://cdn.jsdelivr.net/npm/';
  const REVEAL = `${NPM}reveal.js@6.0.2/dist/`;

  // [kind, URL or path relative to deckmd, skip name]  — loaded in order
  // Config comes first: only deck.js reads it for now, but this leaves room to control boot itself from the config later
  const LIST = [
    ['config', '', 'config'],
    ['css', `${REVEAL}reset.css`, 'reveal'],
    ['css', `${REVEAL}reveal.css`, 'reveal'],
    ['css', 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css', 'font'],
    ['js', `${REVEAL}reveal.js`, 'reveal'],
    ['js', `${REVEAL}plugin/notes.js`, 'notes'],
    ['js', `${REVEAL}plugin/highlight.js`, 'highlight'],
    ['js', `${NPM}markdown-it@15.0.2/dist/browser/markdown-it.umd.min.js`, 'markdown'],
    ['js', 'js/md-spans.js', 'markdown'],
    ['js', `${NPM}markdown-it-attrs@5.0.1/markdown-it-attrs.browser.min.js`, 'markdown'],  // .min = the version jsDelivr minifies (the original is 370 KB and contains another copy of markdown-it)
    ['js', `${NPM}markdown-it-container@4.0.0/dist/markdown-it-container.min.js`, 'markdown'],
    ['js', `${NPM}js-yaml@5.4.3/dist/browser/js-yaml.umd.min.js`, 'yaml'],
    ['js', 'js/defaults.js', ''],
    ['js', 'js/notices.js', 'pack'],                 // license list written into bundled files
    ['js', 'js/pack.js', 'pack'],
    ['js', 'js/deck.js', ''],
  ];
  // Internet URL → local copy path (used by localize.mjs, build.mjs, release.mjs. The reverse is libUrl in pack.js)
  const localPath = url => `vendor/${url.replace(/^https?:\/\//, '')}`;
  // reveal.js built-in themes: theme: reveal/white → ${REVEAL}theme/white.css (deck.js resolves it, localize.mjs downloads it)
  const revealThemes = ['black', 'white', 'league', 'beige', 'night', 'serif', 'simple', 'solarized', 'moon', 'dracula', 'sky', 'blood', 'black-contrast', 'white-contrast'];
  window.DeckBoot = { list: LIST, localPath, reveal: REVEAL, revealThemes };

  const me = document.currentScript;
  if (!me) return;                                     // when a tool only reads the list
  const root = new URL('..', me.src);
  const useLocal = me.hasAttribute('data-local');
  const skip = new Set((me.dataset.skip || '').split(/[\s,]+/).filter(Boolean));
  const config = me.dataset.config ?? 'deck.config.js';

  // Same file already on the page (a tag whose URL ends in the same file name counts as the same file)
  const present = new Set([...document.querySelectorAll('link[rel="stylesheet"][href], script[src]')]
    .filter(el => el !== me).map(el => (el.getAttribute('href') || el.getAttribute('src')).split(/[?#]/)[0].split('/').pop()));

  // Insert right after this tag, in order. document.write is not used: browsers may block it on slow connections.
  // Scripts have async=false, so they run in insertion order. But CSS loads separately, so the last one (deck.js) is
  // inserted after all CSS has loaded (so reveal.js doesn't measure sizes without styles). Earlier libraries are fetched together with the CSS.
  let anchor = me;
  const put = (el) => { anchor.after(el); anchor = el; return el; };
  const loaded = [];                                   // things to wait for until all CSS has loaded
  const scripts = [];
  for (const [kind, file, name] of LIST) {
    if (name && skip.has(name)) continue;
    if (kind === 'config') {
      if (config && config !== 'none' && !present.has(config.split('/').pop())) scripts.push(config);
      continue;
    }
    if (present.has(file.split('/').pop())) continue;
    const remote = /^https?:/.test(file);
    const url = remote && !useLocal ? file : new URL(remote ? localPath(file) : file, root).href;
    if (kind === 'css') {
      const l = put(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: url }));
      loaded.push(new Promise(done => { l.onload = l.onerror = done; }));
    } else scripts.push(url);
  }
  const addScript = (src) => put(Object.assign(document.createElement('script'), { src, async: false }));
  scripts.slice(0, -1).forEach(addScript);
  Promise.all(loaded).then(() => scripts.slice(-1).forEach(addScript));
})();

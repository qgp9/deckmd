// pack.js — pack the current deck into one HTML file. E key while viewing the deck (the deckmd helper panel lives here too).
// The command-line tools/build.mjs also calls this DeckPack.pack(mode) in jsdom → { html, title, missing, external }
//
//   offline: everything inside (libraries, fonts, even images). Opens without internet
//   share:   libraries and fonts from the CDN, the rest inside. Small, needs internet
//
// Resources are gathered from what deck.js recorded: the CSS/JS tags on the page from the start (DeckMD.staticTags),
// the themes, CSS and plugins deck.js loaded (DeckMD.loaded), the Markdown source (DeckMD.source) or slides written in the page, and images.
// What's already inside the page is taken as text; what's linked is read with fetch.
// → Works when opened through a web server or from an already bundled file. Opened without a server (file://), the browser blocks reading files next to the deck (CDN files work).
// Packing marks where things came from (used by unpack, build.mjs --unpack): data-from="deckmd" · data-file="original location" · Markdown data-path
(() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const scriptSafe = s => s.replace(/<\/script/gi, '<\\/script');

  async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.text();
  }
  // If the server doesn't know the type (MIME) (empty, octet-stream), guess from the extension — embedded as is, SVG and such won't show
  const MIME = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
    woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', pdf: 'application/pdf' };
  async function fetchDataUri(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    let blob = await res.blob();
    const guess = MIME[/\.(\w+)(?:[?#]|$)/.exec(String(url))?.[1]?.toLowerCase()];
    if (guess && (!blob.type || blob.type === 'application/octet-stream')) blob = new Blob([blob], { type: guess });
    return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
  }

  // Tags added by boot.js have absolute URLs → inside deckmd, shorten them to paths relative to deckmd
  const local = (key) => {
    const root = window.DeckMD?.here?.href;
    return root && key.startsWith(root) ? key.slice(root.length) : key;
  };
  // Library = a URL on another server (CDN), or a local copy in vendor/ (a path made from the URL → turned back). Otherwise null
  const libUrl = (key) => {
    const k = local(key);
    if (/^https?:/.test(k)) return new URL(k).origin !== location.origin ? k : null;
    const v = /(?:^|\/)(vendor\/.+)$/.exec(k)?.[1];
    return v ? `https://${v.slice(7)}` : null;
  };

  // Path relative to the page (if on the same server; ../ to go up). null if on another server
  function pagePath(abs) {
    try {                                                  // if the page is blob: or about:srcdoc there is no base → null
      const a = new URL(abs), p = new URL('.', location.href);
      if (a.origin !== p.origin) return null;
      const A = a.pathname.split('/'), P = p.pathname.split('/').slice(0, -1);
      let i = 0;
      while (i < P.length && i < A.length - 1 && A[i] === P[i]) i++;
      return decodeURI([...P.slice(i).map(() => '..'), ...A.slice(i)].join('/'));
    } catch { return null; }
  }
  // Origin marks (used when unpacking a bundled file): things under boot.js (deckmd; on a CDN, …/deckmd@version/) get data-from="deckmd",
  // the user's files get data-file="actual path relative to the page". Libraries (CDN URLs) get no mark. Already bundled tags keep their mark
  function origin(abs, el) {
    if (el?.dataset.from) return ` data-from="${esc(el.dataset.from)}"`;
    if (el?.dataset.file) return ` data-file="${esc(el.dataset.file)}"`;
    if (!abs) return '';
    // With deckmd itself inside the page (a bundle, or the index.html of a zip), "under boot.js" is just the page's folder:
    // deckmd's files are all inside already, so whatever is read from a file is the user's
    const inside = document.querySelector('script[data-from="deckmd"][data-src="js/deck.js"]');
    const root = !inside && window.DeckMD?.here?.href;
    if (root && abs.startsWith(root)) return ' data-from="deckmd"';
    if (libUrl(abs)) return '';
    const f = pagePath(abs);
    return f ? ` data-file="${esc(f)}"` : '';
  }

  // Things that couldn't be embedded (cleared on every pack) — the result is still made, but reported
  let missing = [];

  // url(…) in CSS → data:
  async function packCss(text, baseUrl) {
    // @import is inlined in place (ones with a media condition are left as is)
    for (const m of [...text.matchAll(/@import\s+(?:url\(\s*)?(["']?)([^"')\s]+?)\1\s*\)?\s*;/gi)]) {
      if (/^data:/.test(m[2])) continue;
      try { const u = new URL(m[2], baseUrl); const inner = await packCss(await fetchText(u), u); text = text.replace(m[0], () => inner); }
      catch { missing.push(m[2]); }
    }
    // A src list with woff2 and older formats (woff, ttf), in any order: woff2 is all a current browser uses, and the others would double or triple the size of the file
    // (local(…) entries stay; an entry counts as woff2 by its format(…) hint or, without one, by its .woff2 extension)
    text = text.replace(/@font-face\s*\{[^}]*\}/gi, face => face.replace(/(\bsrc\s*:\s*)([^;}]*)/gi, (whole, head, list) => {            // only inside @font-face (a custom property may be called --x-src)
      const entries = list.split(/,(?=\s*url\()/i);
      const isW2 = e => /format\(\s*["']?woff2["']?\s*\)/i.test(e) || (!/format\(/i.test(e) && /url\(\s*["']?[^)"']*\.woff2(?:[?#][^)"']*)?["']?\s*\)/i.test(e));
      const w2 = entries.filter(e => /url\(/i.test(e) && isW2(e));
      if (!w2.length || entries.filter(e => /url\(/i.test(e)).length === w2.length) return whole;
      return head + entries.filter(e => !/url\(/i.test(e) || isW2(e)).join(',').trim();
    }));
    const refs = [...new Set([...text.matchAll(/url\((["']?)([^"')]+)\1\)/gi)].map(m => m[2]).filter(r => !/^(data:|#)/.test(r)))];
    for (const ref of refs) {
      try {
        const uri = await fetchDataUri(new URL(ref, baseUrl));
        text = text.split(ref).join(uri);
      } catch { missing.push(ref); }
    }
    return text;
  }

  // Text of one tag: if inside the page, that; if linked, fetch
  const tagUrl = el => el.getAttribute('href') || el.getAttribute('src');
  const tagKey = el => el.dataset.src || tagUrl(el);
  async function tagText(el) {
    const u = tagUrl(el);
    return u ? fetchText(new URL(u, location.href)) : el.textContent.replace(/^\n/, '').replace(/\n$/, '');
  }
  const tagBase = el => (tagUrl(el) ? new URL(tagUrl(el), location.href) : new URL(el.dataset.src, window.DeckMD.here));

  // Images the deck points to. Outside URLs (https:, //…) are not embedded but reported separately
  // Code is shown as written, never loaded: an example like `<!-- bg: photo.jpg -->` or ![](x.png) in a code block or span is not a reference (Markdown only; a page's HTML has its own tags). A span ends at a blank line, so a stray backtick can't swallow real images
  const withoutCode = t => t.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[`~]*[ \t]*$/gm, '').replace(/(`+)(?:(?!\1)[^\n]|\n(?!\s*\n))+?\1/g, '');
  function allRefs(text) {
    const refs = new Set();
    for (const m of text.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)) refs.add(m[1]);
    const many = v => v.split(',').map(p => p.trim()).filter(Boolean).forEach(p => refs.add(p));   // video backgrounds: several formats separated by commas
    for (const m of text.matchAll(/\b(?:src|poster|data-background-(?:image|video|iframe))\s*=\s*["']([^"']+)["']/g)) many(m[1]);
    for (const m of text.matchAll(/<!--[^>]*?\b(?:bg|background-(?:image|video|iframe))\s*:\s*([^;\n>]+?)\s*(?:;|-->|\n)/g)) many(m[1]);
    return [...refs].filter(r => !/^(data:|#)/i.test(r));
  }
  const isExternal = r => /^([a-z]+:|\/\/)/i.test(r);
  const norm = v => { try { return decodeURI(v).replace(/^\.\//, ''); } catch { return v; } };

  // The launcher page, kept in the bundle so unpacking can give it back (unpack.js). A bundle passes on the copy it carries; otherwise
  // the page is read again from the server. Nothing is kept when it can't be read (file://) or isn't a launcher page of its own:
  // a deck written inside the page, or the page npx deckmd serve makes up for decks without a project (deckmd under /_deckmd/).
  async function launcherPage() {
    const kept = document.getElementById('deck-launcher');
    if (kept) { try { return { path: kept.dataset.path || 'index.html', text: JSON.parse(kept.textContent) }; } catch { return null; } }
    if (document.querySelector('script[type="text/markdown"]')) return null;
    const url = location.href.split(/[?#]/)[0];
    let text;
    try { text = await fetchText(url); } catch { return null; }
    const page = text.replace(/<!--[\s\S]*?-->/g, '');
    if (!/<script\b[^>]*\ssrc\s*=\s*["'][^"']*\b(?:boot|deck)\.js\b/i.test(page) || /\/_deckmd\//.test(page)) return null;
    if (/<section\b|type\s*=\s*["']text\/markdown|id\s*=\s*["']deck-meta/i.test(page)) return null;
    const name = new URL(url).pathname.split('/').pop();
    let path;
    try { path = decodeURIComponent(name); } catch { path = name; }   // a stray % in the file name is not an escape
    return { path: path || 'index.html', text };
  }

  async function pack(mode, say) {
    const D = window.DeckMD;
    missing = [];
    const head = [], body = [];

    // 1. CSS/JS on the page from the start (libraries, pack.js, deck.config.js, deck.js)
    for (const el of D.staticTags) {
      const key = tagKey(el);
      if (/(^|\/)js\/boot\.js$/.test(key.split(/[?#]/)[0])) continue;   // what boot.js loaded is already there separately
      if (D.loaded.some(r => r.key === key)) continue;          // when re-packing a bundled file: themes etc. are handled in 2
      const isCss = el.tagName === 'LINK' || el.tagName === 'STYLE';
      const lib = libUrl(key);
      const cdn = mode === 'share' ? lib : null;
      say(`reading: ${key}`);
      if (cdn) { (isCss ? head : body).push(isCss ? `<link rel="stylesheet" href="${cdn}">` : `<script src="${cdn}"></script>`); continue; }
      let text;
      try { text = await tagText(el); } catch {
        if (!/(^|\/)deck\.config\.js$/.test(key.split(/[?#]/)[0])) missing.push(key);   // the config file is optional
        continue;
      }
      const pageDir = (() => { try { return new URL('.', location.href).href; } catch { return ''; } })();   // absolute URLs on the same server → paths relative to the page (no base on a blob: page)
      const keyOut = lib || (k => (k.startsWith(pageDir) ? k.slice(pageDir.length) : k))(local(key)).replace(/^(\.\.\/)+/, '');
      const mark = origin(tagUrl(el) && new URL(tagUrl(el), location.href).href, el);
      if (isCss) head.push(`<style data-src="${esc(keyOut)}"${mark}>\n${await packCss(text, tagBase(el))}\n</style>`);
      else body.push(`<script data-src="${esc(keyOut)}"${mark}>\n${scriptSafe(text)}\n</script>`);
    }

    // 2. Themes, CSS and plugins deck.js loaded (data-src = the path deck.js will recognize again)
    const tail = [];
    for (const r of D.loaded) {
      if (mode === 'share' && libUrl(r.key)) continue;              // CDN files (reveal built-in themes): deck.js loads them again
      say(`reading: ${r.key}`);
      const inPage = [...document.querySelectorAll('[data-src]')].find(el => el.dataset.src === r.key && !el.src && !el.href);
      const text = inPage ? inPage.textContent.replace(/^\n/, '').replace(/\n$/, '') : await fetchText(r.url);
      // data-loaded: deck.js loaded it (from the config or the front matter), so a zip leaves it to deck.js to load the file again
      const mark = origin(inPage ? null : r.url, inPage) + ' data-loaded';
      if (r.as === 'css') head.push(`<style data-src="${esc(r.key)}"${mark}>\n${await packCss(text, r.url)}\n</style>`);
      else tail.push(`<script data-src="${esc(r.key)}"${mark}>\n${scriptSafe(text)}\n</script>`);
    }

    // 3. Deck source and images
    let slides = '', source = '';
    const page = D.pageSlidesHTML != null;
    const assets = {};
    const refs = allRefs(page ? D.pageSlidesHTML : withoutCode(D.source || ''));
    const external = refs.filter(isExternal);
    for (const ref of refs.filter(r => !isExternal(r))) {
      say(`image: ${ref}`);
      try { assets[ref] = D.assets?.[norm(ref)] || await fetchDataUri(D.fromPage(ref, D.srcUrl)); } catch { missing.push(ref); }
    }
    if (page) {
      slides = D.pageSlidesHTML.replace(/\b(src|poster|data-background-(?:image|video|iframe))(\s*=\s*)(["'])([^"']+)\3/g,
        (m, a, eq, q, v) => `${a}${eq}${q}${v.split(',').map(p => assets[p.trim()] || p).join(',')}${q}`);
      source = `<script type="application/yaml" id="deck-meta" data-base="./">${D.pageMetaText ?? ''}</script>\n`;
    } else {
      // data-path = original location of the Markdown (relative to the page; on unpack, files and images next to the deck go back in place)
      const mdPath = document.querySelector('script[type="text/markdown"]')?.dataset.path ?? pagePath(D.srcUrl.href);
      source = `<script type="text/markdown" data-base="./"${mdPath ? ` data-path="${esc(mdPath)}"` : ''}>\n${scriptSafe(D.source || '')}</script>\n`;
      if (Object.keys(assets).length) source += `<script type="application/json" id="deck-assets">${scriptSafe(JSON.stringify(assets))}</script>\n`;
      const l = await launcherPage();
      // As a JSON string with every < escaped: a page holds <!-- and <script, which would change how the browser reads a script element
      if (l) source += `<script type="application/json" id="deck-launcher" data-path="${esc(l.path)}">${JSON.stringify(l.text).replace(/</g, '\\u003c')}</script>\n`;
    }

    const title = document.title || 'deck';
    const html = `<!doctype html>
<!-- packed with deckmd · ${mode === 'share' ? 'share (libraries from CDN)' : 'offline (everything inside)'} · ${new Date().toISOString().slice(0, 10)} -->
${window.DeckNotices?.comment([...head, ...body, ...tail].join('\n')) ?? ''}<html lang="${esc(document.documentElement.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${head.join('\n')}
</head>
<body>
<div class="reveal"><div class="slides">${slides}</div></div>
${source}
${body.join('\n')}
${tail.join('\n')}
</body>
</html>
`;
    return { html, title, missing: [...new Set(missing)], external };
  }

  function download(data, name, type = 'text/html') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ── Panel ────────────────────────────────────────────────────────
  // Mode switch (shown only when the theme declares supported modes with --deck-modes. The choice is not saved)
  function modeSection() {
    const decl = getComputedStyle(document.documentElement).getPropertyValue('--deck-modes').trim();
    const modes = decl ? decl.split(/\s+/).filter(m => /^[\w-]+$/.test(m)) : [];
    if (!window.DeckMD?.setMode || !modes.length) return '';
    const cur = document.documentElement.dataset.mode || modes[0];
    return `<h4>Mode</h4><div class="md">${[...modes, 'auto'].map(m => `<button data-mode="${m}" aria-pressed="${m === cur}">${m === 'auto' ? 'Auto' : m === 'dark' ? 'Dark' : m === 'light' ? 'Light' : m}</button>`).join('')}</div>`;
  }

  // URL options: reopen with options added to or removed from the current URL (deck position #/… kept). Options without a value are written without =, like '?draft'
  function withQuery(change) {
    const u = new URL(location.href);
    change(u.searchParams);
    u.search = u.searchParams.toString().replace(/=(?=&|$)/g, '').replace(/%2F/gi, '/');
    return u.href;
  }
  function viewSection() {
    const q = new URLSearchParams(location.search);
    const toggle = (key, label, tip) => `<button data-q="${key}" aria-pressed="${q.has(key)}" title="?${key}: ${tip}">${label}</button>`;
    const tiers = q.has('core') || document.querySelector('section[data-tier]');
    return `<h4>View</h4><div class="md">${toggle('draft', 'Review notes', '<!-- @@ … --> as yellow sticky notes')}${tiers ? toggle('core', 'Core slides only', 'only tier: core slides') : ''}</div>
      <h4>Print / PDF <span>opens in a new tab, then ⌘/Ctrl+P → Save as PDF</span></h4><div class="md"><button data-p="">Slides only</button><button data-p="separate-page">With notes</button></div>`;
  }

  let box = null;
  function close() { box?.remove(); box = null; }
  function open() {
    if (box || !window.DeckMD?.loaded) return;
    const D = window.DeckMD;
    box = document.createElement('div');
    box.innerHTML = `<div class="pk">
      <h3>deckmd <span>helper</span></h3>
      ${modeSection()}
      ${viewSection()}
      <h4>Download: pack into one file</h4>
      <button data-m="offline"><b>Offline</b><small>Everything inside. Opens without internet, large</small></button>
      <button data-m="share"><b>Share</b><small>Libraries and fonts from the CDN. Small, needs internet</small></button>
      ${window.DeckUnpack && D.pageSlidesHTML == null ? `<h4>Download: the same, with your files separate (zip)</h4><div class="md">
        <button data-u="offline" title="Your Markdown, images, CSS and JS as files to edit; the rest as in Offline, inside index.html">Offline (zip)</button>
        <button data-u="share" title="Your Markdown, images, CSS and JS as files to edit; the rest as in Share, inside index.html">Share (zip)</button></div>` : ''}
      <p class="st"></p><p class="hint">Esc to close</p></div>`;
    box.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
    const css = document.createElement('style');
    css.textContent = `.pk{background:#161b24;color:#e9edf3;border:1px solid #2c3544;border-radius:16px;padding:24px 28px;width:min(460px,90vw);font:16px/1.5 "Pretendard Variable","Apple SD Gothic Neo",sans-serif}
      .pk h3{margin:0 0 14px;font-size:20px}.pk h3 span{color:#8b96a8;font-weight:400;font-size:14px;margin-left:6px}.pk .md{display:flex;gap:8px;margin:0 0 14px}.pk .md button{margin:0;text-align:center;padding:8px 10px;flex:1}.pk .md button[aria-pressed=true]{border-color:#ffb454;color:#ffb454}.pk h4{margin:0 0 4px;font-size:14px;color:#8b96a8;font-weight:600}.pk h4 span{font-weight:400;font-size:12px;margin-left:6px}.pk button{display:block;width:100%;text-align:left;margin:8px 0;padding:12px 16px;border-radius:10px;border:1px solid #2c3544;background:#1f2632;color:inherit;font:inherit;cursor:pointer}
      .pk button:hover{border-color:#ffb454}.pk small{display:block;color:#8b96a8;font-size:13px}.pk .st{min-height:1.5em;color:#ffb454;font-size:13px;margin:10px 0 0;word-break:break-all}.pk .hint{color:#8b96a8;font-size:12px;margin:4px 0 0}`;
    box.appendChild(css);
    document.body.appendChild(box);
    const st = box.querySelector('.st');
    const say = (t) => { st.textContent = t; };
    box.addEventListener('click', e => { if (e.target === box) close(); });
    box.querySelectorAll('button[data-mode]').forEach(b => b.addEventListener('click', () => {
      window.DeckMD.setMode(b.dataset.mode);
      box.querySelectorAll('button[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
    box.querySelectorAll('button[data-q]').forEach(b => b.addEventListener('click', () => {
      location.href = withQuery(p => (p.has(b.dataset.q) ? p.delete(b.dataset.q) : p.set(b.dataset.q, '')));
    }));
    box.querySelectorAll('button[data-p]').forEach(b => b.addEventListener('click', () => {
      window.open(withQuery((p) => {
        p.set('print-pdf', '');
        if (b.dataset.p) p.set('showNotes', b.dataset.p); else p.delete('showNotes');
      }).replace(/#.*$/, ''), '_blank');
    }));
    // Every download packs first. A zip then takes the user's files back out of that bundle (unpack.js), so it is the same Offline or Share
    // bundle with those files separate, whether the deck is a project on a server or an already bundled file.
    const run = (b, mode, make) => b.addEventListener('click', async () => {
      const all = box.querySelectorAll('button[data-m], button[data-u]');
      all.forEach(x => (x.disabled = true));
      // Only reading files can fail because of file://; an error from splitting (a path outside the folder) is said as it is
      let reading = true;
      try {
        const { html, title, missing: miss } = await pack(mode, say);
        reading = false;
        const base = (new URLSearchParams(location.search).get('src') || title).split('/').pop().replace(/\.(md|markdown|html?)$/i, '') || 'deck';
        const [data, name, type] = make(html, base, title);
        download(data, name, type);
        say(`downloaded: ${name} (${Math.round(data.length / 1024)} KB)`
          + (miss.length ? ` · could not embed ${miss.length}: ${miss.join(', ')}` : ''));
        if (miss.length) console.warn('pack: files that could not be embedded', miss);
      } catch (e) {
        say(reading && location.protocol === 'file:'
          ? `could not read (${e.message}). A deck opened without a server can't read separate files. Please open it through a web server.`
          : `failed: ${e.message}`);
      }
      all.forEach(x => (x.disabled = false));
    });
    box.querySelectorAll('button[data-m]').forEach(b => run(b, b.dataset.m, (html, base) => [html, `${base}.${b.dataset.m}.html`]));
    box.querySelectorAll('button[data-u]').forEach(b => run(b, b.dataset.u, (html, base) =>
      [window.DeckUnpack.zip(window.DeckUnpack.folder(html)), `${base}.${b.dataset.u}.zip`, 'application/zip']));
  }

  // Show in the shortcut list of the help (?) (registrations made before start don't seem to stick, so once more after start)
  const label = () => window.Reveal?.registerKeyboardShortcut?.('E', 'deckmd helper (view options, PDF, packed download)');
  label();
  window.Reveal?.on?.('ready', label);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && box) { e.stopPropagation(); close(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.key === 'e' || e.key === 'E') open();
  }, true);

  window.DeckPack = { pack, open };
})();

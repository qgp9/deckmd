// deck.js — reads one Markdown file and turns it into a reveal.js deck. (Syntax in docs/writing.md, flow in docs/internals.md)
//
//  1. Read the Markdown and take out the front matter (YAML): title, size, theme, css, plugins, reveal …
//  2. Load the theme, CSS and plugins (plugins register syntax with DeckMD)
//  3. Split the body into slides at '---' lines, and from each slide take off the leading <!-- … --> settings and the Note: notes
//  4. Make HTML with markdown-it, put it in <section>s, run plugin post-processing, then start reveal
//  If the page's .slides already has <section>s written in it, those are used instead of Markdown (settings in <script type="application/yaml" id="deck-meta">)
(() => {
  const params = new URLSearchParams(location.search);
  // deckmd folder (base for themes and built-in plugins). If bundled into one file with deck.js inside, the page location
  // If the page URL can't resolve relative paths (about:srcdoc, blob:), use a fake base — such decks have every resource inside
  const pageBase = (() => { try { return new URL('.', location.href).href; } catch { return 'http://deck.local/'; } })();
  // here = top of deckmd (deck.js is in js/, so one level up). If bundled inside, the page location
  const here = document.currentScript.src ? new URL('..', document.currentScript.src) : new URL(pageBase);
  // Global config: window.DeckConfig from deck.config.js over the defaults (js/defaults.js). Markdown front matter and URL options override it
  if (!window.DeckDefaults) console.error('deckmd: js/defaults.js must be loaded before deck.js');
  const CFG = { ...window.DeckDefaults, ...(window.DeckConfig || {}) };
  // Location of the Markdown file (base for relative paths in it). If the Markdown is inside the page, data-base is its original folder
  const inlineMd = document.querySelector('script[type="text/markdown"]');
  const givenSrc = params.get('src') || document.documentElement.dataset.src;
  // Slides written directly in the page: <section>s inside .slides, and <script type="application/yaml" id="deck-meta"> instead of front matter
  const pageSections = document.querySelectorAll('.reveal .slides > section').length > 0;
  const pageMetaEl = document.getElementById('deck-meta');
  // For browser packing (pack.js): the original before reveal touches it, and the CSS/JS tags on the page from the start (up to this deck.js)
  const pageSlidesHTML = pageSections ? document.querySelector('.reveal .slides').innerHTML : null;
  const staticTags = [...document.querySelectorAll('link[rel="stylesheet"], style[data-src], script[src], script[data-src]')];
  // List: ?deck-list, or home: 'list' with neither a deck to open (?src) nor picking (?pick)
  const showingList = !inlineMd && !pageSections && (params.has('deck-list') || (!givenSrc && !params.has('pick') && CFG.home === 'list'));
  const srcPath = givenSrc || CFG.src;
  const srcUrl = inlineMd ? new URL(inlineMd.dataset.base || './', pageBase)
    : pageSections ? new URL(pageMetaEl?.dataset.base || './', pageBase)
    : new URL(srcPath, pageBase);

  // Is this value under this page's folder? Resolve it the way the browser would (the URL parser also folds `..`, `%2e%2e`,
  // `\`, tabs and `user@host` tricks) and compare with the folder's URL (pageBase ends with /). See getSource.
  const underPage = (p) => { try { return new URL(p, pageBase).href.startsWith(pageBase); } catch { return false; } };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── API for plugins ─────────────────────────────────────────────
  const DeckMD = window.DeckMD = {
    version: '0.4.1',  // same as package.json (npm version bumps both, a test checks). Informational: plugins should check whether a feature exists
    config: {},        // front matter
    md: null,          // markdown-it instance (plugins may call md.use(...))
    fences: {},        // code block language → (code, attrs, token) => HTML
    hooks: [],         // (section, deck) => void — after a slide is attached to the DOM
    sources: new WeakMap(),   // section → the Markdown it was made from (slide settings comment + content, without the notes). Only for slides made from Markdown
    runs: {},          // name → (section) => cleanup function | void — when a slide with the slide setting run: name is shown
    srcUrl,
    esc,
    registerFence(lang, fn) { this.fences[lang] = fn; },
    afterRender(fn) { this.hooks.push(fn); },
    // Runs each time a slide is shown: <!-- run: name --> on the slide, DeckMD.registerRun('name', sec => { …; return () => cleanup on leaving }) in the plugin
    registerRun(name, fn) { this.runs[name] = fn; },
    // CSS next to the plugin itself (e.g. DeckMD.loadCSS('grid.css')). The deck waits until it has loaded before starting
    loadCSS(href) {
      const cur = document.currentScript;
      const base = cur?.src || (cur?.dataset.src ? new URL(cur.dataset.src, here) : here);
      const ownerKey = cur?.dataset.src || pluginKey || '';
      const key = (ownerKey.includes('/') ? ownerKey.replace(/[^/]*$/, '') : '') + href.replace(/^\.\//, '');
      const p = loadCSS(new URL(href, base), key);
      pending.push(p);
      return p;
    },
    // read by pack.js
    here, staticTags, pageSlidesHTML,
    pageMetaText: pageMetaEl?.textContent ?? null,
    source: null,          // Markdown source
    loaded: [],            // themes, CSS and plugins deck.js loaded { url, key, as }
    assets: null,          // table of embedded assets
  };
  const pending = [];
  let pluginKey = '';

  // Files already put into the page when packing (pack.js) (<style data-src>, <script data-src>) are not loaded again
  // data-src is written relative to deckmd for deckmd's files (themes/x/x.css), relative to the page for files next to the Markdown or page
  const inlined = (url) => {
    const want = new URL(url).href;
    return [...document.querySelectorAll('[data-src]')].some(el => [here, pageBase].some(b => new URL(el.dataset.src, b).href === want));
  };

  // key = path written into <… data-src> when packing (deckmd's files = themes/x/x.css, files next to the deck = as written)
  function loadCSS(url, key) {
    if (key != null) DeckMD.loaded.push({ url: String(url), key, as: 'css' });
    if (inlined(url)) return Promise.resolve();
    return new Promise((resolve) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = url;
      l.onload = l.onerror = resolve;
      document.body.appendChild(l);     // must come after reveal.css added by boot.js (same order in bundled files: at the very end)
    });
  }

  function loadScript(url, key) {
    if (key != null) DeckMD.loaded.push({ url: String(url), key, as: 'js' });
    if (inlined(url)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`could not load plugin: ${url}`));
      document.body.appendChild(s);
    });
  }

  const list = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
  // Just a name like "grid" → deckmd's plugins/grid/grid.js; a path is relative to where that setting is written (Markdown front matter = the Markdown, deck.config.js = the launcher page)
  // A path starting with '/' = relative to the launcher page (index.html). Not the server root but where index.html is (it can live under a subpath)
  const fromPage = (v, base) => (v.startsWith('/') ? new URL(v.replace(/^\/+/, ''), pageBase) : new URL(v, base));
  DeckMD.fromPage = fromPage;          // used by pack.js
  const pluginUrl = (p, base = srcUrl) => (/[/.]/.test(p) ? fromPage(p, base) : new URL(`plugins/${p}/${p}.js`, here));
  // A theme path can also be a directory: if the last part has no extension, the <name>.css inside it (/themes/my → /themes/my/my.css)
  // reveal/white = reveal.js built-in theme. Same location as the page's reveal.css (CDN or vendor/; in a bundled file, its data-src)
  const revealBase = () => {
    const el = document.querySelector('link[rel="stylesheet"][href$="/reveal.css"], style[data-src$="/reveal.css"]');
    return el ? new URL('.', new URL(el.getAttribute('href') || el.dataset.src, location.href)).href : null;
  };
  const revealTheme = t => /^reveal\/[\w-]+$/.test(t) && revealBase() ? `${revealBase()}theme/${t.slice(7)}.css` : null;
  const themeFile = t => revealTheme(t) || (/^[a-z]+:/i.test(t) ? t : (/[/.]/.test(t) && !/\.[^/]*$/.test(t.replace(/\/+$/, '')) ? `${t.replace(/\/+$/, '')}/${t.replace(/\/+$/, '').split('/').pop()}.css` : t));
  const themeUrl = (t, base = srcUrl) => (/[/.]/.test(t) ? fromPage(t, base) : new URL(`themes/${t}/${t}.css`, here));

  // ── markdown-it ─────────────────────────────────────────────────
  function makeMarkdown() {
    const md = window.markdownit({ html: true, linkify: true, breaks: false });
    md.use(window.markdownItBracketedSpans);                            // [text]{.class} → <span>
    md.use(window.markdownItAttrs, { allowedAttributes: [] });          // {.class #id data-x=1}
    // ::: name rest  →  <div class="name rest">  (any name. When nesting, make the outer colons longer)
    md.use(window.markdownitContainer, 'div', {
      validate: () => true,
      render: (tokens, idx) => {
        const t = tokens[idx];
        if (t.nesting !== 1) return '</div>\n';
        const cls = t.info.trim();
        return cls ? `<div class="${esc(cls)}">\n` : '<div>\n';
      },
    });
    const fallback = md.renderer.rules.fence;
    md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
      const t = tokens[idx];
      const lang = t.info.trim().split(/\s+/)[0];
      const fn = DeckMD.fences[lang];
      if (!fn) return fallback(tokens, idx, opts, env, self);
      try { return fn(t.content, Object.fromEntries(t.attrs || []), t); }
      catch (e) { return `<pre class="deck-error">${esc(`${lang}: ${e.message}`)}</pre>`; }
    };
    return md;
  }

  // ── Markdown → slides ───────────────────────────────────────────
  function splitFrontmatter(text) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
    if (!m) return { meta: {}, body: text };
    return { meta: window.jsyaml.load(m[1]) || {}, body: text.slice(m[0].length) };
  }

  // Code block fences: remember the opening line's character (` or ~) and length; only a line of the same character at least as long closes it
  // Three or more ``` or ~~~, any indentation (to catch code blocks inside lists too). Otherwise CommonMark rules
  // Opening line: if a backtick fence's info string contains a backtick, it is not a fence (```` ```grid ```` is inline code)
  // Closing line: same character, at least the opening length, only whitespace after
  const fenceLine = line => /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
  const fenceStep = (open, f) => {
    if (!f) return open;
    const [, mark, rest] = f;
    if (open === null) return mark[0] === '`' && rest.includes('`') ? null : mark;
    return mark[0] === open[0] && mark.length >= open.length && !rest.trim() ? null : open;
  };

  // Split at '---' lines that are not inside a code block
  function splitSlides(body) {
    const slides = [[]];
    let fence = null;
    for (const line of body.split(/\r?\n/)) {
      const f = fenceLine(line);
      fence = fenceStep(fence, f);
      if (fence === null && /^---\s*$/.test(line)) slides.push([]);
      else slides[slides.length - 1].push(line);
    }
    return slides.map(l => l.join('\n'));
  }

  // ── Markdown without '---', like a README: split by headings ──────
  //  # Title    → chapter slide (up to the first paragraph right below)
  //  ## Title   → slide. If it has no content and ### follows, like a chapter slide
  //  ### Title  → slide, with the ## title small above it
  //  If long, overflow by block (paragraph, list, table, code block) into "(cont.)" slides. A single block is never split.
  //  Size = estimated screen lines (about 45 characters per line at 44px body text; tables and code are smaller). Default 12 per slide
  //  Slides that still overflow (big tables or lists that can't be split) get fit: shrink the text to fit (fitSlides below)
  function blocksOf(lines) {
    const blocks = [];
    let cur = [], fence = null;
    for (const line of lines) {
      const f = fenceLine(line);
      fence = fenceStep(fence, f);
      if (fence === null && !f && !line.trim()) { if (cur.length) blocks.push(cur); cur = []; }
      else cur.push(line);
    }
    if (cur.length) blocks.push(cur);
    return blocks;
  }
  const weight = (block) => {
    if (/^\s*(`{3,}|~{3,})/.test(block[0])) return block.length * 0.75;                    // code 0.72em
    if (/^\s*\|/.test(block[0])) return block.reduce((n, l) => n + 0.9 + Math.floor(l.length / 110) * 0.6, 0);  // table 0.68em
    return block.reduce((n, l) => n + Math.max(1, Math.ceil(l.replace(/[`*_[\]{}]|\(http[^)]*\)/g, '').length / 45)), 0) + 0.4;
  };
  function chunk(blocks, budget) {
    const pages = [[]];
    let used = 0;
    for (const b of blocks) {
      const w = weight(b);
      if (used > 0 && used + w > budget) { pages.push([]); used = 0; }
      pages[pages.length - 1].push(b);
      used += w;
    }
    return pages.map(p => p.map(b => b.join('\n')).join('\n\n'));
  }

  function splitHeadings(body, budget) {
    const secs = [{ level: 0, title: '', lines: [] }];
    let fence = null;
    for (const line of body.split(/\r?\n/)) {
      const f = fenceLine(line);
      fence = fenceStep(fence, f);
      const h = fence === null && !f && /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
      if (h) secs.push({ level: h[1].length, title: h[2], lines: [] });
      else secs[secs.length - 1].lines.push(line);
    }
    const slides = [];
    let h1 = '', h2 = '';
    secs.forEach((sec, i) => {
      const blocks = blocksOf(sec.lines);
      const next = secs[i + 1];
      if (sec.level === 0) {                                    // before the first heading (badges and such)
        if (blocks.length) chunk(blocks, budget).forEach(c => slides.push(`<!-- fit -->\n\n${c}`));
        return;
      }
      if (sec.level === 1 || (sec.level === 2 && !blocks.length && next?.level === 3)) {
        if (sec.level === 1) { h1 = sec.title; h2 = ''; } else h2 = sec.title;
        const kicker = sec.level === 2 && h1 ? `###### ${h1}\n\n` : '';
        const [lead, ...rest] = blocks;                          // only the first block right below goes on the chapter slide
        const leadOk = lead && weight(lead) <= budget / 3 && !/^\s*(`|~|\||[-*+] |\d+\. )/.test(lead[0]);
        slides.push(`<!-- class: chapter; fit -->\n\n${kicker}# ${sec.title}${leadOk ? `\n\n${lead.join('\n')} {.teaser}` : ''}`);
        const remain = leadOk ? rest : blocks;
        if (remain.length) chunk(remain, budget).forEach((c, k) => slides.push(`<!-- fit -->\n\n## ${sec.title}${k ? ' (cont.)' : ''}\n\n${c}`));
        return;
      }
      if (sec.level === 2) h2 = sec.title;
      const kicker = sec.level === 3 && h2 ? `###### ${h2}\n\n` : '';
      const pages = blocks.length ? chunk(blocks, budget) : [''];
      pages.forEach((c, k) => slides.push(`<!-- fit -->\n\n${kicker}## ${sec.title}${k ? ' (cont.)' : ''}\n\n${c}`));
    });
    return slides;
  }

  // If there is no '---' slide break at all, split by headings (front matter split: headings | rules can also decide)
  function hasRules(body) {
    let fence = null;
    for (const line of body.split(/\r?\n/)) {
      const f = fenceLine(line);
      fence = fenceStep(fence, f);
      if (fence === null && /^---\s*$/.test(line)) return true;
    }
    return false;
  }

  // <!-- tier: backup; class: chapter; auto-animate --> at the top of a slide → attributes
  function directives(src) {
    const m = /^\s*<!--(?!\s*@@)([\s\S]*?)-->/.exec(src);
    if (!m) return { attrs: {}, rest: src };
    const attrs = {};
    for (const part of m[1].split(/[;\n·]/)) {
      const p = part.trim();
      if (!p) continue;
      const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(p);
      if (kv) attrs[kv[1]] = kv[2].trim();
      else attrs[p] = true;
    }
    return { attrs, rest: src.slice(m[0].length) };
  }

  function applyAttrs(section, attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') section.className = v;
      else if (k === 'id') section.id = v;
      else if (k === 'tier') section.dataset.tier = v;
      else if (k === 'auto-animate') section.setAttribute('data-auto-animate', '');
      else if (k === 'bg') {                                            // bg: color / image / video (mp4·webm·mov)
        const val = v.replace(/^url\((.*)\)$/, '$1');
        section.setAttribute(/\.(mp4|webm|mov|m4v|ogv)$/i.test(val) ? 'data-background-video'
          : /^(url|https?:|\.|\/)/.test(v) || /\.(png|jpe?g|svg|webp|gif|avif)$/i.test(val) ? 'data-background-image' : 'data-background-color', val);
      }
      else if (k.startsWith('data-')) section.setAttribute(k, v === true ? '' : v);
      else section.setAttribute(`data-${k}`, v === true ? '' : v);       // transition: zoom → data-transition
    }
  }

  // Notes split: the first 'Note:' line outside code blocks. Everything below it is notes
  function splitNotes(text) {
    const lines = text.split('\n');
    let fence = null;
    for (let i = 0; i < lines.length; i++) {
      fence = fenceStep(fence, fenceLine(lines[i]));
      if (fence === null && /^Notes?:[ \t]*$/.test(lines[i])) return [lines.slice(0, i).join('\n'), lines.slice(i + 1).join('\n')];
    }
    return [text, ''];
  }

  function buildSection(src, md) {
    const { attrs, rest } = directives(src);
    const [content, notes] = splitNotes(rest);
    const section = document.createElement('section');
    applyAttrs(section, attrs);
    DeckMD.sources.set(section, (src.slice(0, src.length - rest.length) + content).trim());
    section.innerHTML = md.render(content);
    if (notes && notes.trim()) {
      const aside = document.createElement('aside');
      aside.className = 'notes';
      aside.innerHTML = md.render(notes);
      section.appendChild(aside);
    }
    return section;
  }

  // ── Default post-processing ─────────────────────────────────────
  // ::: fragments → the items right below (li, or children) one by one
  DeckMD.afterRender((sec) => {
    sec.querySelectorAll('.fragments').forEach((box) => {
      const items = box.querySelectorAll(':scope > ul > li, :scope > ol > li');
      (items.length ? items : box.children).forEach(el => el.classList.add('fragment'));
    });
  });
  // ?draft: <!-- @@ note --> as yellow sticky notes
  DeckMD.afterRender((sec) => {
    if (!params.has('draft')) return;
    const notes = [];
    const walk = document.createTreeWalker(sec, NodeFilter.SHOW_COMMENT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const m = /^\s*@@([\s\S]*)$/.exec(n.data);
      if (m) notes.push(m[1].trim());
    }
    if (!notes.length) return;
    const box = document.createElement('div');
    box.className = 'cm-notes';
    box.innerHTML = notes.map(x => `<div>💬 ${esc(x)}</div>`).join('');
    sec.appendChild(box);
  });

  function fail(msg) {
    const html = `<h2>Can't open the deck</h2><p>${esc(msg)}</p>`;
    if (!window.Reveal) {        // when even the libraries failed to load (no internet, etc.)
      document.body.innerHTML = `<div style="font:18px/1.6 sans-serif;padding:40px;color:#e9edf3;background:#0e1117;min-height:100vh">${html}</div>`;
      return;
    }
    document.querySelector('.slides').innerHTML = `<section>${html}</section>`;
    if (Reveal.isReady()) Reveal.sync(); else Reveal.initialize({ hash: false });
  }

  // ── Getting the Markdown ────────────────────────────────────────
  //  1. <script type="text/markdown"> in the page (a one-file deck with the Markdown inside)
  //  2. fetch(src) — when opened through a web server
  //  3. When opened without a server (file://): pick the file once and the browser remembers it (local below)
  async function getSource() {
    if (inlineMd) return inlineMd.textContent.replace(/^\n/, '').replace(/<\\\/script/gi, '</script');   // packing (pack.js) stores </script as <\/script
    if (params.has('pick')) return local.open();                          // pick directly even when served (for testing)
    // ?src comes from the address: anyone who can hand you a link could point it at their own Markdown, and that Markdown's
    // front matter can load scripts (plugins: [URL]) that then run on this origin. So only a relative path under this page's
    // folder is opened (a URL, a leading /, or a .. that climbs out of it all resolve outside, and are refused).
    // (Not for <html data-src>: that is written into the page itself, e.g. by build.mjs.)
    if (params.get('src') && !underPage(params.get('src'))) {
      throw new Error(`?src=${params.get('src')} is not opened: ?src must be a path under this page's folder, because a deck's front matter can load scripts that run on this page.`);
    }
    try {
      const res = await fetch(srcUrl);
      if (!res.ok) throw new Error(`${srcPath}: ${res.status}`);
      return await res.text();
    }
    catch (e) {
      if (location.protocol !== 'file:') throw e;
      return local.open();
    }
  }

  // Use without a server. Browsers block a file:// page from fetching files next to it, so the user picks the file.
  //  - Chrome/Edge: store the picked file's "handle" in IndexedDB → read again on reload, redraw the deck when the file changes
  //  - Other browsers: file picker / drag and drop. The content is kept in sessionStorage, so it lasts only until reload
  //  Relative paths in the Markdown (css, plugins) stay relative to ?src (<link>, <script> work on file:// too)
  const local = {
    key: `deck:${srcPath}`,
    db() {
      return new Promise((resolve, reject) => {
        const r = indexedDB.open('deckmd', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('handles');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    },
    async get() {
      try {
        const db = await this.db();
        return await new Promise(res => { const q = db.transaction('handles').objectStore('handles').get(this.key); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
      } catch { return null; }
    },
    async put(h) {
      try { const db = await this.db(); db.transaction('handles', 'readwrite').objectStore('handles').put(h, this.key); } catch {}
    },
    // Redraw when the file changes (the current slide is kept via the hash)
    watch(handle, file) {
      let last = file.lastModified;
      setInterval(async () => {
        try { const f = await handle.getFile(); if (f.lastModified !== last) location.reload(); } catch {}
      }, 1000);
    },
    async read(handle) {
      const file = await handle.getFile();
      this.watch(handle, file);
      return file.text();
    },
    async open() {
      const handle = await this.get();
      if (handle && (await handle.queryPermission?.({ mode: 'read' })) === 'granted') return this.read(handle);
      const cached = sessionStorage.getItem(this.key);
      if (cached != null && !('showOpenFilePicker' in window)) return cached;
      return this.ask(handle);
    },
    // Picker screen — one button press (browsers require a user action)
    ask(handle) {
      return new Promise((resolve) => {
        // The theme is only known after reading the Markdown, so this screen's styling lives here
        const style = document.createElement('style');
        style.textContent = `.deck-open { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: #0e1117; color: #e9edf3; font: 18px/1.6 "Pretendard Variable", "Apple SD Gothic Neo", sans-serif; }
.deck-open > div { border: 2px dashed #2c3544; border-radius: 18px; padding: 40px 56px; text-align: center; max-width: 640px; }
.deck-open.over > div { border-color: #ffb454; }
.deck-open h2 { font-size: 28px; margin: 0 0 12px; color: #fff; }
.deck-open small { color: #8b96a8; }
.deck-open button { font: 600 18px "Pretendard Variable", "Apple SD Gothic Neo", sans-serif; color: #000; background: #ffb454; border: 0; border-radius: 10px; padding: 10px 22px; margin: 12px 0; cursor: pointer; }`;
        document.head.appendChild(style);
        const box = document.createElement('div');
        box.className = 'deck-open';
        const name = srcPath.split('/').pop();
        box.innerHTML = `<div><h2>${esc(name)}</h2>
          <p>${location.protocol === 'file:' ? 'Opened without a server. ' : ''}Please choose a Markdown file.<br>
          <small>Chrome and Edge remember it and redraw right away when you edit the file.</small></p>
          <button>${handle ? `Reopen: ${esc(handle.name)}` : 'Open Markdown file'}</button>
          <p><small>or drop a file here</small></p></div>`;
        document.body.appendChild(box);
        const done = (text) => { box.remove(); resolve(text); };
        const fromFile = async (file) => { const t = await file.text(); sessionStorage.setItem(this.key, t); done(t); };
        box.querySelector('button').onclick = async () => {
          try {
            if (handle && (await handle.requestPermission({ mode: 'read' })) === 'granted') return done(await this.read(handle));
            if ('showOpenFilePicker' in window) {
              const [h] = await window.showOpenFilePicker({ types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } }] });
              await this.put(h);
              return done(await this.read(h));
            }
          } catch (e) { if (e.name === 'AbortError') return; }
          const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.md,.markdown,text/markdown' });
          input.onchange = () => input.files[0] && fromFile(input.files[0]);
          input.click();
        };
        box.ondragover = (e) => { e.preventDefault(); box.classList.add('over'); };
        box.ondragleave = () => box.classList.remove('over');
        box.ondrop = async (e) => {
          e.preventDefault();
          const item = [...e.dataTransfer.items].find(i => i.kind === 'file');
          const h = await item?.getAsFileSystemHandle?.();
          if (h && h.kind === 'file') { await this.put(h); return done(await this.read(h)); }
          const file = e.dataTransfer.files[0];
          if (file) fromFile(file);
        };
      });
    },
  };

  // ── Relative paths and embedded assets ──────────────────────────
  // Relative paths of images, links and backgrounds in the deck resolve against the Markdown (for slides written in a page, that page); starting with '/', against the launcher page (index.html).
  // If there are assets embedded when packing (<script type="application/json" id="deck-assets">), they are replaced with those data: URLs.
  const assetEl = document.getElementById('deck-assets');
  const norm = v => { try { return decodeURI(v).replace(/^\.\//, ''); } catch { return v; } };
  const ASSETS = DeckMD.assets = Object.fromEntries(Object.entries(assetEl ? JSON.parse(assetEl.textContent) : {}).map(([k, v]) => [norm(k), v]));
  const blobUrl = (dataUri) => {
    const [head, data] = dataUri.split(/,(.*)/s);
    const bytes = /;base64$/.test(head) ? Uint8Array.from(atob(data), c => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(data));
    return URL.createObjectURL(new Blob([bytes], { type: /^data:([^;,]+)/.exec(head)?.[1] || '' }));
  };
  function localize(sec) {
    const fix = (el, attr) => {
      const v = el.getAttribute(attr);
      if (!v || /^(data:|blob:|[a-z]+:|#|\/\/)/i.test(v)) return;
      el.setAttribute(attr, ASSETS[norm(v)] || fromPage(v, srcUrl).href);
    };
    for (const el of sec.querySelectorAll('img[src], source[src], video[src], audio[src], iframe[src]')) fix(el, 'src');
    for (const el of sec.querySelectorAll('video[poster]')) fix(el, 'poster');
    for (const el of sec.querySelectorAll('a[href]')) fix(el, 'href');
    // Slide backgrounds: image, video (several formats separated by commas), web page
    // reveal.js splits videos at commas, so data: URLs in bundled files (which contain commas) are turned into blob: URLs
    for (const attr of ['data-background-image', 'data-background-video', 'data-background-iframe']) {
      for (const el of [sec, ...sec.querySelectorAll(`[${attr}]`)]) {
        if (!el.hasAttribute(attr)) continue;
        const parts = el.getAttribute(attr).split(',').map(p => p.trim());
        el.setAttribute(attr, parts.map((p) => {
          el.setAttribute(attr, p);
          fix(el, attr);
          const u = el.getAttribute(attr);
          return attr === 'data-background-video' && u.startsWith('data:') ? blobUrl(u) : u;
        }).join(','));
      }
    }
  }

  async function main() {
    if (showingList) { showList(); return; }
    let meta = {}, body = '';
    if (pageSections) {
      try { meta = (pageMetaEl && window.jsyaml.load(pageMetaEl.textContent)) || {}; }
      catch (e) { fail(`deck-meta: ${e.message}`); return; }
    } else {
      let text;
      try { text = await getSource(); }
      catch (e) { fail(e.message); return; }
      try { ({ meta, body } = splitFrontmatter(text)); }
      catch (e) { fail(`${srcPath} front matter (YAML): ${e.message}`); return; }
      DeckMD.source = text;
    }
    DeckMD.config = meta;
    if (meta.title) document.title = meta.title;
    if (meta.lang) document.documentElement.lang = meta.lang;
    if (params.has('draft')) document.documentElement.classList.add('draft');
    // Light/dark mode: <html data-mode="dark|light">. If not set, nothing is added and the theme keeps its default look.
    // URL ?mode= > front matter mode > config mode. 'auto' follows the OS setting (prefers-color-scheme) at open time (does not follow later changes)
    // The theme decides whether it supports modes (its own default mode on :root, the opposite mode overridden by :root[data-mode="…"])
    // DeckMD.setMode is also used by the helper panel (E). A theme declares the modes it supports with the CSS variable --deck-modes ("dark light")
    DeckMD.setMode = (m) => {
      document.documentElement.dataset.mode = m === 'auto'
        ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : m;
    };
    const modeWant = params.get('mode') || meta.mode || CFG.mode;
    if (modeWant) DeckMD.setMode(modeWant);

    DeckMD.md = makeMarkdown();
    // Theme: the front matter's if present, otherwise the config's. CSS and plugins: the config's + the front matter's (each file once)
    const named = (v, dir, ext) => (/[/.]/.test(v) ? v.replace(/^\/+/, '') : `${dir}/${v}/${v}${ext}`);
    const themes = meta.theme != null ? list(meta.theme).map(themeFile).map(t => ({ url: themeUrl(t), key: named(t, 'themes', '.css') }))
      : list(CFG.theme).map(themeFile).map(t => ({ url: themeUrl(t, pageBase), key: named(t, 'themes', '.css') }));
    // deck.config.js is next to the launcher page, so paths written there are relative to the page
    // css/base.css (common rules) always comes before the theme, whatever the theme
    const css = [{ url: new URL('css/base.css', here), key: 'css/base.css' }, ...themes, ...list(CFG.css).map(c => ({ url: fromPage(c, pageBase), key: c.replace(/^\/+/, '') })), ...list(meta.css).map(c => ({ url: fromPage(c, srcUrl), key: c.replace(/^\/+/, '') }))];
    const seen = new Set();
    const once = x => !seen.has(String(x.url)) && seen.add(String(x.url));
    await Promise.all(css.filter(once).map(c => loadCSS(c.url, c.key)));
    // CSS written in style: as is (config's + front matter's). After the files, so it overrides the theme and css
    const inlineCss = [...list(CFG.style), ...list(meta.style)].join('\n');
    if (inlineCss.trim()) {
      const st = document.createElement('style');
      st.textContent = inlineCss;
      document.body.appendChild(st);
    }
    const plugins = [...list(CFG.plugins).map(p => ({ url: pluginUrl(p, pageBase), key: named(p, 'plugins', '.js') })),
      ...list(meta.plugins).map(p => ({ url: pluginUrl(p), key: named(p, 'plugins', '.js') }))];
    try { for (const p of plugins.filter(once)) { pluginKey = p.key; await loadScript(p.url, p.key); } }
    catch (e) { fail(e.message); return; }
    pluginKey = '';

    await Promise.all(pending);
    const deck = document.querySelector('.slides');
    if (!pageSections) {
      const split = params.get('split') || meta.split || CFG.split || (hasRules(body) ? 'rules' : 'headings');
      const sources = split === 'headings' ? splitHeadings(body, +(params.get('lines') || meta.lines || CFG.lines)) : splitSlides(body);
      for (const src of sources) {
        if (!src.trim()) continue;
        deck.appendChild(buildSection(src, DeckMD.md));
      }
    }
    // ?core: only slides whose tier is core. Slides without a tier get defaultTier (default core). If no slides remain, keep them all and warn (instead of an empty deck)
    if (params.has('core')) {
      const dflt = String(params.get('defaultTier') || meta.defaultTier || CFG.defaultTier || 'core');
      const all = [...deck.querySelectorAll('section')].filter(s => !s.querySelector(':scope > section'));   // slides (not the outer section of a vertical stack)
      const cut = all.filter(s => (s.closest('section[data-tier]')?.dataset.tier || dflt) !== 'core');   // own tier, else the vertical stack's tier
      if (cut.length === all.length) console.warn(`?core: no core slides, so all are shown (add tier: core, or defaultTier: core)`);
      else {
        const stacks = new Set(cut.map(s => s.parentElement).filter(p => p.tagName === 'SECTION'));
        cut.forEach(s => s.remove());
        stacks.forEach(p => { if (!p.querySelector(':scope > section')) p.remove(); });   // vertical stacks left empty
      }
    }
    // <style> written inside a slide is moved after the theme (inside the slide it comes before the theme in document order and loses on equal selectors).
    // Slides left with nothing after the move (slides that only had <style>) are removed
    for (const sec of [...deck.querySelectorAll(':scope > section')]) {
      const styles = [...sec.querySelectorAll('style')];
      if (!styles.length) continue;
      styles.forEach(st => document.body.appendChild(st));
      if (!sec.children.length && !sec.textContent.trim() && !sec.getAttributeNames().length) sec.remove();
    }
    for (const sec of deck.querySelectorAll(':scope > section')) {
      localize(sec);
      for (const fn of DeckMD.hooks) fn(sec, DeckMD);
    }

    const [width, height] = String(meta.size || CFG.size).split('x').map(Number);
    Reveal.initialize({
      width, height,
      margin: 0.04,
      hash: true,
      center: true,
      transition: 'fade',
      transitionSpeed: 'fast',
      backgroundTransition: 'none',
      autoAnimateDuration: 0.8,
      slideNumber: s => [`${Reveal.getIndices(s).h} / ${Reveal.getHorizontalSlides().length - 1}`],
      plugins: [window.RevealNotes, window.RevealHighlight].filter(Boolean),
      ...(CFG.reveal || {}),
      ...(meta.reveal || {}),
    });
    Reveal.on('ready', fitSlides);
    startRuns();
    document.fonts?.addEventListener('loadingdone', () => Reveal.isReady() && fitSlides());   // CDN fonts can arrive late (font-display: swap)
  }

  // Slide setting run: name (several separated by spaces or commas) → when that slide is shown, DeckMD.runs[name](section), else a global function of the same name.
  // The returned function is called when leaving the slide (stop timers, etc.). When printing (?print-pdf), every slide once (so what it shows stays)
  function startRuns() {
    let cleanups = [];
    const enter = (sec) => {
      cleanups.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
      cleanups = [];
      for (const name of (sec?.dataset.run || '').split(/[\s,]+/).filter(Boolean)) {
        const fn = DeckMD.runs[name] || (typeof window[name] === 'function' ? window[name] : null);
        if (!fn) { console.warn(`run: "${name}" not found (register it with DeckMD.registerRun('${name}', …))`); continue; }
        try { const c = fn(sec, DeckMD); if (typeof c === 'function') cleanups.push(c); } catch (e) { console.error(`run: ${name}`, e); }
      }
    };
    Reveal.on('ready', () => {
      if (Reveal.isPrintView?.()) document.querySelectorAll('.slides section[data-run]').forEach(enter);
      else enter(Reveal.getCurrentSlide());
    });
    Reveal.on('slidechanged', e => enter(e.currentSlide));
  }

  // ── Deck list (?deck-list, or home: 'list' in deck.config.js) ─────────────
  //  decks: [...] a fixed list is used as is; 'auto' finds the scan folders in the web server's directory listings (not on file://)
  //  Titles are each deck's front matter title, else its first # heading (only when it can be read)
  // Read links from a directory listing (HTML the web server returns)
  async function listDir(d) {
    const res = await fetch(new URL(d || './', pageBase));
    if (!res.ok) return [];
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    return [...doc.querySelectorAll('a[href]')].map(a => decodeURIComponent(a.getAttribute('href')));
  }
  // scan: ['slides', 'slides/*'] — 'x/*' means each subfolder of x (one deck = one folder). Relative to the page.
  // The top ('.', '*') can't be found when the launcher page is index.html, because the server returns that page instead of a directory listing
  async function scanDecks() {
    const found = [];
    const dirs = [];
    for (const entry of list(CFG.scan)) {
      const star = /(^|\/)\*$/.test(entry);                       // '*' or 'x/*'
      const b = entry.replace(/\/?\*$/, '').replace(/^\.$/, '');
      const d = b ? b.replace(/\/?$/, '/') : '';
      if (!star) { dirs.push(d); continue; }
      try { for (const h of await listDir(d)) if (/^[^/?#.][^/?#]*\/$/.test(h)) dirs.push(d + h); } catch {}
    }
    for (const d of dirs) {
      try {
        for (const h of await listDir(d)) if (/^[^/?#]+\.(md|markdown)$/i.test(h)) found.push({ src: d + h });
      } catch {}
    }
    return found;
  }

  async function titleOf(src) {
    try {
      const text = await (await fetch(new URL(src, pageBase))).text();
      const { meta, body } = splitFrontmatter(text);
      return meta.title || /^#\s+(.+)$/m.exec(body)?.[1] || null;
    } catch { return null; }
  }

  async function showList() {
    document.title = CFG.title;
    const style = document.createElement('style');
    style.textContent = `
      body { background: #0e1117; color: #e9edf3; font: 18px/1.6 "Pretendard Variable", "Apple SD Gothic Neo", sans-serif; margin: 0; }
      .reveal { display: none; }
      .deck-list { max-width: 820px; margin: 8vh auto; padding: 0 24px; }
      .deck-list h1 { font-size: 30px; margin: 0 0 24px; color: #fff; }
      .deck-list a { color: inherit; text-decoration: none; }
      .deck-list li { list-style: none; display: flex; align-items: baseline; gap: 14px; padding: 12px 16px; border: 1px solid #2c3544; border-radius: 12px; margin-bottom: 10px; background: #161b24; }
      .deck-list li:hover { border-color: #ffb454; }
      .deck-list ul { padding: 0; }
      .deck-list .t { font-weight: 700; flex: 1; }
      .deck-list .p { color: #8b96a8; font: 14px ui-monospace, Menlo, monospace; }
      .deck-list .c { color: #ffb454; font-size: 14px; }
      .deck-list .hint { color: #8b96a8; font-size: 15px; }
      .deck-list code { background: #1f2632; padding: 1px 6px; border-radius: 5px; }`;
    document.head.appendChild(style);
    const box = document.createElement('div');
    box.className = 'deck-list';
    box.innerHTML = `<h1>${esc(CFG.title)}</h1><ul></ul>`;
    document.body.appendChild(box);

    const items = Array.isArray(CFG.decks) ? CFG.decks.map(d => (typeof d === 'string' ? { src: d } : { ...d })) : await scanDecks();
    const ul = box.querySelector('ul');
    const page = location.pathname.split('/').pop();                  // '' means the current folder (= index.html)
    const href = (src, extra = '') => `${page}?src=${encodeURIComponent(src)}${extra}`;
    for (const it of items) {
      const li = document.createElement('li');
      li.innerHTML = `<a class="t" href="${href(it.src)}">${esc(it.title || it.src)}</a>`
        + `<span class="p">${esc(it.src)}</span><a class="c" href="${href(it.src, '&core')}">core</a>`;
      ul.appendChild(li);
      if (!it.title) titleOf(it.src).then(t => { if (t) li.querySelector('.t').textContent = t; });
    }
    if (!items.length) {
      box.insertAdjacentHTML('beforeend', `<p class="hint">${location.protocol === 'file:'
        ? 'Folders can\'t be scanned without a server. List the decks in <code>decks</code> in <code>deck.config.js</code>, or'
        : `No Markdown found in the <code>${esc(list(CFG.scan).join(', '))}</code> folders. Or`}
        <a href="${page}?pick" style="color:#ffb454">choose a Markdown file directly</a>.</p>`);
    }
  }

  // data-fit slides (split by headings, or <!-- fit -->): if they overflow, shrink the text to fit the slide height (down to 60%)
  function fitSlides() {
    const H = Reveal.getConfig().height * 0.96;
    for (const sec of document.querySelectorAll('.reveal .slides > section[data-fit]')) {
      const shown = sec.style.display;
      sec.style.display = 'block';
      sec.style.fontSize = '';
      for (let k = 0, pct = 100; k < 4; k++) {
        const h = sec.scrollHeight;
        if (h <= H || pct <= 60) break;
        pct = Math.max(60, Math.floor(pct * (H / h) * 0.98));
        sec.style.fontSize = `${pct}%`;
      }
      sec.style.display = shown;
    }
    Reveal.layout();
  }

  // A deck bundled into one file has the plugin <script>s after deck.js, so start after the whole page has loaded
  // Wherever it fails, show the reason instead of a blank screen
  const start = () => main().catch((e) => { console.error(e); fail(e.message || String(e)); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

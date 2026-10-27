// unpack.js — take the user's own files back out of a bundled deck (what pack.js made), and put files into a zip.
// Used by the E key ("Offline (zip)", "Share (zip)": pack.js packs the deck, then this splits the result) and by tools/build.mjs --unpack.
// Plain strings and bytes only (no DOM, no Node APIs), so the same code runs in the browser and in Node.
//
// Split by the marks pack.js left when packing: data-from="deckmd" = deckmd's files, data-src https:// = libraries → not extracted.
// data-file = original location of a user file (relative to the launcher page), the Markdown has data-path, images are in the deck-assets
// table (relative to the Markdown; starting with '/', to the launcher page). Every path must stay inside the launcher page's folder:
// a bundle that points above it is refused as a whole, since a partial set of files would not pack again the same way.
(() => {
  const unsafe = s => s.replace(/<\\\/script/gi, '</script');
  const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m => [m[1], (m[2] ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')]));
  // 'a/./b/../c' → 'a/c'. null if it climbs above the top or names nothing. Backslashes count as separators too (a bundle may come from anywhere)
  function inside(p) {
    const out = [];
    for (const s of p.split(/[\\/]/)) {
      if (s === '' || s === '.') continue;
      if (s === '..') { if (!out.length) return null; out.pop(); } else out.push(s);
    }
    return out.length ? out.join('/') : null;
  }
  const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  // A stray % (a file really named a%zz.png) is not an escape: kept as written instead of failing the whole unpack
  const decode = (f, s) => { try { return f(s); } catch { return s; } };

  // → { files: Map(path → string | Uint8Array), md: the Markdown's path, launcher: the launcher page's path if the bundle kept it,
  //     skipped: [library and deckmd keys], kept: [CSS files that still hold data: URIs] }
  // Throws when there is nothing to extract, for HTML decks, and when a path leaves the launcher page's folder.
  function split(html) {
    const found = [];                // [written path, content]
    const skipped = [], kept = [];
    let mdPath = null, table = null, launcher = null;
    // Tag by tag from the top: the text inside one tag is skipped whole, so a tag written as a string in embedded code
    // (pack.js itself holds '<script type="application/json" id="deck-assets">…') is never taken for the real one
    for (const m of html.matchAll(/<(style|script)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const a = attrs(m[2]);
      const text = unsafe(m[3]).replace(/^\n/, '').replace(/\n$/, '');
      if (a.type === 'text/markdown') { mdPath = a['data-path'] || 'talk.md'; found.push([mdPath, text.endsWith('\n') ? text : `${text}\n`]); continue; }
      if (a.id === 'deck-assets') { table = text; continue; }
      // The launcher page is an extra: a copy that doesn't read (a bundle edited by hand) is left out rather than failing the unpack
      if (a.id === 'deck-launcher') { try { found.push([a['data-path'] || 'index.html', JSON.parse(text)]); launcher = a['data-path'] || 'index.html'; } catch {} continue; }
      if (a.id === 'deck-meta') throw new Error('bundled files of pages with slides written directly (HTML decks) cannot be unpacked yet');
      if (!a['data-src']) continue;
      if (a['data-from'] === 'deckmd' || /^https?:/.test(a['data-src'])) { skipped.push(a['data-src']); continue; }
      const where = a['data-file'] || a['data-src'];              // older bundles without marks: the written path as is
      found.push([where, text]);
      if (m[1] === 'style' && /url\(\s*["']?data:/.test(text)) kept.push(where);
    }
    if (table) {
      const md = mdPath || 'talk.md', mdDir = md.includes('/') ? md.slice(0, md.lastIndexOf('/') + 1) : '';
      // The deck's images are not extras: a broken table or entry is an error that names it (a zip without them would be wrong)
      let list;
      try { list = Object.entries(JSON.parse(table)); } catch (e) { throw new Error(`the image table (deck-assets) of this bundle is broken: ${e.message}`); }
      for (const [ref, uri] of list) {
        const m = /^data:[^;,]*(;base64)?,(.*)$/s.exec(uri);
        if (!m) continue;
        let data;
        try { data = m[1] ? bytes(m[2]) : decode(decodeURIComponent, m[2]); } catch { throw new Error(`the image ${ref} in this bundle is broken (its base64 data does not decode)`); }
        found.push([ref.startsWith('/') ? ref : mdDir + decode(decodeURI, ref), data]);
      }
    }
    if (!found.length) throw new Error('no user files to extract (is this a file packed with deckmd?)');
    const files = new Map(), outside = [];
    for (const [where, data] of found) {
      const p = inside(where);
      if (p) files.set(p, data); else outside.push(where);
    }
    if (outside.length) throw new Error(`outside the launcher page's folder, so they have no place to go back to: ${outside.join(', ')}. Move them next to the deck (or under the folder of index.html) and pack again`);
    return { files, md: mdPath && inside(mdPath), launcher: launcher && inside(launcher), skipped, kept };
  }

  // A zip of a bundle: the user's files (split) and an index.html that is the bundle itself without them, so deckmd, libraries
  // and fonts stay exactly as in that Offline or Share bundle (the same code, nothing else to fetch or match).
  // In index.html: the Markdown and the image table go (the Markdown is opened from its file, images are found next to it); the files
  // deck.js loaded from the config or the front matter (data-loaded) go, since deck.js loads them again, now from the files; a file
  // the launcher page itself had (deck.config.js, a stylesheet) becomes a tag pointing at the file. The launcher page the bundle kept
  // is not in the zip: index.html takes its place (build.mjs --unpack gives it back).
  function folder(html) {
    const { files, md, launcher } = split(html);
    const out = new Map([...files].filter(([p]) => p !== launcher));
    const at = s => encodeURI(s).replace(/"/g, '%22');
    let page = html.replace(/<(style|script)\b([^>]*)>([\s\S]*?)<\/\1>/g, (all, tag, attrText) => {
      const a = attrs(attrText);
      if (a.type === 'text/markdown' || a.id === 'deck-assets') return '';
      if (!a['data-src'] || a['data-from'] === 'deckmd' || /^https?:/.test(a['data-src'])) return all;
      if ('data-loaded' in a) return '';
      const p = at(inside(a['data-file'] || a['data-src']));
      return tag === 'style' ? `<link rel="stylesheet" href="${p}" data-src="${p}" data-file="${p}">` : `<script src="${p}" data-src="${p}" data-file="${p}"></script>`;
    });
    // Which deck to open: this one, whatever the config says (it is the only deck in the zip). Right before deck.js, after the config
    const open = `<script>window.DeckConfig = Object.assign(window.DeckConfig || {}, { home: 'deck', src: ${JSON.stringify(md).replace(/</g, '\\u003c')} });</script>\n`;
    const deck = /<script\b[^>]*\sdata-src="js\/deck\.js"/.exec(page);
    page = deck ? page.slice(0, deck.index) + open + page.slice(deck.index) : page.replace(/<\/body>/i, `${open}</body>`);
    out.set('index.html', page.replace(/^(<!doctype html>\n<!-- packed with deckmd · )/i, '$1unpacked into a zip · '));
    return out;
  }

  // A zip without compression ("stored"): headers, the bytes as they are, and the directory at the end. Names are UTF-8 (flag bit 11).
  // Fields not written stay 0 (an ArrayBuffer starts zero-filled), which is what they should be: method 0 = stored, no extra field,
  // no comment, disk 0, no file attributes ("version made by" 0 = MS-DOS, the plainest).
  const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
  function zip(files, date = new Date()) {
    const enc = new TextEncoder(), parts = [], dir = [];
    const time = date.getHours() << 11 | date.getMinutes() << 5 | date.getSeconds() >> 1;
    const day = (date.getFullYear() - 1980) << 9 | (date.getMonth() + 1) << 5 | date.getDate();
    let offset = 0;
    for (const [name, data] of files) {
      const n = enc.encode(name), d = typeof data === 'string' ? enc.encode(data) : data, crc = crc32(d);
      // The fields the local header and the directory entry share, from "version needed" on
      const common = (v, at) => {
        v.setUint16(at, 20, true); v.setUint16(at + 2, 0x800, true); v.setUint16(at + 6, time, true); v.setUint16(at + 8, day, true);
        v.setUint32(at + 10, crc, true); v.setUint32(at + 14, d.length, true); v.setUint32(at + 18, d.length, true); v.setUint16(at + 22, n.length, true);
      };
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); common(h, 4);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); common(c, 6); c.setUint32(42, offset, true);
      parts.push(new Uint8Array(h.buffer), n, d);
      dir.push(new Uint8Array(c.buffer), n);
      offset += 30 + n.length + d.length;
    }
    const dirSize = dir.reduce((s, b) => s + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.size, true); end.setUint16(10, files.size, true);
    end.setUint32(12, dirSize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...dir, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
    all.reduce((at, b) => (out.set(b, at), at + b.length), 0);
    return out;
  }

  globalThis.DeckUnpack = { split, folder, zip };
})();

// deckmd serve — a small web server to write decks with (called by build.mjs: npx deckmd serve)
//
//   npx deckmd serve                  serve the project: the nearest deckmd index.html here or in the folders above (npx deckmd init makes one)
//   npx deckmd serve my-deck.md       serve that deck;  a.md b.md  a deck list;  some/folder  every .md in it (two levels deep)
//   npx deckmd -C path serve ...      start in that folder, as if you had cd'd there (the project is looked for from there)
//   In a project the whole tree is the site: its index.html and deck.config.js are used (only home, src and decks are replaced by what you named),
//   so the theme, plugins and CSS of the project apply. The decks you name must be under the project.
//   Outside a project nothing is looked for above the current folder: only the folders of the decks you name are served, with a made-up index page.
//   --port N   default 8000, or the next free port; 0 = any      --open   open the browser
//   --host H   default localhost; 0.0.0.0 opens it to your network (a phone, a friend's laptop)
//   Only slide and web file types are served (no keys, certificates, databases or archives; no node_modules). Your home folder (or one above it) is never served.
//   Files are read from disk on every request: edit, then reload. Dot files and folders (.git, .env) are never served,
//   a request whose Host is some domain name (a DNS rebinding attack) is refused, and a symbolic link is followed only inside the served folder
//   (or into deckmd's own js/ css/ themes/ plugins/). --host 0.0.0.0 opens the folder to your network: you are warned.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { findProject, isInside, NOT_FOUND } from './project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = (lines => lines.slice(1, lines.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))(   // the top comment
  fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n'));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.markdown': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf',
  '.htm': 'text/html; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.tsv': 'text/tab-separated-values; charset=utf-8', '.yaml': 'text/yaml; charset=utf-8', '.yml': 'text/yaml; charset=utf-8',
  '.xml': 'application/xml', '.otf': 'font/otf', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4v': 'video/mp4', '.wasm': 'application/wasm', '.map': 'application/json',
};
const SERVED_TYPES = new Set(Object.keys(TYPES));                      // the only file types that are served: slide text, web files, images, fonts, media, data
const PACKAGE_DIRS = new Set(['js', 'css', 'themes', 'plugins']);      // what deckmd itself serves, under /_deckmd/
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const posix = p => p.split(path.sep).join('/');

export async function serve(args) {
  const die = (msg) => { console.error(msg); process.exit(1); };
  if (args.includes('--help') || args.includes('-h')) { console.log(USAGE); return; }
  let port = 8000, portGiven = false, host = 'localhost', open = false;
  const given = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--port' || a === '-p') { port = Number(args[++i]); portGiven = true; if (!Number.isInteger(port) || port < 0 || port > 65535) die(`--port needs a number (0-65535), got "${args[i] ?? ''}"`); }
    else if (a === '--host') { host = args[++i]; if (!host || host.startsWith('-')) die('--host needs a host name or address (localhost, 0.0.0.0)'); }
    else if (a === '--open') open = true;
    else if (a.startsWith('-')) die(`unknown option: ${a}  (deckmd serve --help)`);
    else given.push(a);
  }

  // Where we are: inside a deckmd project (the nearest launcher page upwards) or not
  const cwd = process.cwd();
  const within = (child, base) => child === base || child.startsWith(base + path.sep);
  const found = findProject(cwd);
  const tree = !!found;
  const home = (() => { try { return fs.realpathSync(os.homedir()); } catch { return null; } })();
  const tooWide = real => real === path.parse(real).root || (home && within(home, real));

  // What was named: Markdown files, and folders (every .md in them, two levels deep, never dot folders or node_modules)
  const scan = (dir, depth = 0) => fs.readdirSync(dir, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name)).flatMap(d => {
    if (d.name.startsWith('.') || d.name === 'node_modules') return [];
    const f = path.join(dir, d.name);
    if (d.isDirectory()) return depth < 2 ? scan(f, depth + 1) : [];
    return d.isFile() && /\.(md|markdown)$/i.test(d.name) ? [f] : [];
  });
  const files = [];
  for (const g of given) {
    const f = path.resolve(g);
    let st; try { st = fs.statSync(f); } catch { die(`not found: ${g}`); }
    if (st.isDirectory()) {
      const list = scan(f);
      if (!list.length) die(`no Markdown files in ${g}`);
      files.push(...list.map(x => ({ file: x, given: g })));
    } else if (!/\.(md|markdown)$/i.test(f)) die(`serve takes Markdown files (.md) or folders, got: ${g}`);
    else files.push({ file: f, given: g });
  }
  if (!tree && !files.length) die(`${NOT_FOUND}.\n  npx deckmd serve my-deck.md   show one deck (no project needed)\n  npx deckmd init                start a project here`);
  // The decks must be inside the project, or (without one) inside the current folder: the page is made at the top and only opens Markdown under it
  const top = tree ? found.root : cwd;
  for (const { file, given: g } of files) {
    if (!isInside(file, top)) die(`${g} is outside ${tree ? `the deckmd project at ${top}` : 'the current folder'}: the launcher page is ${tree ? 'there' : 'here'} and only opens Markdown under it.\nRun it from the deck's folder:  cd ${posix(path.relative(cwd, path.dirname(file)))} && npx deckmd serve ${path.basename(file)}`);
  }
  const only = [...new Set(files.map(f => f.file))];

  // The root of the site. In a project: the project. Without one: the common folder of the decks, never above the current folder
  const commonDir = ds => ds.reduce((a, b) => { const x = a.split(path.sep), y = b.split(path.sep); let i = 0; while (i < x.length && x[i] === y[i]) i++; return x.slice(0, i).join(path.sep) || path.sep; });
  const root = tree ? found.root : commonDir(only.map(f => path.dirname(f)));
  const realRoot = fs.realpathSync(root);
  if (tooWide(realRoot)) die(`won't serve ${root}: it is your home folder or one above it. Run it in the folder of a project or a deck.`);

  // The project's page and config. It is served as it is; the decks you named only choose what to show
  const indexHtml = tree ? fs.readFileSync(found.index, 'utf8').replace(/<!--[\s\S]*?-->/g, '') : '';    // without the comments about it
  const bootTag = /<script\b[^>]*\b(?:boot|deck)\.js[^>]*>/.exec(indexHtml)?.[0] || '';                  // the real tag, not the comments about it
  const configName = /\bdata-config="([^"]*)"/.exec(bootTag)?.[1] || 'deck.config.js';              // the config its index.html loads
  const configOk = /^[\w.-][\w./-]*$/.test(configName) && !configName.includes('..');                // a file in this folder; 'none' or a URL can't be extended
  const hasConfig = tree && configOk && fs.existsSync(path.join(root, configName));
  const ownIndex = tree && only.length > 0 && configOk && configName !== 'none';                      // the project's index.html is the page, its config extended
  const decks = only.map(f => ({ src: posix(path.relative(root, f)) }));
  const configUrl = ownIndex ? `/${posix(path.normalize(configName))}` : null;                      // where the page asks for its config
  const makeConfig = () => {                                                                         // read on every request: edit deck.config.js, reload
    const mine = { home: decks.length === 1 ? 'deck' : 'list', src: decks[0]?.src, decks };
    if (ownIndex && hasConfig) return `${readConfigText().trimEnd()}\n\n// deckmd serve: the files you gave it replace home, src and decks\nObject.assign(window.DeckConfig = window.DeckConfig || {}, ${JSON.stringify(mine, null, 2)});\n`;
    return `// made by deckmd serve for the files you gave it\nwindow.DeckConfig = ${JSON.stringify({ title: 'Decks', ...mine }, null, 2)};\n`;
  };
  const note = tree && only.length && !ownIndex ? "not using the project's index.html or config: it can't be extended (data-config is none or not a file in the project)" : '';

  // What is served. File types, everywhere: slide text, web files, images, fonts, media, data (no keys, certificates, databases, archives, files without an extension; no node_modules).
  // In a project: everything under it, of those types. Without one: the folder of each deck you named in full, and nothing else but the made-up page
  // The folder of each deck, and the deck itself: as written, and where it really is (a deck may be reached through a link inside the folder).
  // '' = the root itself
  const where = (p) => { const lexical = posix(path.relative(root, p)); let real = lexical; try { real = posix(path.relative(realRoot, fs.realpathSync(p))); } catch {} return real.startsWith('..') ? [lexical] : [lexical, real]; };
  const deckDirs = [...new Set(only.flatMap(f => where(path.dirname(f))))];
  const deckFiles = new Set(only.flatMap(where));
  const deckReal = new Set(only.flatMap(f => { try { return [fs.realpathSync(f)]; } catch { return []; } }));   // a deck that is a link to a file elsewhere is still the deck you named
  const deckDirReal = tree ? [] : [...new Set(only.flatMap(f => { try { return [fs.realpathSync(path.dirname(f))]; } catch { return []; } }))];   // without a project: where the deck folders really are
  const notServed = (parts, isDir) => {                                                              // why a path is not served, or null if it is
    if (parts.includes('node_modules')) return 'node_modules is not served';
    if (!isDir && !SERVED_TYPES.has(path.extname(parts[parts.length - 1] || '').toLowerCase())) return 'this file type is not served';
    if (tree) return null;
    const rel = parts.join('/');
    if (deckFiles.has(rel)) return null;
    if (deckDirs.some(d => d === '' || rel === d || rel.startsWith(`${d}/`))) return null;
    return 'it is outside the folders of your decks (run it in a project, or put the file next to the deck)';
  };
  const launcher = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>deckmd</title></head>
<body>
  <div class="reveal"><div class="slides"></div></div>
  <script src="/_deckmd/js/boot.js" data-config="/_deckmd/config.js"></script>
</body>
</html>
`;

  // DNS rebinding: a page on evil.example can make the browser send requests here with Host: evil.example once it points the name at 127.0.0.1,
  // and read the answers. So only localhost, an IP address, or the name you gave --host is a valid Host
  const hostAllowed = (h) => {
    const m = /^(\[[0-9a-f:.]+\]|[^:[\]\s]+)(?::\d{1,5})?$/i.exec(h || '');
    const name = m?.[1].toLowerCase();
    return !!name && (name === 'localhost' || name === host.toLowerCase() || name.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(name));
  };
  // Symbolic links are followed only while the real path stays inside the served folder, or in the public folders of deckmd's own package
  // (js, css, themes, plugins: so a deckmd/ link to the package works, but not package.json, .git, tools …)
  const packagePublic = [...PACKAGE_DIRS].map(d => path.join(fs.realpathSync(ROOT), d));
  const insideOf = (real, base) => real === base || real.startsWith(base + path.sep);
  // The policy again for where a path really ends up: a link must not lead to what the policy hides (a dot folder, another folder, a key file
  // under a harmless name). The public folders of deckmd's own package are the exception.
  const realWhy = (real, isDir) => {
    if (packagePublic.some(b => insideOf(real, b)) || (!isDir && deckReal.has(real))) return null;
    const dd = deckDirReal.find(b => insideOf(real, b));                                          // in a deck folder that is a link to somewhere else
    if (dd) {
      const dp = path.relative(dd, real).split(path.sep).filter(Boolean);
      return dp.some(p => p.startsWith('.')) ? 'dot files and folders are never served' : dp.includes('node_modules') ? 'node_modules is not served' : !isDir && !SERVED_TYPES.has(path.extname(real).toLowerCase()) ? 'this file type is not served' : null;
    }
    const rp = path.relative(realRoot, real).split(path.sep).filter(Boolean);
    if (rp.some(p => p.startsWith('.'))) return 'dot files and folders are never served';
    return notServed(rp, isDir);
  };
  // The project's config, read only after checking where it really is (it may be a link): inside the served folder, not under a dot folder, a served type
  const readConfigText = () => {
    const real = fs.realpathSync(path.join(root, configName));
    if (!insideOf(real, realRoot) || path.relative(realRoot, real).split(path.sep).some(p => p.startsWith('.')) || !SERVED_TYPES.has(path.extname(real).toLowerCase())) {
      throw Object.assign(new Error('Forbidden: the config is a symbolic link that leaves the served folder (or leads to something that is not served)'), { status: 403 });
    }
    return fs.readFileSync(real, 'utf8');
  };
  const sendConfig = (req, res) => {
    try { send(req, res, 200, TYPES['.js'], makeConfig()); }
    catch (e) { text(req, res, e.status || (e.code === 'ENOENT' ? 404 : 500), e.status ? e.message : e.code === 'ENOENT' ? 'Not found' : 'Server error'); }
  };
  const send = (req, res, code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : body); };
  const text = (req, res, code, msg) => send(req, res, code, 'text/plain; charset=utf-8', `${msg}\n`);
  const LEAVES = 'Forbidden: a symbolic link that leaves the served folder';
  // Where a path really ends up, if that is inside one of the bases: { real }, else { code } (404 if it isn't there, 403 if a link leads out)
  const resolveInside = async (file, bases) => {
    let real;
    try { real = await fs.promises.realpath(file); } catch { return { code: 404 }; }
    return bases.some(b => insideOf(real, b)) || deckReal.has(real) || deckDirReal.some(b => insideOf(real, b)) ? { real } : { code: 403 };
  };
  // A file, streamed (a deck may have hundreds of MB of video), with Range requests: browsers need them to seek in <video>, and Safari won't play without them
  const sendFile = async (req, res, real) => {
    let st;
    try { st = await fs.promises.stat(real); } catch { return text(req, res, 404, 'Not found'); }
    if (!st.isFile()) return text(req, res, 404, 'Not found');
    const headers = { 'content-type': TYPES[path.extname(real).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache', 'accept-ranges': 'bytes' };
    let start = 0, end = st.size - 1, code = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec((req.headers.range || '').trim());                     // one range; anything else (several ranges, bad syntax) is ignored: the whole file
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') { start = Math.max(0, st.size - Number(m[2])); end = st.size - 1; if (Number(m[2]) === 0) start = st.size; }   // bytes=-N: the last N
      else { start = Number(m[1]); end = m[2] === '' ? st.size - 1 : Math.min(Number(m[2]), st.size - 1); }
      if (start > end || start >= st.size) { res.writeHead(416, { ...headers, 'content-range': `bytes */${st.size}` }); return res.end(); }
      code = 206;
      headers['content-range'] = `bytes ${start}-${end}/${st.size}`;
    }
    headers['content-length'] = st.size === 0 ? 0 : end - start + 1;
    res.writeHead(code, headers);
    if (req.method === 'HEAD' || st.size === 0) return res.end();
    fs.createReadStream(real, { start, end }).on('error', () => res.destroy()).pipe(res);
  };
  const serveFile = async (req, res, file, bases) => {
    const got = await resolveInside(file, bases);
    return got.code ? text(req, res, got.code, got.code === 403 ? LEAVES : 'Not found') : sendFile(req, res, got.real);
  };
  const listing = (dir, urlPath, parts) => {
    // Each entry is judged by where it really leads (a link to a hidden folder or a key file is not listed), and a link to a folder is shown as a folder
    const entries = [];
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.name.startsWith('.')) continue;
      let real, isDir;
      try { real = fs.realpathSync(path.join(dir, d.name)); isDir = fs.statSync(real).isDirectory(); } catch { continue; }
      if (![realRoot, ...packagePublic, ...deckDirReal].some(base => insideOf(real, base)) || notServed([...parts, d.name], isDir) || realWhy(real, isDir)) continue;
      entries.push({ name: d.name, isDir });
    }
    const rows = entries.sort((x, y) => x.name.localeCompare(y.name))
      .map(e => `<li><a href="${encodeURIComponent(e.name)}${e.isDir ? '/' : ''}">${esc(e.name + (e.isDir ? '/' : ''))}</a></li>`);
    return `<!doctype html>\n<meta charset="utf-8"><title>Index of ${esc(urlPath)}</title>\n<h1>Index of ${esc(urlPath)}</h1>\n<ul>\n${rows.join('\n')}\n</ul>\n`;   // deck.js reads the links of this page to find decks (scan)
  };

  // One place that catches whatever goes wrong while answering a request, so a request can never end the server (an unreadable folder, a
  // header the answer can't carry, a file that vanished mid-way): it answers 500, or 403/404 when the cause is known
  const handle = async (req, res) => {
    if (!hostAllowed(req.headers.host)) return text(req, res, 403, 'Forbidden: use http://localhost or the IP address (this Host is neither; a DNS rebinding attack looks like this)');
    if (req.method !== 'GET' && req.method !== 'HEAD') return text(req, res, 405, 'Method not allowed');
    let pathname, encoded;
    try { encoded = new URL(req.url, 'http://localhost').pathname; pathname = decodeURIComponent(encoded); } catch { return text(req, res, 400, 'Bad request'); }
    const parts = pathname.split('/').filter(Boolean);
    if (pathname.includes('\0') || parts.some(p => p.startsWith('.') || p.includes('\\'))) return text(req, res, 404, 'Not found');   // '..', .git, .env …

    if (parts[0] === '_deckmd') {                                           // deckmd itself, from the installed package
      if (parts[1] === 'config.js' && parts.length === 2 && decks.length) return sendConfig(req, res);
      if (PACKAGE_DIRS.has(parts[1])) return serveFile(req, res, path.join(ROOT, ...parts.slice(1)), packagePublic);
      return text(req, res, 404, 'Not found');
    }
    if (configUrl && pathname === configUrl) return sendConfig(req, res);   // the project's page asks for its own config
    if (decks.length && !ownIndex && (pathname === '/' || pathname === '/index.html')) return send(req, res, 200, TYPES['.html'], launcher);
    const target = path.join(root, ...parts);
    const got = await resolveInside(target, [realRoot, ...packagePublic]);
    if (got.code) return text(req, res, got.code, got.code === 403 ? LEAVES : 'Not found');
    const st = await fs.promises.stat(got.real);
    const why = notServed(parts, st.isDirectory()) || realWhy(got.real, st.isDirectory());       // the path asked for, and where it really is
    if (why) return text(req, res, 404, `Not found (not served: ${why})`);
    if (!st.isDirectory()) return sendFile(req, res, got.real);
    // A folder without its trailing slash: redirect from the path as it was sent (still percent-encoded, one leading slash). The decoded
    // path can't go into a header: non-ASCII throws, and #, ?, % or a leading // would point somewhere else
    if (!encoded.endsWith('/')) { res.writeHead(301, { location: `/${encoded.replace(/^\/+/, '')}/` }); return res.end(); }
    if (!notServed([...parts, 'index.html'], false)) {
      const idx = await resolveInside(path.join(target, 'index.html'), [realRoot, ...packagePublic]);
      if (!idx.code) return realWhy(idx.real, false) ? text(req, res, 404, 'Not found') : sendFile(req, res, idx.real);
      if (idx.code === 403) return text(req, res, 404, 'Not found');
    }
    send(req, res, 200, TYPES['.html'], listing(got.real, pathname, parts));
  };
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      const code = e.code === 'EACCES' || e.code === 'EPERM' ? 403 : e.code === 'ENOENT' || e.code === 'ENOTDIR' ? 404 : 500;
      console.error(`deckmd serve: ${req.method} ${req.url}: ${e.message}`);
      if (res.headersSent) return res.destroy();
      try { text(req, res, code, code === 403 ? 'Forbidden: this folder or file can\'t be read' : code === 404 ? 'Not found' : 'Server error'); } catch { res.destroy(); }
    });
  });

  const listen = p => new Promise((ok, no) => { server.once('error', no); server.listen(p, host, () => { server.off('error', no); ok(server.address().port); }); });
  let actual;
  for (let p = port, tries = 0; ; p++, tries++) {
    try { actual = await listen(p); break; }
    catch (e) { if (e.code !== 'EADDRINUSE' || portGiven || tries >= 20) die(e.code === 'EADDRINUSE' ? `port ${p} is in use` : `can't listen on ${host}:${p}: ${e.message}`); }
  }

  const url = `http://${host === '0.0.0.0' || host === '::' ? 'localhost' : host}:${actual}/`;
  const lan = host === '0.0.0.0' ? Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal) : null;
  const what = !only.length ? 'this project' : only.length === 1 ? given[0] : `${only.length} decks`;
  console.log(`deckmd serve: ${what}${tree ? `\n  project: ${root}${found.up ? ` (found ${found.up} folder${found.up > 1 ? 's' : ''} up)` : ''}` : ''}${note ? `\n  ${note}` : ''}
  ${url}${lan ? `\n  ${url.replace('localhost', lan.address)}   (on your network)` : ''}
${['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase()) ? '' : `\n  WARNING: --host ${host} opens ${tree ? 'the whole project' : 'the folders of your decks'} (dot files excepted, web file types only) to your network. Anyone who can reach this port can read it.`}
Reload the page to see edits. Ctrl+C to stop.`);
  if (open) spawn(...(process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]), { stdio: 'ignore', detached: true }).on('error', () => {}).unref();

  await new Promise((resolve) => {
    server.on('close', resolve);
    process.once('SIGINT', () => { server.close(); server.closeAllConnections?.(); });
  });
}

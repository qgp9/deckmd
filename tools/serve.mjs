// deckmd serve — a small web server to write decks with (called by build.mjs: npx deckmd serve)
//
//   npx deckmd serve                           serve the current folder (a project from npx deckmd init: its index.html, or the deck list from deck.config.js)
//   npx deckmd serve my-deck.md                serve that one deck. No index.html or config needed
//   npx deckmd serve a.md b.md examples/*.md   a deck list of those files
//   Run inside a project (an index.html and/or deck.config.js here) with files from it: your index.html and deck.config.js are used,
//   only home, src and decks are replaced by your files, so the theme, plugins and CSS of the project apply.
//   --port N   default 8000, or the next free port; 0 = any      --open   open the browser
//   --host H   default localhost; 0.0.0.0 opens it to your network (a phone, a friend's laptop)
//   Files are read from disk on every request: edit, then reload. Dot files and folders (.git, .env) are never served,
//   a request whose Host is some domain name (a DNS rebinding attack) is refused, and a symbolic link is followed only inside the served folder
//   (or into deckmd's own js/ css/ themes/ plugins/). --host 0.0.0.0 opens the folder to your network: you are warned.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = (lines => lines.slice(1, lines.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))(   // the top comment
  fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n'));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.markdown': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf',
};
const PACKAGE_DIRS = new Set(['js', 'css', 'themes', 'plugins']);      // what deckmd itself serves, under /_deckmd/
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const posix = p => p.split(path.sep).join('/');
const commonDir = (a, b) => { const A = a.split(path.sep), B = b.split(path.sep); let i = 0; while (i < A.length && i < B.length && A[i] === B[i]) i++; return A.slice(0, i).join(path.sep) || path.sep; };

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

  // Deck files given → a launcher page and a config made on the fly. None → the current folder as it is
  const files = given.map(f => path.resolve(f));
  for (const [i, f] of files.entries()) {
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) die(`not found: ${given[i]}`);
    if (!/\.(md|markdown)$/i.test(f)) die(`serve takes Markdown files (.md), got: ${given[i]}`);
  }
  // Inside a project (an index.html and/or a config here) with files from it: preview them with the project's settings
  const cwd = process.cwd();
  const inside = f => { const r = path.relative(cwd, f); return r !== '' && !r.startsWith('..') && !path.isAbsolute(r); };
  const hasIndex = fs.existsSync(path.join(cwd, 'index.html'));
  const bootTag = hasIndex ? /<script\b[^>]*\bboot\.js[^>]*>/.exec(fs.readFileSync(path.join(cwd, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, ''))?.[0] || '' : '';   // the real tag, not the comments about it
  const configName = /\bdata-config="([^"]*)"/.exec(bootTag)?.[1] || 'deck.config.js';              // the config its index.html loads
  const configOk = /^[\w.-][\w./-]*$/.test(configName) && !configName.includes('..');                // a file in this folder; 'none' or a URL can't be extended
  const hasConfig = configOk && fs.existsSync(path.join(cwd, configName));
  const project = files.length > 0 && files.every(inside) && (hasIndex || hasConfig) && configOk && configName !== 'none';
  const ownIndex = project && hasIndex;                                                              // the project's index.html is the page
  const root = files.length === 0 || project ? cwd : files.map(f => path.dirname(f)).reduce(commonDir);    // else the folders the decks are in, so their images and CSS resolve
  if (root === path.parse(root).root) die('those files are too far apart: no common folder below the root of the disk');
  const decks = files.map(f => ({ src: posix(path.relative(root, f)) }));
  const configUrl = ownIndex ? `/${posix(path.normalize(configName))}` : null;                      // where the page asks for its config
  const makeConfig = () => {                                                                         // read on every request: edit deck.config.js, reload
    const mine = { home: decks.length === 1 ? 'deck' : 'list', src: decks[0]?.src, decks };
    if (project && hasConfig) return `${fs.readFileSync(path.join(cwd, configName), 'utf8').trimEnd()}\n\n// deckmd serve: the files you gave it replace home, src and decks\nObject.assign(window.DeckConfig = window.DeckConfig || {}, ${JSON.stringify(mine, null, 2)});\n`;
    return `// made by deckmd serve for the files you gave it\nwindow.DeckConfig = ${JSON.stringify({ title: 'Decks', ...mine }, null, 2)};\n`;
  };
  const note = !files.length ? '' : project ? `using ${[ownIndex && 'index.html', hasConfig && configName].filter(Boolean).join(' and ')} from this folder; your files replace home, src and decks`
    : (hasIndex || fs.existsSync(path.join(cwd, 'deck.config.js'))) ? `not using index.html or deck.config.js here: ${files.every(inside) ? "the project's config can't be extended" : 'the files are outside this folder'}` : '';
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
  const realRoot = fs.realpathSync(root);
  const packagePublic = [...PACKAGE_DIRS].map(d => path.join(fs.realpathSync(ROOT), d));
  const insideOf = (real, base) => real === base || real.startsWith(base + path.sep);
  const resolveInside = (file, bases, done) => fs.realpath(file, (err, real) => (err ? done(404) : bases.some(b => insideOf(real, b)) ? done(null, real) : done(403)));

  const send = (req, res, code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : body); };
  const text = (req, res, code, msg) => send(req, res, code, 'text/plain; charset=utf-8', `${msg}\n`);
  const sendFile = (req, res, file) => fs.readFile(file, (err, buf) => (err ? text(req, res, 404, 'Not found') : send(req, res, 200, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', buf)));
  const serveFile = (req, res, file, bases) => resolveInside(file, bases, (code, real) => (code ? text(req, res, code, code === 403 ? 'Forbidden: a symbolic link that leaves the served folder' : 'Not found') : sendFile(req, res, real)));
  const listing = (dir, urlPath) => {
    const rows = fs.readdirSync(dir, { withFileTypes: true }).filter(d => !d.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name))
      .map(d => { const name = d.name + (d.isDirectory() ? '/' : ''); return `<li><a href="${encodeURIComponent(d.name)}${d.isDirectory() ? '/' : ''}">${esc(name)}</a></li>`; });
    return `<!doctype html>\n<meta charset="utf-8"><title>Index of ${esc(urlPath)}</title>\n<h1>Index of ${esc(urlPath)}</h1>\n<ul>\n${rows.join('\n')}\n</ul>\n`;   // deck.js reads the links of this page to find decks (scan)
  };

  const server = http.createServer((req, res) => {
    if (!hostAllowed(req.headers.host)) return text(req, res, 403, 'Forbidden: use http://localhost or the IP address (this Host is neither; a DNS rebinding attack looks like this)');
    if (req.method !== 'GET' && req.method !== 'HEAD') return text(req, res, 405, 'Method not allowed');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return text(req, res, 400, 'Bad request'); }
    const parts = pathname.split('/').filter(Boolean);
    if (pathname.includes('\0') || parts.some(p => p.startsWith('.') || p.includes('\\'))) return text(req, res, 404, 'Not found');   // '..', .git, .env …

    if (parts[0] === '_deckmd') {                                           // deckmd itself, from the installed package
      if (parts[1] === 'config.js' && parts.length === 2 && files.length) return send(req, res, 200, TYPES['.js'], makeConfig());
      if (PACKAGE_DIRS.has(parts[1])) return serveFile(req, res, path.join(ROOT, ...parts.slice(1)), packagePublic);
      return text(req, res, 404, 'Not found');
    }
    if (configUrl && pathname === configUrl) return send(req, res, 200, TYPES['.js'], makeConfig());   // the project's page asks for its own config
    if (files.length && !ownIndex && (pathname === '/' || pathname === '/index.html')) return send(req, res, 200, TYPES['.html'], launcher);
    const target = path.join(root, ...parts);
    resolveInside(target, [realRoot, ...packagePublic], (code, real) => {
      if (code) return text(req, res, code, code === 403 ? 'Forbidden: a symbolic link that leaves the served folder' : 'Not found');
      fs.stat(real, (err, st) => {
        if (err) return text(req, res, 404, 'Not found');
        if (!st.isDirectory()) return sendFile(req, res, real);
        if (!pathname.endsWith('/')) { res.writeHead(301, { location: `${pathname}/` }); return res.end(); }
        const index = path.join(target, 'index.html');
        if (fs.existsSync(index)) return serveFile(req, res, index, [realRoot, ...packagePublic]);
        send(req, res, 200, TYPES['.html'], listing(real, pathname));
      });
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
  const what = !files.length ? 'the current folder' : files.length === 1 ? given[0] : `${files.length} decks`;
  console.log(`deckmd serve: ${what}${files.length && root !== process.cwd() ? `  (from ${root})` : ''}${note ? `\n  ${note}` : ''}
  ${url}${lan ? `\n  ${url.replace('localhost', lan.address)}   (on your network)` : ''}
${['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase()) ? '' : `\n  WARNING: --host ${host} opens ${files.length ? 'the folder of your files' : 'this whole folder'} (dot files excepted) to your network. Anyone who can reach this port can read it.`}
Reload the page to see edits. Ctrl+C to stop.`);
  if (open) spawn(...(process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]), { stdio: 'ignore', detached: true }).on('error', () => {}).unref();

  await new Promise((resolve) => {
    server.on('close', resolve);
    process.once('SIGINT', () => { server.close(); server.closeAllConnections?.(); });
  });
}

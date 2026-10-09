// deckmd serve — a small web server to write decks with (called by build.mjs: npx deckmd serve)
//
//   npx deckmd serve                           serve the current folder (a project from npx deckmd init: its index.html, or the deck list from deck.config.js)
//   npx deckmd serve my-deck.md                serve that one deck. No index.html or config needed
//   npx deckmd serve a.md b.md examples/*.md   a deck list of those files
//   --port N   default 8000, or the next free port; 0 = any      --open   open the browser
//   --host H   default localhost; 0.0.0.0 opens it to your network (a phone, a friend's laptop)
//   Files are read from disk on every request: edit, then reload. Dot files and folders (.git, .env) are never served.
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
  const root = files.length ? files.map(f => path.dirname(f)).reduce(commonDir) : process.cwd();    // the folders the decks are in, so their images and CSS resolve
  if (root === path.parse(root).root) die('those files are too far apart: no common folder below the root of the disk');
  const decks = files.map(f => ({ src: posix(path.relative(root, f)) }));
  const config = `// made by deckmd serve for the files you gave it
window.DeckConfig = ${JSON.stringify({ title: 'Decks', home: decks.length === 1 ? 'deck' : 'list', src: decks[0]?.src, decks }, null, 2)};
`;
  const launcher = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>deckmd</title></head>
<body>
  <div class="reveal"><div class="slides"></div></div>
  <script src="/_deckmd/js/boot.js" data-config="/_deckmd/config.js"></script>
</body>
</html>
`;

  const send = (req, res, code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : body); };
  const text = (req, res, code, msg) => send(req, res, code, 'text/plain; charset=utf-8', `${msg}\n`);
  const sendFile = (req, res, file) => fs.readFile(file, (err, buf) => (err ? text(req, res, 404, 'Not found') : send(req, res, 200, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', buf)));
  const listing = (dir, urlPath) => {
    const rows = fs.readdirSync(dir, { withFileTypes: true }).filter(d => !d.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name))
      .map(d => { const name = d.name + (d.isDirectory() ? '/' : ''); return `<li><a href="${encodeURIComponent(d.name)}${d.isDirectory() ? '/' : ''}">${esc(name)}</a></li>`; });
    return `<!doctype html>\n<meta charset="utf-8"><title>Index of ${esc(urlPath)}</title>\n<h1>Index of ${esc(urlPath)}</h1>\n<ul>\n${rows.join('\n')}\n</ul>\n`;   // deck.js reads the links of this page to find decks (scan)
  };

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return text(req, res, 405, 'Method not allowed');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return text(req, res, 400, 'Bad request'); }
    const parts = pathname.split('/').filter(Boolean);
    if (pathname.includes('\0') || parts.some(p => p.startsWith('.') || p.includes('\\'))) return text(req, res, 404, 'Not found');   // '..', .git, .env …

    if (parts[0] === '_deckmd') {                                           // deckmd itself, from the installed package
      if (parts[1] === 'config.js' && parts.length === 2 && files.length) return send(req, res, 200, TYPES['.js'], config);
      if (PACKAGE_DIRS.has(parts[1])) return sendFile(req, res, path.join(ROOT, ...parts.slice(1)));
      return text(req, res, 404, 'Not found');
    }
    if (files.length && (pathname === '/' || pathname === '/index.html')) return send(req, res, 200, TYPES['.html'], launcher);
    const target = path.join(root, ...parts);
    fs.stat(target, (err, st) => {
      if (err) return text(req, res, 404, 'Not found');
      if (!st.isDirectory()) return sendFile(req, res, target);
      if (!pathname.endsWith('/')) { res.writeHead(301, { location: `${pathname}/` }); return res.end(); }
      if (fs.existsSync(path.join(target, 'index.html'))) return sendFile(req, res, path.join(target, 'index.html'));
      send(req, res, 200, TYPES['.html'], listing(target, pathname));
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
  console.log(`deckmd serve: ${what}${files.length && root !== process.cwd() ? `  (from ${root})` : ''}
  ${url}${lan ? `\n  ${url.replace('localhost', lan.address)}   (on your network)` : ''}
Reload the page to see edits. Ctrl+C to stop.`);
  if (open) spawn(...(process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]), { stdio: 'ignore', detached: true }).on('error', () => {}).unref();

  await new Promise((resolve) => {
    server.on('close', resolve);
    process.once('SIGINT', () => { server.close(); server.closeAllConnections?.(); });
  });
}

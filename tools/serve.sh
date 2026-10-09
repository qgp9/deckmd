#!/usr/bin/env bash
# Web server for viewing while writing. Finds an available tool and serves the current folder with it (localhost only).
#
#   deckmd/tools/serve.sh [port]            order: python3 → python → node → php
#   deckmd/tools/serve.sh -d talks 9000     folder and port (default: current folder, 8000)
#
# If the port is in use, tries the next numbers (up to 10).
set -eu

dir=.; port=8000
while [ $# -gt 0 ]; do
  case "$1" in
    -d) dir="${2:?-d needs a folder after it}"; shift 2 ;;
    -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *[!0-9]*) echo "unknown argument: $1" >&2; exit 2 ;;
    *) port="$1"; shift ;;
  esac
done
[ -d "$dir" ] || { echo "folder not found: $dir" >&2; exit 2; }
dir="$(cd "$dir" && pwd)"

busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
for _ in 1 2 3 4 5 6 7 8 9 10; do busy "$port" || break; port=$((port + 1)); done
busy "$port" && { echo "could not find a free port." >&2; exit 1; }

has() { command -v "$1" >/dev/null 2>&1; }
# python must be 3 (the old python on macOS is 2)
py3() { has "$1" && "$1" -c 'import sys; sys.exit(sys.version_info[0] < 3)' 2>/dev/null; }

echo "http://localhost:$port/   ($dir)   Ctrl+C to stop"
# Directory listings (folders without index.html): python gives them by default; for node and php they are made below in the same shape
# (decks: 'auto' in deck.config.js reads these listings)
if   py3 python3; then exec python3 -m http.server "$port" --bind 127.0.0.1 --directory "$dir"
elif py3 python;  then exec python  -m http.server "$port" --bind 127.0.0.1 --directory "$dir"
elif has node; then
  exec node --input-type=module - "$dir" "$port" <<'JS'
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3]);
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
};
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400).end('bad request'); return; }
  let file = path.join(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('forbidden'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!rel.endsWith('/')) { res.writeHead(301, { Location: rel + '/' }).end(); return; }
    if (!fs.existsSync(path.join(file, 'index.html'))) {
      const items = fs.readdirSync(file, { withFileTypes: true })
        .map(e => e.name + (e.isDirectory() ? '/' : '')).sort()
        .map(n => `<li><a href="${esc(encodeURIComponent(n.replace(/\/$/, '')) + (n.endsWith('/') ? '/' : ''))}">${esc(n)}</a></li>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<!doctype html><meta charset="utf-8"><title>${esc(rel)}</title><ul>${items.join('')}</ul>`);
      return;
    }
    file = path.join(file, 'index.html');
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': (TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream') + '; charset=utf-8',
      'Cache-Control': 'no-cache',
    }).end(buf);
  });
}).listen(port, '127.0.0.1');
JS
elif has php; then
  # php -S gives no directory listings, so a router is written to a temporary file (deleted at the end)
  router="$(mktemp "${TMPDIR:-/tmp}/deck-router.XXXXXX")"
  trap 'rm -f "$router"' EXIT
  cat >"$router" <<'PHP'
<?php
$root = $_SERVER['DOCUMENT_ROOT'];
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$dir = realpath($root . $path);
if ($dir && is_dir($dir) && strpos($dir . '/', $root . '/') === 0
    && !file_exists("$dir/index.html") && !file_exists("$dir/index.php")) {
  if (substr($path, -1) !== '/') { header('Location: ' . $path . '/', true, 301); exit; }
  echo '<!doctype html><meta charset="utf-8"><title>' . htmlspecialchars($path) . '</title><ul>';
  foreach (scandir($dir) as $f) {
    if ($f === '.' || $f === '..') continue;
    $slash = is_dir("$dir/$f") ? '/' : '';
    echo '<li><a href="' . htmlspecialchars(rawurlencode($f) . $slash) . '">' . htmlspecialchars($f . $slash) . '</a></li>';
  }
  exit;
}
return false;
PHP
  php -S "127.0.0.1:$port" -t "$dir" "$router"
  exit
fi
echo "no tool to run a web server (python3, node, php)." >&2
exit 1

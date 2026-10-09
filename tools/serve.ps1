# Local web server for editing decks (Windows). Needs nothing installed: uses HttpListener in the built-in
# PowerShell 5.1. Listens on localhost only.
#
# NOT TESTED ON WINDOWS YET. Written and reviewed on macOS, where PowerShell is not available, so it has never
# been run. If something fails, check: the window opens and prints the address, the next port is tried when one is
# taken, folder listing works for a folder without index.html (needed by decks: 'auto' / scan), Ctrl+C stops it.
#
#   deckmd\tools\serve.cmd                    Double-click it, or run it in a terminal. (Use the .cmd: a .ps1 opens in
#                                             Notepad on double-click and may be blocked by the execution policy.)
#   deckmd\tools\serve.cmd 9000 -Dir slides    Choose the port and folder (default: port 8000, folder as below)
#
# Without -Dir: the current folder if it has index.html, otherwise the first of ..\.. and .. (relative to this
# script) that has one. If the port is taken, the next ones (up to 10) are tried. Stop with Ctrl+C.
param(
  [int]$Port = 8000,
  [string]$Dir
)
$ErrorActionPreference = 'Stop'

if (-not $Dir) {
  $here = Split-Path -Parent $MyInvocation.MyCommand.Path
  $Dir = (Get-Location).Path
  foreach ($c in @((Get-Location).Path, (Join-Path $here '..\..'), (Join-Path $here '..'))) {
    if (Test-Path -LiteralPath (Join-Path $c 'index.html')) { $Dir = $c; break }
  }
}
if (-not (Test-Path -LiteralPath $Dir -PathType Container)) { Write-Host "Folder not found: $Dir"; exit 2 }
$root = [IO.Path]::GetFullPath($Dir).TrimEnd('\', '/')

$types = @{
  '.html' = 'text/html'; '.js' = 'text/javascript'; '.mjs' = 'text/javascript'; '.css' = 'text/css'
  '.json' = 'application/json'; '.md' = 'text/markdown'; '.txt' = 'text/plain'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'
  '.webp' = 'image/webp'; '.ico' = 'image/x-icon'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'
  '.ttf' = 'font/ttf'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'; '.pdf' = 'application/pdf'
}

$listener = $null
for ($i = 0; $i -lt 10; $i++, $Port++) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$Port/")
  try { $l.Start(); $listener = $l; break } catch { $l.Close() }
}
if (-not $listener) { Write-Host 'No free port found.'; exit 1 }
Write-Host "http://localhost:$Port/   ($root)   Ctrl+C to stop"

function Send($res, [int]$code, [string]$type, [byte[]]$bytes) {
  $res.StatusCode = $code
  if ($type) { $res.ContentType = $type }
  $res.Headers['Cache-Control'] = 'no-cache'
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}
function Esc([string]$s) { [Net.WebUtility]::HtmlEncode($s) }

try {
  while ($listener.IsListening) {
    # GetContext() cannot be interrupted by Ctrl+C until a request arrives, so wait in short steps
    $task = $listener.GetContextAsync()
    while (-not $task.AsyncWaitHandle.WaitOne(200)) { }
    $ctx = $task.GetAwaiter().GetResult()
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      $full = [IO.Path]::GetFullPath((Join-Path $root $rel.TrimStart('/').Replace('/', '\')))
      $inside = $full.Equals($root, 'OrdinalIgnoreCase') -or $full.StartsWith($root + '\', 'OrdinalIgnoreCase')
      if (-not $inside) { Send $res 403 'text/plain' ([Text.Encoding]::UTF8.GetBytes('forbidden')) }
      elseif (Test-Path -LiteralPath $full -PathType Container) {
        if (-not $rel.EndsWith('/')) { $res.Redirect($rel + '/') }
        elseif (Test-Path -LiteralPath (Join-Path $full 'index.html')) {
          Send $res 200 'text/html; charset=utf-8' ([IO.File]::ReadAllBytes((Join-Path $full 'index.html')))
        } else {
          # Folder listing (read by decks: 'auto' in deck.config.js, which looks at the links)
          $items = Get-ChildItem -LiteralPath $full | Sort-Object Name | ForEach-Object {
            $n = if ($_.PSIsContainer) { "$($_.Name)/" } else { $_.Name }
            "<li><a href=""$(Esc ([Uri]::EscapeDataString($_.Name) + $(if ($_.PSIsContainer) { '/' } else { '' })))"">$(Esc $n)</a></li>"
          }
          $html = "<!doctype html><meta charset=""utf-8""><title>$(Esc $rel)</title><ul>$($items -join '')</ul>"
          Send $res 200 'text/html; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($html))
        }
      }
      elseif (Test-Path -LiteralPath $full -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
        $type = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        if ($type -match '^(text/|application/json|image/svg)') { $type += '; charset=utf-8' }
        Send $res 200 $type ([IO.File]::ReadAllBytes($full))
      }
      else { Send $res 404 'text/plain' ([Text.Encoding]::UTF8.GetBytes('not found')) }
    } catch {
      try { Send $res 500 'text/plain' ([Text.Encoding]::UTF8.GetBytes('error')) } catch { }
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}

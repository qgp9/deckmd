DeckMD.register({ libs: ['https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.css', 'https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.js'], load: 'manual' });
// math plugin — TeX in Markdown, drawn with KaTeX. plugins: [math] in the front matter. Docs: docs/plugins.md
//   $x^2$  \(x^2\)   in a sentence          $$ … $$   \[ … \]   as a block (on lines of its own) or inside a sentence
//   math: { output: htmlAndMathml (default) | html | mathml, macros: { '\RR': '\mathbb{R}' } }   in the front matter
// The KaTeX files are loaded only when the Markdown has a '$' or '\(' / '\[' in it (load: 'manual' above), and the CSS (with the fonts) not at all for output: mathml.
// The two rules run before the Markdown ones for _ * \ ` so a formula reaches KaTeX as it was written. Code spans and code blocks are never touched.
(() => {
  const { esc } = DeckMD;
  const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.css';
  const KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.js';
  window.DeckNotices?.list.push({ name: 'KaTeX', spdx: 'MIT', match: /\/npm\/katex@/ });
  DeckMD.loadCSS('math.css');

  let opts = {}, output = 'htmlAndMathml';

  function render(tex, display) {
    try {
      if (!window.katex) throw new Error('KaTeX is not loaded');
      return window.katex.renderToString(tex, { displayMode: display, output, macros: { ...opts.macros }, throwOnError: true, trust: false });
    } catch (e) {
      console.warn(`math: ${e.message}`);
      return `<span class="math-error" title="${esc(e.message)}">${esc(tex)}</span>`;
    }
  }

  // Inline: $…$  $$…$$  \(…\)  \[…\]. A single $ opens only when no space follows it and closes only when no space comes before it and no digit follows it ($5 and $10 is money)
  function inline(state, silent) {
    const src = state.src, start = state.pos;
    let open, close, display = false;
    if (src.startsWith('$$', start)) [open, close, display] = ['$$', '$$', true];
    else if (src[start] === '$') [open, close] = ['$', '$'];
    else if (src.startsWith('\\(', start)) [open, close] = ['\\(', '\\)'];
    else if (src.startsWith('\\[', start)) [open, close, display] = ['\\[', '\\]', true];
    else return false;
    const from = start + open.length;
    if (open === '$' && (from >= src.length || /\s/.test(src[from]))) return false;
    let end = from - 1;
    for (;;) {                                                                   // the first closer that is not escaped decides
      end = src.indexOf(close, end + 1);
      if (end < 0) return false;
      let slashes = 0;
      while (src[end - 1 - slashes] === '\\') slashes++;
      if (!(slashes % 2)) break;                                                 // (an escaped \$ is part of the formula)
    }
    if (open === '$' && (/\s/.test(src[end - 1]) || /\d/.test(src[end + 1] ?? ''))) return false;
    const tex = src.slice(from, end);
    if (!tex.trim() || (open === '$' && tex.includes('`'))) return false;
    if (!silent) {
      const t = state.push('math_inline', 'math', 0);
      t.content = tex; t.meta = { display };
    }
    state.pos = end + close.length;
    return true;
  }

  // Block: a line that starts with $$ (or \[) up to the line that ends with $$ (or \]); one line is enough ($$ x $$)
  function block(state, startLine, endLine, silent) {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false;
    const first = state.bMarks[startLine] + state.tShift[startLine];
    const open = state.src.startsWith('$$', first) ? '$$' : state.src.startsWith('\\[', first) ? '\\[' : null;
    if (!open) return false;
    const close = open === '$$' ? '$$' : '\\]';
    const lineText = n => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]);
    const parts = [];
    let rest = lineText(startLine).slice(2).trimEnd(), n = startLine;
    for (;;) {
      if (rest.endsWith(close)) { parts.push(rest.slice(0, -close.length)); break; }
      parts.push(rest);
      if (++n >= endLine) return false;                                         // never closed: not a block
      rest = lineText(n).trimEnd();
    }
    const tex = parts.join('\n').trim();
    if (!tex) return false;
    if (silent) return true;
    const t = state.push('math_block', 'math', 0);
    t.block = true; t.content = tex; t.map = [startLine, n + 1];
    state.line = n + 1;
    return true;
  }

  DeckMD.init((deck) => {                                              // the front matter, the source and markdown-it exist now (see DeckMD.init)
    opts = deck.config?.math || {};
    output = ['html', 'mathml', 'htmlAndMathml'].includes(opts.output) ? opts.output : 'htmlAndMathml';
    if (/\$|\\\(|\\\[/.test(deck.source || '')) {
      if (output !== 'mathml') deck.load(KATEX_CSS);
      deck.load(KATEX_JS);
    }
    const md = deck.md;
    md.inline.ruler.before('escape', 'math_inline', inline);
    md.block.ruler.before('fence', 'math_block', block, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
    md.renderer.rules.math_inline = (tokens, i) => render(tokens[i].content, tokens[i].meta.display);
    md.renderer.rules.math_block = (tokens, i) => `<div class="math-block">${render(tokens[i].content, true)}</div>\n`;
  });
})();

// grid plugin — cell (N×M) diagrams. plugins: [grid] in the front matter. Syntax: docs/plugins.md
//
// ```grid {size=4x8 id=g index head start=1 h=90}
// 0          list   !        // cells, text, color, ! = highlight. Later lines override earlier ones
// 1-3        A#     cool     // # = running number within this line (A1 A2 A3), \# = the character #
// B2:C3      "two words" bad // Excel-style rectangle. Quote text with spaces
// 3:3        warn            // whole row (row 3), C:C = whole column, B:D = several columns. Changing only the color keeps the text
// 2,5,6      _               // _ = clear the text
// 8> 3 4 end! · 7            // fill in order from cell 8. A trailing ! highlights that cell
// ```
//   Cell numbers: left→right, top→bottom from 0 (from 1 with start=1). Excel-style addresses (A1, B2:C3, 3:3, C:C) always start at 1
//   size=RxC (if absent cols=16, rows fit the cells given) · index = show cell numbers · head = column letters and row numbers · h = cell height (px)
//   colors: accent cool good bad warn muted (theme variables) or a color value like #5ccfe6
//   each cell has data-id = "{id}-{number}" → if neighboring slides use auto-animate, matching cells move together
(() => {
  const { esc } = DeckMD;
  DeckMD.loadCSS('grid.css');

  const NAMED = ['accent', 'cool', 'good', 'bad', 'warn', 'muted'];
  const isColor = t => NAMED.includes(t) || /^#[0-9a-f]{3,8}$/i.test(t);
  const colOf = s => [...s.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;   // A → 0
  const letters = (i) => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

  // One cell spec → list of cell numbers (from 0). For when the row count is unknown: [numbers, rows needed]
  function cellsOf(spec, cols, rows, start) {
    const out = [];
    let need = 0;
    const add = (r, c) => { out.push(r * cols + c); need = Math.max(need, r + 1); };
    for (const part of spec.split(',')) {
      const p = part.trim();
      let m;
      if ((m = /^(\d+)(?:-(\d+))?$/.exec(p))) {                                  // 5, 1-3
        const a = +m[1] - start, b = (m[2] != null ? +m[2] : +m[1]) - start;
        if (a < 0 || b < a) throw new Error(`bad cell number: "${p}"`);
        for (let i = a; i <= b; i++) add(Math.floor(i / cols), i % cols);
      } else if ((m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i.exec(p))) {         // B2, B2:C5
        const c1 = colOf(m[1]), r1 = +m[2] - 1, c2 = m[3] ? colOf(m[3]) : c1, r2 = m[4] ? +m[4] - 1 : r1;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) add(r, c);
      } else if ((m = /^(\d+):(\d+)$/.exec(p))) {                                  // 3:3, 2:4 = rows
        if (!rows) throw new Error(`a whole row (${p}) needs size=rowsxcols`);
        for (let r = +m[1] - 1; r <= +m[2] - 1; r++) for (let c = 0; c < cols; c++) add(r, c);
      } else if ((m = /^([A-Z]+):([A-Z]+)$/i.exec(p))) {                           // C:C, B:D = columns
        if (!rows) throw new Error(`a whole column (${p}) needs size=rowsxcols`);
        for (let r = 0; r < rows; r++) for (let c = colOf(m[1]); c <= colOf(m[2]); c++) add(r, c);
      } else throw new Error(`can't read cell spec: "${p}"`);
    }
    return [out, need];
  }

  function parse(code, a) {
    const start = a.start != null ? +a.start : 0;
    const size = /^(\d+)\s*x\s*(\d+)$/i.exec(a.size || '');
    const cols = size ? +size[2] : +(a.cols || 16);
    let rows = size ? +size[1] : 0;
    const set = [];                                      // [cell numbers, {label?, color?, hl?}] in order
    let need = 1;
    code.split('\n').forEach((raw, ln) => {
      const line = raw.replace(/(^|\s)\/\/.*$/, '').trim();
      if (!line) return;
      const where = `line ${ln + 1}`;
      try {
        const tok = line.match(/"[^"]*"|\S+/g);
        let spec = tok.shift();
        while (spec.endsWith(',') && tok.length) spec += tok.shift();       // 1-3, 9-10 (space after a comma)
        const fill = spec.endsWith('>');
        if (fill) {                                      // 8> a b c — fill in order
          spec = spec.slice(0, -1);
          const [[first], n] = cellsOf(spec, cols, rows, start);
          tok.forEach((t, k) => {
            const hl = /[^\\]!$/.test(t) || t === '!';
            const label = t.replace(/!$/, '').replace(/\\!$/, '!').replace(/^"|"$/g, '');
            set.push([[first + k], { label: label === '_' ? '' : label, ...(hl ? { hl } : {}) }]);
            need = Math.max(need, n, Math.floor((first + k) / cols) + 1);
          });
          return;
        }
        const [idx, n] = cellsOf(spec, cols, rows, start);
        need = Math.max(need, n);
        const opt = {};
        if (tok[tok.length - 1] === '!') { tok.pop(); opt.hl = true; }
        if (tok.length && isColor(tok[tok.length - 1])) opt.color = tok.pop();
        if (tok.length) {
          const label = tok.map(t => t.replace(/^"|"$/g, '')).join(' ');
          opt.label = label === '_' ? '' : label;
        }
        idx.forEach((i, k) => {
          const o = { ...opt };
          if (o.label) o.label = o.label.replace(/\\#/g, '\u0000').replace(/#/g, String(k + 1)).replace(/\u0000/g, '#');
          set.push([[i], o]);
        });
      } catch (e) { throw new Error(`${where}: ${e.message}`); }
    });
    rows = rows || need;
    const cells = Array.from({ length: rows * cols }, () => ({ label: '', color: null, hl: false }));
    for (const [idx, o] of set) {
      for (const i of idx) {
        if (i >= cells.length) throw new Error(`cell ${i + start} is outside the grid (${rows}x${cols})`);
        Object.assign(cells[i], o);
      }
    }
    return { rows, cols, start, cells };
  }

  DeckMD.registerFence('grid', (code, a) => {
    const { rows, cols, start, cells } = parse(code, a);
    const id = a.id || 'g', head = 'head' in a, index = 'index' in a;
    const style = [`--cols:${cols}`, a.h ? `--grid-h:${+a.h}px` : ''].filter(Boolean).join(';');
    const cell = (c, i) => {
      const named = c.color && NAMED.includes(c.color);
      const cls = ['cell', c.color ? 'tint' : '', named ? `is-${c.color}` : '', c.hl ? 'hl' : '', c.label ? '' : 'empty'].filter(Boolean).join(' ');
      const st = c.color && !named ? ` style="--c:${esc(c.color)}"` : '';
      return `<div class="${cls}" data-id="${esc(id)}-${i}"${st}>${index ? `<i>${i + start}</i>` : ''}<b>${esc(c.label)}</b></div>`;
    };
    let body = '';
    if (head) body += '<span class="gh"></span>' + Array.from({ length: cols }, (_, c) => `<span class="gh">${letters(c)}</span>`).join('');
    for (let r = 0; r < rows; r++) {
      if (head) body += `<span class="gh">${r + 1}</span>`;
      body += cells.slice(r * cols, (r + 1) * cols).map((c, k) => cell(c, r * cols + k)).join('');
    }
    return `<div class="grid${head ? ' with-head' : ''}" style="${style}">${body}</div>\n`;
  });
})();

// grid plugin — cell (N×M) diagrams. plugins: [grid] in the front matter. Syntax: docs/plugins.md
//
// ```grid {size=4x8 id=g index head start=1 h=90}      (```grid {as=table} or ```table: the same cells as a <table>)
// 0          list   !        // cells, text, color, ! = highlight. Later lines override earlier ones
// 1-3        A#     cool     // # = running number within this line (A1 A2 A3), \# = the character #
// B2:C3      "two words" bad // Excel-style rectangle. Quote text with spaces
// 3:3        warn            // whole row (row 3), C:C = whole column, B:D = several columns. Changing only the color keeps the text
// 2,5,6      _               // _ = clear the text
// 8> 3 4 end! · 7            // fill in order from cell 8. A trailing ! highlights that cell
// ```
//   Lines that start with | are data (a Markdown table, shown as the cells; **bold** and `code` work in them); the others are the commands above, in any order
//   Cell numbers: left→right, top→bottom from 0 (from 1 with start=1). Excel-style addresses (A1, B2:C3, 3:3, C:C) always start at 1
//   size=RxC (if absent cols=16, rows fit the cells given) · index = show cell numbers · head = column letters and row numbers · h = cell height (px)
//   colors: accent cool good bad warn muted (theme variables) or a color value like #5ccfe6
//   each cell has data-id = "{id}-{number}" → if neighboring slides use auto-animate, matching cells move together
(() => {
  const { esc } = DeckMD;
  DeckMD.loadCSS('grid.css');

  const MAX_CELLS = 10000;
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
      const room = n => { if (out.length + n > MAX_CELLS) throw new Error(`"${p}" is more than ${MAX_CELLS} cells`); };   // before the loop: a typo like A1:ZZZ999 must not run for minutes
      if ((m = /^(\d+)(?:-(\d+))?$/.exec(p))) {                                  // 5, 1-3
        const a = +m[1] - start, b = (m[2] != null ? +m[2] : +m[1]) - start;
        if (a < 0 || b < a) throw new Error(`bad cell number: "${p}"`);
        room(b - a + 1);
        for (let i = a; i <= b; i++) add(Math.floor(i / cols), i % cols);
      } else if ((m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i.exec(p))) {         // B2, B2:C5
        const c1 = colOf(m[1]), r1 = +m[2] - 1, c2 = m[3] ? colOf(m[3]) : c1, r2 = m[4] ? +m[4] - 1 : r1;
        if (r1 < 0 || r2 < 0) throw new Error(`rows start at 1 (A1 is the first cell): "${p}"`);
        room((Math.abs(r2 - r1) + 1) * (Math.abs(c2 - c1) + 1));
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) add(r, c);
      } else if ((m = /^(\d+):(\d+)$/.exec(p))) {                                  // 3:3, 2:4 = rows
        if (!rows) throw new Error(`a whole row (${p}) needs size=rowsxcols`);
        if (+m[1] < 1 || +m[2] < 1) throw new Error(`rows start at 1: "${p}"`);
        room((Math.abs(+m[2] - +m[1]) + 1) * cols);
        for (let r = Math.min(+m[1], +m[2]) - 1; r <= Math.max(+m[1], +m[2]) - 1; r++) for (let c = 0; c < cols; c++) add(r, c);
      } else if ((m = /^([A-Z]+):([A-Z]+)$/i.exec(p))) {                           // C:C, B:D = columns
        if (!rows) throw new Error(`a whole column (${p}) needs size=rowsxcols`);
        room(rows * (Math.abs(colOf(m[2]) - colOf(m[1])) + 1));
        for (let r = 0; r < rows; r++) for (let c = Math.min(colOf(m[1]), colOf(m[2])); c <= Math.max(colOf(m[1]), colOf(m[2])); c++) add(r, c);
      } else throw new Error(`can't read cell spec: "${p}"`);
    }
    return [out, need];
  }

  // Lines that start with | are the data (a Markdown table: cells, an optional |---|:--:| line for alignment and for a header row); the other lines are
  // the commands. The cells are filled from the data first, then the commands change them, wherever they stand among the data lines.
  const splitRow = line => line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  function parseData(lines) {
    const rows = lines.map(splitRow);
    let align = null, header = false;
    if (rows.length > 1 && rows[1].every(c => /^:?-+:?$/.test(c))) {
      if (rows[1].length !== rows[0].length) throw new Error(`the |---| line has ${rows[1].length} cells but the header row has ${rows[0].length}`);
      align = rows[1].map(c => (c.startsWith(':') ? (c.endsWith(':') ? 'center' : 'left') : c.endsWith(':') ? 'right' : null));
      rows.splice(1, 1);
      header = true;
    }
    return { rows, align, header, cols: Math.max(0, ...rows.map(r => r.length)) };
  }

  function parse(code, a) {
    const start = a.start != null ? +a.start : 0;
    const size = /^(\d+)\s*x\s*(\d+)$/i.exec(a.size || '');
    if (a.size != null && !size) throw new Error(`bad size="${a.size}": use size=ROWSxCOLUMNS (size=4x8)`);
    const dataLines = [], cmdLines = [];
    code.split('\n').forEach((raw, ln) => (/^\s*\|/.test(raw) ? dataLines : cmdLines).push([raw, ln]));
    const data = parseData(dataLines.map(([raw]) => raw));
    const cols = size ? +size[2] : data.cols || +(a.cols || 16);
    if (!Number.isInteger(cols) || cols < 1) throw new Error(`bad cols="${a.cols}": a number of columns, 1 or more`);
    if (a.h != null && !(+a.h > 0)) throw new Error(`bad h="${a.h}": the cell height in px`);
    let rows = size ? +size[1] : 0;
    if (data.rows.length && (data.cols > cols || (size && data.rows.length > rows))) throw new Error(`the table is ${data.rows.length}x${data.cols} but size=${a.size}`);
    const known = rows || data.rows.length;                  // rows known before the commands are read (whole rows and columns need it)
    const set = [];                                      // [cell numbers, {label?, color?, hl?}] in order
    let need = 1;
    cmdLines.forEach(([raw, ln]) => {
      const line = raw.replace(/(^|\s)\/\/.*$/, '').trim();
      if (!line) return;
      const where = `line ${ln + 1}`;
      try {
        const tok = line.match(/"[^"]*"|\S+/g);
        if (tok.some(t => t.startsWith('"') && !/^"[^"]*"$/.test(t))) throw new Error('unclosed quote (a text with spaces goes in "double quotes")');
        let spec = tok.shift();
        while (spec.endsWith(',') && tok.length) spec += tok.shift();       // 1-3, 9-10 (space after a comma)
        const fill = spec.endsWith('>');
        if (fill) {                                      // 8> a b c — fill in order
          spec = spec.slice(0, -1);
          const [starts, n] = cellsOf(spec, cols, known, start);
          if (starts.length !== 1) throw new Error(`"${spec}>" fills in order from ONE cell (8> a b c), not from a range`);
          const [first] = starts;
          tok.forEach((t, k) => {
            const hl = /[^\\]!$/.test(t) || t === '!';
            const label = t.replace(/!$/, '').replace(/\\!$/, '!').replace(/^"|"$/g, '');
            set.push([[first + k], { label: label === '_' ? '' : label, md: false, ...(hl ? { hl } : {}) }]);
            need = Math.max(need, n, Math.floor((first + k) / cols) + 1);
          });
          return;
        }
        const [idx, n] = cellsOf(spec, cols, known, start);
        need = Math.max(need, n);
        const opt = {};
        if (tok[tok.length - 1] === '!') { tok.pop(); opt.hl = true; }
        if (tok.length && isColor(tok[tok.length - 1])) opt.color = tok.pop();
        if (tok.length) {
          const label = tok.map(t => t.replace(/^"|"$/g, '')).join(' ');
          opt.label = label === '_' ? '' : label;
          opt.md = false;                                // typed here: plain text, not Markdown
        }
        idx.forEach((i, k) => {
          const o = { ...opt };
          if (o.label) o.label = o.label.replace(/\\#/g, '\u0000').replace(/#/g, String(k + 1)).replace(/\u0000/g, '#');
          set.push([[i], o]);
        });
      } catch (e) { throw new Error(`${where}: ${e.message}`); }
    });
    rows = rows || Math.max(need, data.rows.length);
    if (rows * cols > MAX_CELLS) throw new Error(`${rows}x${cols} is too many cells (at most ${MAX_CELLS})`);
    const cells = Array.from({ length: rows * cols }, () => ({ label: '', color: null, hl: false, md: false }));
    data.rows.forEach((row, r) => row.forEach((text, c) => Object.assign(cells[r * cols + c], { label: text, md: true })));
    for (const [idx, o] of set) {
      for (const i of idx) {
        if (i < 0 || i >= cells.length) throw new Error(`cell ${i + start} is outside the grid (${rows}x${cols})`);
        Object.assign(cells[i], o);
      }
    }
    return { rows, cols, start, cells, align: data.align, header: data.header };
  }

  // The cell text: from the data lines it is Markdown (**bold**, `code`, links); typed in a command it is plain text
  const inner = c => (c.md ? DeckMD.md.renderInline(c.label) : esc(c.label));
  const cellAttrs = (c, id, i, extra = []) => {
    const named = c.color && NAMED.includes(c.color);
    const cls = ['cell', c.color ? 'tint' : '', named ? `is-${c.color}` : '', c.hl ? 'hl' : '', c.label ? '' : 'empty'].filter(Boolean).join(' ');
    const style = [...extra, c.color && !named ? `--c:${esc(c.color)}` : ''].filter(Boolean).join(';');
    return `class="${cls}" data-id="${esc(id)}-${i}"${style ? ` style="${style}"` : ''}`;
  };

  // as=table: the same cells in a <table> (text that wraps, copy and paste, screen readers); the first data row is the header when there is a |---| line
  function renderTable(p, id) {
    const row = (r, tag) => `<tr>${Array.from({ length: p.cols }, (_, c) => {
      const i = r * p.cols + c, cell = p.cells[i], al = p.align?.[c];
      return `<${tag} ${cellAttrs(cell, id, i, al ? [`text-align:${al}`] : [])}${tag === 'th' ? ' scope="col"' : ''}>${inner(cell)}</${tag}>`;
    }).join('')}</tr>`;
    const body = Array.from({ length: p.rows }, (_, r) => r).filter(r => !(p.header && r === 0));
    return `<table class="grid-table">${p.header ? `<thead>${row(0, 'th')}</thead>` : ''}<tbody>${body.map(r => row(r, 'td')).join('')}</tbody></table>\n`;
  }

  function render(code, a, as) {
    const p = parse(code, a);
    const { rows, cols, start, cells } = p;
    const id = a.id || 'g', head = 'head' in a, index = 'index' in a;
    const given = a.as == null ? null : String(a.as).trim().replace(/^["']|["']$/g, '').trim().toLowerCase();    // as=Table, as=" table ", as="table"
    if (as && given && given !== as) throw new Error(`as=${a.as}: this block is a ${as}`);
    const kind = as || given || 'grid';
    if (kind === 'table') return renderTable(p, id);
    if (kind !== 'grid') throw new Error(`as=${kind}: use as=table, or leave it out for a grid`);
    const style = [`--cols:${cols}`, a.h ? `--grid-h:${+a.h}px` : ''].filter(Boolean).join(';');
    const cell = (c, i) => `<div ${cellAttrs(c, id, i)}>${index ? `<i>${i + start}</i>` : ''}<b>${inner(c)}</b></div>`;
    let body = '';
    if (head) body += '<span class="gh"></span>' + Array.from({ length: cols }, (_, c) => `<span class="gh">${letters(c)}</span>`).join('');
    for (let r = 0; r < rows; r++) {
      if (head) body += `<span class="gh">${r + 1}</span>`;
      body += cells.slice(r * cols, (r + 1) * cols).map((c, k) => cell(c, r * cols + k)).join('');
    }
    return `<div class="grid${head ? ' with-head' : ''}" style="${style}">${body}</div>\n`;
  }
  DeckMD.registerFence('grid', (code, a) => render(code, a));
  DeckMD.registerFence('table', (code, a) => render(code, a, 'table'));            // ```table = ```grid {as=table}
})();

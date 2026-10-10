---
title: grid plugin (example)
size: 1920x1080
theme: solarized
plugins: [grid, source]
---

<!-- class: center; source: off -->

# Cell diagrams and tables: ```` ```grid ````

Arrays, boards, calendars, memory, tables — diagrams made of cells {.teaser}

Press ↓ under a slide to see the Markdown it was made from {.small .muted}

Source: [examples/grid/talk.md](https://github.com/qgp9/deckmd/blob/main/examples/grid/talk.md) {.small .muted}

Note:
Each line: "cells, text, color, ! (highlight)". Later lines override earlier ones.

---

## Arrays: indexes, ranges, highlights

```grid {size=1x10 index}
0> 3 8 15 21 34 42 57 63 78 91
4  cool !
5-9 muted
```

`size=1x10 index` · `0> 3 8 15 …` fills cells in order, `4 cool !` colors and highlights cell 4 {.small .muted}

---

<!-- auto-animate -->

## Binary search: find 42 {data-id=bs}

```grid {size=1x10 index id=bs}
0> 3 8 15 21 34 42 57 63 78 91
4  warn !
```

Middle (cell 4) = 34 < 42 → keep only the right half {.small .muted}

---

<!-- auto-animate -->

## Binary search: find 42 {data-id=bs}

```grid {size=1x10 index id=bs}
0> 3 8 15 21 34 42 57 63 78 91
0-4 muted
5  good !
7  warn
```

Middle of the remaining 5–9 (cell 7) = 63 > 42 → go left. Found at cell 5 {.small .muted}

Note:
This slide and the previous one are both auto-animate with the same id=bs, so the colors of matching cells change smoothly.

---

## Boards: spreadsheet addresses (`head`)

::::: cols
::: div
```grid {size=3x3 head h=150}
A1 X  cool
B2 X  cool
C3 X  cool !
A3 O  bad
C1 O  bad
```
:::
::: div
- `B2` one cell, `B2:C3` a rectangle
- `3:3` a whole row, `C:C` a whole column
- Spreadsheet addresses start at 1 (A1 is the first cell)
- `head` = column letters · row numbers
{.small}
:::
:::::

---

## Calendars: color by row · column · rectangle

```grid {size=5x7 start=1 head h=70}
1> 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31
F:G      muted
B2:D2    "trip" cool
22-26    accent
24       "talk" accent !
32-35    _
```

With `start=1`, cell numbers start at 1 too · `F:G` weekend columns · `B2:D2` a rectangle · `24 "talk" accent !` {.small .muted}

---

## Memory: a chain of next cells

```grid {size=2x8 index id=mem}
0     list  accent
1-3   A#    cool
4-7   B#    good
9-10  A#    cool
```

```grid {size=1x16 index h=56}
0> _ 2 3 9 5 6 7 end · 10 end · · · · ·
1-3, 9-10   cool
4-7         good
```

Top: data in each cell (A continues from 1–3 to 9–10) · bottom: the "next cell" table {.small .muted}

---

## Data: a Markdown table fills the grid

```grid {id=data h=80}
| Name  | Q1 | Q2     | Q3 |
| Alpha | 10 | 12     | 9  |
| Beta  | 7  | **15** | 11 |
C3 good !
D2 bad
1:1 muted
```

Lines that start with `|` are data (Markdown works inside), the others are the usual commands · `1:1` is the whole first row {.small .muted}

---

## Tables: ```` ```table ````

```table
| Name  | Q1 | Q2     | Q3     |
|:------|---:|-------:|-------:|
| Alpha | 10 | 12     | 9      |
| Beta  | 7  | **15** | 11     |
| Gamma | 4  | 6      | `n/a`  |

B3 !
D4 bad
A2:A4 accent
```

Same syntax, drawn as a real `<table>`. A `|---|` line makes the first row the header and sets the alignment (`:---` left, `:---:` center, `---:` right) {.small .muted}

---

## Tables: text wraps, ranges and rows get colors

```grid {as=table}
| Step | What happens | Why |
|---|---|---|
| 1 | The server finds the project by walking up from the current folder, like git does | so you can run it from any subfolder |
| 2 | Only files inside the project are served | nothing above it is exposed |
| 3 | A deck outside the project is refused with the command that works | it can't be opened from here |

B2:C2 good
A4:C4 bad
```

`grid {as=table}` is the same as `table` · the header is row 1, so `B2:C2` is the first data row {.small .muted}

---

## Colors: theme names or color values

```grid {size=1x8 h=90}
0 accent accent
1 cool cool
2 good good
3 bad bad
4 warn warn
5 muted muted
6 "hex" #c792ea
7 _
```

Names are theme variables, so they fit any theme. Wrap in quotes for text (`"bad"`). Empty cells are dashed {.small .muted}

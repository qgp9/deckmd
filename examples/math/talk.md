---
title: math plugin (example)
size: 1920x1080
theme: solarized
plugins: [math, source]
---

<!-- class: center -->

# Math: TeX with KaTeX

`$E = mc^2$` in a sentence: $E = mc^2$ {.teaser}

Press ↓ under a slide to see its Markdown {.small .muted}

---

## Inline and block

A sentence with a formula, $a^2 + b^2 = c^2$, and one that is not: it costs $5 and $10.

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

---

## Escapes and code

Write `\$` for a dollar sign: \$5 is money. Code is never math: `$x_1$`.

```
$x_1 + y_2$   (in a code block too)
```

Underscores outside a formula stay text: snake_case_name.

---

## Layouts and larger formulas

$$
\begin{aligned}
(a + b)^2 &= a^2 + 2ab + b^2 \\
\sum_{k=1}^{n} k &= \frac{n(n+1)}{2}
\end{aligned}
$$

$$
\mathbf{A} = \begin{pmatrix} a & b \\ c & d \end{pmatrix}, \qquad \det \mathbf{A} = ad - bc
$$

---

## A mistake shows where it is

This formula is broken: $\frac{1$ (the message is in its tooltip and in the console), and this one is fine: \(\alpha + \beta\).

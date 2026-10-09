/*! markdown-it-bracketed-spans 1.0.3 (MIT, https://github.com/mb21/markdown-it-bracketed-spans) — wrapped for the browser: window.markdownItBracketedSpans */
(function () { var module = { exports: {} };
"use strict";

module.exports = function bracketed_spans_plugin(md) {

  function span(state) {
    var max = state.posMax

    if (state.src.charCodeAt(state.pos) !== 0x5B) {
      // opening [
      return false;
    }

    var labelStart = state.pos + 1;
    var labelEnd   = state.md.helpers.parseLinkLabel(state, state.pos, false);

    if (labelEnd < 0) {
      // parser failed to find closing ]
      return false;
    }

    var tokens = state.tokens;
    var tokens_len = state.tokens.length;

    if ((tokens_len === 0 && state.level > 0) ||
        (tokens_len > 0 && ((tokens[tokens_len - 1].nesting < 1 && tokens[tokens_len - 1].level !== state.level) ||
        (tokens[tokens_len - 1].nesting > 0 && tokens[tokens_len - 1].level >= state.level)))
       ) {
      // parser failed to find closing ]
      return false;
    }

    var pos = labelEnd + 1;
    if (pos < max && state.src.charCodeAt(pos) === 0x7B /* { */) {
      // probably found span

      state.pos = labelStart;
      state.posMax = labelEnd;

      state.push('span_open', 'span', 1);
      state.md.inline.tokenize(state);
      state.push('span_close', 'span', -1);

      state.pos = pos;
      state.posMax = max;
      return true;
    } else {
      return false;
    }
  };

  md.inline.ruler.push('bracketed-spans', span);
}
window.markdownItBracketedSpans = module.exports; })();

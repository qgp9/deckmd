// source plugin — under each slide, a slide with the Markdown it was made from (press ↓). plugins: [source] in the front matter. Docs: docs/plugins.md
//   ?source=off          hide them for this viewing (the deck keeps the plugin)
//   <!-- source: off --> in a slide: no source slide for that one
// A slide that already is a vertical stack (a <section> inside it, written as raw HTML) is left alone: reveal has only two levels.
// The first slide that gets a source has one more page before it: the front matter (the deck's settings) as written (if that slide is off, the next one has it).
// The source is the slide as written in the file: its settings comment and content, without the speaker notes (for a deck with no --- breaks, the lines of the file the slide was made from). A deck written in HTML has no Markdown, so nothing is added.
(() => {
  const off = new URLSearchParams(location.search).get('source') === 'off';
  if (off) return;                                             // nothing to do (and no CSS to load) for this viewing
  DeckMD.loadCSS('source.css');

  // reveal goes back to the vertical slide you left last (data-previous-indexv on the stack), so after reading a source and moving sideways,
  // coming back would land on the source. Moving to another stack always starts at its top slide; only ↓ (or a link to #/h/1) shows a source.
  // Leaving a source sideways: forget the remembered position (so the way back doesn't flash the source). Going to a source on purpose (↓, a link, the back button) is left alone.
  let armed = false, lastH;
  const arm = () => {
    if (armed || !window.Reveal) return;
    armed = true;
    Reveal.on('slidechanged', (e) => {
      if (lastH != null && e.indexh !== lastH && e.previousSlide?.classList.contains('source-slide')) e.previousSlide.parentElement?.setAttribute('data-previous-indexv', '0');
      lastH = e.indexh;
    });
  };

  const view = (text, extra = '') => {                           // a slide with the text in a code block
    const s = document.createElement('section');
    s.className = `source-slide ${extra}`.trim();
    const code = s.appendChild(document.createElement('pre')).appendChild(document.createElement('code'));
    code.className = 'language-markdown';
    code.textContent = text;
    return s;
  };

  let frontMatterPending = true;                                 // the first slide that gets a source also gets the deck's front matter (the --- … --- at the top of the file) first
  DeckMD.beforeRender?.(() => { frontMatterPending = true; });   // the slides are built again on DeckMD.setSource: the first one gets the front matter again
  DeckMD.afterRender((sec) => {
    arm();
    const text = DeckMD.slideInfo?.get(sec)?.withoutNotes ?? DeckMD.sources.get(sec);       // the lines as written; for a deck split by headings DeckMD.sources is text deckmd built (<!-- fit -->, a title)
    if (text == null || sec.dataset.source === 'off') return;
    if (sec.querySelector(':scope > section')) return;          // a vertical stack written inside the slide (raw HTML): reveal has two levels only, so leave it as it is
    const stack = document.createElement('section');          // a vertical stack: the slide, then its source below it
    sec.replaceWith(stack);
    stack.append(sec, ...(frontMatterPending && DeckMD.frontMatter ? [view(DeckMD.frontMatter, 'front-matter')] : []), view(text));
    frontMatterPending = false;
  });
})();

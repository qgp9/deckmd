// source plugin — under each slide, a slide with the Markdown it was made from (press ↓). plugins: [source] in the front matter. Docs: docs/plugins.md
//   ?source=off          hide them for this viewing (the deck keeps the plugin)
//   <!-- source: off --> in a slide: no source slide for that one
// The source is the slide as written: its settings comment and content, without the speaker notes. A deck written in HTML has no Markdown, so nothing is added.
(() => {
  DeckMD.loadCSS('source.css');
  const off = new URLSearchParams(location.search).get('source') === 'off';

  // reveal goes back to the vertical slide you left last, so after reading a source and moving sideways, coming back would land on the source.
  // Moving to another stack always starts at its top slide; only ↓ (or a link to #/h/1) shows a source
  let armed = false, lastH;
  const arm = () => {
    if (armed || !window.Reveal) return;
    armed = true;
    Reveal.on('slidechanged', (e) => {
      if (e.currentSlide?.classList.contains('source-slide') && lastH != null && e.indexh !== lastH) Reveal.slide(e.indexh, 0);
      lastH = e.indexh;
    });
  };

  DeckMD.afterRender((sec) => {
    arm();
    const text = DeckMD.sources.get(sec);
    if (off || text == null || sec.dataset.source === 'off') return;
    const stack = document.createElement('section');          // a vertical stack: the slide, then its source below it
    const view = document.createElement('section');
    view.className = 'source-slide';
    const pre = view.appendChild(document.createElement('pre'));
    const code = pre.appendChild(document.createElement('code'));
    code.className = 'language-markdown';
    code.textContent = text;
    sec.replaceWith(stack);
    stack.append(sec, view);
  });
})();

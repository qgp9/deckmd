// JS for this deck only. In the front matter: plugins: [demo.js]
DeckMD.loadCSS('demo.css');

// Way 2: once when the slide is rendered, add behavior to the buttons
DeckMD.afterRender((sec) => {
  sec.querySelectorAll('button.count').forEach((b) => {
    let n = 0;
    b.addEventListener('click', () => { b.textContent = `Clicked ${++n}`; });
  });
});

// Way 4: every time the slide is shown. The returned function is called on leaving
DeckMD.registerRun('clock', (sec) => {
  const el = sec.querySelector('.clock');
  const tick = () => { el.textContent = new Date().toTimeString().slice(0, 8); };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
});

DeckMD.registerRun('countup', (sec) => {
  const el = sec.querySelector('.big-num');
  const to = +el.dataset.to, start = performance.now();
  let raf;
  const step = (t) => {
    const k = Math.min(1, (t - start) / 1200);
    el.textContent = Math.round(to * (1 - (1 - k) ** 3));
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
});

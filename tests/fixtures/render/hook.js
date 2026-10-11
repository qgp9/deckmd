// for tests: records when DeckMD calls beforeRender and afterRender (tests/browser.html reads window.__renderLog),
// and throws for a slide that says BOOM (a plugin that fails while the slides are being built again)
window.__renderLog = [];
DeckMD.beforeRender(({ update }) => window.__renderLog.push(`before:${update}`));
DeckMD.afterRender((sec) => {
  window.__renderLog.push(`after:${DeckMD.slideInfo.get(sec).startLine}`);
  if (sec.textContent.includes('BOOM')) throw new Error('boom');
});

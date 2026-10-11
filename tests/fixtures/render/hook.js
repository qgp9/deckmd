// for tests: records when DeckMD calls beforeRender and afterRender (tests/browser.html reads window.__renderLog)
window.__renderLog = [];
DeckMD.beforeRender(({ update }) => window.__renderLog.push(`before:${update}`));
DeckMD.afterRender((sec) => window.__renderLog.push(`after:${DeckMD.slideInfo.get(sec).startLine}`));

// Config for your talks repository (next to index.html). Optional. Markdown front matter and URL options override it.
window.DeckConfig = {
  title: 'Talks',
  home: 'list',                 // opened without ?src: 'list' = deck list | 'deck' = the src deck below
  src: '',                      // deck to open when home: 'deck'
  decks: 'auto',                // 'auto' = .md files in the scan folders (web server only) | [{ src, title }]
  scan: ['slides/*'],            // each folder in slides/ (one deck = one folder). The top level can't be scanned: index.html hides its folder listing
  // Defaults for all decks (paths relative to this file. theme and plugins given by name come from deckmd/. Unset: deckmd/js/defaults.js): theme: 'ember', plugins: [], css: [], lines: 12,
  // reveal: { transition: 'slide' },
};

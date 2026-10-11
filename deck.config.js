// Config used when opening the deckmd repository directly (the sample for your own repository is templates/deck.config.js).
window.DeckConfig = {
  title: 'deckmd examples',
  home: 'list',
  // 'auto' = the example decks found by scan; then the two READMEs, which are decks too: no slide breaks in them, so they are split by headings
  decks: ['auto',
    { src: 'README.md', title: 'README: split by headings (no slide breaks)', core: false, plugins: ['source'] },
    { src: 'README.ko.md', title: 'README (Korean): split by headings', core: false, plugins: ['source'] }],
  scan: ['examples/*'],
};

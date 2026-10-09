// defaults.js — the one place for config defaults. Overridden in order by deck.config.js (window.DeckConfig) → Markdown front matter → URL options.
// Read by deck.js (the command-line pack tools/build.mjs runs the same deck.js in jsdom). Meaning of each value: templates/deck.config.full.js.
window.DeckDefaults = {
  title: 'Deck list',      // title of the deck list page
  home: 'deck',            // when opened without ?src: 'deck' = the src deck | 'list' = deck list
  src: 'slides.md',
  decks: 'auto',           // list: 'auto' = .md files in the scan folders (web server only) | [{ src, title }]
  scan: ['talks/*'],       // where to look when decks: 'auto' (repository layout in docs/usage.md)
  theme: 'ember',          // themes/ember/ember.css
  css: [],
  plugins: [],
  size: '1920x1080',
  split: null,             // null = 'rules' if the deck has ---, otherwise 'headings'
  lines: 12,
  defaultTier: 'core',     // tier of slides without a tier. ?core keeps only slides whose tier is core → 'core' = slides without a tier stay | 'none'·'backup' = they are dropped
  reveal: {},
};

// A sample with everything you can put in deck.config.js (templates/deck.config.js has only the common ones).
// Copy it next to index.html as deck.config.js and keep only what you need. All of it is optional (values below are defaults or safe values).
// Values for keys you don't set are all collected in deckmd/js/defaults.js.
//
// How to write paths (theme, css, plugins, src, scan, etc.):
//   ember           name only (theme, plugins)   → deckmd/themes/ember/ember.css, deckmd/plugins/grid/grid.js (inside deckmd)
//   my/x.css        relative path                → relative to this file (next to index.html). In Markdown front matter, relative to that Markdown
//   /themes/x.css   starting with '/'            → relative to where index.html is, wherever you write it (not the server root)
//   /themes/x       theme only: no extension     → treated as a folder, x.css inside it (/themes/x/x.css)
//   reveal/white    theme only: reveal.js built-in theme → reveal.js's dist/theme/white.css (black, league, moon, dracula …)
//
// The same keys in Markdown front matter (---) go on top of this config. How they combine differs per key (see each line below).
// Only values that deck.js reads mean anything. A misspelled name is silently ignored (watch for typos).

window.DeckConfig = {

  // ───────────── Deck list (index.html opened without ?src) ─────────────

  // Title of the list page.
  title: 'Talks',

  // Opened without ?src=: 'list' = deck list | 'deck' = open the src deck below right away.
  home: 'list',
  // Markdown to open when home: 'deck' (relative to index.html). Handy when there's only one deck.
  // src: 'talk.md',

  // How the list is built.
  //   'auto'  = find .md files in the scan folders below from the web server's folder listing (the server must provide folder listings; not on file://).
  //   [ ... ] = write it yourself. Use this for static hosting (GitHub Pages, etc.) or file://.
  decks: 'auto',
  // decks: [
  //   { src: 'talks/2026-11-first-talk/talk.md', title: 'My first talk' },
  //   'talks/2026-12-second/talk.md',                  // a plain string works too (title from front matter title or the first # heading)
  // ],

  // Where to look when decks: 'auto' (relative to index.html).
  //   'talks'     the talks folder itself (talks/talk.md)
  //   'talks/*'   each subfolder of talks (talks/2026-11-xxx/talk.md) ← one deck = one folder (recommended)
  //   The top level ('.', '*') can't be scanned because index.html hides its folder listing → go one level down like 'talks/*', or list them in decks.
  scan: ['talks/*'],

  // ───────────── Deck defaults (apply to all decks. If front matter has the same key, the rules below apply) ─────────────

  // One theme or several. A theme in front matter replaces this value entirely (not merged).
  //   'ember'                 default theme (dark background + orange accent. Light mode too)
  //   'catppuccin'            Catppuccin (dark Mocha by default, light Latte)
  //   'solarized'             Solarized (light by default, dark mode too)
  //   'reveal/white'          reveal.js built-in theme (black, league, moon, dracula …)
  //   'themes/my'             your own theme = themes/my/my.css (relative to index.html. Images and fonts in the same folder)
  //   ['ember', 'extra']      several (later wins). Usually one is enough.
  theme: 'ember',

  // Light/dark mode. Only meaningful when the theme supports it (otherwise ignored and the theme stays as is).
  // If the theme declares its supported modes with --deck-modes, the helper panel (E key) shows a toggle.
  //   'dark' | 'light'   fixed
  //   'auto'             decided by the OS setting (prefers-color-scheme) when opened (doesn't follow OS changes during the talk)
  //   (unset)            no mode → the theme's default look. The default theme is dark
  // Priority: URL ?mode= > front matter mode > this value. Set as <html data-mode="dark|light"> (docs/styling.md).
  // mode: 'auto',

  // Extra CSS files. Merged with css in front matter (the same file only once). Loaded after the theme, so they override it.
  // CSS that needs font files or images (url(…)) should be a file (they go inside when packing).
  css: [],
  // css: ['themes/fonts.css', '/themes/my-overrides.css'],

  // CSS text as is. Merged with style in front matter. Added after the css files.
  // Handy for changing a few variables like colors, fonts or sizes (variable list: top of css/base.css, fonts: docs/fonts.md).
  // Note: url(…) written here doesn't go inside when packing. If you need a file, use css.
  // style: ':root { --accent: #c92000; --r-main-font-size: 40px; }',
  // style: `
  //   :root { --r-main-font: Georgia, serif; }
  //   .reveal h2 { letter-spacing: 0.05em; }
  // `,

  // Plugins. Merged with plugins in front matter.
  //   'grid'                     name only → deckmd/plugins/grid/grid.js
  //   '/plugins/my/my.js'        path → relative to index.html
  plugins: [],
  // plugins: ['grid'],

  // Slide size 'widthxheight'. size in front matter wins; otherwise this value. CSS px are relative to this size too (44px text = for 1920 width).
  size: '1920x1080',
  // size: '1280x720',

  // How to split slides. URL ?split= comes first, then front matter, then this value. Leave empty for automatic:
  //   'headings'  split by headings (#, ##, ###) (default when there is no --- at all)
  //   'rules'     split by --- lines (default when there is a ---)
  split: null,
  // split: 'rules',

  // With split: 'headings', the target number of lines per slide (beyond it, a "(cont.)" slide). URL ?lines= > front matter > this value.
  lines: 12,

  // Tier for slides with no tier. ?core (short version) keeps only slides whose tier is core.
  //   'core'     slides with no tier stay in the short version. Just add tier: backup etc. to the ones to drop
  //   'none'     slides with no tier are dropped. Add tier: core to the ones to keep (any non-core value like 'backup' works the same)
  // If there are no core slides at all, ?core shows everything (with a console notice). URL ?defaultTier= > front matter > this value.
  defaultTier: 'core',

  // reveal.js config (https://revealjs.com/config/). Goes on top of deck.js's defaults.
  // Merged one level deep with reveal in front matter (front matter wins on the same key).
  // Already set by deck.js: margin 0.04, hash true, center true, transition 'fade', transitionSpeed 'fast',
  //   backgroundTransition 'none', autoAnimateDuration 0.8, slideNumber (current / total), width·height (from size).
  // Note: setting plugins here replaces the notes and highlight plugins deck.js adds. Don't.
  reveal: {},
  // reveal: {
  //   transition: 'slide',        // none | fade | slide | convex | concave | zoom
  //   slideNumber: false,         // hide slide numbers
  //   progress: false,            // hide the progress bar
  //   controls: false,            // hide the arrows
  //   autoSlide: 0,               // auto-advance (ms). 0 = off
  //   loop: false,
  // },

};

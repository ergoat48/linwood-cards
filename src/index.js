/* Linwood cards — every card that goes into the bundle (dist/linwood-cards.js), in this order.
 * Add a new card here (one line) and it ships with the next deploy. Each card runs in its own scope inside the bundle,
 * so an error in one can't stop the others. Theater and TV wait for the Kit and the Apple TV card themselves. */
export const files = [
  'linwood-kit.js',
  'linwood-appletv-card.js',
  'linwood-theater-card.js',
  'linwood-tv-card.js',
  'linwood-climate-card.js',
  'linwood-security-card.js',
  'linwood-weather-card.js',
  'linwood-calendar-card.js',
  'linwood-plant-card.js',
  'linwood-jump-bar.js',
  'linwood-shell.js',
];

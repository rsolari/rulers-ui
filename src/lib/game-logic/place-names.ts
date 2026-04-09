const PREFIXES = [
  'Ash', 'Alder', 'Amber', 'Black', 'Bright', 'Broad', 'Briar',
  'Crag', 'Clear', 'Cold', 'Copper', 'Crown', 'Dark', 'Dawn',
  'Dew', 'Drift', 'Eagle', 'East', 'Elder', 'Elm', 'Ever',
  'Fair', 'Falcon', 'Fern', 'Fire', 'Frost', 'Gold', 'Granite',
  'Green', 'Grey', 'Hawk', 'Hazel', 'Heath', 'High', 'Holly',
  'Horn', 'Iron', 'Ivory', 'Jade', 'Keen', 'King', 'Lake',
  'Lark', 'Leaf', 'Lion', 'Long', 'Maple', 'Mist', 'Moon',
  'Moss', 'Night', 'North', 'Oak', 'Old', 'Owl', 'Pine',
  'Rain', 'Raven', 'Red', 'Ridge', 'River', 'Rock', 'Rose',
  'Rust', 'Salt', 'Shadow', 'Silver', 'Snow', 'South', 'Star',
  'Steel', 'Stone', 'Storm', 'Summer', 'Sun', 'Swan', 'Swift',
  'Thorn', 'Timber', 'Tower', 'West', 'White', 'Wild', 'Willow',
  'Wind', 'Winter', 'Wolf', 'Wren',
];

const SUFFIXES = [
  'barrow', 'borough', 'bridge', 'brook', 'burg', 'bury',
  'cairn', 'castle', 'cliff', 'crest', 'cross', 'dale',
  'dell', 'fall', 'fen', 'field', 'ford', 'forge',
  'fort', 'gate', 'glen', 'guard', 'hall', 'haven',
  'hearth', 'helm', 'hill', 'hold', 'hollow', 'holt',
  'keep', 'lake', 'land', 'leigh', 'march', 'mead',
  'mere', 'mill', 'moor', 'mouth', 'peak', 'point',
  'port', 'reach', 'rest', 'ridge', 'rock', 'run',
  'shire', 'shore', 'spire', 'stead', 'stone', 'thorpe',
  'vale', 'view', 'wall', 'ward', 'watch', 'water',
  'well', 'wick', 'wood', 'worth', 'wynd',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePlaceName(): string {
  return pick(PREFIXES) + pick(SUFFIXES);
}

export const INTENSITY_ORDER = ["LOW", "MODERATE", "HIGH"] as const;
export const DEFAULT_COUNTRY_CODE = "IN";
export const CURRENCY_INR = "INR";
export const CACHE_TTL_MS = 60_000;
export const CACHE_MAX_ENTRIES = 500;
export const MAX_CANDIDATES = 200;
export const PROVIDER_PAGE_SIZE = 100;
export const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;
export const PROVIDER_RATE_LIMIT_MS = 250;
export const PROVIDER_CONCURRENCY = 3;

export const PLACE_DESCRIPTIONS: ReadonlyArray<readonly [string[], string]> = [
  [["comedy"], "A comedy venue for stand-up shows and live laughs."],
  [["park", "garden"], "A green park for peaceful walks and outdoor time."],
  [["sport", "stadium"], "A sports venue for games, training, and matches."],
  [["museum", "historic"], "A museum for local history, culture, and exhibits."],
  [["catering", "restaurant", "cafe"], "A place to enjoy meals, snacks, and drinks."],
  [["entertainment"], "A local entertainment venue for live shows and gatherings."],
  [["tourism", "attraction"], "A local attraction for sightseeing and memorable visits."],
];

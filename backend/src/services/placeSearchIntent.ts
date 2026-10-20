export type PlaceSearchIntent = {
  terms: string[];
  categories: string[];
  matchCategories: string[];
};

const intents: Array<{ pattern: RegExp; terms: string[]; categories: string[] }> = [
  { pattern: /\blaser\s*(tag|game|games)?\b/i, terms: ["laser", "laser tag", "laser game", "laser games", "amusement arcade", "activity park"], categories: ["entertainment.activity_park", "entertainment.amusement_arcade", "entertainment.escape_game"] },
  { pattern: /\b(cycl(?:e|es|ing)|bicycl(?:e|es)|bik(?:e|es|ing))\b/i, terms: ["cycle", "cycling", "bicycle", "bike", "biking"], categories: ["rental.bicycle", "commercial.outdoor_and_sport.bicycle", "sport", "highway.cycleway", "highway.path"] },
  { pattern: /\b(mystery\s*rooms?|escape\s*rooms?|escape\s*games?|puzzle\s*rooms?)\b/i, terms: ["mystery room", "escape room", "escape game", "puzzle room", "escape", "puzzle"], categories: ["entertainment.escape_game", "leisure"] },
  { pattern: /\b(movie|movies|film|films|cinema|cinemas|theatre|theatres|theater|theaters)\b/i, terms: ["movie", "film", "cinema", "theatre", "theater"], categories: ["entertainment.cinema", "entertainment.culture"] },
  { pattern: /\b(sport|sports|football|soccer|cricket|tennis|badminton|basketball|gym|fitness|swimming)\b/i, terms: ["sport", "football", "soccer", "cricket", "tennis", "badminton", "basketball", "gym", "fitness", "swimming"], categories: ["sport"] },
  { pattern: /\b(park|parks|walk|walking|garden|gardens|nature|hike|hiking|trail|trails)\b/i, terms: ["park", "garden", "nature", "walk", "hike", "trail"], categories: ["leisure.park", "leisure.park.garden", "leisure.park.nature_reserve"] },
  { pattern: /\b(food|restaurant|restaurants|eat|dining|cafe|cafes|coffee|bakery|bakeries)\b/i, terms: ["food", "restaurant", "dining", "cafe", "coffee", "bakery"], categories: ["catering"] },
  { pattern: /\b(stand\s?up|comedy|comedian|comedians|improv)\b/i, terms: ["stand up", "comedy", "comedian", "improv"], categories: ["entertainment.culture"] },
  { pattern: /\b(museum|museums|history|exhibition|gallery|galleries|art)\b/i, terms: ["museum", "history", "exhibition", "gallery", "art"], categories: ["entertainment.museum", "entertainment.culture", "tourism"] },
  { pattern: /\b(bowling|bowling alley)\b/i, terms: ["bowling", "bowling alley"], categories: ["entertainment"] },
  { pattern: /\b(arcade|arcades|games|gaming)\b/i, terms: ["arcade", "gaming", "games", "amusement arcade", "activity park", "escape game", "bowling alley", "miniature golf"], categories: ["entertainment.activity_park", "entertainment.amusement_arcade", "entertainment.bowling_alley", "entertainment.escape_game", "entertainment.miniature_golf"] },
  { pattern: /\b(music|concert|concerts|live music|gig|gigs)\b/i, terms: ["music", "concert", "live music", "gig"], categories: ["entertainment"] },
  { pattern: /\b(dance|dancing|club|clubs|nightlife)\b/i, terms: ["dance", "dancing", "club", "nightlife"], categories: ["entertainment"] },
  { pattern: /\b(yoga|meditation|wellness|spa)\b/i, terms: ["yoga", "meditation", "wellness", "spa"], categories: ["leisure"] },
  { pattern: /\b(amusement park|theme park|rides)\b/i, terms: ["amusement park", "theme park", "rides"], categories: ["entertainment"] },
  { pattern: /\b(zoo|aquarium|wildlife|animals)\b/i, terms: ["zoo", "aquarium", "wildlife", "animals"], categories: ["entertainment", "tourism"] },
];

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function placeSearchIntent(query: string): PlaceSearchIntent {
  const normalized = normalize(query);
  const intent = intents.find(({ pattern }) => pattern.test(query));
  const terms = intent?.terms ?? [normalized];
  return {
    terms: [...new Set(terms.map(normalize).filter(Boolean))],
    categories: intent?.categories ?? [],
    matchCategories: intent?.categories.filter((category) => category.includes(".")) ?? [],
  };
}

export function matchesPlaceSearchText(query: string, values: Array<string | null | undefined>) {
  const { terms } = placeSearchIntent(query);
  const text = normalize(values.filter(Boolean).join(" "));
  return terms.some((term) => text.includes(term));
}

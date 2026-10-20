import { CURRENCY_INR, INTENSITY_ORDER } from "./places.constants.js";
import { placeSearchIntent } from "./placeSearchIntent.js";
import { finiteNumber } from "./places.provider.js";
import type { NearbyExperience, ProviderPlace, ScoredPlace, Search } from "./places.types.js";

function distanceKm(latitude: number, longitude: number, centerLatitude: number, centerLongitude: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(centerLatitude - latitude);
  const dLon = radians(centerLongitude - longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(centerLatitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasValue(value: unknown): boolean {
  return typeof value === "string"
    ? Boolean(value.trim())
    : typeof value === "object" && value !== null
      && Object.values(value).some((item) => typeof item === "string" && Boolean(item.trim()));
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

function intensityValue(value: unknown): (typeof INTENSITY_ORDER)[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase();
  return INTENSITY_ORDER.find((intensity) => intensity === normalized) ?? null;
}

/** Calculate distance and provider popularity once for a place. */
export function scorePlace(place: ProviderPlace, center: { lat: number; lon: number } | undefined): ScoredPlace {
  const properties = place.properties ?? {};
  const latitude = finiteNumber(properties.lat);
  const longitude = finiteNumber(properties.lon);
  const distance = latitude === null || longitude === null || !center
    ? null
    : distanceKm(latitude, longitude, center.lat, center.lon);
  const wiki = properties.wiki_and_media;
  const wikiRecord = recordValue(wiki);
  const hasWiki = hasValue(properties.wikidata) || hasValue(properties.wikipedia)
    || hasValue(wikiRecord?.wikidata) || hasValue(wikiRecord?.wikipedia);
  const popularityScore = (hasWiki ? 5 : 0)
    + (hasValue(properties.website) ? 3 : 0)
    + (hasValue(properties.brand) ? 2 : 0)
    + (hasValue(properties.opening_hours) ? 1 : 0)
    + (hasValue(properties.phone) ? 1 : 0);
  return { place, distanceKm: distance, popularityScore };
}

type FilteredPlace = {
  record: NearbyExperience;
  score: number;
};

/** Apply all place filters once and return the ranked record metadata. */
export function filterPlace(candidate: ScoredPlace, record: Awaited<ReturnType<typeof import("../config/db.js").prisma.experience.findMany>>[number], input: Search): FilteredPlace | null {
  const properties = candidate.place.properties ?? {};
  const keywordIntent = input.keyword ? placeSearchIntent(input.keyword) : undefined;
  const name = properties.name;
  const categories = Array.isArray(properties.categories)
    ? properties.categories.filter((category): category is string => typeof category === "string")
    : [];
  const searchText = [typeof name === "string" || typeof name === "number" ? String(name) : "", ...categories,
    typeof properties.formatted === "string" ? properties.formatted : ""]
    .join(" ").toLowerCase().replace(/[\s_.-]+/g, " ");
  const terms = keywordIntent?.terms ?? [];
  const matchesKeyword = !input.keyword || terms.some((term) => searchText.includes(term.replace(/[\s_.-]+/g, " ")));
  const matchesCategory = !input.category || !categories.length || categories.some((category) =>
    category.toLowerCase() === input.category || category.toLowerCase().startsWith(`${input.category}.`));
  const keywordCategoryMatch = Boolean(keywordIntent?.matchCategories.some((category) =>
    categories.some((placeCategory) => placeCategory.toLowerCase().startsWith(category.toLowerCase())),
  ));
  if (input.keyword && !matchesKeyword && !keywordCategoryMatch) return null;
  if (!matchesCategory) return null;
  if (candidate.distanceKm !== null && candidate.distanceKm > input.radiusKm) return null;

  const missingFields: string[] = [];
  const matchedFilters: string[] = [];
  let relevance = 0;
  if (record.priceMax === null) missingFields.push("price");
  if (record.durationMins === null) missingFields.push("duration");
  if (record.intensity === null) missingFields.push("intensity");
  if (record.setting === null) missingFields.push("setting");
  if (record.category === "Place") missingFields.push("category");
  if (candidate.distanceKm === null) missingFields.push("distance");
  if (input.keyword) { matchedFilters.push("keyword"); relevance += 2; }
  if (input.category) {
    if (record.category === "Place") missingFields.push("category");
    else if (!record.category.toLowerCase().startsWith(input.category.toLowerCase())) return null;
    else { matchedFilters.push("category"); relevance += 1; }
  }
  if (input.budget !== undefined) {
    const price = finiteNumber(properties.price_max) ?? finiteNumber(properties.price) ?? record.priceMax;
    const currency = typeof properties.currency === "string" ? properties.currency : record.currency;
    if (price === null || currency !== CURRENCY_INR) missingFields.push("price");
    else if (price > input.budget) return null;
    else { matchedFilters.push("budget"); relevance += 1; }
  }
  if (input.duration !== undefined) {
    const duration = finiteNumber(properties.duration_mins) ?? finiteNumber(properties.duration) ?? record.durationMins;
    if (duration === null) missingFields.push("duration");
    else if (duration > input.duration) return null;
    else { matchedFilters.push("duration"); relevance += 1; }
  }
  if (input.intensity) {
    const intensity = intensityValue(properties.intensity) ?? record.intensity;
    if (intensity === null) missingFields.push("intensity");
    else if (INTENSITY_ORDER.indexOf(intensity) > INTENSITY_ORDER.indexOf(input.intensity)) return null;
    else { matchedFilters.push("intensity"); relevance += 1; }
  }
  if (input.setting) {
    const setting = typeof properties.setting === "string" ? properties.setting.toUpperCase() : record.setting;
    if (setting === null) missingFields.push("setting");
    else if (setting !== "EITHER" && setting !== input.setting) return null;
    else { matchedFilters.push("setting"); relevance += 1; }
  }
  const uniqueMissingFields = [...new Set(missingFields)];
  const score = relevance + candidate.popularityScore
    + (candidate.distanceKm === null ? -20 : -candidate.distanceKm * 0.05)
    - uniqueMissingFields.length * 0.5;
  return {
    record: { ...record, distanceKm: candidate.distanceKm, popularityScore: candidate.popularityScore, missingFields: uniqueMissingFields, matchedFilters },
    score,
  };
}

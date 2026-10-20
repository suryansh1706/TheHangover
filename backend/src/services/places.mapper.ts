import { PLACE_DESCRIPTIONS } from "./places.constants.js";
import { finiteNumber } from "./places.provider.js";
import type { PlaceData, ProviderPlace } from "./places.types.js";

function descriptionFor(categories: string[]): string {
  const categoryText = categories.join(" ").toLowerCase();
  return PLACE_DESCRIPTIONS.find(([keywords]) => keywords.some((keyword) => categoryText.includes(keyword)))?.[1]
    ?? "A nearby place for local activities and visits.";
}

/** Convert a Geoapify feature into the database's place shape. */
export function placeData(place: ProviderPlace): PlaceData | null {
  const properties = place.properties ?? {};
  const rawName = properties.name;
  if (typeof rawName !== "string" && typeof rawName !== "number") return null;
  const name = String(rawName).trim();
  if (!name) return null;
  const categories = Array.isArray(properties.categories)
    ? properties.categories.filter((category): category is string => typeof category === "string")
      .map((category) => category.trim()).filter(Boolean)
    : [];
  const formatted = typeof properties.formatted === "string" ? properties.formatted : null;
  const website = typeof properties.website === "string" ? properties.website : null;
  const rawPlaceId = typeof properties.place_id === "string" ? properties.place_id.trim() : "";
  const latitude = finiteNumber(properties.lat);
  const longitude = finiteNumber(properties.lon);
  const placeId = rawPlaceId || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${latitude ?? ""}-${longitude ?? ""}`;
  return {
    slug: `geoapify-${placeId}`,
    name,
    description: descriptionFor(categories),
    category: categories[0] ?? "Place",
    tags: categories,
    priceMin: null,
    priceMax: null,
    currency: null,
    locationName: formatted,
    latitude,
    longitude,
    durationMins: null,
    setting: null,
    intensity: null,
    socialLevel: null,
    adventureLevel: null,
    source: "Geoapify (OpenStreetMap)",
    sourceUrl: website,
    bookingUrl: website,
    eventStartsAt: null,
    eventLocalDate: null,
    eventLocalTime: null,
    eventTimeZone: null,
    lastVerifiedAt: new Date(),
    active: true,
  };
}

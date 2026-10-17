import { z } from "zod";
import { prisma } from "../config/db.js";

const searchSchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  size: z.coerce.number().int().min(1).max(100).default(30),
}).refine((query) => Boolean(query.keyword || query.city), "Provide a search term or city");

type Search = z.infer<typeof searchSchema>;
type ProviderPlace = {
  properties?: {
    place_id?: string;
    name?: string;
    categories?: string[];
    formatted?: string;
    website?: string;
    lat?: number;
    lon?: number;
  };
};

export interface EventSearchProvider {
  search(input: Search): Promise<ProviderPlace[]>;
}

const placeCategories = ["entertainment", "leisure", "catering", "sport", "tourism"];

class GeoapifyProvider implements EventSearchProvider {
  async search(input: Search): Promise<ProviderPlace[]> {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) throw new Error("EVENT_PROVIDER_NOT_CONFIGURED");

    const location = input.city ?? input.keyword;
    if (!location) return [];

    const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
    geocodeUrl.searchParams.set("text", location);
    geocodeUrl.searchParams.set("format", "json");
    geocodeUrl.searchParams.set("type", "city");
    geocodeUrl.searchParams.set("limit", "1");
    geocodeUrl.searchParams.set("filter", `countrycode:${(input.countryCode ?? "IN").toLowerCase()}`);
    geocodeUrl.searchParams.set("apiKey", apiKey);

    const geocodeResponse = await fetch(geocodeUrl, { signal: AbortSignal.timeout(10_000) });
    if (!geocodeResponse.ok) throw new Error("EVENT_PROVIDER_REQUEST_FAILED");
    const geocodePayload: unknown = await geocodeResponse.json();
    const geocodeResults = (geocodePayload as { results?: Array<{ lat?: number; lon?: number }> } | null)?.results;
    const center = geocodeResults?.[0];
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon))
      throw new Error("EVENT_LOCATION_NOT_FOUND");
    console.warn("[Geoapify] Geocoded center", { city: location, lat: center.lat, lon: center.lon });

    const placesUrl = new URL("https://api.geoapify.com/v2/places");
    placesUrl.searchParams.set("categories", placeCategories.join(","));
    placesUrl.searchParams.set("filter", `circle:${center.lon},${center.lat},10000`);
    placesUrl.searchParams.set("bias", `proximity:${center.lon},${center.lat}`);
    placesUrl.searchParams.set("limit", "100");
    placesUrl.searchParams.set("apiKey", apiKey);
    const safePlacesUrl = new URL(placesUrl);
    safePlacesUrl.searchParams.delete("apiKey");
    console.warn("[Geoapify] Places request URL", safePlacesUrl.toString());

    const placesResponse = await fetch(placesUrl, { signal: AbortSignal.timeout(10_000) });
    if (!placesResponse.ok) throw new Error("EVENT_PROVIDER_REQUEST_FAILED");
    const placesPayload: unknown = await placesResponse.json();
    const features = (placesPayload as { features?: ProviderPlace[] } | null)?.features;
    const results = Array.isArray(features) ? features : [];
    console.warn("[Geoapify] Places feature count", results.length);
    if (!input.keyword) return results;

    const keyword = input.keyword.toLocaleLowerCase();
    const matchingResults = results.filter((place) => {
      const properties = place.properties;
      return properties?.name?.toLocaleLowerCase().includes(keyword)
        || properties?.categories?.some((category) => category.toLocaleLowerCase().includes(keyword));
    });
    return matchingResults.length ? matchingResults : results;
  }
}

const provider: EventSearchProvider = new GeoapifyProvider();
let providerQueue = Promise.resolve();
let lastProviderCall = 0;
const cache = new Map<string, { expiresAt: number; records: Awaited<ReturnType<typeof prisma.experience.findMany>> }>();

function placeData(place: ProviderPlace) {
  const properties = place.properties;
  const name = properties?.name?.trim();
  if (!name) return null;

  const categories = properties?.categories ?? [];
  const latitude = properties?.lat;
  const longitude = properties?.lon;
  const placeId = properties?.place_id ?? `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${latitude ?? ""}-${longitude ?? ""}`;
  return {
    slug: `geoapify-${placeId}`,
    name,
    description: `${name} is listed on OpenStreetMap. Check the listing for current details.`,
    category: categories[0] ?? "Place",
    tags: categories,
    priceMin: null,
    priceMax: null,
    currency: null,
    locationName: properties?.formatted ?? null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    durationMins: null,
    setting: null,
    intensity: null,
    socialLevel: null,
    adventureLevel: null,
    source: "Geoapify (OpenStreetMap)",
    sourceUrl: properties?.website ?? null,
    bookingUrl: properties?.website ?? null,
    eventStartsAt: null,
    eventLocalDate: null,
    eventLocalTime: null,
    eventTimeZone: null,
    lastVerifiedAt: new Date(),
    isSample: false,
    active: true,
  };
}

export async function searchAndStoreEvents(rawQuery: unknown) {
  const query = searchSchema.parse(rawQuery);
  const cacheKey = JSON.stringify(query);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.records;
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  const previous = providerQueue;
  providerQueue = next;
  await previous;
  const delay = Math.max(0, 250 - (Date.now() - lastProviderCall));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  let places: ProviderPlace[];
  try {
    places = await provider.search(query);
    lastProviderCall = Date.now();
  } finally { release(); }
  const rows = places.map(placeData).filter((row): row is NonNullable<typeof row> => row !== null);
  console.warn("[Geoapify] Named places ready to upsert", rows.length);
  await Promise.all(rows.map((row) => prisma.experience.upsert({ where: { slug: row.slug }, create: row, update: row })));
  const records = await prisma.experience.findMany({ where: { slug: { in: rows.map((row) => row.slug) } }, orderBy: { eventStartsAt: "asc" } });
  console.warn("[Geoapify] Places returned after upsert", records.length);
  // Empty searches should not hide newly available provider results for the full cache window.
  if (records.length > 0) cache.set(cacheKey, { expiresAt: Date.now() + 60_000, records });
  if (cache.size > 500) {
    const now = Date.now();
    for (const [key, value] of cache) if (value.expiresAt <= now) cache.delete(key);
    while (cache.size > 500) cache.delete(cache.keys().next().value!);
  }
  return records;
}

export function eventSearchErrorCode(error: unknown) {
  if (error instanceof Error && error.message === "EVENT_PROVIDER_NOT_CONFIGURED") return "NOT_CONFIGURED";
  if (error instanceof Error && error.message === "EVENT_PROVIDER_REQUEST_FAILED") return "UPSTREAM_FAILED";
  if (error instanceof Error && error.message === "EVENT_LOCATION_NOT_FOUND") return "LOCATION_NOT_FOUND";
  return null;
}

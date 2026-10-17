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
    lat?: number;
    lon?: number;
  };
};

export interface EventSearchProvider {
  search(input: Search): Promise<ProviderPlace[]>;
}

const placeCategories = ["entertainment", "leisure", "catering", "sport", "tourism"];

function categoriesForKeyword(keyword?: string) {
  const value = keyword?.toLowerCase() ?? "";
  if (/\b(food|restaurant|cafe|coffee|bar|dining|eat)\b/.test(value)) return ["catering"];
  if (/\b(sport|sports|fitness|gym|swim|cycling|karting|climb)\b/.test(value)) return ["sport", "leisure"];
  if (/\b(park|relax|spa|garden|picnic)\b/.test(value)) return ["leisure", "tourism"];
  if (/\b(tour|tourism|sight|attraction|historic|monument)\b/.test(value)) return ["tourism"];
  if (/\b(museum|cinema|movie|arcade|game|bowling|music|art|concert|escape|theatre|theater|zoo|aquarium)\b/.test(value)) {
    return ["entertainment"];
  }
  return placeCategories;
}

class GeoapifyProvider implements EventSearchProvider {
  async search(input: Search): Promise<ProviderPlace[]> {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) throw new Error("EVENT_PROVIDER_NOT_CONFIGURED");

    const location = input.city ?? input.keyword;
    if (!location) return [];

    const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
    geocodeUrl.searchParams.set("text", location);
    geocodeUrl.searchParams.set("format", "json");
    geocodeUrl.searchParams.set("limit", "1");
    geocodeUrl.searchParams.set("filter", `countrycode:${(input.countryCode ?? "IN").toLowerCase()}`);
    geocodeUrl.searchParams.set("apiKey", apiKey);

    const geocodeResponse = await fetch(geocodeUrl, { signal: AbortSignal.timeout(10_000) });
    if (!geocodeResponse.ok) throw new Error("EVENT_PROVIDER_REQUEST_FAILED");
    const geocodePayload: unknown = await geocodeResponse.json();
    const geocodeResults = (geocodePayload as { results?: Array<{ lat?: number; lon?: number }> } | null)?.results;
    const center = geocodeResults?.[0];
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return [];

    const categories = categoriesForKeyword(input.keyword);
    const placesUrl = new URL("https://api.geoapify.com/v2/places");
    placesUrl.searchParams.set("categories", categories.join(","));
    placesUrl.searchParams.set("filter", `circle:${center.lon},${center.lat},10000`);
    placesUrl.searchParams.set("limit", "30");
    if (input.keyword && categories.length === placeCategories.length)
      placesUrl.searchParams.set("name", input.keyword);
    placesUrl.searchParams.set("apiKey", apiKey);

    const placesResponse = await fetch(placesUrl, { signal: AbortSignal.timeout(10_000) });
    if (!placesResponse.ok) throw new Error("EVENT_PROVIDER_REQUEST_FAILED");
    const placesPayload: unknown = await placesResponse.json();
    const features = (placesPayload as { features?: ProviderPlace[] } | null)?.features;
    return Array.isArray(features) ? features : [];
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
    sourceUrl: null,
    bookingUrl: null,
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
  await Promise.all(rows.map((row) => prisma.experience.upsert({ where: { slug: row.slug }, create: row, update: row })));
  const records = await prisma.experience.findMany({ where: { slug: { in: rows.map((row) => row.slug) } }, orderBy: { eventStartsAt: "asc" } });
  cache.set(cacheKey, { expiresAt: Date.now() + 60_000, records });
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
  return null;
}

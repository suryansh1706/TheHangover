import { z } from "zod";
import { prisma } from "../config/db.js";

const searchSchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(10),
  category: z.enum(["entertainment", "leisure", "catering", "sport", "tourism"]).optional(),
  budget: z.coerce.number().int().min(0).optional(),
  setting: z.enum(["INDOOR", "OUTDOOR"]).optional(),
  intensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
  size: z.coerce.number().int().min(1).max(100).default(30),
}).refine((query) => (query.latitude === undefined) === (query.longitude === undefined), "Provide latitude and longitude together")
  .refine((query) => Boolean(query.city || query.latitude !== undefined), "Provide a city or location");

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
    distanceKm?: number;
  };
};

export interface EventSearchProvider {
  search(input: Search): Promise<ProviderPlace[]>;
}

const placeCategories = ["entertainment", "leisure", "catering", "sport", "tourism"];

function distanceKm(latitude: number, longitude: number, centerLatitude: number, centerLongitude: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(centerLatitude - latitude);
  const dLon = radians(centerLongitude - longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(centerLatitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class GeoapifyProvider implements EventSearchProvider {
  async search(input: Search): Promise<ProviderPlace[]> {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) throw new Error("EVENT_PROVIDER_NOT_CONFIGURED");

    let center: { lat: number; lon: number } | undefined;
    if (input.city) {
      const location = input.city;
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
      const result = (geocodePayload as { results?: Array<{ lat?: number; lon?: number }> } | null)?.results?.[0];
      if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lon))
        throw new Error("EVENT_LOCATION_NOT_FOUND");
      center = { lat: result.lat!, lon: result.lon! };
      console.warn("[Geoapify] Geocoded center", { city: location, lat: center.lat, lon: center.lon });
    } else if (input.latitude !== undefined && input.longitude !== undefined) {
      center = { lat: input.latitude, lon: input.longitude };
    }
    if (!center) return [];

    const placesUrl = new URL("https://api.geoapify.com/v2/places");
    const categories = input.category ? [input.category] : placeCategories;
    placesUrl.searchParams.set("categories", categories.join(","));
    placesUrl.searchParams.set("filter", `circle:${center.lon},${center.lat},${Math.round(input.radiusKm * 1000)}`);
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
    const centerLat = center.lat;
    const centerLon = center.lon;
    const rankedResults = results
      .map((place) => {
        const latitude = place.properties?.lat;
        const longitude = place.properties?.lon;
        const distance = Number.isFinite(latitude) && Number.isFinite(longitude)
          ? distanceKm(latitude!, longitude!, centerLat, centerLon)
          : Number.POSITIVE_INFINITY;
        return { place: { ...place, properties: { ...place.properties, distanceKm: Number.isFinite(distance) ? distance : undefined } }, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .map(({ place }) => place);
    if (!input.keyword) return rankedResults;

    const keyword = input.keyword.toLocaleLowerCase();
    const matchingResults = rankedResults.filter((place) => {
      const properties = place.properties;
      return properties?.name?.toLocaleLowerCase().includes(keyword)
        || properties?.categories?.some((value) => value.toLocaleLowerCase().includes(keyword));
    });
    return matchingResults.length ? matchingResults : rankedResults;
  }
}

const provider: EventSearchProvider = new GeoapifyProvider();
let providerQueue = Promise.resolve();
let lastProviderCall = 0;
type NearbyExperience = Awaited<ReturnType<typeof prisma.experience.findMany>>[number] & { distanceKm: number | null };
const cache = new Map<string, { expiresAt: number; records: NearbyExperience[] }>();

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
  const rows = places.map((place) => {
    const data = placeData(place);
    return data ? { data, distanceKm: place.properties?.distanceKm ?? null } : null;
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  console.warn("[Geoapify] Named places ready to upsert", rows.length);
  await Promise.all(rows.map(({ data }) => prisma.experience.upsert({ where: { slug: data.slug }, create: data, update: data })));
  const found = rows.length
    ? await prisma.experience.findMany({ where: { slug: { in: rows.map(({ data }) => data.slug) } } })
    : [];
  const recordsBySlug = new Map(found.map((record) => [record.slug, record]));
  let records = rows.flatMap(({ data, distanceKm }) => {
    const record = recordsBySlug.get(data.slug);
    return record ? [{ ...record, distanceKm }] : [];
  });
  if (query.budget !== undefined) records = records.filter((record) => record.priceMax !== null && record.currency === "INR" && record.priceMax <= query.budget!);
  if (query.setting) records = records.filter((record) => record.setting === query.setting || record.setting === "EITHER");
  if (query.intensity) records = records.filter((record) => record.intensity === query.intensity);
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

import { z } from "zod";
import { prisma } from "../config/db.js";
import { placeSearchIntent } from "./placeSearchIntent.js";

const searchSchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(10),
  category: z.enum(["entertainment", "leisure", "catering", "sport", "tourism"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).refine((query) => (query.latitude === undefined) === (query.longitude === undefined), "Provide latitude and longitude together")
  .refine((query) => Boolean(query.city || query.latitude !== undefined), "Provide a city or location");

type Search = z.infer<typeof searchSchema>;
type ProviderPlace = { properties?: Record<string, unknown> };
type NearbyExperience = Awaited<ReturnType<typeof prisma.experience.findMany>>[number] & { distanceKm: number | null };

const placeCategories = ["entertainment", "leisure", "catering", "sport", "tourism"];
const popularHangoutCategories = [
  "catering.cafe", "catering.restaurant", "catering.food_court", "catering.ice_cream",
  "entertainment.cinema", "entertainment.culture", "entertainment.amusement_arcade", "entertainment.zoo",
  "entertainment.museum", "leisure.park", "tourism.attraction", "tourism.sights",
];
const cache = new Map<string, { expiresAt: number; records: NearbyExperience[] }>();
let requestQueue: Promise<void> = Promise.resolve();
let lastProviderCall = 0;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function distanceKm(latitude: number, longitude: number, centerLatitude: number, centerLongitude: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(centerLatitude - latitude);
  const dLon = radians(centerLongitude - longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(centerLatitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function providerPlace(value: unknown): value is ProviderPlace {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchGeoapify(url: URL): Promise<Response> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("EVENT_PROVIDER_REQUEST_FAILED");
    return response;
  } catch {
    throw new Error("EVENT_PROVIDER_REQUEST_FAILED");
  }
}

async function searchGeoapifyPlaces(input: Search): Promise<ProviderPlace[]> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error("EVENT_PROVIDER_NOT_CONFIGURED");

  try {
    let center: { lat: number; lon: number; placeId?: string } | undefined;
    if (input.city) {
      const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
      geocodeUrl.searchParams.set("text", input.city);
      geocodeUrl.searchParams.set("format", "json");
      geocodeUrl.searchParams.set("type", "city");
      geocodeUrl.searchParams.set("limit", "1");
      geocodeUrl.searchParams.set("filter", `countrycode:${(input.countryCode ?? "IN").toLowerCase()}`);
      geocodeUrl.searchParams.set("apiKey", apiKey);
      const geocodePayload: unknown = await (await fetchGeoapify(geocodeUrl)).json();
      const result = (geocodePayload as { results?: Array<{ lat?: unknown; lon?: unknown; place_id?: unknown }> } | null)?.results?.[0];
      const lat = finiteNumber(result?.lat);
      const lon = finiteNumber(result?.lon);
      if (lat === null || lon === null) throw new Error("EVENT_LOCATION_NOT_FOUND");
      center = { lat, lon, placeId: typeof result?.place_id === "string" ? result.place_id : undefined };
    } else if (input.latitude !== undefined && input.longitude !== undefined) {
      center = { lat: input.latitude, lon: input.longitude };
    }
    if (!center) return [];

    const keywordIntent = input.keyword ? placeSearchIntent(input.keyword) : undefined;
    const popularMode = !input.keyword && !input.category;
    const keywordCategories = keywordIntent?.categories.filter((category) => !input.category || category === input.category || category.startsWith(`${input.category}.`));
    const circleFilter = `circle:${center.lon},${center.lat},${Math.round(input.radiusKm * 1000)}`;
    const categoryQueries = new Set<string>();
    if (keywordIntent?.categories.length) {
      if (keywordCategories?.length) categoryQueries.add(keywordCategories.join(","));
      const broadCategories = input.category
        ? input.category
        : [...new Set(keywordIntent.categories.map((category) => category.split(".")[0]))].join(",");
      if (broadCategories) categoryQueries.add(broadCategories);
    } else {
      categoryQueries.add(popularMode ? popularHangoutCategories.join(",") : input.category ?? placeCategories.join(","));
    }
    const placeBatches = await Promise.all([...categoryQueries].map(async (categories) => {
      const batch: ProviderPlace[] = [];
      for (let offset = 0; ; offset += 500) {
        const placesUrl = new URL("https://api.geoapify.com/v2/places");
        placesUrl.searchParams.set("categories", categories);
        placesUrl.searchParams.set("filter", center.placeId ? `place:${center.placeId}|${circleFilter}` : circleFilter);
        placesUrl.searchParams.set("bias", `proximity:${center.lon},${center.lat}`);
        placesUrl.searchParams.set("limit", popularMode ? "100" : "500");
        if (popularMode) placesUrl.searchParams.set("conditions", "named");
        else placesUrl.searchParams.set("offset", String(offset));
        placesUrl.searchParams.set("apiKey", apiKey);
        const payload: unknown = await (await fetchGeoapify(placesUrl)).json();
        const features = (payload as { features?: unknown } | null)?.features;
        const page = Array.isArray(features) ? features.filter(providerPlace) : [];
        batch.push(...page);
        if (popularMode) break;
        if (page.length < 500) break;
      }
      return batch;
    }));
    const uniquePlaces = new Map<string, ProviderPlace>();
    for (const place of placeBatches.flat()) {
      const placeId = place.properties?.place_id;
      const key = typeof placeId === "string" ? placeId : JSON.stringify(place.properties ?? place);
      if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
    }
    const places = [...uniquePlaces.values()];
    const rankedPlaces = places.map((place) => {
      const latitude = finiteNumber(place.properties?.lat);
      const longitude = finiteNumber(place.properties?.lon);
      const distance = latitude === null || longitude === null
        ? Number.POSITIVE_INFINITY
        : distanceKm(latitude, longitude, center!.lat, center!.lon);
      const placeProperties: Record<string, unknown> = {
        ...(place.properties ?? {}),
        distanceKm: Number.isFinite(distance) ? distance : undefined,
      };
      const properties = place.properties ?? {};
      const hasValue = (value: unknown): boolean => typeof value === "string"
        ? Boolean(value.trim())
        : typeof value === "object" && value !== null && Object.values(value).some((item) => typeof item === "string" && Boolean(item.trim()));
      const wiki = properties.wiki_and_media;
      const hasWiki = hasValue(properties.wikidata) || hasValue(properties.wikipedia)
        || (typeof wiki === "object" && wiki !== null && (hasValue((wiki as Record<string, unknown>).wikidata) || hasValue((wiki as Record<string, unknown>).wikipedia)));
      const popularity = (hasWiki ? 5 : 0)
        + (hasValue(properties.website) ? 3 : 0)
        + (hasValue(properties.brand) ? 2 : 0)
        + (hasValue(properties.opening_hours) ? 1 : 0)
        + (hasValue(properties.phone) ? 1 : 0)
        - (Number.isFinite(distance) ? distance * 0.25 : 1000);
      return {
        place: { ...place, properties: placeProperties },
        distance,
        popularity,
      };
    }).sort((a, b) => popularMode ? b.popularity - a.popularity : a.distance - b.distance).map(({ place }) => place);

    if (!input.keyword) return popularMode ? rankedPlaces.slice(0, input.limit ?? 10) : rankedPlaces;
    const matches = rankedPlaces.flatMap((place) => {
      const name = place.properties?.name;
      const categories = place.properties?.categories;
      const placeCategoryNames = Array.isArray(categories)
        ? categories.filter((category): category is string => typeof category === "string")
        : [];
      const searchText = [typeof name === "string" || typeof name === "number" ? String(name) : "", ...placeCategoryNames, typeof place.properties?.formatted === "string" ? place.properties.formatted : ""]
        .join(" ").toLocaleLowerCase().replace(/[\s_.-]+/g, " ");
      const terms = keywordIntent?.terms ?? [];
      const matchesKeyword = terms.some((term) => searchText.includes(term.replace(/[\s_.-]+/g, " ")));
      const matchesCategory = Boolean(keywordIntent?.matchCategories.some((category) =>
        placeCategoryNames.some((placeCategory) => placeCategory.toLocaleLowerCase().startsWith(category.toLocaleLowerCase())),
      ));
      return matchesKeyword || matchesCategory ? [{ place }] : [];
    });
    return matches.sort((a, b) => (finiteNumber(a.place.properties?.distanceKm) ?? Number.POSITIVE_INFINITY)
      - (finiteNumber(b.place.properties?.distanceKm) ?? Number.POSITIVE_INFINITY)).map(({ place }) => place);
  } catch (error) {
    if (error instanceof Error && ["EVENT_LOCATION_NOT_FOUND", "EVENT_PROVIDER_REQUEST_FAILED"].includes(error.message)) throw error;
    throw new Error("EVENT_PROVIDER_REQUEST_FAILED", { cause: error });
  }
}

function placeData(place: ProviderPlace) {
  const properties = place.properties ?? {};
  const rawName = properties.name;
  if (typeof rawName !== "string" && typeof rawName !== "number") return null;
  const name = String(rawName).trim();
  if (!name) return null;

  const categories = Array.isArray(properties.categories)
    ? properties.categories.filter((category): category is string => typeof category === "string").map((category) => category.trim()).filter(Boolean)
    : [];
  const formatted = typeof properties.formatted === "string" ? properties.formatted : null;
  const website = typeof properties.website === "string" ? properties.website : null;
  const rawPlaceId = typeof properties.place_id === "string" ? properties.place_id.trim() : "";
  const latitude = finiteNumber(properties.lat);
  const longitude = finiteNumber(properties.lon);
  const placeId = rawPlaceId || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${latitude ?? ""}-${longitude ?? ""}`;
  const categoryText = categories.join(" ").toLocaleLowerCase();
  const description = categoryText.includes("comedy")
    ? "A comedy venue for stand-up shows and live laughs."
    : categoryText.includes("park") || categoryText.includes("garden")
      ? "A green park for peaceful walks and outdoor time."
      : categoryText.includes("sport") || categoryText.includes("stadium")
        ? "A sports venue for games, training, and matches."
        : categoryText.includes("museum") || categoryText.includes("historic")
          ? "A museum for local history, culture, and exhibits."
          : categoryText.includes("catering") || categoryText.includes("restaurant") || categoryText.includes("cafe")
            ? "A place to enjoy meals, snacks, and drinks."
            : categoryText.includes("entertainment")
              ? "A local entertainment venue for live shows and gatherings."
              : categoryText.includes("tourism") || categoryText.includes("attraction")
                ? "A local attraction for sightseeing and memorable visits."
                : "A nearby place for local activities and visits.";
  return {
    slug: `geoapify-${placeId}`,
    name,
    description,
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

async function searchWithRateLimit(input: Search) {
  let release!: () => void;
  const previous = requestQueue;
  requestQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const waitMs = Math.max(0, 250 - (Date.now() - lastProviderCall));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastProviderCall = Date.now();
    return await searchGeoapifyPlaces(input);
  } finally {
    release();
  }
}

export async function searchAndStorePlaces(rawQuery: unknown) {
  const query = searchSchema.parse(rawQuery);
  const cacheKey = JSON.stringify(query);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.records;
  if (cached) cache.delete(cacheKey);

  let places: ProviderPlace[];
  try {
    places = await searchWithRateLimit(query);
  } catch (error) {
    console.error("Geoapify place search failed", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }

  const uniqueRows = new Map<string, { data: NonNullable<ReturnType<typeof placeData>>; distanceKm: number | null }>();
  for (const place of places) {
    const rawPlaceId = place.properties?.place_id;
    const placeId = typeof rawPlaceId === "string" || typeof rawPlaceId === "number" ? rawPlaceId : "unknown";
    try {
      const data = placeData(place);
      if (!data) {
        console.warn("Skipping invalid Geoapify place", placeId);
        continue;
      }
      if (!uniqueRows.has(data.slug)) {
        uniqueRows.set(data.slug, {
          data,
          distanceKm: finiteNumber(place.properties?.distanceKm),
        });
      }
    } catch {
      console.warn("Skipping invalid Geoapify place", placeId);
    }
  }
  const rows = [...uniqueRows.values()].slice(0, !query.keyword && !query.category ? query.limit ?? 10 : undefined);
  for (let start = 0; start < rows.length; start += 10) {
    const chunk = rows.slice(start, start + 10);
    await Promise.all(chunk.map(({ data }) => prisma.experience.upsert({ where: { slug: data.slug }, create: data, update: data })));
  }

  const found = rows.length
    ? await prisma.experience.findMany({ where: { slug: { in: rows.map(({ data }) => data.slug) } } })
    : [];
  const recordsBySlug = new Map(found.map((record) => [record.slug, record]));
  const records = rows.flatMap(({ data, distanceKm }) => {
    const record = recordsBySlug.get(data.slug);
    return record ? [{ ...record, distanceKm }] : [];
  });
  if (records.length > 0) {
    cache.set(cacheKey, { expiresAt: Date.now() + 60_000, records });
    for (const [key, value] of cache) if (value.expiresAt <= Date.now()) cache.delete(key);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
  }
  return records;
}

export function placeSearchErrorCode(error: unknown) {
  if (error instanceof Error && error.message === "EVENT_PROVIDER_NOT_CONFIGURED") return "NOT_CONFIGURED";
  if (error instanceof Error && error.message === "EVENT_PROVIDER_REQUEST_FAILED") return "UPSTREAM_FAILED";
  if (error instanceof Error && error.message === "EVENT_LOCATION_NOT_FOUND") return "LOCATION_NOT_FOUND";
  return null;
}

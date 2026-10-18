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
}).refine((query) => (query.latitude === undefined) === (query.longitude === undefined), "Provide latitude and longitude together")
  .refine((query) => Boolean(query.city || query.latitude !== undefined), "Provide a city or location");

type Search = z.infer<typeof searchSchema>;
type ProviderPlace = { properties?: Record<string, unknown> };
type NearbyExperience = Awaited<ReturnType<typeof prisma.experience.findMany>>[number] & { distanceKm: number | null };

const placeCategories = ["entertainment", "leisure", "catering", "sport", "tourism"];
const keywordCategoryRules: Array<{ pattern: RegExp; categories: string[]; matchCategories?: string[] }> = [
  {
    pattern: /\b(cycle|cycles|cycling|bicycle|bicycles|bike|bikes|biking)\b/i,
    categories: ["rental.bicycle", "commercial.outdoor_and_sport.bicycle", "sport", "highway.cycleway", "highway.path"],
    matchCategories: ["rental.bicycle", "commercial.outdoor_and_sport.bicycle", "sport.cycl", "sport.bicy", "highway.cycleway", "highway.path"],
  },
  { pattern: /\b(mystery rooms?|escape rooms?|escape games?|puzzle rooms?)\b/i, categories: ["entertainment.escape_game"] },
  { pattern: /\b(movie|movies|film|films|cinema|cinemas|theatre|theatres|theater|theaters)\b/i, categories: ["entertainment.cinema", "entertainment.culture"] },
  { pattern: /\b(sport|sports|football|soccer|cricket|tennis|badminton|basketball|gym|fitness|swimming)\b/i, categories: ["sport"] },
  { pattern: /\b(park|parks|walk|walking|garden|gardens)\b/i, categories: ["leisure.park", "leisure.garden"] },
  { pattern: /\b(food|restaurant|restaurants|eat|dining|cafe|cafes)\b/i, categories: ["catering"] },
  { pattern: /\b(stand\s?up|comedy|comedian|comedians)\b/i, categories: ["entertainment.culture"] },
  { pattern: /\b(museum|museums|history|exhibition)\b/i, categories: ["entertainment.museum", "tourism"] },
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

    const keywordRule = input.keyword
      ? keywordCategoryRules.find(({ pattern }) => pattern.test(input.keyword!))
      : undefined;
    const placesUrl = new URL("https://api.geoapify.com/v2/places");
    const keywordCategories = keywordRule?.categories.filter((category) => !input.category || category === input.category || category.startsWith(`${input.category}.`));
    const requestedCategories = keywordRule
      ? input.category && !keywordCategories?.length
        ? input.category
        : keywordCategories?.join(",") ?? keywordRule.categories.join(",")
      : input.category ?? placeCategories.join(",");
    placesUrl.searchParams.set("categories", requestedCategories);
    const circleFilter = `circle:${center.lon},${center.lat},${Math.round(input.radiusKm * 1000)}`;
    placesUrl.searchParams.set("filter", center.placeId ? `place:${center.placeId}|${circleFilter}` : circleFilter);
    placesUrl.searchParams.set("bias", `proximity:${center.lon},${center.lat}`);
    placesUrl.searchParams.set("limit", "500");
    if (input.keyword && !keywordRule) placesUrl.searchParams.set("name", input.keyword.replace(/\([^)]*\)/g, " ").trim());
    placesUrl.searchParams.set("apiKey", apiKey);
    const payload: unknown = await (await fetchGeoapify(placesUrl)).json();
    const features = (payload as { features?: unknown } | null)?.features;
    const places = Array.isArray(features) ? features.filter(providerPlace) : [];
    const rankedPlaces = places.map((place) => {
      const latitude = finiteNumber(place.properties?.lat);
      const longitude = finiteNumber(place.properties?.lon);
      const distance = latitude === null || longitude === null
        ? Number.POSITIVE_INFINITY
        : distanceKm(latitude, longitude, center!.lat, center!.lon);
      const properties: Record<string, unknown> = {
        ...(place.properties ?? {}),
        distanceKm: Number.isFinite(distance) ? distance : undefined,
      };
      return {
        place: { ...place, properties },
        distance,
      };
    }).sort((a, b) => a.distance - b.distance).map(({ place }) => place);

    if (!input.keyword) return rankedPlaces;
    const keyword = input.keyword.toLocaleLowerCase().replace(/[\s-]/g, "");
    const specificNameTerms = keywordRule
      ? (input.keyword.toLocaleLowerCase().replace(/\([^)]*\)/g, " ").match(/[a-z0-9]+/g) ?? [])
        .filter((term) => !keywordRule.pattern.test(term) && !["near", "around", "in", "at", "the", "show", "shows", "venue", "venues", "place", "places"].includes(term))
      : [];
    const matches = rankedPlaces.flatMap((place) => {
      const name = place.properties?.name;
      const categories = place.properties?.categories;
      const placeCategories = Array.isArray(categories)
        ? categories.filter((category): category is string => typeof category === "string").map((category) => category.toLocaleLowerCase())
        : [];
      if (keywordRule) {
        const acceptedCategories = keywordRule.matchCategories ?? keywordRule.categories;
        if (!placeCategories.some((category) => acceptedCategories.some((wanted) => category.startsWith(wanted)))) return [];
        const searchText = `${typeof name === "string" || typeof name === "number" ? String(name) : ""} ${typeof place.properties?.formatted === "string" ? place.properties.formatted : ""}`
          .toLocaleLowerCase().replace(/[\s-]/g, "");
        const nameMatchCount = specificNameTerms.filter((term) => searchText.includes(term)).length;
        return [{ place, nameMatchCount }];
      }
      const matchesKeyword = ((typeof name === "string" || typeof name === "number") && String(name).toLocaleLowerCase().replace(/[\s-]/g, "").includes(keyword))
        || placeCategories.some((category) => category.replace(/[\s-]/g, "").includes(keyword));
      return matchesKeyword ? [{ place, nameMatchCount: 0 }] : [];
    });
    return matches.sort((a, b) => b.nameMatchCount - a.nameMatchCount
      || (finiteNumber(a.place.properties?.distanceKm) ?? Number.POSITIVE_INFINITY)
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
  const rows = [...uniqueRows.values()].slice(0, 50);
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

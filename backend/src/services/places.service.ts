import { z } from "zod";
import { prisma } from "../config/db.js";
import { createTtlLruCache } from "./places.cache.js";
import { CACHE_MAX_ENTRIES, CACHE_TTL_MS } from "./places.constants.js";
import { placeData } from "./places.mapper.js";
import { filterPlace, scorePlace } from "./places.ranking.js";
import { searchProvider } from "./places.provider.js";
import type { NearbyExperience, Search, SearchPage } from "./places.types.js";

const searchSchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(10),
  category: z.enum(["entertainment", "leisure", "catering", "sport", "tourism"]).optional(),
  budget: z.coerce.number().int().min(0).optional(),
  intensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
  duration: z.coerce.number().int().min(1).max(1440).optional(),
  setting: z.enum(["INDOOR", "OUTDOOR"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
}).refine((query) => (query.latitude === undefined) === (query.longitude === undefined), "Provide latitude and longitude together")
  .refine((query) => Boolean(query.city || query.latitude !== undefined), "Provide a city or location");

const cache = createTtlLruCache<NearbyExperience[]>(CACHE_MAX_ENTRIES, CACHE_TTL_MS);

async function loadPlaces(query: Search): Promise<NearbyExperience[]> {
  const providerResult = await searchProvider(query);
  const candidates = providerResult.places.map((place) => ({ ...scorePlace(place, providerResult.center), data: placeData(place) }))
    .filter((candidate): candidate is typeof candidate & { data: NonNullable<typeof candidate.data> } => candidate.data !== null);
  const slugs = candidates.map(({ data }) => data.slug);
  const existing = slugs.length ? await prisma.experience.findMany({ where: { slug: { in: slugs } } }) : [];
  const existingSlugs = new Set(existing.map(({ slug }) => slug));
  const newRows = candidates.filter(({ data }) => !existingSlugs.has(data.slug)).map(({ data }) => data);
  const records = await prisma.$transaction(async (transaction) => {
    if (newRows.length) await transaction.experience.createMany({ data: newRows, skipDuplicates: true });
    return slugs.length ? transaction.experience.findMany({ where: { slug: { in: slugs } } }) : [];
  });
  const recordsBySlug = new Map(records.map((record) => [record.slug, record]));
  return candidates.flatMap((candidate) => {
    const record = recordsBySlug.get(candidate.data.slug);
    if (!record) return [];
    const filtered = filterPlace(candidate, record, query);
    return filtered ? [filtered] : [];
  }).sort((a, b) => b.score - a.score).map(({ record }) => record);
}

/** Search Geoapify, persist newly discovered places, and return a paged result. */
export async function searchAndStorePlaces(rawQuery: unknown): Promise<SearchPage> {
  const query = searchSchema.parse(rawQuery);
  const { limit = 10, offset = 0, ...filters } = query;
  const cacheKey = JSON.stringify(filters);
  let rankedRecords: NearbyExperience[];
  try {
    rankedRecords = await cache.getOrCreate(cacheKey, () => loadPlaces(query));
  } catch (error) {
    console.error("Geoapify place search failed", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
  const experiences = rankedRecords.slice(offset, offset + limit);
  const hasMore = offset + experiences.length < rankedRecords.length;
  return { experiences, hasMore, nextOffset: hasMore ? offset + experiences.length : null };
}

/** Convert an internal place-search error into the route's stable error code. */
export function placeSearchErrorCode(error: unknown): "NOT_CONFIGURED" | "UPSTREAM_FAILED" | "LOCATION_NOT_FOUND" | null {
  if (error instanceof Error && error.message === "EVENT_PROVIDER_NOT_CONFIGURED") return "NOT_CONFIGURED";
  if (error instanceof Error && error.message === "EVENT_PROVIDER_REQUEST_FAILED") return "UPSTREAM_FAILED";
  if (error instanceof Error && error.message === "EVENT_LOCATION_NOT_FOUND") return "LOCATION_NOT_FOUND";
  return null;
}

import { placeSearchIntent } from "./placeSearchIntent.js";
import {
  DEFAULT_COUNTRY_CODE,
  MAX_CANDIDATES,
  PROVIDER_CONCURRENCY,
  PROVIDER_PAGE_SIZE,
  PROVIDER_RATE_LIMIT_MS,
  PROVIDER_REQUEST_TIMEOUT_MS,
} from "./places.constants.js";
import type { ProviderPlace, Search } from "./places.types.js";

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function providerPlace(value: unknown): value is ProviderPlace {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const popularHangoutCategories = [
  "catering.cafe", "catering.restaurant", "catering.food_court", "catering.ice_cream",
  "entertainment.cinema", "entertainment.culture", "entertainment.amusement_arcade", "entertainment.zoo",
  "entertainment.museum", "leisure.park", "tourism.attraction", "tourism.sights",
];
const placeCategories = ["entertainment", "leisure", "catering", "sport", "tourism"];

type GeoapifyCenter = { lat: number; lon: number; placeId?: string };
export type ProviderSearchResult = { places: ProviderPlace[]; center: GeoapifyCenter | undefined };

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

class ProviderLimiter {
  private active = 0;
  private lastStartedAt = 0;
  private readonly waiters: Array<() => void> = [];

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= PROVIDER_CONCURRENCY) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    const waitMs = Math.max(0, PROVIDER_RATE_LIMIT_MS - (Date.now() - this.lastStartedAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.active += 1;
    this.lastStartedAt = Date.now();
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.waiters.shift()?.();
    }
  }
}

const providerLimiter = new ProviderLimiter();

async function fetchGeoapify(url: URL): Promise<Response> {
  try {
    return await providerLimiter.run(async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error("EVENT_PROVIDER_REQUEST_FAILED");
      return response;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EVENT_PROVIDER_REQUEST_FAILED") throw error;
    throw new Error("EVENT_PROVIDER_REQUEST_FAILED", { cause: error });
  }
}

/** Resolve a city name to the coordinates used for a places search. */
export async function geocodeCity(input: Search, apiKey: string): Promise<GeoapifyCenter | undefined> {
  if (!input.city) {
    if (input.latitude === undefined || input.longitude === undefined) return undefined;
    return { lat: input.latitude, lon: input.longitude };
  }
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", input.city);
  url.searchParams.set("format", "json");
  url.searchParams.set("type", "city");
  url.searchParams.set("limit", "1");
  url.searchParams.set("filter", `countrycode:${(input.countryCode ?? DEFAULT_COUNTRY_CODE).toLowerCase()}`);
  url.searchParams.set("apiKey", apiKey);
  const payload: unknown = await (await fetchGeoapify(url)).json();
  const payloadRecord = recordValue(payload);
  const results = Array.isArray(payloadRecord?.results) ? payloadRecord.results : [];
  const properties = recordValue(results[0]);
  const lat = finiteNumber(properties?.lat);
  const lon = finiteNumber(properties?.lon);
  if (lat === null || lon === null) throw new Error("EVENT_LOCATION_NOT_FOUND");
  return { lat, lon, placeId: typeof properties?.place_id === "string" ? properties.place_id : undefined };
}

/** Fetch only the provider pages needed to cover the requested result window. */
export async function fetchPlaces(input: Search, apiKey: string, center: GeoapifyCenter): Promise<ProviderPlace[]> {
  const keywordIntent = input.keyword ? placeSearchIntent(input.keyword) : undefined;
  const popularMode = !input.keyword && !input.category && input.budget === undefined
    && input.intensity === undefined && input.duration === undefined && input.setting === undefined;
  const keywordCategories = keywordIntent?.categories.filter((category) =>
    !input.category || category === input.category || category.startsWith(`${input.category}.`));
  const categoryQueries = new Set<string>();
  if (keywordIntent?.categories.length) {
    if (keywordCategories?.length) categoryQueries.add(keywordCategories.join(","));
    else if (input.category) categoryQueries.add(input.category);
    else categoryQueries.add([...new Set(keywordIntent.categories.map((category) => category.split(".")[0]))].join(","));
  } else {
    categoryQueries.add(popularMode ? popularHangoutCategories.join(",") : input.category ?? placeCategories.join(","));
  }
  const pageSize = popularMode ? PROVIDER_PAGE_SIZE : MAX_CANDIDATES;
  const pagesNeeded = Math.ceil(Math.min(MAX_CANDIDATES, Math.max(pageSize, (input.offset + (input.limit ?? 10)))) / pageSize);
  const circleFilter = `circle:${center.lon},${center.lat},${Math.round(input.radiusKm * 1000)}`;
  const batches = await Promise.all([...categoryQueries].map(async (categories) => {
    const pages = await Promise.all(Array.from({ length: pagesNeeded }, (_, pageIndex) => {
      const url = new URL("https://api.geoapify.com/v2/places");
      url.searchParams.set("categories", categories);
      url.searchParams.set("filter", center.placeId ? `place:${center.placeId}|${circleFilter}` : circleFilter);
      url.searchParams.set("bias", `proximity:${center.lon},${center.lat}`);
      url.searchParams.set("limit", String(pageSize));
      if (popularMode) url.searchParams.set("conditions", "named");
      url.searchParams.set("offset", String(pageIndex * pageSize));
      url.searchParams.set("apiKey", apiKey);
      return fetchGeoapify(url).then(async (response) => {
        const payload: unknown = await response.json();
        const features = typeof payload === "object" && payload !== null
          ? (payload as { features?: unknown }).features
          : undefined;
        return Array.isArray(features) ? features.filter(providerPlace) : [];
      });
    }));
    return pages.flat();
  }));
  return batches.flat();
}

/** Remove duplicate provider records while retaining the first provider result. */
export function dedupePlaces(places: ProviderPlace[]): ProviderPlace[] {
  const unique = new Map<string, ProviderPlace>();
  for (const place of places) {
    const properties = place.properties ?? {};
    const placeId = properties.place_id;
    const name = String(properties.name ?? "").trim().toLowerCase();
    const latitude = finiteNumber(properties.lat);
    const longitude = finiteNumber(properties.lon);
    const key = typeof placeId === "string" || typeof placeId === "number"
      ? String(placeId)
      : `${name}|${latitude ?? ""}|${longitude ?? ""}`;
    if (!unique.has(key)) unique.set(key, place);
  }
  return [...unique.values()];
}

export function searchError(error: unknown): never {
  if (error instanceof Error && ["EVENT_LOCATION_NOT_FOUND", "EVENT_PROVIDER_REQUEST_FAILED"].includes(error.message)) {
    throw error;
  }
  throw new Error("EVENT_PROVIDER_REQUEST_FAILED", { cause: error });
}

export async function searchProvider(input: Search): Promise<ProviderSearchResult> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error("EVENT_PROVIDER_NOT_CONFIGURED");
  try {
    const center = await geocodeCity(input, apiKey);
    if (!center) return { places: [], center };
    return { places: dedupePlaces(await fetchPlaces(input, apiKey, center)), center };
  } catch (error) {
    return searchError(error);
  }
}

export { finiteNumber };

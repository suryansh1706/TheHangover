import { z } from "zod";
import { prisma } from "./db.js";

const searchSchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
  size: z.coerce.number().int().min(1).max(100).default(30),
}).refine((query) => Boolean(query.keyword || query.city), "Provide a search term or city");

type Search = z.infer<typeof searchSchema>;
type ProviderEvent = {
  id?: string;
  name?: string;
  info?: string;
  pleaseNote?: string;
  url?: string;
  dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string; timezone?: string } };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string }; type?: { name?: string } }>;
  _embedded?: { venues?: Array<{ name?: string; city?: { name?: string }; country?: { countryCode?: string }; location?: { latitude?: string; longitude?: string } }> };
};

export interface EventSearchProvider {
  search(input: Search): Promise<ProviderEvent[]>;
}

class TicketmasterProvider implements EventSearchProvider {
  async search(input: Search): Promise<ProviderEvent[]> {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) throw new Error("EVENT_PROVIDER_NOT_CONFIGURED");
    const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("size", String(input.size));
    if (input.keyword) url.searchParams.set("keyword", input.keyword);
    if (input.city) url.searchParams.set("city", input.city);
    if (input.countryCode) url.searchParams.set("countryCode", input.countryCode);
    const result = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!result.ok) throw new Error("EVENT_PROVIDER_REQUEST_FAILED");
    const payload: unknown = await result.json();
    if (!payload || typeof payload !== "object") return [];
    const events = (payload as { _embedded?: { events?: ProviderEvent[] } })._embedded?.events;
    return Array.isArray(events) ? events : [];
  }
}

const provider: EventSearchProvider = new TicketmasterProvider();
let providerQueue = Promise.resolve();
let lastProviderCall = 0;
const cache = new Map<string, { expiresAt: number; records: Awaited<ReturnType<typeof prisma.experience.findMany>> }>();

function eventData(event: ProviderEvent) {
  if (!event.id || !event.name) return null;
  const venue = event._embedded?.venues?.[0];
  const start = event.dates?.start;
  const timestamp = start?.dateTime;
  const price = event.priceRanges?.[0];
  const classes = (event.classifications ?? []).flatMap((classification) => [classification.segment?.name, classification.genre?.name, classification.type?.name]).filter((value): value is string => Boolean(value));
  const category = classes[0] ?? "Live Event";
  const description = [event.info, event.pleaseNote].filter(Boolean).join(" ") || `${event.name} is a listing from Ticketmaster Discovery. Check the provider page for event details and current booking terms.`;
  const latitude = Number(venue?.location?.latitude);
  const longitude = Number(venue?.location?.longitude);
  return {
    slug: `ticketmaster-${event.id}`,
    name: event.name,
    description,
    category,
    tags: Array.from(new Set(classes)),
    priceMin: Number.isFinite(price?.min) ? Math.round(price!.min!) : null,
    priceMax: Number.isFinite(price?.max) ? Math.round(price!.max!) : null,
    currency: price?.currency ?? null,
    locationName: venue ? [venue.name, venue.city?.name, venue.country?.countryCode].filter(Boolean).join(", ") : null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    setting: null,
    intensity: null,
    source: "Ticketmaster Discovery API",
    sourceUrl: event.url ?? null,
    bookingUrl: event.url ?? null,
    eventStartsAt: timestamp && !Number.isNaN(Date.parse(timestamp)) ? new Date(timestamp) : null,
    eventLocalDate: start?.localDate ?? null,
    eventLocalTime: start?.localTime ?? null,
    eventTimeZone: start?.timezone ?? null,
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
  let events: ProviderEvent[];
  try {
    events = await provider.search(query);
    lastProviderCall = Date.now();
  } finally { release(); }
  const rows = events.map(eventData).filter((row): row is NonNullable<typeof row> => row !== null);
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

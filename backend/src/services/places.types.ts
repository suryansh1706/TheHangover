import type { Prisma } from "@prisma/client";

export type Search = {
  keyword?: string;
  city?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  category?: "entertainment" | "leisure" | "catering" | "sport" | "tourism";
  budget?: number;
  intensity?: "LOW" | "MODERATE" | "HIGH";
  duration?: number;
  setting?: "INDOOR" | "OUTDOOR";
  limit?: number;
  offset: number;
};

export type ProviderPlace = { properties?: Record<string, unknown> };

export type PlaceData = Prisma.ExperienceCreateManyInput;

export type NearbyExperience = Awaited<ReturnType<typeof import("../config/db.js").prisma.experience.findMany>>[number] & {
  distanceKm: number | null;
  popularityScore: number;
  missingFields: string[];
  matchedFilters: string[];
};

export type SearchPage = {
  experiences: NearbyExperience[];
  hasMore: boolean;
  nextOffset: number | null;
};

export type ScoredPlace = {
  place: ProviderPlace;
  distanceKm: number | null;
  popularityScore: number;
};

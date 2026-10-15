import type { GroupPreferences, Preferences } from "./types";

export const categories = ["Creative", "Adventure", "Outdoors", "Games", "Food", "Puzzle"] as const;
export const emptyPreferences: Preferences = {
  budgetPerPerson: null,
  maxDistanceKm: null,
  maxDurationMins: null,
  homeLatitude: null,
  homeLongitude: null,
  preferredTypes: [],
  dislikedTypes: [],
  preferredTags: [],
  dislikedTags: [],
  accessibility: [],
  dietaryNeeds: [],
  setting: "EITHER",
  maxIntensity: "HIGH",
  naturalLanguage: null,
};
export const emptyGroupPreferences: GroupPreferences = {
  budgetPerPerson: null,
  maxDistanceKm: null,
  homeLatitude: null,
  homeLongitude: null,
  maxDurationMins: null,
  setting: "EITHER",
  maxIntensity: "HIGH",
};

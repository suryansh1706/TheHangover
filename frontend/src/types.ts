export type Setting = "EITHER" | "INDOOR" | "OUTDOOR";
export type Intensity = "LOW" | "MODERATE" | "HIGH";
export type VoteChoice = "YES" | "MAYBE" | "NO";
export type MembershipRole = "OWNER" | "MEMBER";

export type User = { id: string; email: string; name: string };
export type Experience = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
  locationName: string | null;
  eventStartsAt: string | null;
  eventLocalDate: string | null;
  eventLocalTime: string | null;
  eventTimeZone: string | null;
  bookingUrl: string | null;
  durationMins: number | null;
  setting: string | null;
  intensity: string | null;
  adventureLevel: number | null;
  socialLevel: number | null;
  source: string;
  lastVerifiedAt: string | null;
  distanceKm?: number | null;
  popularityScore?: number;
  missingFields?: string[];
  matchedFilters?: string[];
};
export type PlaceSignal = Pick<Experience, "id" | "popularityScore" | "distanceKm" | "missingFields" | "matchedFilters">;
export type GroupPreferences = {
  budgetPerPerson: number | null;
  maxDistanceKm: number | null;
  homeLatitude: number | null;
  homeLongitude: number | null;
  maxDurationMins: number | null;
  setting: Setting;
  maxIntensity: Intensity;
};
export type Group = {
  id: string;
  name: string;
  memberships: Array<{ user: { id: string; name: string }; role: MembershipRole }>;
  preferences?: GroupPreferences | null;
  votes?: Array<{ experienceId: string; choice: VoteChoice; user: { id: string; name: string } }>;
  shortlists?: Array<{ items: Array<{ id: string; experience: Experience }> }>;
};
export type Suggestion = {
  activityId: string;
  score: number;
  memberScores: Record<string, number>;
  predictedEnjoyment?: Record<string, number>;
  breakdown: Record<string, number | boolean>;
  reasons: string[];
  missingFields?: string[];
  matchedFilters?: string[];
  experience: Experience;
};
export type Preferences = {
  budgetPerPerson: number | null;
  maxDistanceKm: number | null;
  maxDurationMins: number | null;
  homeLatitude: number | null;
  homeLongitude: number | null;
  preferredTypes: string[];
  dislikedTypes: string[];
  preferredTags: string[];
  dislikedTags: string[];
  accessibility: string[];
  dietaryNeeds: string[];
  setting: Setting;
  maxIntensity: Intensity;
  naturalLanguage: string | null;
};
export type Analytics = {
  personal: {
    feedbackCount: number;
    outingsRated: number;
    averageEnjoyment: number | null;
    predictedFeedbackCount: number;
    observedPredictionMae: number | null;
  };
  recommendations: {
    runs: number;
    averageGroupNovelty: number | null;
    hardConstraintCompliance: number | null;
  };
  offlineEvaluation: null | {
    modelVersion: string;
    selectedModel: string;
    ratings: number;
    outings: number;
    mae: number;
    baselineMae: number;
    candidateMae: Record<string, number>;
    validationMethod: string;
    createdAt: string;
  };
};

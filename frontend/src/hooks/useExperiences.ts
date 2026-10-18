import { useCallback, useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { api } from "../api";
import type { Experience, Preferences, User } from "../types";

type Action = (work: () => Promise<void>) => Promise<void>;
export type DiscoveryFilters = {
  q: string;
  city: string;
  country: string;
  category: string;
  budget: string;
  intensity: string;
  setting: string;
  radiusKm: string;
};

const initialFilters: DiscoveryFilters = {
  q: "",
  city: "",
  country: "IN",
  category: "",
  budget: "",
  intensity: "",
  setting: "",
  radiusKm: "50",
};

export function useExperiences(
  user: User | null,
  act: Action,
  setError: (message: string) => void,
  setNotice: (message: string) => void,
  preferences: Preferences,
  setPreferences: Dispatch<SetStateAction<Preferences>>,
) {
  const [filters, setFilters] = useState<DiscoveryFilters>(initialFilters);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const locationRequested = useRef(false);
  const requestNumber = useRef(0);

  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Location is unavailable in this browser. Enter a city to find nearby places.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPreferences((current) => ({ ...current, homeLatitude: coords.latitude, homeLongitude: coords.longitude }));
        setNotice("Using your current location to find nearby places.");
      },
      () => setError("Could not get your location. Allow location access or enter a city."),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  }, [setError, setNotice, setPreferences]);

  useEffect(() => {
    if (!user || locationRequested.current || (preferences.homeLatitude !== null && preferences.homeLongitude !== null)) return;
    locationRequested.current = true;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => setPreferences((current) => ({ ...current, homeLatitude: coords.latitude, homeLongitude: coords.longitude })),
        () => setNotice("Allow location access or enter a city to find nearby places."),
        { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
      );
    }
  }, [user, preferences.homeLatitude, preferences.homeLongitude, setPreferences, setNotice]);

  const loadExperiences = useCallback(async () => {
    const query = new URLSearchParams();
    if (filters.q.trim()) query.set("keyword", filters.q.trim());
    if (filters.city.trim()) query.set("city", filters.city.trim());
    else if (preferences.homeLatitude !== null && preferences.homeLongitude !== null) {
      query.set("latitude", String(preferences.homeLatitude));
      query.set("longitude", String(preferences.homeLongitude));
    } else if (!filters.q.trim()) {
      setExperiences([]);
      return;
    }
    if (filters.country.trim()) query.set("countryCode", filters.country.trim());
    if (filters.category) query.set("category", filters.category);
    if (filters.budget) query.set("budget", filters.budget);
    if (filters.intensity) query.set("intensity", filters.intensity);
    if (filters.setting) query.set("setting", filters.setting);
    if (filters.radiusKm) query.set("radiusKm", filters.radiusKm);

    const currentRequest = ++requestNumber.current;
    setLoadingPlaces(true);
    try {
      const result = await api<{ experiences: Experience[] }>(`/api/places/search?${query}`);
      if (currentRequest === requestNumber.current) setExperiences(result.experiences);
    } catch (reason) {
      if (currentRequest === requestNumber.current) {
        setExperiences([]);
        setError(reason instanceof Error ? reason.message : "Could not load nearby places");
      }
    } finally {
      if (currentRequest === requestNumber.current) setLoadingPlaces(false);
    }
  }, [filters, preferences.homeLatitude, preferences.homeLongitude, setError]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => void loadExperiences(), 350);
    return () => window.clearTimeout(timer);
  }, [user, loadExperiences]);

  async function searchPlaces(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act(loadExperiences);
  }

  async function markTried(experienceId: string, tried: boolean) {
    await act(async () => {
      await api(`/api/experiences/${experienceId}/tried`, {
        method: "PUT",
        body: JSON.stringify({ tried }),
      });
      setNotice(
        tried
          ? "Marked as tried; future group picks will account for it."
          : "Removed from your tried list.",
      );
    });
  }
  return {
    filters,
    setFilters,
    experiences,
    loadingPlaces,
    useCurrentLocation,
    searchPlaces,
    markTried,
  };
}

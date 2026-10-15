import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Experience, User } from "../types";

type Action = (work: () => Promise<void>) => Promise<void>;
export function useExperiences(
  user: User | null,
  act: Action,
  setError: (message: string) => void,
  setNotice: (message: string) => void,
) {
  const [filters, setFilters] = useState({ q: "", category: "", budget: "", intensity: "" });
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [eventKeyword, setEventKeyword] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventCountry, setEventCountry] = useState("");
  const loadExperiences = useCallback(async () => {
    const query = new URLSearchParams();
    if (filters.q) query.set("q", filters.q);
    if (filters.category) query.set("category", filters.category);
    if (filters.budget) query.set("budget", filters.budget);
    if (filters.intensity) query.set("intensity", filters.intensity);
    const result = await api<{ experiences: Experience[] }>(`/api/experiences?${query}`);
    setExperiences(result.experiences);
  }, [filters]);
  useEffect(() => {
    if (!user) return;
    // Debounce the catalog request while the user is changing filters.
    const timer = window.setTimeout(
      () =>
        loadExperiences().catch((reason: unknown) =>
          setError(reason instanceof Error ? reason.message : "Could not load experiences"),
        ),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [user, loadExperiences, setError]);
  async function searchLiveEvents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventKeyword.trim() && !eventCity.trim()) {
      setError("Enter an event keyword or city to search.");
      return;
    }
    await act(async () => {
      const query = new URLSearchParams();
      if (eventKeyword.trim()) query.set("keyword", eventKeyword.trim());
      if (eventCity.trim()) query.set("city", eventCity.trim());
      if (eventCountry.trim()) query.set("countryCode", eventCountry.trim());
      const result = await api<{ experiences: Experience[] }>(`/api/events/search?${query}`);
      setExperiences((current) => [
        ...result.experiences,
        ...current.filter(
          (activity) => !result.experiences.some((found) => found.id === activity.id),
        ),
      ]);
      setNotice(
        result.experiences.length
          ? `Added ${result.experiences.length} current event listing${result.experiences.length === 1 ? "" : "s"} from Ticketmaster.`
          : "The provider returned no events for that search.",
      );
    });
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
    eventKeyword,
    setEventKeyword,
    eventCity,
    setEventCity,
    eventCountry,
    setEventCountry,
    searchLiveEvents,
    markTried,
  };
}

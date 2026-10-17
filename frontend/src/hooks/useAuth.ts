import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { emptyPreferences } from "../constants";
import type { Preferences, User } from "../types";

type Action = (work: () => Promise<void>) => Promise<void>;
type GroupActions = { loadGroups: () => Promise<void>; clearGroups: () => void };
export function useAuth(
  groupActions: GroupActions,
  act: Action,
  setError: (message: string) => void,
  setNotice: (message: string) => void,
  setPage: (page: string) => void,
) {
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("");
  const [draftPreferences, setDraftPreferences] = useState<Preferences>(emptyPreferences);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  useEffect(() => {
    api<{ user: User & { preferences?: Preferences | null } }>("/api/auth/me")
      .then(({ user: found }) => {
        setUser(found);
        setProfileName(found.name);
        setDraftPreferences(found.preferences ?? emptyPreferences);
        return groupActions.loadGroups();
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof ApiError) || reason.status !== 401)
          setError(reason instanceof Error ? reason.message : "Could not connect to the app");
      });
  }, [groupActions, setError]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act(async () => {
      const route = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const result = await api<{ user: User & { preferences?: Preferences | null } }>(route, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      setUser(result.user);
      setProfileName(result.user.name);
      setDraftPreferences(result.user.preferences ?? emptyPreferences);
      await groupActions.loadGroups();
      setPage(authMode === "register" ? "profile" : "discover");
    });
  }

  async function logout() {
    await act(async () => {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      groupActions.clearGroups();
    });
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act(async () => {
      const result = await api<{ user: User }>("/api/profile/me", {
        method: "PATCH",
        body: JSON.stringify({ ...draftPreferences, name: profileName }),
      });
      setUser((current) => (current ? { ...current, name: result.user.name } : current));
      setNotice("Your preferences have been saved.");
    });
  }

  async function interpretPreferences(onSuccess?: (anyIntensity: boolean) => void) {
    const text = draftPreferences.naturalLanguage?.trim();
    if (!text) {
      setDraftPreferences((current) => ({
        ...emptyPreferences,
        homeLatitude: current.homeLatitude,
        homeLongitude: current.homeLongitude,
        naturalLanguage: null,
      }));
      setNotice("Preference fields cleared because the description is empty.");
      return;
    }
    await act(async () => {
      const result = await api<{
        draft: Omit<Partial<Preferences>, "maxIntensity"> & { maxIntensity?: Preferences["maxIntensity"] | null };
        method: string;
      }>(
        "/api/profile/preference-draft",
        { method: "POST", body: JSON.stringify({ text }) },
      );
      setDraftPreferences((current) => ({
        ...emptyPreferences,
        ...result.draft,
        maxIntensity: result.draft.maxIntensity ?? "HIGH",
        homeLatitude: current.homeLatitude,
        homeLongitude: current.homeLongitude,
        naturalLanguage: current.naturalLanguage,
      }));
      onSuccess?.(result.draft.maxIntensity == null);
      setNotice(
        `Preference draft prepared with ${result.method}. Review the fields, then save when ready.`,
      );
    });
  }

  return {
    user,
    setUser,
    profileName,
    setProfileName,
    draftPreferences,
    setDraftPreferences,
    authMode,
    setAuthMode,
    authenticate,
    logout,
    savePreferences,
    interpretPreferences,
  };
}

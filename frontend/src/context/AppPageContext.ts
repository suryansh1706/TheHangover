import { createContext } from "react";
import type { Dispatch, SetStateAction, FormEvent } from "react";
import type {
  Analytics,
  Experience,
  Group,
  GroupPreferences,
  Preferences,
  Suggestion,
  User,
  VoteChoice,
} from "../types";
import type { DiscoveryFilters } from "../hooks/useExperiences";

export type AppPageContextValue = {
  user: User | null;
  groups: Group[];
  groupId: string;
  setGroupId: Dispatch<SetStateAction<string>>;
  experiences: Experience[];
  suggestions: Suggestion[];
  invalidateRecommendations: () => void;
  enjoymentModelVersion: string | null;
  filters: DiscoveryFilters;
  setFilters: Dispatch<SetStateAction<DiscoveryFilters>>;
  busy: boolean;
  error: string;
  notice: string;
  setError: Dispatch<SetStateAction<string>>;
  inviteToken: string;
  setInviteToken: Dispatch<SetStateAction<string>>;
  newGroup: string;
  setNewGroup: Dispatch<SetStateAction<string>>;
  groupSettings: GroupPreferences;
  setGroupSettings: Dispatch<SetStateAction<GroupPreferences>>;
  groupName: string;
  setGroupName: Dispatch<SetStateAction<string>>;
  loadingPlaces: boolean;
  useCurrentLocation: () => void;
  draftPreferences: Preferences;
  setDraftPreferences: Dispatch<SetStateAction<Preferences>>;
  feedbackId: string;
  setFeedbackId: Dispatch<SetStateAction<string>>;
  profileName: string;
  setProfileName: Dispatch<SetStateAction<string>>;
  analytics: Analytics | null;
  activeGroup: Group | undefined;
  isGroupOwner: boolean;
  shortlistedIds: Set<string>;
  loadGroups: () => Promise<void>;
  authenticate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  logout: () => Promise<void>;
  createGroup: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  joinGroup: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  createInvitation: () => Promise<void>;
  saveGroupSettings: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  savePreferences: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  recommend: (filters?: DiscoveryFilters, silent?: boolean) => Promise<void>;
  searchPlaces: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  addToShortlist: (id: string) => Promise<void>;
  vote: (id: string, choice: VoteChoice) => Promise<void>;
  refreshGroup: () => Promise<void>;
  markTried: (id: string, tried: boolean) => Promise<void>;
  setPage: (page: string) => void;
  categories: readonly string[];
  numOrNull: (value: string) => number | null;
  splitList: (value: string) => string[];
};
export const appPageContext = createContext<AppPageContextValue | null>(null);

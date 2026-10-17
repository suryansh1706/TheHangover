import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "../api";
import { emptyGroupPreferences } from "../constants";
import type { Group, GroupPreferences, Suggestion, User, VoteChoice } from "../types";

type Action = (work: () => Promise<void>) => Promise<void>;
type RecommendationFilters = { q: string; category: string; budget: string; intensity: string };
export function useGroups(
  user: User | null,
  act: Action,
  setError: (message: string) => void,
  setNotice: (message: string) => void,
  setPage: (page: string) => void,
) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [enjoymentModelVersion, setEnjoymentModelVersion] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [groupSettings, setGroupSettings] = useState<GroupPreferences>(emptyGroupPreferences);
  const [groupName, setGroupName] = useState("");
  const recommendationRequest = useRef(0);
  const activeGroup = groups.find((group) => group.id === groupId);
  const isGroupOwner =
    activeGroup?.memberships.some(
      (member) => member.role === "OWNER" && member.user.id === user?.id,
    ) ?? false;
  const shortlistedIds = useMemo(
    () => new Set(activeGroup?.shortlists?.[0]?.items.map((item) => item.experience.id) ?? []),
    [activeGroup],
  );

  const loadGroups = useCallback(async () => {
    const result = await api<{ groups: Group[] }>("/api/groups");
    setGroups(result.groups);
    const selected = result.groups[0]?.id ?? "";
    setGroupId((current) =>
      result.groups.some((group) => group.id === current) ? current : selected,
    );
  }, []);
  const refreshGroup = useCallback(async () => {
    if (!groupId) return;
    const { group } = await api<{ group: Group }>(`/api/groups/${groupId}`);
    setGroups((current) => current.map((item) => (item.id === groupId ? group : item)));
  }, [groupId]);
  useEffect(() => {
    if (!activeGroup) return;
    setGroupName(activeGroup.name);
    setGroupSettings(activeGroup.preferences ?? emptyGroupPreferences);
  }, [activeGroup]);
  useEffect(() => {
    if (user && groupId)
      refreshGroup().catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Could not load group"),
      );
  }, [groupId, user, refreshGroup, setError]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act(async () => {
      const result = await api<{ group: Group }>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: newGroup }),
      });
      setNewGroup("");
      await loadGroups();
      setGroupId(result.group.id);
      setPage("group");
      setNotice("Your group is ready. Invite your friends to join.");
    });
  }
  async function joinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act(async () => {
      await api("/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ token: inviteToken.trim() }),
      });
      setInviteToken("");
      await loadGroups();
      setNotice("You joined the group.");
    });
  }
  async function createInvitation() {
    if (!groupId) return;
    await act(async () => {
      const result = await api<{ invitation: { token: string; expiresAt: string } }>(
        `/api/groups/${groupId}/invitations`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setNotice(
        `Invite token: ${result.invitation.token} (expires ${new Date(result.invitation.expiresAt).toLocaleDateString()})`,
      );
    });
  }
  async function saveGroupSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId) return;
    await act(async () => {
      await api(`/api/groups/${groupId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ name: groupName, ...groupSettings }),
      });
      await loadGroups();
      await refreshGroup();
      setNotice("Group settings saved. Recommendations will use these limits.");
    });
  }
  const invalidateRecommendations = useCallback(() => {
    recommendationRequest.current += 1;
    setSuggestions([]);
  }, []);
  const recommend = useCallback(async (filters?: RecommendationFilters, silent = false) => {
    if (!groupId) {
      setError("Create a group or join one to get group recommendations.");
      return;
    }
    const requestId = ++recommendationRequest.current;
    setSuggestions([]);
    await act(async () => {
      const query = new URLSearchParams();
      if (filters?.q.trim()) query.set("q", filters.q.trim());
      if (filters?.category) query.set("category", filters.category);
      if (filters?.budget) query.set("budget", filters.budget);
      if (filters?.intensity) query.set("intensity", filters.intensity);
      const result = await api<{
        recommendations: Suggestion[];
        enjoymentModelVersion: string | null;
      }>(`/api/groups/${groupId}/recommendations?${query}`);
      if (requestId !== recommendationRequest.current) return;
      setSuggestions(result.recommendations);
      setEnjoymentModelVersion(result.enjoymentModelVersion);
      if (!silent) setPage("discover");
      if (!silent && !result.recommendations.length)
        setNotice(
          "No activities meet every group member\u2019s stated hard constraints. Try broadening a budget or preference.",
        );
    });
  }, [act, groupId, setError, setNotice, setPage]);
  async function addToShortlist(experienceId: string) {
    if (!groupId) return setError("Choose or create a group first.");
    await act(async () => {
      await api(`/api/groups/${groupId}/shortlist/${experienceId}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshGroup();
      setNotice("Added to your group shortlist.");
    });
  }
  async function vote(experienceId: string, choice: VoteChoice) {
    if (!groupId) return;
    await act(async () => {
      await api(`/api/groups/${groupId}/votes/${experienceId}`, {
        method: "PUT",
        body: JSON.stringify({ choice }),
      });
      await refreshGroup();
      setNotice("Your vote was saved.");
    });
  }

  const clearGroups = useCallback(() => {
    setGroups([]);
    invalidateRecommendations();
  }, [invalidateRecommendations]);

  return {
    groups,
    clearGroups,
    setGroups,
    groupId,
    setGroupId,
    suggestions,
    setSuggestions,
    invalidateRecommendations,
    enjoymentModelVersion,
    inviteToken,
    setInviteToken,
    newGroup,
    setNewGroup,
    groupSettings,
    setGroupSettings,
    groupName,
    setGroupName,
    activeGroup,
    isGroupOwner,
    shortlistedIds,
    loadGroups,
    refreshGroup,
    createGroup,
    joinGroup,
    createInvitation,
    saveGroupSettings,
    recommend,
    addToShortlist,
    vote,
  };
}

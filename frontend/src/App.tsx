import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "./api";

type User = { id: string; email: string; name: string };
type Experience = { id: string; name: string; slug: string; description: string; category: string; tags: string[]; priceMin: number | null; priceMax: number | null; currency: string | null; locationName: string | null; eventStartsAt: string | null; eventLocalDate: string | null; eventLocalTime: string | null; eventTimeZone: string | null; bookingUrl: string | null; durationMins: number | null; setting: string | null; intensity: string | null; adventureLevel: number | null; socialLevel: number | null; isSample: boolean; source: string; lastVerifiedAt: string | null };
type GroupPreferences = { budgetPerPerson: number | null; maxDistanceKm: number | null; homeLatitude: number | null; homeLongitude: number | null; maxDurationMins: number | null; setting: string; maxIntensity: string };
type Group = { id: string; name: string; memberships: Array<{ user: { id: string; name: string }; role: string }>; preferences?: GroupPreferences | null; votes?: Array<{ experienceId: string; choice: string; user: { id: string; name: string } }>; shortlists?: Array<{ items: Array<{ id: string; experience: Experience }> }> };
type Suggestion = { activityId: string; score: number; memberScores: Record<string, number>; predictedEnjoyment?: Record<string, number>; breakdown: Record<string, number | boolean>; reasons: string[]; experience: Experience };
type Preferences = { budgetPerPerson: number | null; maxDistanceKm: number | null; maxDurationMins: number | null; homeLatitude: number | null; homeLongitude: number | null; preferredTypes: string[]; dislikedTypes: string[]; preferredTags: string[]; dislikedTags: string[]; accessibility: string[]; dietaryNeeds: string[]; setting: string; maxIntensity: string; naturalLanguage: string | null };
type Analytics = { personal: { feedbackCount: number; outingsRated: number; averageEnjoyment: number | null; predictedFeedbackCount: number; observedPredictionMae: number | null }; recommendations: { runs: number; averageGroupNovelty: number | null; hardConstraintCompliance: number | null }; offlineEvaluation: null | { modelVersion: string; selectedModel: string; ratings: number; outings: number; mae: number; baselineMae: number; candidateMae: Record<string, number>; validationMethod: string; createdAt: string } };

const categories = ["Creative", "Adventure", "Outdoors", "Games", "Food", "Puzzle"];
const emptyPreferences: Preferences = { budgetPerPerson: null, maxDistanceKm: null, maxDurationMins: null, homeLatitude: null, homeLongitude: null, preferredTypes: [], dislikedTypes: [], preferredTags: [], dislikedTags: [], accessibility: [], dietaryNeeds: [], setting: "EITHER", maxIntensity: "HIGH", naturalLanguage: null };
const emptyGroupPreferences: GroupPreferences = { budgetPerPerson: null, maxDistanceKm: null, homeLatitude: null, homeLongitude: null, maxDurationMins: null, setting: "EITHER", maxIntensity: "HIGH" };

function money(min: number | null, max: number | null, currency: string | null) {
  if (min == null && max == null) return "Price not listed";
  if (currency) {
    const format = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
    if (min != null && max != null) return `${format(min)}–${format(max)}`;
    return `From ${format(min ?? max ?? 0)}`;
  }
  const format = (amount: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
  if (min != null && max != null) return `${format(min)}–${format(max)} (currency unavailable)`;
  return `From ${format(min ?? max ?? 0)} (currency unavailable)`;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [enjoymentModelVersion, setEnjoymentModelVersion] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const page = location.pathname === "/" ? "discover" : location.pathname.slice(1);
  const setPage = (next: string) => navigate(next === "discover" ? "/" : `/${next}`);
  useEffect(() => {
    if (!["discover", "group", "shortlist", "analytics", "profile"].includes(page)) navigate("/", { replace: true });
  }, [navigate, page]);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [filters, setFilters] = useState({ q: "", category: "", budget: "", intensity: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [groupSettings, setGroupSettings] = useState<GroupPreferences>(emptyGroupPreferences);
  const [groupName, setGroupName] = useState("");
  const [eventKeyword, setEventKeyword] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventCountry, setEventCountry] = useState("");
  const [draftPreferences, setDraftPreferences] = useState<Preferences>(emptyPreferences);
  const [feedbackId, setFeedbackId] = useState("");
  const [profileName, setProfileName] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const activeGroup = groups.find((group) => group.id === groupId);
  const isGroupOwner = activeGroup?.memberships.some((member) => member.role === "OWNER" && member.user.id === user?.id) ?? false;
  useEffect(() => {
    if (!activeGroup) return;
    setGroupName(activeGroup.name);
    setGroupSettings(activeGroup.preferences ?? emptyGroupPreferences);
  }, [activeGroup]);
  const shortlistedIds = useMemo(() => new Set(activeGroup?.shortlists?.[0]?.items.map((item) => item.experience.id) ?? []), [activeGroup]);

  const loadGroups = useCallback(async (uid?: string) => {
    const result = await api<{ groups: Group[] }>("/api/groups");
    setGroups(result.groups);
    const selected = result.groups[0]?.id ?? "";
    setGroupId((current) => result.groups.some((group) => group.id === current) ? current : selected);
    void uid;
  }, []);

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
    api<{ user: User & { preferences?: Preferences | null } }>("/api/auth/me").then(({ user: found }) => {
      setUser(found);
      setProfileName(found.name);
      setDraftPreferences(found.preferences ?? emptyPreferences);
      return loadGroups(found.id);
    }).catch((reason: unknown) => { if (!(reason instanceof ApiError) || reason.status !== 401) setError(reason instanceof Error ? reason.message : "Could not connect to the app"); });
  }, [loadGroups]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => loadExperiences().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load experiences")), 250);
    return () => window.clearTimeout(timer);
  }, [user, loadExperiences]);

  useEffect(() => {
    if (user && groupId) {
      api<{ group: Group }>(`/api/groups/${groupId}`).then(({ group }) => setGroups((current) => current.map((item) => item.id === groupId ? group : item))).catch(() => undefined);
    }
  }, [groupId, user]);

  useEffect(() => {
    if (user && page === "analytics") api<Analytics>("/api/analytics").then(setAnalytics).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load analytics"));
  }, [page, user]);

  const act = async (work: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act(async () => {
      const route = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = Object.fromEntries(form.entries());
      const result = await api<{ user: User & { preferences?: Preferences | null } }>(route, { method: "POST", body: JSON.stringify(body) });
      setUser(result.user); setProfileName(result.user.name); setDraftPreferences(result.user.preferences ?? emptyPreferences);
      await loadGroups(result.user.id); setPage(authMode === "register" ? "profile" : "discover");
    });
  }

  async function logout() {
    await act(async () => { await api("/api/auth/logout", { method: "POST" }); setUser(null); setGroups([]); setSuggestions([]); });
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act(async () => {
      const result = await api<{ group: Group }>("/api/groups", { method: "POST", body: JSON.stringify({ name: newGroup }) });
      setNewGroup(""); await loadGroups(); setGroupId(result.group.id); setPage("group"); setNotice("Your group is ready. Invite your friends to join.");
    });
  }

  async function joinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act(async () => { await api("/api/groups/join", { method: "POST", body: JSON.stringify({ token: inviteToken.trim() }) }); setInviteToken(""); await loadGroups(); setNotice("You joined the group."); });
  }

  async function createInvitation() {
    if (!groupId) return;
    await act(async () => {
      const result = await api<{ invitation: { token: string; expiresAt: string } }>(`/api/groups/${groupId}/invitations`, { method: "POST", body: JSON.stringify({}) });
      setNotice(`Invite token: ${result.invitation.token} (expires ${new Date(result.invitation.expiresAt).toLocaleDateString()})`);
    });
  }

  async function saveGroupSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId) return;
    await act(async () => {
      await api(`/api/groups/${groupId}/settings`, { method: "PATCH", body: JSON.stringify({ name: groupName, ...groupSettings }) });
      await loadGroups();
      await refreshGroup();
      setNotice("Group settings saved. Recommendations will use these limits.");
    });
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act(async () => {
      const result = await api<{ user: User }>("/api/profile/me", { method: "PATCH", body: JSON.stringify({ ...draftPreferences, name: profileName }) });
      setUser((current) => current ? { ...current, name: result.user.name } : current);
      setNotice("Your preferences have been saved.");
    });
  }

  async function interpretPreferences() {
    const text = draftPreferences.naturalLanguage?.trim();
    if (!text) { setError("Write a preference description first."); return; }
    await act(async () => {
      const result = await api<{ draft: Partial<Preferences>; method: string }>("/api/profile/preference-draft", { method: "POST", body: JSON.stringify({ text }) });
      setDraftPreferences((current) => ({ ...current, ...result.draft, naturalLanguage: current.naturalLanguage }));
      setNotice(`Preference draft prepared with ${result.method}. Review the fields, then save when ready.`);
    });
  }

  async function recommend() {
    if (!groupId) { setError("Create a group or join one to get group recommendations."); return; }
    await act(async () => {
      const result = await api<{ recommendations: Suggestion[]; enjoymentModelVersion: string | null }>(`/api/groups/${groupId}/recommendations`);
      setSuggestions(result.recommendations); setEnjoymentModelVersion(result.enjoymentModelVersion); setPage("discover");
      if (!result.recommendations.length) setNotice("No activities meet every group member’s stated hard constraints. Try broadening a budget or preference.");
    });
  }

  async function searchLiveEvents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventKeyword.trim() && !eventCity.trim()) { setError("Enter an event keyword or city to search."); return; }
    await act(async () => {
      const query = new URLSearchParams();
      if (eventKeyword.trim()) query.set("keyword", eventKeyword.trim());
      if (eventCity.trim()) query.set("city", eventCity.trim());
      if (eventCountry.trim()) query.set("countryCode", eventCountry.trim());
      const result = await api<{ experiences: Experience[] }>(`/api/events/search?${query}`);
      setExperiences((current) => [...result.experiences, ...current.filter((activity) => !result.experiences.some((found) => found.id === activity.id))]);
      setNotice(result.experiences.length ? `Added ${result.experiences.length} current event listing${result.experiences.length === 1 ? "" : "s"} from Ticketmaster.` : "The provider returned no events for that search.");
    });
  }

  async function addToShortlist(experienceId: string) {
    if (!groupId) return setError("Choose or create a group first.");
    await act(async () => { await api(`/api/groups/${groupId}/shortlist/${experienceId}`, { method: "POST", body: JSON.stringify({}) }); await refreshGroup(); setNotice("Added to your group shortlist."); });
  }

  async function vote(experienceId: string, choice: string) {
    if (!groupId) return;
    await act(async () => { await api(`/api/groups/${groupId}/votes/${experienceId}`, { method: "PUT", body: JSON.stringify({ choice }) }); await refreshGroup(); setNotice("Your vote was saved."); });
  }

  async function refreshGroup() {
    if (!groupId) return;
    const { group } = await api<{ group: Group }>(`/api/groups/${groupId}`);
    setGroups((current) => current.map((item) => item.id === groupId ? group : item));
  }

  async function markTried(experienceId: string, tried: boolean) {
    await act(async () => { await api(`/api/experiences/${experienceId}/tried`, { method: "PUT", body: JSON.stringify({ tried }) }); setNotice(tried ? "Marked as tried; future group picks will account for it." : "Removed from your tried list."); });
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optionalRating = (key: string) => form.get(key) ? Number(form.get(key)) : undefined;
    await act(async () => {
      const outing = await api<{ outing: { id: string } }>(`/api/groups/${groupId}/outings`, { method: "POST", body: JSON.stringify({ experienceId: feedbackId }) });
      await api(`/api/outings/${outing.outing.id}/complete`, { method: "PATCH", body: JSON.stringify({}) });
      await api(`/api/outings/${outing.outing.id}/feedback`, { method: "POST", body: JSON.stringify({ enjoyment: Number(form.get("enjoyment")), wouldRepeat: form.get("wouldRepeat") === "yes", adventure: optionalRating("adventure"), socialAtmosphere: optionalRating("socialAtmosphere"), valueForMoney: optionalRating("valueForMoney"), difficulty: optionalRating("difficulty"), comments: form.get("comments") || undefined }) });
      setFeedbackId(""); setNotice("Thanks for the feedback. It will help tune future group picks.");
    });
  }

  if (!user) return <main className="auth-page"><div className="auth-brand"><span className="brand">the hangover<span>.</span></span><span className="auth-tag">GOOD PLANS, MADE TOGETHER</span></div><section className="auth-card"><p className="eyebrow">A BETTER WAY TO MAKE PLANS</p><h1>{authMode === "register" ? "Make room for" : "Welcome"}<br /><em>{authMode === "register" ? "new stories." : "back."}</em></h1><p className="muted">Discover new group experiences that suit everyone.</p>
    {error && <Notice type="error">{error}</Notice>}
    <form className="stack" onSubmit={authenticate}>{authMode === "register" && <label>Your name<input name="name" autoComplete="name" required maxLength={80} /></label>}<label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} required minLength={authMode === "register" ? 10 : 1} maxLength={128} />{authMode === "register" && <small>At least 10 characters</small>}</label><button className="button primary" disabled={busy}>{busy ? "Please wait…" : authMode === "register" ? "Create account" : "Log in"}</button></form>
    <p className="switch-auth">{authMode === "register" ? "Already have an account?" : "New here?"} <button className="text-button" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setError(""); }}>{authMode === "register" ? "Log in" : "Create account"}</button></p>
    </section><p className="auth-foot">Experiences for the group, not just the algorithm.</p></main>;

  return <div className="app-layout min-h-screen font-sans">
    <aside className="sidebar"><a className="brand" href="#" onClick={() => setPage("discover")}>the hangover<span>.</span></a><div className="side-label">YOUR SPACE</div><nav aria-label="Main navigation">{[["discover", "Discover", "✳"], ["group", "Your group", "◉"], ["shortlist", "Shortlist & votes", "♡"], ["analytics", "Progress", "↗"], ["profile", "Preferences", "⌘"]].map(([key, label, icon]) => <button key={key} className={`nav-item ${page === key ? "active" : ""}`} onClick={() => setPage(key)}><span>{icon}</span>{label}</button>)}</nav><div className="sidebar-bottom"><div className="user-chip"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><b>{user.name}</b><small>{user.email}</small></span></div><button className="text-button signout" onClick={logout}>Sign out</button></div></aside>
    <main className="main-content"><header className="mobile-header"><span className="brand">the hangover<span>.</span></span><button className="text-button" onClick={logout}>Sign out</button></header><div className="content-wrap">
      {error && <Notice type="error">{error}<button className="dismiss" onClick={() => setError("")}>×</button></Notice>}{notice && <Notice type="success">{notice}<button className="dismiss" onClick={() => setNotice("")}>×</button></Notice>}
      {page === "discover" && <>
        <PageHeading eyebrow="DISCOVERY, FOR YOUR WHOLE GROUP" title={<>Make a plan<br /><em>worth remembering.</em></>} description="Find something fresh that fits your group’s interests and practical limits." />
        <div className="discover-toolbar"><label className="select-label">RECOMMEND FOR<select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Choose a group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><button className="button primary" onClick={recommend} disabled={busy || !groupId}>{busy ? "Finding ideas…" : "✦ Find group picks"}</button></div>
        <div className="filters"><input placeholder="Search activities" aria-label="Search activities" value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} /><select aria-label="Category" value={filters.category} onChange={(event) => setFilters((old) => ({ ...old, category: event.target.value }))}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><input aria-label="Maximum price" placeholder="Max ₹ / person" inputMode="numeric" value={filters.budget} onChange={(event) => setFilters((old) => ({ ...old, budget: event.target.value }))} /><select aria-label="Maximum intensity" value={filters.intensity} onChange={(event) => setFilters((old) => ({ ...old, intensity: event.target.value }))}><option value="">Any intensity</option><option value="LOW">Low</option><option value="MODERATE">Moderate</option><option value="HIGH">High</option></select></div>
        <form className="event-search panel" onSubmit={searchLiveEvents}><div><p className="eyebrow">LIVE EVENT LISTINGS</p><p>Search real events and venue details from Ticketmaster. Current prices appear only when the provider supplies them.</p></div><input aria-label="Event keyword" placeholder="Event keyword" value={eventKeyword} onChange={(event) => setEventKeyword(event.target.value)} /><input aria-label="Event city" placeholder="City" value={eventCity} onChange={(event) => setEventCity(event.target.value)} /><input aria-label="Event country code" placeholder="Country (e.g. US)" maxLength={2} value={eventCountry} onChange={(event) => setEventCountry(event.target.value.toUpperCase())} /><button className="button dark" disabled={busy}>Search events</button></form>
        {suggestions.length > 0 && <><div className="section-heading"><div><p className="eyebrow">MATCHED TO YOUR GROUP</p><h2>Group picks</h2></div><span className="small-note">Balances member fit, group novelty & diversity</span></div><div className="cards">{suggestions.map((item, index) => <ExperienceCard key={item.activityId} item={item.experience} rank={index + 1} reasons={item.reasons} score={item.score} predictedEnjoyment={item.predictedEnjoyment} modelVersion={enjoymentModelVersion} saved={shortlistedIds.has(item.activityId)} onSave={() => addToShortlist(item.activityId)} onTried={() => markTried(item.activityId, true)} onVote={(choice) => vote(item.activityId, choice)} onFeedback={() => setFeedbackId(item.activityId)} />)}</div></>}
        <div className="section-heading"><div><p className="eyebrow">ACTIVITY IDEAS</p><h2>Explore the possibilities</h2></div><span className="small-note">{experiences.length} listed</span></div>
        {experiences.length ? <div className="cards">{experiences.map((item) => <ExperienceCard key={item.id} item={item} saved={shortlistedIds.has(item.id)} onSave={() => addToShortlist(item.id)} onTried={() => markTried(item.id, true)} onVote={(choice) => vote(item.id, choice)} onFeedback={() => setFeedbackId(item.id)} />)}</div> : <div className="empty-state"><h3>No activities match those filters</h3><p>Try a broader search or clear a filter.</p><button className="button subtle" onClick={() => setFilters({ q: "", category: "", budget: "", intensity: "" })}>Clear filters</button></div>}
      </>}
      {page === "group" && <><PageHeading eyebrow="YOUR PEOPLE, YOUR PLANS" title={<>Good things are<br /><em>better together.</em></>} description="Create a private group or join with a secure invitation token." />
        <div className="group-grid"><section className="panel"><p className="eyebrow">START A GROUP</p><h2>Bring your people in</h2><form className="inline-form" onSubmit={createGroup}><input value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="e.g. The Sunday Crew" maxLength={80} required /><button className="button primary" disabled={busy}>Create group</button></form></section><section className="panel"><p className="eyebrow">JOIN YOUR FRIENDS</p><h2>Got an invite token?</h2><form className="inline-form" onSubmit={joinGroup}><input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder="Paste the token here" required /><button className="button dark" disabled={busy}>Join group</button></form></section></div>
        {activeGroup && <section className="panel group-detail"><div className="section-heading"><div><p className="eyebrow">YOUR CURRENT GROUP</p><h2>{activeGroup.name}</h2></div><button className="button subtle" onClick={createInvitation}>＋ Create invite</button></div><p className="muted">{activeGroup.memberships.length} member{activeGroup.memberships.length === 1 ? "" : "s"}. Invite tokens expire after 7 days.</p><div className="member-list">{activeGroup.memberships.map((member) => <div className="member" key={member.user.id}><span className="avatar">{member.user.name.slice(0, 1).toUpperCase()}</span><span>{member.user.name}</span>{member.role === "OWNER" && <small>ORGANIZER</small>}</div>)}</div>
          <form className="preference-form group-settings-form" onSubmit={saveGroupSettings}><div className="full-field"><p className="eyebrow">GROUP SETTINGS</p><h3>Set shared outing limits</h3><p className="small-note">These are group-wide hard limits. Member preferences and accessibility needs still apply too.</p></div>
            <label>Group name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} required disabled={!isGroupOwner} /></label>
            <label>Maximum budget per person (₹)<input type="number" min="0" max="1000000" value={groupSettings.budgetPerPerson ?? ""} onChange={(event) => setGroupSettings((old) => ({ ...old, budgetPerPerson: event.target.value ? Number(event.target.value) : null }))} placeholder="No group limit" disabled={!isGroupOwner} /></label>
            <label>Maximum outing duration (minutes)<input type="number" min="1" max="1440" value={groupSettings.maxDurationMins ?? ""} onChange={(event) => setGroupSettings((old) => ({ ...old, maxDurationMins: event.target.value ? Number(event.target.value) : null }))} placeholder="No group limit" disabled={!isGroupOwner} /></label>
            <label>Maximum travel distance (km)<input type="number" min="0" max="5000" step="any" value={groupSettings.maxDistanceKm ?? ""} onChange={(event) => setGroupSettings((old) => ({ ...old, maxDistanceKm: event.target.value ? Number(event.target.value) : null }))} placeholder="No group limit" disabled={!isGroupOwner} /></label>
            <label>Group home latitude<input type="number" min="-90" max="90" step="any" value={groupSettings.homeLatitude ?? ""} onChange={(event) => setGroupSettings((old) => ({ ...old, homeLatitude: event.target.value ? Number(event.target.value) : null }))} placeholder="Required for group distance" disabled={!isGroupOwner} /></label>
            <label>Group home longitude<input type="number" min="-180" max="180" step="any" value={groupSettings.homeLongitude ?? ""} onChange={(event) => setGroupSettings((old) => ({ ...old, homeLongitude: event.target.value ? Number(event.target.value) : null }))} placeholder="Required for group distance" disabled={!isGroupOwner} /></label>
            <label>Preferred setting<select value={groupSettings.setting} onChange={(event) => setGroupSettings((old) => ({ ...old, setting: event.target.value }))} disabled={!isGroupOwner}><option value="EITHER">Either</option><option value="INDOOR">Indoors</option><option value="OUTDOOR">Outdoors</option></select></label>
            <label>Maximum physical intensity<select value={groupSettings.maxIntensity} onChange={(event) => setGroupSettings((old) => ({ ...old, maxIntensity: event.target.value }))} disabled={!isGroupOwner}><option value="LOW">Low</option><option value="MODERATE">Moderate</option><option value="HIGH">High</option></select></label>
            {isGroupOwner ? <button className="button primary" disabled={busy}>Save group settings</button> : <p className="small-note full-field">Only the group organizer can edit these settings.</p>}
          </form></section>}
        {!groups.length && <div className="empty-state"><h3>Your group starts here</h3><p>Create a group above, then invite friends to explore and vote together.</p></div>}
      </>}
      {page === "shortlist" && <><PageHeading eyebrow="DECIDE TOGETHER" title={<>A shortlist full<br /><em>of possibilities.</em></>} description="Save group ideas, compare everyone’s votes, and turn a pick into an outing." />
        {!activeGroup ? <div className="empty-state"><h3>Pick a group first</h3><p>Create or join a group to start a shortlist.</p><button className="button primary" onClick={() => setPage("group")}>Go to groups</button></div> : <><div className="discover-toolbar"><label className="select-label">GROUP<select value={groupId} onChange={(event) => setGroupId(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div><VoteSummary group={activeGroup} />{activeGroup.shortlists?.[0]?.items.length ? <div className="cards">{activeGroup.shortlists[0].items.map(({ experience }) => <ExperienceCard key={experience.id} item={experience} saved onSave={() => addToShortlist(experience.id)} onTried={() => markTried(experience.id, true)} onVote={(choice) => vote(experience.id, choice)} onFeedback={() => setFeedbackId(experience.id)} />)}</div> : <div className="empty-state"><h3>Your shortlist is waiting</h3><p>Save experiences from Discover to collect your group’s options here.</p><button className="button primary" onClick={() => setPage("discover")}>Explore activities</button></div>}</>}
      </>}
      {page === "analytics" && <><PageHeading eyebrow="LEARN FROM REAL OUTINGS" title={<>Better plans,<br /><em>with every review.</em></>} description="See group novelty, member feedback, and honest model evaluation as real outing data is collected." />{!analytics ? <div className="empty-state">Loading your analytics…</div> : <><div className="metric-grid"><Metric label="Outings rated" value={analytics.personal.outingsRated} detail={`${analytics.personal.feedbackCount} ratings from you`} /><Metric label="Your average enjoyment" value={analytics.personal.averageEnjoyment == null ? "—" : `${analytics.personal.averageEnjoyment} / 5`} detail="Based on your submitted feedback" /><Metric label="Group novelty" value={analytics.recommendations.averageGroupNovelty == null ? "—" : `${Math.round(analytics.recommendations.averageGroupNovelty * 100)}%`} detail={`${analytics.recommendations.runs} recommendation runs recorded`} /><Metric label="Predicted vs. actual" value={analytics.personal.observedPredictionMae == null ? "—" : `${analytics.personal.observedPredictionMae} stars MAE`} detail={`${analytics.personal.predictedFeedbackCount} predictions matched to your ratings`} /></div><section className="panel evaluation-panel"><p className="eyebrow">OFFLINE MODEL EVALUATION</p>{analytics.offlineEvaluation ? <><h2>{analytics.offlineEvaluation.selectedModel}</h2><p className="muted">Selected by the lowest mean absolute error on held-out outings. Validation split: {analytics.offlineEvaluation.validationMethod}.</p><div className="evaluation-numbers"><span><b>{analytics.offlineEvaluation.mae.toFixed(2)}</b><small>Model MAE</small></span><span><b>{analytics.offlineEvaluation.baselineMae.toFixed(2)}</b><small>Mean baseline MAE</small></span><span><b>{analytics.offlineEvaluation.ratings}</b><small>Real feedback rows</small></span><span><b>{analytics.offlineEvaluation.outings}</b><small>Separate outings</small></span></div><p className="small-note">Last evaluated {new Date(analytics.offlineEvaluation.createdAt).toLocaleDateString()}. No synthetic ratings are used.</p></> : <div className="empty-copy"><h3>Not enough feedback to evaluate a model yet</h3><p>The system waits for at least 30 feature-linked ratings from 5 separate outings. Until then, it uses transparent preference and content scoring. The threshold prevents us from claiming reliability from a handful of ratings.</p></div>}</section><p className="analytics-footnote">“Predicted vs. actual” is observed prediction error on your later feedback. The offline MAE above uses group-held-out validation and is the appropriate measure for comparing candidate models.</p></>}</>}
      {page === "profile" && <><PageHeading eyebrow="YOUR TASTE, OVER TIME" title={<>A little about<br /><em>your kind of fun.</em></>} description="Set preferences that help the group find experiences you’ll feel good about." /><form className="panel preference-form" onSubmit={savePreferences}><label>Your name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={80} required /></label><label>Maximum budget per person (₹)<input type="number" min="0" max="1000000" value={draftPreferences.budgetPerPerson ?? ""} onChange={(event) => setDraftPreferences((old) => ({ ...old, budgetPerPerson: event.target.value ? Number(event.target.value) : null }))} placeholder="No limit set" /></label><label>Maximum travel distance (km)<input type="number" min="0" max="5000" value={draftPreferences.maxDistanceKm ?? ""} onChange={(event) => setDraftPreferences((old) => ({ ...old, maxDistanceKm: event.target.value ? Number(event.target.value) : null }))} placeholder="No limit set" /></label><label>Home latitude<input type="number" min="-90" max="90" step="any" value={draftPreferences.homeLatitude ?? ""} onChange={(event) => setDraftPreferences((old) => ({ ...old, homeLatitude: event.target.value ? Number(event.target.value) : null }))} placeholder="Needed to apply travel distance" /></label><label>Home longitude<input type="number" min="-180" max="180" step="any" value={draftPreferences.homeLongitude ?? ""} onChange={(event) => setDraftPreferences((old) => ({ ...old, homeLongitude: event.target.value ? Number(event.target.value) : null }))} placeholder="Needed to apply travel distance" /></label><label>Preferred setting<select value={draftPreferences.setting} onChange={(event) => setDraftPreferences((old) => ({ ...old, setting: event.target.value }))}><option value="EITHER">Either</option><option value="INDOOR">Indoors</option><option value="OUTDOOR">Outdoors</option></select></label><label>Maximum physical intensity<select value={draftPreferences.maxIntensity} onChange={(event) => setDraftPreferences((old) => ({ ...old, maxIntensity: event.target.value }))}><option value="LOW">Low</option><option value="MODERATE">Moderate</option><option value="HIGH">High</option></select></label><label>Interests <small>Comma separated</small><input value={draftPreferences.preferredTypes.join(", ")} onChange={(event) => setDraftPreferences((old) => ({ ...old, preferredTypes: splitList(event.target.value) }))} placeholder="creative, food, outdoors" /></label><label>Avoid <small>Categories you don’t want recommended</small><input value={draftPreferences.dislikedTypes.join(", ")} onChange={(event) => setDraftPreferences((old) => ({ ...old, dislikedTypes: splitList(event.target.value) }))} placeholder="e.g. heights, competitive" /></label><label>Accessibility needs <small>Only match catalog facts that are listed</small><input value={draftPreferences.accessibility.join(", ")} onChange={(event) => setDraftPreferences((old) => ({ ...old, accessibility: splitList(event.target.value) }))} placeholder="e.g. step-free access" /></label><label>Dietary needs <small>Only match catalog facts that are listed</small><input value={draftPreferences.dietaryNeeds.join(", ")} onChange={(event) => setDraftPreferences((old) => ({ ...old, dietaryNeeds: splitList(event.target.value) }))} placeholder="e.g. vegetarian" /></label><label className="full-field">Describe what you enjoy in your own words<textarea rows={3} maxLength={1000} value={draftPreferences.naturalLanguage ?? ""} onChange={(event) => setDraftPreferences((old) => ({ ...old, naturalLanguage: event.target.value || null }))} placeholder="We like creative activities and relaxed social settings…" /><button type="button" className="button subtle" onClick={interpretPreferences} disabled={busy}>Interpret as an editable draft</button><small>Uses the configured language model when available; otherwise a basic local parser. Always review before saving.</small></label><button className="button primary" disabled={busy}>Save preferences</button></form>
      </>}
    </div></main>
    {feedbackId && <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setFeedbackId(""); }}><form className="modal panel" onSubmit={submitFeedback}><button type="button" className="modal-close" onClick={() => setFeedbackId("")}>×</button><p className="eyebrow">AFTER THE OUTING</p><h2>How did it go?</h2><label>Enjoyment<select name="enjoyment" required><option value="">Choose a rating</option><option value="1">1 — Not for me</option><option value="2">2 — Could be better</option><option value="3">3 — It was okay</option><option value="4">4 — Had a good time</option><option value="5">5 — Would do it again</option></select></label><label>Would you do something similar again?<select name="wouldRepeat"><option value="yes">Yes</option><option value="no">No</option></select></label><RatingSelect name="adventure" label="Adventure level" /><RatingSelect name="socialAtmosphere" label="Social atmosphere" /><RatingSelect name="valueForMoney" label="Value for money" /><RatingSelect name="difficulty" label="Difficulty" /><label>Anything else? <textarea name="comments" rows={3} maxLength={2000} /></label><button className="button primary" disabled={busy || !groupId}>Save feedback</button></form></div>}
  </div>;
}

function splitList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: ReactNode; description: string }) { return <section className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted heading-description">{description}</p></section>; }
function Notice({ children, type }: { children: ReactNode; type: "error" | "success" }) { return <div className={`notice ${type}`} role={type === "error" ? "alert" : "status"}>{children}</div>; }
function VoteSummary({ group }: { group: Group }) {
  const items = group.shortlists?.[0]?.items ?? [];
  if (!items.length) return null;
  return <section className="compare-panel"><div className="section-heading"><div><p className="eyebrow">COMPARE YOUR OPTIONS</p><h2>Group vote</h2></div><span className="small-note">Members can change their vote anytime</span></div><div className="compare-scroll"><table><thead><tr><th>Experience</th><th>Price range</th><th>Time</th><th>Yes</th><th>Maybe</th><th>No</th></tr></thead><tbody>{items.map(({ experience }) => { const votes = group.votes?.filter((vote) => vote.experienceId === experience.id) ?? []; return <tr key={experience.id}><th scope="row">{experience.name}</th><td>{money(experience.priceMin, experience.priceMax, experience.currency)}</td><td>{experience.durationMins ? `${Math.round(experience.durationMins / 60 * 10) / 10} hr` : "Not listed"}</td><td>{votes.filter((vote) => vote.choice === "YES").length}</td><td>{votes.filter((vote) => vote.choice === "MAYBE").length}</td><td>{votes.filter((vote) => vote.choice === "NO").length}</td></tr>; })}</tbody></table></div></section>;
}
function Metric({ label, value, detail }: { label: string; value: ReactNode; detail: string }) { return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function RatingSelect({ name, label }: { name: string; label: string }) { return <label>{label} <small>Optional</small><select name={name}><option value="">Skip</option>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>; }
function ExperienceCard({ item, rank, reasons, score, predictedEnjoyment, modelVersion, saved, onSave, onTried, onVote, onFeedback }: {
  item: Experience;
  rank?: number;
  reasons?: string[];
  score?: number;
  predictedEnjoyment?: Record<string, number>;
  modelVersion?: string | null;
  saved: boolean;
  onSave: () => void;
  onTried: () => void;
  onVote: (choice: string) => void;
  onFeedback: () => void;
}) {
  return (
    <article className="experience-card">
      <div className={`card-art art-${item.category.toLowerCase()}`}>
        <span className="card-category">{item.category}</span>
        <span className="card-symbol">{symbol(item.category)}</span>
        {rank && <span className="rank">#{rank}</span>}
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <h3>{item.name}</h3>
          {item.isSample && <span className="sample-tag">SAMPLE IDEA</span>}
        </div>
        <p className="card-description">{item.description}</p>
        <div className="meta-row">
          <span>{money(item.priceMin, item.priceMax, item.currency)}</span>
          <span>{item.durationMins ? `${Math.round((item.durationMins / 60) * 10) / 10} hr` : "Duration not listed"}</span>
          <span>{item.setting?.toLowerCase() ?? "setting unverified"}</span>
          <span>{item.intensity ? `${item.intensity.toLowerCase()} effort` : "effort unverified"}</span>
        </div>
        {item.locationName && (
          <div className="location-line">
            {item.locationName}
            {item.eventLocalDate && ` · ${item.eventLocalDate} ${item.eventLocalTime ?? ""} ${item.eventTimeZone ?? ""}`}
          </div>
        )}
        {reasons?.length ? (
          <div className="why">
            <strong>Why it fits</strong>
            <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            {score != null && <small>Group score · {Math.round(score * 100)} / 100</small>}
            {predictedEnjoyment && Object.keys(predictedEnjoyment).length > 0 && <p className="predicted-note">Learned enjoyment estimate: {Math.min(...Object.values(predictedEnjoyment)).toFixed(1)}–{Math.max(...Object.values(predictedEnjoyment)).toFixed(1)} / 5 across members · {modelVersion}</p>}
          </div>
        ) : null}
        <div className="card-actions">
          <button className={`button ${saved ? "subtle" : "outline"}`} onClick={onSave}>{saved ? "On shortlist" : "+ Shortlist"}</button>
          <button className="button text-button" onClick={onTried}>Tried it</button>
          <div className="vote-buttons" aria-label="Vote on this experience"><button onClick={() => onVote("YES")}>Yes</button><button onClick={() => onVote("MAYBE")}>Maybe</button><button onClick={() => onVote("NO")}>No</button></div>
          <button className="button text-button" onClick={onFeedback}>Record outing feedback</button>
        </div>
        {item.bookingUrl && <a className="source-link" href={item.bookingUrl} target="_blank" rel="noreferrer">View source and booking details</a>}
        <p className="sample-disclaimer">
          {item.isSample
            ? "Development sample. Not a verified venue, price, or availability listing."
            : `${item.source}${item.lastVerifiedAt ? ` · checked ${new Date(item.lastVerifiedAt).toLocaleDateString()}` : ""}`}
        </p>
      </div>
    </article>
  );
}
function symbol(category: string) { return ({ Creative: "✳", Adventure: "↗", Outdoors: "⌁", Games: "◇", Food: "♨", Puzzle: "▦" } as Record<string, string>)[category] ?? "✦"; }

export { App };

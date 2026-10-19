import { useEffect } from "react";
import { useAppPageContext } from "../hooks/useAppPageContext";
import { PageHeading } from "../components/PageHeading";
import { ExperienceCard } from "../components/ExperienceCard";

const placeCategories = [
  ["entertainment", "Entertainment"],
  ["leisure", "Leisure & outdoors"],
  ["catering", "Food & drink"],
  ["sport", "Sports"],
  ["tourism", "Tourism & sights"],
] as const;

export function DiscoverPage() {
  const {
    groups,
    groupId,
    setGroupId,
    experiences,
    loadingPlaces,
    hasMorePlaces,
    loadMorePlaces,
    useCurrentLocation,
    suggestions,
    invalidateRecommendations,
    enjoymentModelVersion,
    filters,
    setFilters,
    busy,
    draftPreferences,
    setFeedbackId,
    shortlistedIds,
    recommend,
    searchPlaces,
    addToShortlist,
    vote,
    markTried,
  } = useAppPageContext();
  const selectedGroup = groups.find((group) => group.id === groupId);
  const centerLatitude = selectedGroup?.preferences?.homeLatitude ?? draftPreferences.homeLatitude;
  const centerLongitude = selectedGroup?.preferences?.homeLongitude ?? draftPreferences.homeLongitude;
  const orderedSuggestions = suggestions;

  useEffect(() => {
    invalidateRecommendations();
    if (!groupId || loadingPlaces) return;
    const timer = window.setTimeout(() => void recommend(filters, true, experiences.map(({ id }) => id), experiences), 250);
    return () => window.clearTimeout(timer);
  }, [experiences, filters.q, filters.category, filters.budget, filters.intensity, filters.duration, filters.radiusKm, filters.setting, groupId, loadingPlaces, invalidateRecommendations, recommend]);

  return (
    <>
      <PageHeading
        eyebrow="HANGOUT PICKS FOR YOUR GROUP"
        title={<>Find your next <em>hangout.</em></>}
        description="Find real places your group can enjoy, starting with the closest options. A group with one member gets picks for that person."
      />
      <div className="discover-toolbar">
        <label className="select-label">
          GROUP PICKS FOR
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">Choose a group</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <button className="button primary" onClick={() => void recommend(filters, false, experiences.map(({ id }) => id), experiences)} disabled={busy || !groupId}>
          {busy ? "Finding ideas…" : "✦ Find group picks"}
        </button>
      </div>

      <form className="place-search panel" onSubmit={searchPlaces}>
        <div>
          <p className="eyebrow">FILTER GROUP PICKS</p>
          <p>Search by activity or location to refresh the picks for your selected group.</p>
        </div>
        <input
          aria-label="Search activities or keywords"
          placeholder="Search activities or keywords"
          value={filters.q}
          onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))}
        />
        <input
          aria-label="City"
          placeholder="City (optional)"
          value={filters.city}
          onChange={(event) => setFilters((old) => ({ ...old, city: event.target.value }))}
        />
        <input
          aria-label="Country code"
          placeholder="Country code"
          maxLength={2}
          value={filters.country}
          onChange={(event) => setFilters((old) => ({ ...old, country: event.target.value.toUpperCase() }))}
        />
        <button type="button" className="button subtle" onClick={useCurrentLocation}>
          Use my location
        </button>
        <button className="button dark" disabled={loadingPlaces}>
          {loadingPlaces ? "Searching…" : "Search places"}
        </button>
      </form>

      <div className="filters" aria-label="Place filters">
        <select aria-label="Category" value={filters.category} onChange={(event) => setFilters((old) => ({ ...old, category: event.target.value }))}>
          <option value="">All categories</option>
          {placeCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input
          aria-label="Maximum price per person"
          placeholder="Max price / person"
          inputMode="numeric"
          value={filters.budget}
          onChange={(event) => setFilters((old) => ({ ...old, budget: event.target.value }))}
        />
        <select aria-label="Setting" value={filters.setting} onChange={(event) => setFilters((old) => ({ ...old, setting: event.target.value }))}>
          <option value="">Any setting</option>
          <option value="INDOOR">Indoor</option>
          <option value="OUTDOOR">Outdoor</option>
        </select>
        <select aria-label="Maximum intensity" value={filters.intensity} onChange={(event) => setFilters((old) => ({ ...old, intensity: event.target.value }))}>
          <option value="">Any intensity</option>
          <option value="LOW">Low</option>
          <option value="MODERATE">Moderate</option>
          <option value="HIGH">High</option>
        </select>
        <input aria-label="Maximum duration in minutes" placeholder="Max duration / min" inputMode="numeric" value={filters.duration} onChange={(event) => setFilters((old) => ({ ...old, duration: event.target.value }))} />
        <select aria-label="Search radius" value={filters.radiusKm} onChange={(event) => setFilters((old) => ({ ...old, radiusKm: event.target.value }))}>
          {[5, 10, 25, 50, 100].map((radius) => <option key={radius} value={radius}>Within {radius} km</option>)}
        </select>
      </div>

      <p className="small-note">Powered by Geoapify · OpenStreetMap data. {loadingPlaces ? "Updating places…" : "Prices, setting, and effort appear only when listed."}</p>
      <section className="nearby-results">
        <div className="section-heading">
          <div><p className="eyebrow">RETRIEVED NEAR YOU</p><h2>Nearby spots</h2></div>
          <span className="small-note">{experiences.length} spots loaded</span>
        </div>
        {experiences.length ? <div className="cards">
          {experiences.map((item, index) => (
            <ExperienceCard key={item.id} item={item} rank={index + 1} saved={shortlistedIds.has(item.id)}
              onSave={() => addToShortlist(item.id)} onTried={() => markTried(item.id, true)}
              onVote={(choice) => vote(item.id, choice)} onFeedback={() => setFeedbackId(item.id)} />
          ))}
        </div> : <p className="small-note">No spots match this search yet. Try a wider radius or clear a filter.</p>}
        {hasMorePlaces && <button className="button subtle load-more" disabled={loadingPlaces} onClick={() => void loadMorePlaces()}>{loadingPlaces ? "Loading spots…" : "Load more spots"}</button>}
      </section>
      <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">MATCHED TO YOUR GROUP</p>
              <h2>Group picks</h2>
            </div>
            <span className="small-note">{busy || loadingPlaces ? "Updating group picks…" : `${orderedSuggestions.length} ranked picks`}</span>
          </div>
          {orderedSuggestions.length ? <div className="cards">
            {orderedSuggestions.map((item, index) => (
              <ExperienceCard
                key={item.activityId}
                item={item.experience}
                rank={index + 1}
                reasons={item.reasons}
                score={item.score}
                predictedEnjoyment={item.predictedEnjoyment}
                modelVersion={enjoymentModelVersion}
                saved={shortlistedIds.has(item.activityId)}
                onSave={() => addToShortlist(item.activityId)}
                onTried={() => markTried(item.activityId, true)}
                onVote={(choice) => vote(item.activityId, choice)}
                onFeedback={() => setFeedbackId(item.activityId)}
              />
            ))}
          </div> : <div className="empty-state">
            <h3>{groupId ? "No group picks yet" : "Choose a group to get picks"}</h3>
            <p>{groupId ? (centerLatitude == null || centerLongitude == null ? "Set a home location in your preferences or use a city search to find nearby places." : "Try a wider radius or clear some filters.") : "Create a group or choose one above. A group with only you will get personal picks."}</p>
          </div>}
      </>
    </>
  );
}

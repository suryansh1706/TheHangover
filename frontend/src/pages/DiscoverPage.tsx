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

  useEffect(() => {
    invalidateRecommendations();
    if (!groupId) return;
    const timer = window.setTimeout(() => void recommend(filters, true), 350);
    return () => window.clearTimeout(timer);
  }, [filters.q, filters.category, filters.budget, filters.intensity, groupId, invalidateRecommendations, recommend]);

  return (
    <>
      <PageHeading
        eyebrow="NEARBY PLACES, FOR YOUR WHOLE GROUP"
        title={<>Find your next <em>hangout.</em></>}
        description="Explore real places around you, sorted by distance. Filter by activity, location, price, and more."
      />
      <div className="discover-toolbar">
        <label className="select-label">
          GROUP PICKS FOR
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">Choose a group</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <button className="button primary" onClick={() => void recommend(filters)} disabled={busy || !groupId}>
          {busy ? "Finding ideas…" : "✦ Find group picks"}
        </button>
      </div>

      <form className="place-search panel" onSubmit={searchPlaces}>
        <div>
          <p className="eyebrow">EXPLORE NEARBY</p>
          <p>Places are sorted nearest first. Your saved location is used automatically when available.</p>
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
        <select aria-label="Search radius" value={filters.radiusKm} onChange={(event) => setFilters((old) => ({ ...old, radiusKm: event.target.value }))}>
          {[5, 10, 25, 50, 100].map((radius) => <option key={radius} value={radius}>Within {radius} km</option>)}
        </select>
      </div>

      <p className="small-note">Powered by Geoapify · OpenStreetMap data. Prices, setting, and effort appear only when listed.</p>
      <div className="section-heading">
        <div>
          <p className="eyebrow">REAL PLACES AROUND YOU</p>
          <h2>Nearby places</h2>
        </div>
        <span className="small-note">{loadingPlaces ? "Updating places…" : `${experiences.length} places · nearest first`}</span>
      </div>
      {experiences.length ? (
        <div className="cards">
          {experiences.map((item) => (
            <ExperienceCard
              key={item.id}
              item={item}
              saved={shortlistedIds.has(item.id)}
              onSave={() => addToShortlist(item.id)}
              onTried={() => markTried(item.id, true)}
              onVote={(choice) => vote(item.id, choice)}
              onFeedback={() => setFeedbackId(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>{loadingPlaces ? "Finding places near you…" : "No nearby places to show"}</h3>
          <p>
            {draftPreferences.homeLatitude == null && !filters.city
              ? "Allow location access or enter a city to find real places nearby."
              : filters.budget
                ? "These listings do not include verified prices, so they cannot match a price limit. Try clearing it."
                : "Try a wider radius or clear some filters."}
          </p>
          <button className="button subtle" onClick={() => setFilters({ q: "", city: "", country: "IN", category: "", budget: "", intensity: "", setting: "", radiusKm: "10" })}>
            Clear filters
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">MATCHED TO YOUR GROUP</p>
              <h2>Group picks</h2>
            </div>
            <span className="small-note">Balances member fit, group novelty & diversity</span>
          </div>
          <div className="cards">
            {suggestions.map((item, index) => (
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
          </div>
        </>
      )}
    </>
  );
}

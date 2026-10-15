import { useAppPageContext } from "../hooks/useAppPageContext";
import { PageHeading } from "../components/PageHeading";
import { ExperienceCard } from "../components/ExperienceCard";

export function DiscoverPage() {
  const {
    groups,
    groupId,
    setGroupId,
    experiences,
    suggestions,
    enjoymentModelVersion,
    filters,
    setFilters,
    busy,
    eventKeyword,
    setEventKeyword,
    eventCity,
    setEventCity,
    eventCountry,
    setEventCountry,
    setFeedbackId,
    shortlistedIds,
    recommend,
    searchLiveEvents,
    addToShortlist,
    vote,
    markTried,
    categories,
  } = useAppPageContext();
  return (
    <>
      <PageHeading
        eyebrow="DISCOVERY, FOR YOUR WHOLE GROUP"
        title={
          <>
            Make a plan
            <br />
            <em>worth remembering.</em>
          </>
        }
        description="Find something fresh that fits your group’s interests and practical limits."
      />
      <div className="discover-toolbar">
        <label className="select-label">
          RECOMMEND FOR
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">Choose a group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary" onClick={recommend} disabled={busy || !groupId}>
          {busy ? "Finding ideas…" : "✦ Find group picks"}
        </button>
      </div>
      <div className="filters">
        <input
          placeholder="Search activities"
          aria-label="Search activities"
          value={filters.q}
          onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))}
        />
        <select
          aria-label="Category"
          value={filters.category}
          onChange={(event) => setFilters((old) => ({ ...old, category: event.target.value }))}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <input
          aria-label="Maximum price"
          placeholder="Max ₹ / person"
          inputMode="numeric"
          value={filters.budget}
          onChange={(event) => setFilters((old) => ({ ...old, budget: event.target.value }))}
        />
        <select
          aria-label="Maximum intensity"
          value={filters.intensity}
          onChange={(event) => setFilters((old) => ({ ...old, intensity: event.target.value }))}
        >
          <option value="">Any intensity</option>
          <option value="LOW">Low</option>
          <option value="MODERATE">Moderate</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <form className="event-search panel" onSubmit={searchLiveEvents}>
        <div>
          <p className="eyebrow">LIVE EVENT LISTINGS</p>
          <p>
            Search real events and venue details from Ticketmaster. Current prices appear only when
            the provider supplies them.
          </p>
        </div>
        <input
          aria-label="Event keyword"
          placeholder="Event keyword"
          value={eventKeyword}
          onChange={(event) => setEventKeyword(event.target.value)}
        />
        <input
          aria-label="Event city"
          placeholder="City"
          value={eventCity}
          onChange={(event) => setEventCity(event.target.value)}
        />
        <input
          aria-label="Event country code"
          placeholder="Country (e.g. US)"
          maxLength={2}
          value={eventCountry}
          onChange={(event) => setEventCountry(event.target.value.toUpperCase())}
        />
        <button className="button dark" disabled={busy}>
          Search events
        </button>
      </form>
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
      <div className="section-heading">
        <div>
          <p className="eyebrow">ACTIVITY IDEAS</p>
          <h2>Explore the possibilities</h2>
        </div>
        <span className="small-note">{experiences.length} listed</span>
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
          <h3>No activities match those filters</h3>
          <p>Try a broader search or clear a filter.</p>
          <button
            className="button subtle"
            onClick={() => setFilters({ q: "", category: "", budget: "", intensity: "" })}
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}

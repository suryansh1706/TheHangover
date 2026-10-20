import type { Experience, VoteChoice } from "../types";
import { money } from "../utils/format";
export function ExperienceCard({
  item,
  rank,
  score,
  memberScores,
  breakdown,
  saved,
  onSave,
  onTried,
  onVote,
  onFeedback,
}: {
  item: Experience;
  rank?: number;
  score?: number;
  memberScores?: Record<string, number>;
  breakdown?: Record<string, number | boolean>;
  saved: boolean;
  onSave: () => void;
  onTried: () => void;
  onVote: (choice: VoteChoice) => void;
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
        </div>
        {!!item.missingFields?.length && <span className="verification-badge" title={`Unverified: ${item.missingFields.join(", ")}`}>Details unverified</span>}
        <p className="card-description">{item.description}</p>
        <div className="meta-row">
          {item.distanceKm != null && <span>{item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} m away` : `${item.distanceKm.toFixed(1)} km away`}</span>}
          <span>{money(item.priceMin, item.priceMax, item.currency)}</span>
          <span>
            {item.durationMins
              ? `${Math.round((item.durationMins / 60) * 10) / 10} hr`
              : "Duration not listed"}
          </span>
          <span>{item.setting?.toLowerCase() ?? "setting unverified"}</span>
          <span>
            {item.intensity ? `${item.intensity.toLowerCase()} effort` : "effort unverified"}
          </span>
        </div>
        {item.locationName && (
          <div className="location-line">
            {item.locationName}
            {item.eventLocalDate &&
              ` · ${item.eventLocalDate} ${item.eventLocalTime ?? ""} ${item.eventTimeZone ?? ""}`}
          </div>
        )}
        {score != null && breakdown && typeof breakdown.preferenceContribution === "number" && (
          <details className="score-details">
            <summary>How is the {Math.round(score * 100)} / 100 score calculated?</summary>
            <p className="score-formula">The score combines group preference fit and novelty, then adjusts for listing quality and place details.</p>
            <dl className="score-breakdown">
              <div><dt>Preference fit <small>(55% weakest member + 25% group average)</small></dt><dd>+{scorePoints(breakdown.preferenceContribution)} pts</dd></div>
              <div><dt>Novelty <small>(20%; based on who has tried it)</small></dt><dd>+{scorePoints(breakdown.noveltyContribution)} pts</dd></div>
              <div><dt>Matched filters</dt><dd>+{scorePoints(breakdown.filterBonus)} pts</dd></div>
              <div><dt>Popularity</dt><dd>+{scorePoints(breakdown.popularityBonus)} pts</dd></div>
              <div><dt>Distance from home</dt><dd>+{scorePoints(breakdown.proximityBonus)} pts</dd></div>
              <div><dt>Unverified details</dt><dd>−{scorePoints(breakdown.missingInfoPenalty)} pts</dd></div>
            </dl>
            {!!memberScores && Object.keys(memberScores).length > 1 && (
              <p className="member-fit-note">Member fit: {Object.values(memberScores).map((value, index) => `Member ${index + 1} ${Math.round(value * 100)}%`).join(" · ")}</p>
            )}
            <small className="score-note">Contributions are added, then the result is capped between 0 and 100.</small>
          </details>
        )}
        <div className="card-actions">
          <button className={`button ${saved ? "subtle" : "outline"}`} onClick={onSave}>
            {saved ? "On shortlist" : "+ Shortlist"}
          </button>
          <button className="button text-button" onClick={onTried}>
            Tried it
          </button>
          <div className="vote-buttons" aria-label="Vote on this experience">
            <button onClick={() => onVote("YES")}>Yes</button>
            <button onClick={() => onVote("MAYBE")}>Maybe</button>
            <button onClick={() => onVote("NO")}>No</button>
          </div>
          <button className="button text-button" onClick={onFeedback}>
            Record outing feedback
          </button>
        </div>
        {item.bookingUrl && (
          <a className="source-link" href={item.bookingUrl} target="_blank" rel="noreferrer">
            View source and booking details
          </a>
        )}
        <p className="source-note">
          {`${item.source}${item.lastVerifiedAt ? ` · checked ${new Date(item.lastVerifiedAt).toLocaleDateString()}` : ""}`}
        </p>
      </div>
    </article>
  );
}
function scorePoints(value: number | boolean | undefined) {
  return typeof value === "number" ? (value * 100).toFixed(1) : "0.0";
}
function symbol(category: string) {
  return (
    (
      {
        Creative: "✳",
        Adventure: "↗",
        Outdoors: "⌁",
        Games: "◇",
        Food: "♨",
        Puzzle: "▦",
      } as Record<string, string>
    )[category] ?? "✦"
  );
}

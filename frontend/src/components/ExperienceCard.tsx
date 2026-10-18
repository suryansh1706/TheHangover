import type { Experience, VoteChoice } from "../types";
import { money } from "../utils/format";
export function ExperienceCard({
  item,
  rank,
  reasons,
  score,
  predictedEnjoyment,
  modelVersion,
  saved,
  onSave,
  onTried,
  onVote,
  onFeedback,
}: {
  item: Experience;
  rank?: number;
  reasons?: string[];
  score?: number;
  predictedEnjoyment?: Record<string, number>;
  modelVersion?: string | null;
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
        {reasons?.length ? (
          <div className="why">
            <strong>Why it fits</strong>
            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {score != null && <small>Group score · {Math.round(score * 100)} / 100</small>}
            {predictedEnjoyment && Object.keys(predictedEnjoyment).length > 0 && (
              <p className="predicted-note">
                Learned enjoyment estimate:{" "}
                {Math.min(...Object.values(predictedEnjoyment)).toFixed(1)}–
                {Math.max(...Object.values(predictedEnjoyment)).toFixed(1)} / 5 across members ·{" "}
                {modelVersion}
              </p>
            )}
          </div>
        ) : null}
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

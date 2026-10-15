import type { Group } from "../types";
import { money } from "../utils/format";
export function VoteSummary({ group }: { group: Group }) {
  const items = group.shortlists?.[0]?.items ?? [];
  if (!items.length) return null;
  return (
    <section className="compare-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">COMPARE YOUR OPTIONS</p>
          <h2>Group vote</h2>
        </div>
        <span className="small-note">Members can change their vote anytime</span>
      </div>
      <div className="compare-scroll">
        <table>
          <thead>
            <tr>
              <th>Experience</th>
              <th>Price range</th>
              <th>Time</th>
              <th>Yes</th>
              <th>Maybe</th>
              <th>No</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ experience }) => {
              const votes =
                group.votes?.filter((vote) => vote.experienceId === experience.id) ?? [];
              return (
                <tr key={experience.id}>
                  <th scope="row">{experience.name}</th>
                  <td>{money(experience.priceMin, experience.priceMax, experience.currency)}</td>
                  <td>
                    {experience.durationMins
                      ? `${Math.round((experience.durationMins / 60) * 10) / 10} hr`
                      : "Not listed"}
                  </td>
                  <td>{votes.filter((vote) => vote.choice === "YES").length}</td>
                  <td>{votes.filter((vote) => vote.choice === "MAYBE").length}</td>
                  <td>{votes.filter((vote) => vote.choice === "NO").length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

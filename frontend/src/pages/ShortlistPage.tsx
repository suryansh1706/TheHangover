import { useAppPageContext } from "../hooks/useAppPageContext";
import { PageHeading } from "../components/PageHeading";
import { VoteSummary } from "../components/VoteSummary";
import { ExperienceCard } from "../components/ExperienceCard";

export function ShortlistPage() {
  const {
    groups,
    groupId,
    setGroupId,
    setFeedbackId,
    activeGroup,
    addToShortlist,
    vote,
    markTried,
    setPage,
  } = useAppPageContext();
  return (
    <>
      <PageHeading
        eyebrow="DECIDE TOGETHER"
        title={
          <>
            A shortlist full
            <br />
            <em>of possibilities.</em>
          </>
        }
        description="Save group ideas, compare everyone’s votes, and turn a pick into an outing."
      />
      {!activeGroup ? (
        <div className="empty-state">
          <h3>Pick a group first</h3>
          <p>Create or join a group to start a shortlist.</p>
          <button className="button primary" onClick={() => setPage("group")}>
            Go to groups
          </button>
        </div>
      ) : (
        <>
          <div className="discover-toolbar">
            <label className="select-label">
              GROUP
              <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <VoteSummary group={activeGroup} />
          {activeGroup.shortlists?.[0]?.items.length ? (
            <div className="cards">
              {activeGroup.shortlists[0].items.map(({ experience }) => (
                <ExperienceCard
                  key={experience.id}
                  item={experience}
                  saved
                  onSave={() => addToShortlist(experience.id)}
                  onTried={() => markTried(experience.id, true)}
                  onVote={(choice) => vote(experience.id, choice)}
                  onFeedback={() => setFeedbackId(experience.id)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>Your shortlist is waiting</h3>
              <p>Save experiences from Discover to collect your group’s options here.</p>
              <button className="button primary" onClick={() => setPage("discover")}>
                Explore activities
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

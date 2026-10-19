import { useState, type FormEvent } from "react";
import { useAppPageContext } from "../hooks/useAppPageContext";
import { PageHeading } from "../components/PageHeading";
import type { Setting, Intensity } from "../types";

export function GroupPage() {
  const [inviteEmail, setInviteEmail] = useState("");
  const {
    groups,
    busy,
    inviteToken,
    setInviteToken,
    inviteUrl,
    newGroup,
    setNewGroup,
    groupSettings,
    setGroupSettings,
    groupName,
    setGroupName,
    activeGroup,
    isGroupOwner,
    createGroup,
    joinGroup,
    createInvitation,
    saveGroupSettings,
    numOrNull,
    setNotice,
  } = useAppPageContext();
  async function copyInviteLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice("Invite link copied. It can be used once before it expires.");
    } catch {
      setNotice("Could not copy the invite link. Select and copy it from the field.");
    }
  }
  async function shareInviteLink() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Hangover group", text: "Join our group on The Hangover.", url: inviteUrl });
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) setNotice("Could not open the share menu.");
      }
      return;
    }
    await copyInviteLink();
  }
  function emailInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteUrl || !inviteEmail) return;
    window.location.href = `mailto:${encodeURIComponent(inviteEmail)}?subject=${encodeURIComponent(`Join ${activeGroup?.name ?? "our group"} on The Hangover`)}&body=${encodeURIComponent(`Join our group using this link: ${inviteUrl}`)}`;
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR PEOPLE, YOUR PLANS"
        title={
          <>
            Good things are
            <br />
            <em>better together.</em>
          </>
        }
        description="Create a private group or join with a secure invitation token."
      />
      <div className="group-grid">
        <section className="panel">
          <p className="eyebrow">START A GROUP</p>
          <h2>Bring your people in</h2>
          <form className="inline-form" onSubmit={createGroup}>
            <input
              value={newGroup}
              onChange={(event) => setNewGroup(event.target.value)}
              placeholder="e.g. The Sunday Crew"
              maxLength={80}
              required
            />
            <button className="button primary" disabled={busy}>
              Create group
            </button>
          </form>
        </section>
        <section className="panel">
          <p className="eyebrow">JOIN YOUR FRIENDS</p>
          <h2>Got an invite token?</h2>
          <form className="inline-form" onSubmit={joinGroup}>
            <input
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              placeholder="Paste the token here"
              required
            />
            <button className="button dark" disabled={busy}>
              Join group
            </button>
          </form>
        </section>
      </div>
      {activeGroup && (
        <section className="panel group-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR CURRENT GROUP</p>
              <h2>{activeGroup.name}</h2>
            </div>
            <button className="button subtle" onClick={createInvitation}>
              ＋ Create invite
            </button>
          </div>
          <p className="muted">
            {activeGroup.memberships.length} member
            {activeGroup.memberships.length === 1 ? "" : "s"}. Invite tokens expire after 7 days.
          </p>
          {inviteUrl && (
            <div className="invite-tools">
              <label className="full-field">
                Group invite link
                <input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} />
              </label>
              <div className="inline-form">
                <button type="button" className="button dark" onClick={() => void copyInviteLink()}>Copy link</button>
                <button type="button" className="button subtle" onClick={() => void shareInviteLink()}>Share link</button>
              </div>
              <form className="inline-form" onSubmit={emailInvite}>
                <input type="email" required placeholder="Friend’s email address" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
                <button className="button primary" type="submit">Email invite</button>
              </form>
              <p className="small-note">The email button opens a prefilled message in your email app. The invite link can be used once and expires in 7 days.</p>
            </div>
          )}
          <div className="member-list">
            {activeGroup.memberships.map((member) => (
              <div className="member" key={member.user.id}>
                <span className="avatar">{member.user.name.slice(0, 1).toUpperCase()}</span>
                <span>{member.user.name}</span>
                {member.role === "OWNER" && <small>ORGANIZER</small>}
              </div>
            ))}
          </div>
          <form className="preference-form group-settings-form" onSubmit={saveGroupSettings}>
            <div className="full-field">
              <p className="eyebrow">GROUP SETTINGS</p>
              <h3>Set shared outing limits</h3>
              <p className="small-note">
                These are group-wide hard limits. Member preferences and accessibility needs still
                apply too.
              </p>
            </div>
            <label>
              Group name
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={80}
                required
                disabled={!isGroupOwner}
              />
            </label>
            <label>
              Maximum budget per person (₹)
              <input
                type="number"
                min="0"
                max="1000000"
                value={groupSettings.budgetPerPerson ?? ""}
                onChange={(event) =>
                  setGroupSettings((old) => ({
                    ...old,
                    budgetPerPerson: numOrNull(event.target.value),
                  }))
                }
                placeholder="No group limit"
                disabled={!isGroupOwner}
              />
            </label>
            <label>
              Maximum outing duration (minutes)
              <input
                type="number"
                min="1"
                max="1440"
                value={groupSettings.maxDurationMins ?? ""}
                onChange={(event) =>
                  setGroupSettings((old) => ({
                    ...old,
                    maxDurationMins: numOrNull(event.target.value),
                  }))
                }
                placeholder="No group limit"
                disabled={!isGroupOwner}
              />
            </label>
            <label>
              Maximum travel distance (km)
              <input
                type="number"
                min="0"
                max="5000"
                step="any"
                value={groupSettings.maxDistanceKm ?? ""}
                onChange={(event) =>
                  setGroupSettings((old) => ({
                    ...old,
                    maxDistanceKm: numOrNull(event.target.value),
                  }))
                }
                placeholder="No group limit"
                disabled={!isGroupOwner}
              />
            </label>
            <label>
              Group home latitude
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                value={groupSettings.homeLatitude ?? ""}
                onChange={(event) =>
                  setGroupSettings((old) => ({
                    ...old,
                    homeLatitude: numOrNull(event.target.value),
                  }))
                }
                placeholder="Required for group distance"
                disabled={!isGroupOwner}
              />
            </label>
            <label>
              Group home longitude
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                value={groupSettings.homeLongitude ?? ""}
                onChange={(event) =>
                  setGroupSettings((old) => ({
                    ...old,
                    homeLongitude: numOrNull(event.target.value),
                  }))
                }
                placeholder="Required for group distance"
                disabled={!isGroupOwner}
              />
            </label>
            <label>
              Preferred setting
              <select
                value={groupSettings.setting}
                onChange={(event) =>
                  setGroupSettings((old) => ({
                    ...old,
                    setting: event.target.value as Setting,
                  }))
                }
                disabled={!isGroupOwner}
              >
                <option value="EITHER">Either</option>
                <option value="INDOOR">Indoors</option>
                <option value="OUTDOOR">Outdoors</option>
              </select>
            </label>
            <label>
              Maximum physical intensity
              <select
                value={groupSettings.maxIntensity}
                onChange={(event) =>
                  setGroupSettings((old) => ({
                    ...old,
                    maxIntensity: event.target.value as Intensity,
                  }))
                }
                disabled={!isGroupOwner}
              >
                <option value="LOW">Low</option>
                <option value="MODERATE">Moderate</option>
                <option value="HIGH">High</option>
              </select>
            </label>
            {isGroupOwner ? (
              <button className="button primary" disabled={busy}>
                Save group settings
              </button>
            ) : (
              <p className="small-note full-field">
                Only the group organizer can edit these settings.
              </p>
            )}
          </form>
        </section>
      )}
      {!groups.length && (
        <div className="empty-state">
          <h3>Your group starts here</h3>
          <p>Create a group above, then invite friends to explore and vote together.</p>
        </div>
      )}
    </>
  );
}

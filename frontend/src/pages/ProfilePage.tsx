import { useAppPageContext } from "../hooks/useAppPageContext";
import { PageHeading } from "../components/PageHeading";
import type { Setting, Intensity } from "../types";

export function ProfilePage() {
  const {
    busy,
    draftPreferences,
    numOrNull,
    setDraftPreferences,
    profileName,
    setProfileName,
    savePreferences,
    interpretPreferences,
    splitList,
  } = useAppPageContext();
  return (
    <>
      <PageHeading
        eyebrow="YOUR TASTE, OVER TIME"
        title={
          <>
            A little about
            <br />
            <em>your kind of fun.</em>
          </>
        }
        description="Set preferences that help the group find experiences you’ll feel good about."
      />
      <form className="panel preference-form" onSubmit={savePreferences}>
        <label>
          Your name
          <input
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        <label>
          Maximum budget per person (₹)
          <input
            type="number"
            min="0"
            max="1000000"
            value={draftPreferences.budgetPerPerson ?? ""}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                budgetPerPerson: numOrNull(event.target.value),
              }))
            }
            placeholder="No limit set"
          />
        </label>
        <label>
          Maximum travel distance (km)
          <input
            type="number"
            min="0"
            max="5000"
            value={draftPreferences.maxDistanceKm ?? ""}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                maxDistanceKm: numOrNull(event.target.value),
              }))
            }
            placeholder="No limit set"
          />
        </label>
        <label>
          Home latitude
          <input
            type="number"
            min="-90"
            max="90"
            step="any"
            value={draftPreferences.homeLatitude ?? ""}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                homeLatitude: numOrNull(event.target.value),
              }))
            }
            placeholder="Needed to apply travel distance"
          />
        </label>
        <label>
          Home longitude
          <input
            type="number"
            min="-180"
            max="180"
            step="any"
            value={draftPreferences.homeLongitude ?? ""}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                homeLongitude: numOrNull(event.target.value),
              }))
            }
            placeholder="Needed to apply travel distance"
          />
        </label>
        <label>
          Preferred setting
          <select
            value={draftPreferences.setting}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                setting: event.target.value as Setting,
              }))
            }
          >
            <option value="EITHER">Either</option>
            <option value="INDOOR">Indoors</option>
            <option value="OUTDOOR">Outdoors</option>
          </select>
        </label>
        <label>
          Maximum physical intensity
          <select
            value={draftPreferences.maxIntensity}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                maxIntensity: event.target.value as Intensity,
              }))
            }
          >
            <option value="LOW">Low</option>
            <option value="MODERATE">Moderate</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        <label>
          Interests <small>Comma separated</small>
          <input
            value={draftPreferences.preferredTypes.join(", ")}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                preferredTypes: splitList(event.target.value),
              }))
            }
            placeholder="creative, food, outdoors"
          />
        </label>
        <label>
          Avoid <small>Categories you don’t want recommended</small>
          <input
            value={draftPreferences.dislikedTypes.join(", ")}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                dislikedTypes: splitList(event.target.value),
              }))
            }
            placeholder="e.g. heights, competitive"
          />
        </label>
        <label>
          Accessibility needs <small>Only match catalog facts that are listed</small>
          <input
            value={draftPreferences.accessibility.join(", ")}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                accessibility: splitList(event.target.value),
              }))
            }
            placeholder="e.g. step-free access"
          />
        </label>
        <label>
          Dietary needs <small>Only match catalog facts that are listed</small>
          <input
            value={draftPreferences.dietaryNeeds.join(", ")}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                dietaryNeeds: splitList(event.target.value),
              }))
            }
            placeholder="e.g. vegetarian"
          />
        </label>
        <label className="full-field">
          Describe what you enjoy in your own words
          <textarea
            rows={3}
            maxLength={1000}
            value={draftPreferences.naturalLanguage ?? ""}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                naturalLanguage: event.target.value || null,
              }))
            }
            placeholder="We like creative activities and relaxed social settings…"
          />
          <button
            type="button"
            className="button subtle"
            onClick={interpretPreferences}
            disabled={busy}
          >
            Interpret as an editable draft
          </button>
          <small>
            Uses the configured language model when available; otherwise a basic local parser.
            Always review before saving.
          </small>
        </label>
        <button className="button primary" disabled={busy}>
          Save preferences
        </button>
      </form>
    </>
  );
}

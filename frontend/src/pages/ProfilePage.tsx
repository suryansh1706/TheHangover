import { useState } from "react";
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [anyIntensity, setAnyIntensity] = useState<boolean | null>(null);
  const isAnyIntensity = anyIntensity ?? draftPreferences.maxIntensity === "HIGH";

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Location is not available in this browser.");
      return;
    }
    setLocationMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setDraftPreferences((old) => ({
          ...old,
          homeLatitude: coords.latitude,
          homeLongitude: coords.longitude,
        }));
        setLocationMessage("Location added. You can adjust the coordinates below.");
      },
      () => setLocationMessage("Could not get your location. Check browser permissions or enter coordinates below."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

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
        <label className="full-field">
          Describe what you enjoy
          <textarea
            rows={5}
            maxLength={1000}
            value={draftPreferences.naturalLanguage ?? ""}
            onChange={(event) =>
              setDraftPreferences((old) => ({
                ...old,
                naturalLanguage: event.target.value || null,
              }))
            }
            placeholder="We like creative activities, relaxed social settings, and being outdoors…"
          />
        </label>
        <button
          type="button"
          className="button subtle"
          onClick={() => void interpretPreferences((any) => { setDetailsOpen(true); setAnyIntensity(any); })}
          disabled={busy}
        >
          Fill in for me
        </button>
        <small>
          We’ll suggest editable preferences from your description. Review them before saving.
        </small>

        <details
          className="preference-details full-field"
          open={detailsOpen}
          onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        >
          <summary>Review and edit details</summary>
          <div className="preference-details-fields">
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
                  setDraftPreferences((old) => ({ ...old, budgetPerPerson: numOrNull(event.target.value) }))
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
                  setDraftPreferences((old) => ({ ...old, maxDistanceKm: numOrNull(event.target.value) }))
                }
                placeholder="No limit set"
              />
            </label>
            <div className="full-field">
              <button type="button" className="button subtle" onClick={useMyLocation}>
                Use my location
              </button>
              {locationMessage && <small role="status">{locationMessage}</small>}
            </div>
            <label>
              Home latitude
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                value={draftPreferences.homeLatitude ?? ""}
                onChange={(event) =>
                  setDraftPreferences((old) => ({ ...old, homeLatitude: numOrNull(event.target.value) }))
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
                  setDraftPreferences((old) => ({ ...old, homeLongitude: numOrNull(event.target.value) }))
                }
                placeholder="Needed to apply travel distance"
              />
            </label>
            <label>
              Preferred setting
              <select
                value={draftPreferences.setting}
                onChange={(event) => setDraftPreferences((old) => ({ ...old, setting: event.target.value as Setting }))}
              >
                <option value="EITHER">Either</option>
                <option value="INDOOR">Indoors</option>
                <option value="OUTDOOR">Outdoors</option>
              </select>
            </label>
            <label>
              Maximum physical intensity
              <select
                value={isAnyIntensity ? "ANY" : draftPreferences.maxIntensity}
                onChange={(event) =>
                  {
                    const isAny = event.target.value === "ANY";
                    setAnyIntensity(isAny);
                    setDraftPreferences((old) => ({
                      ...old,
                      maxIntensity: isAny ? "HIGH" : (event.target.value as Intensity),
                    }));
                  }
                }
              >
                <option value="ANY">Any</option>
                <option value="LOW">Low</option>
                <option value="MODERATE">Moderate</option>
                <option value="HIGH">High</option>
              </select>
            </label>
            <label>
              Interests <small>Comma separated</small>
              <input
                value={draftPreferences.preferredTypes.join(", ")}
                onChange={(event) => setDraftPreferences((old) => ({ ...old, preferredTypes: splitList(event.target.value) }))}
                placeholder="creative, food, outdoors"
              />
            </label>
            <label>
              Avoid <small>Categories you don’t want recommended</small>
              <input
                value={draftPreferences.dislikedTypes.join(", ")}
                onChange={(event) => setDraftPreferences((old) => ({ ...old, dislikedTypes: splitList(event.target.value) }))}
                placeholder="e.g. heights, competitive"
              />
            </label>
            <label>
              Accessibility needs <small>Only match catalog facts that are listed</small>
              <input
                value={draftPreferences.accessibility.join(", ")}
                onChange={(event) => setDraftPreferences((old) => ({ ...old, accessibility: splitList(event.target.value) }))}
                placeholder="e.g. step-free access"
              />
            </label>
            <label>
              Dietary needs <small>Only match catalog facts that are listed</small>
              <input
                value={draftPreferences.dietaryNeeds.join(", ")}
                onChange={(event) => setDraftPreferences((old) => ({ ...old, dietaryNeeds: splitList(event.target.value) }))}
                placeholder="e.g. vegetarian"
              />
            </label>
          </div>
        </details>
        <button className="button primary" disabled={busy}>
          Save preferences
        </button>
      </form>
    </>
  );
}

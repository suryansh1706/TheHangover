import type { FormEvent } from "react";
import { api } from "../api";
import { RatingSelect } from "../components/RatingSelect";

type Action = (work: () => Promise<void>) => Promise<void>;
export function FeedbackModal({
  feedbackId,
  groupId,
  busy,
  setFeedbackId,
  setNotice,
  act,
}: {
  feedbackId: string;
  groupId: string;
  busy: boolean;
  setFeedbackId: (id: string) => void;
  setNotice: (message: string) => void;
  act: Action;
}) {
  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optionalRating = (key: string) => (form.get(key) ? Number(form.get(key)) : undefined);
    await act(async () => {
      // Feedback intentionally creates, completes, then rates an outing in three API calls.
      const outing = await api<{ outing: { id: string } }>(`/api/groups/${groupId}/outings`, {
        method: "POST",
        body: JSON.stringify({ experienceId: feedbackId }),
      });
      await api(`/api/outings/${outing.outing.id}/complete`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      await api(`/api/outings/${outing.outing.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          enjoyment: Number(form.get("enjoyment")),
          wouldRepeat: form.get("wouldRepeat") === "yes",
          adventure: optionalRating("adventure"),
          socialAtmosphere: optionalRating("socialAtmosphere"),
          valueForMoney: optionalRating("valueForMoney"),
          difficulty: optionalRating("difficulty"),
          comments: form.get("comments") || undefined,
        }),
      });
      setFeedbackId("");
      setNotice("Thanks for the feedback. It will help tune future group picks.");
    });
  }
  if (!feedbackId) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) setFeedbackId("");
      }}
    >
      <form className="modal panel" onSubmit={submitFeedback}>
        <button type="button" className="modal-close" onClick={() => setFeedbackId("")}>
          \u00D7
        </button>
        <p className="eyebrow">AFTER THE OUTING</p>
        <h2>How did it go?</h2>
        <label>
          Enjoyment
          <select name="enjoyment" required>
            <option value="">Choose a rating</option>
            <option value="1">1 \u2014 Not for me</option>
            <option value="2">2 \u2014 Could be better</option>
            <option value="3">3 \u2014 It was okay</option>
            <option value="4">4 \u2014 Had a good time</option>
            <option value="5">5 \u2014 Would do it again</option>
          </select>
        </label>
        <label>
          Would you do something similar again?
          <select name="wouldRepeat">
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <RatingSelect name="adventure" label="Adventure level" />
        <RatingSelect name="socialAtmosphere" label="Social atmosphere" />
        <RatingSelect name="valueForMoney" label="Value for money" />
        <RatingSelect name="difficulty" label="Difficulty" />
        <label>
          Anything else? <textarea name="comments" rows={3} maxLength={2000} />
        </label>
        <button className="button primary" disabled={busy || !groupId}>
          Save feedback
        </button>
      </form>
    </div>
  );
}

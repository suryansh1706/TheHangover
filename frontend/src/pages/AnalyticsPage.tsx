import { useAppPageContext } from "../hooks/useAppPageContext";
import { PageHeading } from "../components/PageHeading";
import { Metric } from "../components/Metric";

export function AnalyticsPage() {
  const { analytics } = useAppPageContext();
  return (
    <>
      <PageHeading
        eyebrow="LEARN FROM REAL OUTINGS"
        title={
          <>
            Better plans,
            <br />
            <em>with every review.</em>
          </>
        }
        description="See group novelty, member feedback, and honest model evaluation as real outing data is collected."
      />
      {!analytics ? (
        <div className="empty-state">Loading your analytics…</div>
      ) : (
        <>
          <div className="metric-grid">
            <Metric
              label="Outings rated"
              value={analytics.personal.outingsRated}
              detail={`${analytics.personal.feedbackCount} ratings from you`}
            />
            <Metric
              label="Your average enjoyment"
              value={
                analytics.personal.averageEnjoyment == null
                  ? "—"
                  : `${analytics.personal.averageEnjoyment} / 5`
              }
              detail="Based on your submitted feedback"
            />
            <Metric
              label="Group novelty"
              value={
                analytics.recommendations.averageGroupNovelty == null
                  ? "—"
                  : `${Math.round(analytics.recommendations.averageGroupNovelty * 100)}%`
              }
              detail={`${analytics.recommendations.runs} recommendation runs recorded`}
            />
            <Metric
              label="Predicted vs. actual"
              value={
                analytics.personal.observedPredictionMae == null
                  ? "—"
                  : `${analytics.personal.observedPredictionMae} stars MAE`
              }
              detail={`${analytics.personal.predictedFeedbackCount} predictions matched to your ratings`}
            />
          </div>
          <section className="panel evaluation-panel">
            <p className="eyebrow">OFFLINE MODEL EVALUATION</p>
            {analytics.offlineEvaluation ? (
              <>
                <h2>{analytics.offlineEvaluation.selectedModel}</h2>
                <p className="muted">
                  Selected by the lowest mean absolute error on held-out outings. Validation split:{" "}
                  {analytics.offlineEvaluation.validationMethod}.
                </p>
                <div className="evaluation-numbers">
                  <span>
                    <b>{analytics.offlineEvaluation.mae.toFixed(2)}</b>
                    <small>Model MAE</small>
                  </span>
                  <span>
                    <b>{analytics.offlineEvaluation.baselineMae.toFixed(2)}</b>
                    <small>Mean baseline MAE</small>
                  </span>
                  <span>
                    <b>{analytics.offlineEvaluation.ratings}</b>
                    <small>Real feedback rows</small>
                  </span>
                  <span>
                    <b>{analytics.offlineEvaluation.outings}</b>
                    <small>Separate outings</small>
                  </span>
                </div>
                <p className="small-note">
                  Last evaluated{" "}
                  {new Date(analytics.offlineEvaluation.createdAt).toLocaleDateString()}. No
                  synthetic ratings are used.
                </p>
              </>
            ) : (
              <div className="empty-copy">
                <h3>Not enough feedback to evaluate a model yet</h3>
                <p>
                  The system waits for at least 30 feature-linked ratings from 5 separate outings.
                  Until then, it uses transparent preference and content scoring. The threshold
                  prevents us from claiming reliability from a handful of ratings.
                </p>
              </div>
            )}
          </section>
          <p className="analytics-footnote">
            “Predicted vs. actual” is observed prediction error on your later feedback. The offline
            MAE above uses group-held-out validation and is the appropriate measure for comparing
            candidate models.
          </p>
        </>
      )}
    </>
  );
}

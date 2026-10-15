import { Router } from "express";
import { prisma } from "./db.js";
import { requireAuth } from "./security.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get("/", async (request, response, next) => {
  try {
    const uid = (request as typeof request & { userId: string }).userId;
    const [feedback, memberships, evaluation] = await Promise.all([
      prisma.feedback.findMany({ where: { userId: uid }, select: { outingId: true, enjoyment: true, predictionAtTime: true }, orderBy: { createdAt: "desc" } }),
      prisma.membership.findMany({ where: { userId: uid }, select: { groupId: true } }),
      prisma.modelEvaluation.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);
    const groupIds = memberships.map(({ groupId }) => groupId);
    const runs = groupIds.length ? await prisma.recommendationRun.findMany({ where: { groupId: { in: groupIds } }, select: { resultSnapshot: true, createdAt: true } }) : [];
    const allFeedback = await prisma.feedback.findMany({ where: { userId: uid, predictionAtTime: { not: null } }, select: { enjoyment: true, predictionAtTime: true } });
    const observedMae = allFeedback.length ? allFeedback.reduce((sum, item) => sum + Math.abs(item.enjoyment - (item.predictionAtTime ?? item.enjoyment)), 0) / allFeedback.length : null;
    const recommendations = runs.flatMap((run) => {
      const result = run.resultSnapshot as { recommendations?: Array<{ breakdown?: { novelty?: number; meetsHardConstraints?: boolean } }> };
      return result.recommendations ?? [];
    });
    const constraintsChecked = recommendations.filter((item) => typeof item.breakdown?.meetsHardConstraints === "boolean");
    const values = recommendations.map((item) => item.breakdown?.novelty).filter((value): value is number => typeof value === "number");
    return response.json({
      personal: {
        feedbackCount: feedback.length,
        outingsRated: new Set(feedback.map(({ outingId }) => outingId)).size,
        averageEnjoyment: feedback.length ? Number((feedback.reduce((sum, item) => sum + item.enjoyment, 0) / feedback.length).toFixed(2)) : null,
        predictedFeedbackCount: allFeedback.length,
        observedPredictionMae: observedMae == null ? null : Number(observedMae.toFixed(2)),
      },
      recommendations: {
        runs: runs.length,
        averageGroupNovelty: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null,
        hardConstraintCompliance: constraintsChecked.length ? constraintsChecked.filter((item) => item.breakdown?.meetsHardConstraints).length / constraintsChecked.length : null,
      },
      offlineEvaluation: evaluation ? {
        modelVersion: evaluation.modelVersion,
        selectedModel: evaluation.selectedModel,
        ratings: evaluation.ratings,
        outings: evaluation.outings,
        mae: evaluation.mae,
        baselineMae: evaluation.baselineMae,
        candidateMae: evaluation.candidateMae,
        validationMethod: evaluation.validationMethod,
        createdAt: evaluation.createdAt,
      } : null,
    });
  } catch (error) { return next(error); }
});

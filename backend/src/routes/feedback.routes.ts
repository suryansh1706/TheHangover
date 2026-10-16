import { Router } from "express";
import { z } from "zod";
import { prisma } from "./db.js";
import { mlServiceTimeoutMs, mlServiceUrl } from "./mlService.js";
import { requireAuth } from "./security.js";

export const outingsRouter = Router();
outingsRouter.use(requireAuth);
const currentUserId = (request: Express.Request) => (request as Express.Request & { userId: string }).userId;

outingsRouter.post("/groups/:groupId/outings", async (request, response, next) => {
  try {
    const uid = currentUserId(request);
    const member = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: request.params.groupId, userId: uid } }, select: { id: true } });
    if (!member) return response.status(404).json({ error: "Group not found" });
    const parsed = z.object({ experienceId: z.string().min(1), scheduledAt: z.string().datetime().optional() }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Invalid outing details" });
    const outing = await prisma.outing.create({ data: { groupId: request.params.groupId, experienceId: parsed.data.experienceId, scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null } });
    return response.status(201).json({ outing });
  } catch (error) { return next(error); }
});

outingsRouter.patch("/outings/:outingId/complete", async (request, response, next) => {
  try {
    const uid = currentUserId(request);
    const outing = await prisma.outing.findFirst({ where: { id: request.params.outingId, group: { memberships: { some: { userId: uid } } } }, select: { id: true } });
    if (!outing) return response.status(404).json({ error: "Outing not found" });
    const updated = await prisma.outing.update({ where: { id: outing.id }, data: { status: "COMPLETED" } });
    return response.json({ outing: updated });
  } catch (error) { return next(error); }
});

outingsRouter.post("/outings/:outingId/feedback", async (request, response, next) => {
  try {
    const uid = currentUserId(request);
    const parsed = z.object({
      enjoyment: z.number().int().min(1).max(5),
      wouldRepeat: z.boolean(),
      adventure: z.number().int().min(1).max(5).optional(),
      socialAtmosphere: z.number().int().min(1).max(5).optional(),
      valueForMoney: z.number().int().min(1).max(5).optional(),
      difficulty: z.number().int().min(1).max(5).optional(),
      comments: z.string().trim().max(2000).optional(),
    }).strict().safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Invalid feedback", details: parsed.error.flatten() });
    const outing = await prisma.outing.findFirst({ where: {
      id: request.params.outingId,
      status: "COMPLETED",
      group: { memberships: { some: { userId: uid } } },
    } });
    if (!outing) return response.status(404).json({ error: "Completed outing not found" });
    const existing = await prisma.feedback.findUnique({ where: { outingId_userId: { outingId: outing.id, userId: uid } }, select: { id: true } });
    if (existing) return response.status(409).json({ error: "Feedback has already been submitted for this outing" });
    const activity = await prisma.experience.findUnique({ where: { id: outing.experienceId }, select: { category: true, tags: true } });
    const lastRun = await prisma.recommendationRun.findFirst({ where: { groupId: outing.groupId }, orderBy: { createdAt: "desc" } });
    const savedResults = lastRun?.resultSnapshot as { enjoymentModelVersion?: string; recommendations?: Array<{ activityId: string; memberFeatures?: Record<string, Record<string, number>>; predictedEnjoyment?: Record<string, number> }> } | undefined;
    const savedSuggestion = savedResults?.recommendations?.find((entry) => entry.activityId === outing.experienceId);
    const predictedEnjoyment = savedSuggestion?.predictedEnjoyment?.[uid];
    const featureSnapshot = savedSuggestion?.memberFeatures?.[uid];
    const feedback = await prisma.$transaction(async (tx) => {
      const saved = await tx.feedback.create({ data: { ...parsed.data, outingId: outing.id, userId: uid, experienceId: outing.experienceId, predictionAtTime: predictedEnjoyment ?? null, modelVersion: savedResults?.enjoymentModelVersion ?? null, featureSnapshot: featureSnapshot ?? undefined } });
      if (activity && (parsed.data.enjoyment >= 4 || parsed.data.enjoyment <= 2)) {
        const preferences = await tx.preference.findUnique({ where: { userId: uid } });
        const positive = parsed.data.enjoyment >= 4;
        const normalizedCategory = activity.category.toLocaleLowerCase();
        const normalizedTags = new Set(activity.tags.map((tag) => tag.toLocaleLowerCase()));
        if (positive) {
          await tx.preference.upsert({
            where: { userId: uid },
            create: { userId: uid, preferredTypes: [activity.category], preferredTags: activity.tags },
            update: {
              preferredTypes: Array.from(new Set([...(preferences?.preferredTypes ?? []), activity.category])),
              preferredTags: Array.from(new Set([...(preferences?.preferredTags ?? []), ...activity.tags])),
              dislikedTypes: (preferences?.dislikedTypes ?? []).filter((item) => item.toLocaleLowerCase() !== normalizedCategory),
              dislikedTags: (preferences?.dislikedTags ?? []).filter((item) => !normalizedTags.has(item.toLocaleLowerCase())),
            },
          });
        } else {
          await tx.preference.upsert({
            where: { userId: uid },
            create: { userId: uid, dislikedTypes: [activity.category], dislikedTags: activity.tags },
            update: {
              dislikedTypes: Array.from(new Set([...(preferences?.dislikedTypes ?? []), activity.category])),
              dislikedTags: Array.from(new Set([...(preferences?.dislikedTags ?? []), ...activity.tags])),
              preferredTypes: (preferences?.preferredTypes ?? []).filter((item) => item.toLocaleLowerCase() !== normalizedCategory),
              preferredTags: (preferences?.preferredTags ?? []).filter((item) => !normalizedTags.has(item.toLocaleLowerCase())),
            },
          });
        }
      }
      return saved;
    });
    let modelTraining: unknown = null;
    try {
      const rows = await prisma.feedback.findMany({ select: { outingId: true, userId: true, enjoyment: true, featureSnapshot: true }, take: 5000, orderBy: { createdAt: "desc" } });
      const trainRows = rows.filter((row) => row.featureSnapshot !== null);
      if (trainRows.length) {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (process.env.ML_SERVICE_TOKEN) headers["x-ml-service-token"] = process.env.ML_SERVICE_TOKEN;
        const result = await fetch(`${mlServiceUrl()}/models/train`, {
          method: "POST", headers,
          body: JSON.stringify({ rows: trainRows.map((row) => ({ outingId: row.outingId, userId: row.userId, enjoyment: row.enjoyment, features: row.featureSnapshot as Record<string, number> })) }),
          signal: AbortSignal.timeout(mlServiceTimeoutMs),
        });
        if (result.ok) {
          modelTraining = await result.json();
          const evaluation = modelTraining as { trained?: boolean; modelVersion?: string; selectedModel?: string; ratings?: number; outings?: number; mae?: number; baselineMae?: number; candidateMae?: Record<string, number>; validation?: string };
          if (evaluation.trained && evaluation.modelVersion && evaluation.selectedModel && evaluation.ratings && evaluation.outings && evaluation.mae != null && evaluation.baselineMae != null && evaluation.candidateMae && evaluation.validation) {
            await prisma.modelEvaluation.upsert({
              where: { modelVersion: evaluation.modelVersion },
              create: { modelVersion: evaluation.modelVersion, selectedModel: evaluation.selectedModel, ratings: evaluation.ratings, outings: evaluation.outings, mae: evaluation.mae, baselineMae: evaluation.baselineMae, candidateMae: evaluation.candidateMae, validationMethod: evaluation.validation },
              update: { selectedModel: evaluation.selectedModel, ratings: evaluation.ratings, outings: evaluation.outings, mae: evaluation.mae, baselineMae: evaluation.baselineMae, candidateMae: evaluation.candidateMae, validationMethod: evaluation.validation },
            });
          }
        }
      }
    } catch (trainingError) {
      console.warn("Feedback was saved, but model evaluation could not run", trainingError);
    }
    return response.status(201).json({ feedback, modelTraining });
  } catch (error) { return next(error); }
});

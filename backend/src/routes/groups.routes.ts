import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { mlServiceTimeoutMs, mlServiceUrl } from "../services/mlService.js";
import { newToken, requireAuth, tokenDigest } from "../config/security.js";

export const groupsRouter = Router();
groupsRouter.use(requireAuth);
const userId = (request: Express.Request) => (request as Express.Request & { userId: string }).userId;
const distanceKm = (lat: number, lon: number, centerLat: number, centerLon: number) => {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(centerLat - lat);
  const dLon = radians(centerLon - lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(centerLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

groupsRouter.get("/", async (request, response, next) => {
  try {
    const groups = await prisma.group.findMany({
      where: { memberships: { some: { userId: userId(request) } } },
      include: { memberships: { include: { user: { select: { id: true, name: true } } } }, preferences: true },
      orderBy: { createdAt: "desc" },
    });
    response.json({ groups });
  } catch (error) { next(error); }
});

groupsRouter.post("/", async (request, response, next) => {
  try {
    const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "A group name is required" });
    const group = await prisma.group.create({ data: {
      name: parsed.data.name,
      memberships: { create: { userId: userId(request), role: "OWNER" } },
      shortlists: { create: {} },
      preferences: { create: {} },
    }, include: { memberships: { include: { user: { select: { id: true, name: true } } } }, preferences: true } });
    return response.status(201).json({ group });
  } catch (error) { return next(error); }
});

groupsRouter.get("/:groupId", async (request, response, next) => {
  try {
    const group = await prisma.group.findFirst({
      where: { id: request.params.groupId, memberships: { some: { userId: userId(request) } } },
      include: {
        memberships: { include: { user: { select: { id: true, name: true } } } },
        shortlists: { include: { items: { include: { experience: true } } } },
        votes: { include: { user: { select: { id: true, name: true } } } },
        preferences: true,
      },
    });
    if (!group) return response.status(404).json({ error: "Group not found" });
    return response.json({ group });
  } catch (error) { return next(error); }
});

groupsRouter.patch("/:groupId/settings", async (request, response, next) => {
  try {
    const uid = userId(request);
    const groupId = request.params.groupId;
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: uid } } });
    if (!membership) return response.status(404).json({ error: "Group not found" });
    if (membership.role !== "OWNER") return response.status(403).json({ error: "Only a group owner can change group settings" });
    const parsed = z.object({
      name: z.string().trim().min(1).max(80).optional(),
      budgetPerPerson: z.number().int().min(0).max(1_000_000).nullable().optional(),
      maxDistanceKm: z.number().min(0).max(5000).nullable().optional(),
      homeLatitude: z.number().min(-90).max(90).nullable().optional(),
      homeLongitude: z.number().min(-180).max(180).nullable().optional(),
      maxDurationMins: z.number().int().min(1).max(1440).nullable().optional(),
      setting: z.enum(["INDOOR", "OUTDOOR", "EITHER"]).optional(),
      maxIntensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
    }).strict()
      .refine((value) => Object.keys(value).length > 0, "Provide at least one setting")
      .refine((value) => (value.homeLatitude === undefined) === (value.homeLongitude === undefined), { path: ["homeLatitude"], message: "Send group latitude and longitude together" })
      .safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Invalid group settings", details: parsed.error.flatten() });
    const { name, ...settings } = parsed.data;
    const group = await prisma.$transaction(async (tx) => {
      if (name) await tx.group.update({ where: { id: groupId }, data: { name } });
      await tx.groupPreference.upsert({ where: { groupId }, create: { groupId, ...settings }, update: settings });
      return tx.group.findUnique({ where: { id: groupId }, include: { preferences: true } });
    });
    return response.json({ group });
  } catch (error) { return next(error); }
});

groupsRouter.post("/:groupId/invitations", async (request, response, next) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId: request.params.groupId, userId: userId(request) } } });
    if (!membership || membership.role !== "OWNER") return response.status(403).json({ error: "Only a group owner can invite members" });
    const rawToken = newToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.invitation.create({ data: { groupId: request.params.groupId, createdById: userId(request), tokenHash: tokenDigest(rawToken), expiresAt } });
    return response.status(201).json({ invitation: { id: invite.id, token: rawToken, expiresAt } });
  } catch (error) { return next(error); }
});

groupsRouter.post("/join", async (request, response, next) => {
  try {
    const parsed = z.object({ token: z.string().min(20).max(100) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "A valid invitation token is required" });
    const invite = await prisma.invitation.findFirst({ where: { tokenHash: tokenDigest(parsed.data.token), usedAt: null, expiresAt: { gt: new Date() } } });
    if (!invite) return response.status(404).json({ error: "Invitation is invalid or expired" });
    const joined = await prisma.$transaction(async (tx) => {
      await tx.membership.upsert({ where: { groupId_userId: { groupId: invite.groupId, userId: userId(request) } }, create: { groupId: invite.groupId, userId: userId(request) }, update: {} });
      const claimed = await tx.invitation.updateMany({ where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!claimed.count) throw new Error("INVITATION_ALREADY_USED");
      return invite;
    });
    return response.status(200).json({ joined: true, groupId: joined.groupId });
  } catch (error) {
    if (error instanceof Error && error.message === "INVITATION_ALREADY_USED") return response.status(409).json({ error: "Invitation has already been used" });
    return next(error);
  }
});

groupsRouter.post("/:groupId/shortlist/:experienceId", async (request, response, next) => {
  try {
    const groupId = request.params.groupId;
    const membership = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: userId(request) } }, select: { id: true } });
    if (!membership) return response.status(404).json({ error: "Group not found" });
    const shortlist = await prisma.shortlist.findUnique({ where: { groupId } });
    if (!shortlist) return response.status(404).json({ error: "Shortlist not found" });
    const item = await prisma.shortlistItem.upsert({
      where: { shortlistId_experienceId: { shortlistId: shortlist.id, experienceId: request.params.experienceId } },
      create: { shortlistId: shortlist.id, experienceId: request.params.experienceId, addedById: userId(request) },
      update: {},
    });
    return response.status(201).json({ item });
  } catch (error) { return next(error); }
});

groupsRouter.get("/:groupId/recommendations", async (request, response, next) => {
  try {
    const groupId = request.params.groupId;
    const filters = z.object({
      category: z.string().trim().max(60).optional(),
      budget: z.coerce.number().int().min(0).optional(),
      intensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
      q: z.string().trim().max(100).optional(),
    }).parse(request.query);
    const group = await prisma.group.findFirst({
      where: { id: groupId, memberships: { some: { userId: userId(request) } } },
      include: {
        memberships: { include: { user: { include: { preferences: true, tried: { select: { experienceId: true } } } } } },
        preferences: true,
      },
    });
    if (!group) return response.status(404).json({ error: "Group not found" });
    const activityFilters: Prisma.ExperienceWhereInput[] = [];
    if (filters.category) activityFilters.push({ category: { equals: filters.category, mode: "insensitive" } });
    if (filters.budget !== undefined) activityFilters.push({ priceMax: { lte: filters.budget }, currency: "INR" });
    if (filters.intensity) activityFilters.push({ intensity: filters.intensity });
    if (filters.q) activityFilters.push({ OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { description: { contains: filters.q, mode: "insensitive" } }] });
    const activities = await prisma.experience.findMany({ where: { active: true, AND: activityFilters } });
    const payload = {
      groupId,
      modelVersion: "group-content-v1",
      limit: 500,
      groupConstraints: {
        budgetPerPerson: group.preferences?.budgetPerPerson ?? null,
        maxDurationMins: group.preferences?.maxDurationMins ?? null,
        maxDistanceKm: group.preferences?.maxDistanceKm ?? null,
        homeLatitude: group.preferences?.homeLatitude ?? null,
        homeLongitude: group.preferences?.homeLongitude ?? null,
        setting: group.preferences?.setting ?? "EITHER",
        maxIntensity: group.preferences?.maxIntensity ?? "HIGH",
      },
      members: group.memberships.map(({ user }) => ({
        userId: user.id,
        preferredTypes: user.preferences?.preferredTypes ?? [],
        dislikedTypes: user.preferences?.dislikedTypes ?? [],
        preferredTags: user.preferences?.preferredTags ?? [],
        dislikedTags: user.preferences?.dislikedTags ?? [],
        budgetPerPerson: user.preferences?.budgetPerPerson ?? null,
        maxDurationMins: user.preferences?.maxDurationMins ?? null,
        maxDistanceKm: user.preferences?.maxDistanceKm ?? null,
        homeLatitude: user.preferences?.homeLatitude ?? null,
        homeLongitude: user.preferences?.homeLongitude ?? null,
        accessibility: user.preferences?.accessibility ?? [],
        dietaryNeeds: user.preferences?.dietaryNeeds ?? [],
        maxIntensity: user.preferences?.maxIntensity ?? "HIGH",
        setting: user.preferences?.setting ?? "EITHER",
        naturalLanguage: user.preferences?.naturalLanguage ?? null,
        triedIds: user.tried.map(({ experienceId }) => experienceId),
      })),
      activities: activities.map((activity) => ({
        id: activity.id, name: activity.name, description: activity.description, category: activity.category,
        tags: activity.tags, priceMax: activity.priceMax, setting: activity.setting, intensity: activity.intensity,
        adventureLevel: activity.adventureLevel, socialLevel: activity.socialLevel,
        durationMins: activity.durationMins,
        minGroupSize: activity.minGroupSize, maxGroupSize: activity.maxGroupSize,
        latitude: activity.latitude, longitude: activity.longitude,
        accessibilityFeatures: activity.accessibilityFeatures, dietaryOptions: activity.dietaryOptions,
      })),
    };
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.ML_SERVICE_TOKEN) headers["x-ml-service-token"] = process.env.ML_SERVICE_TOKEN;
    const mlResponse = await fetch(`${mlServiceUrl()}/recommendations`, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(mlServiceTimeoutMs) });
    if (!mlResponse.ok) {
      console.error("Recommendation service returned an error", {
        status: mlResponse.status,
        statusText: mlResponse.statusText,
      });
      return response.status(502).json({ error: "Recommendation service could not score this group" });
    }
    const result = await mlResponse.json() as { modelVersion: string; recommendations: Array<{ activityId: string }> };
    await prisma.recommendationRun.create({ data: { groupId, modelVersion: result.modelVersion, inputSnapshot: payload, resultSnapshot: result } });
    const selected = new Set(result.recommendations.map(({ activityId }) => activityId));
    const activitiesById = new Map(activities.filter((activity) => selected.has(activity.id)).map((activity) => [activity.id, activity]));
    const centerLatitude = group.preferences?.homeLatitude ?? group.memberships[0]?.user.preferences?.homeLatitude;
    const centerLongitude = group.preferences?.homeLongitude ?? group.memberships[0]?.user.preferences?.homeLongitude;
    const recommendations = result.recommendations.map((item) => {
      const experience = activitiesById.get(item.activityId);
      const distance = experience && centerLatitude !== null && centerLatitude !== undefined
        && centerLongitude !== null && centerLongitude !== undefined
        && experience.latitude !== null && experience.longitude !== null
        ? distanceKm(experience.latitude, experience.longitude, centerLatitude, centerLongitude)
        : null;
      return { ...item, experience: experience ? { ...experience, distanceKm: distance } : undefined };
    }).sort((a, b) => (a.experience?.distanceKm ?? Number.POSITIVE_INFINITY) - (b.experience?.distanceKm ?? Number.POSITIVE_INFINITY));
    return response.json({ ...result, recommendations });
  } catch (error) { return next(error); }
});

groupsRouter.put("/:groupId/votes/:experienceId", async (request, response, next) => {
  try {
    const groupId = request.params.groupId;
    const member = await prisma.membership.findUnique({ where: { groupId_userId: { groupId, userId: userId(request) } }, select: { id: true } });
    if (!member) return response.status(404).json({ error: "Group not found" });
    const parsed = z.object({ choice: z.enum(["YES", "MAYBE", "NO"]) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Vote must be YES, MAYBE, or NO" });
    const vote = await prisma.vote.upsert({
      where: { userId_experienceId_groupId: { userId: userId(request), experienceId: request.params.experienceId, groupId } },
      create: { userId: userId(request), experienceId: request.params.experienceId, groupId, choice: parsed.data.choice },
      update: { choice: parsed.data.choice },
    });
    return response.json({ vote });
  } catch (error) { return next(error); }
});

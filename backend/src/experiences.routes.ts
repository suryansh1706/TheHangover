import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { requireAuth } from "./security.js";

export const experiencesRouter = Router();
experiencesRouter.get("/", async (request, response, next) => {
  try {
    const filters = z.object({
      category: z.string().trim().max(60).optional(),
      budget: z.coerce.number().int().min(0).optional(),
      setting: z.enum(["INDOOR", "OUTDOOR", "EITHER"]).optional(),
      intensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
      q: z.string().trim().max(100).optional(),
    }).parse(request.query);
    const clauses: Prisma.ExperienceWhereInput[] = [];
    if (filters.category) clauses.push({ category: { equals: filters.category, mode: "insensitive" } });
    if (filters.budget !== undefined) clauses.push({ priceMax: { lte: filters.budget }, currency: "INR" });
    if (filters.setting && filters.setting !== "EITHER") clauses.push({ setting: { in: [filters.setting, "EITHER"] } });
    if (filters.intensity) clauses.push({ intensity: filters.intensity });
    if (filters.q) clauses.push({ OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { description: { contains: filters.q, mode: "insensitive" } }] });
    const experiences = await prisma.experience.findMany({ where: { active: true, AND: clauses }, orderBy: [{ isSample: "asc" }, { name: "asc" }], take: 100 });
    return response.json({ experiences });
  } catch (error) { return next(error); }
});

experiencesRouter.get("/:experienceId", async (request, response, next) => {
  try {
    const experience = await prisma.experience.findFirst({ where: { id: request.params.experienceId, active: true } });
    if (!experience) return response.status(404).json({ error: "Experience not found" });
    return response.json({ experience });
  } catch (error) { return next(error); }
});

experiencesRouter.put("/:experienceId/tried", requireAuth, async (request, response, next) => {
  try {
    const uid = (request as typeof request & { userId: string }).userId;
    const parsed = z.object({ tried: z.boolean() }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "tried must be a boolean" });
    const experienceId = request.params.experienceId;
    if (typeof experienceId !== "string") return response.status(400).json({ error: "Invalid experience ID" });
    if (parsed.data.tried) {
      await prisma.userExperience.upsert({
        where: { userId_experienceId: { userId: uid, experienceId } },
        create: { userId: uid, experienceId }, update: {},
      });
    } else {
      await prisma.userExperience.deleteMany({ where: { userId: uid, experienceId } });
    }
    return response.status(204).end();
  } catch (error) { return next(error); }
});

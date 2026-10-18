import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { requireAuth } from "../config/security.js";

export const profilesRouter = Router();
profilesRouter.use(requireAuth);
profilesRouter.patch("/me", async (request, response, next) => {
  try {
    const parsed = z.object({
      name: z.string().trim().min(1).max(80).optional(),
      budgetPerPerson: z.number().int().min(0).max(1_000_000).nullable().optional(),
      maxDistanceKm: z.number().min(0).max(5000).nullable().optional(),
      homeLatitude: z.number().min(-90).max(90).nullable().optional(),
      homeLongitude: z.number().min(-180).max(180).nullable().optional(),
      maxDurationMins: z.number().int().min(1).max(1440).nullable().optional(),
      preferredTypes: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
      dislikedTypes: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
      preferredTags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
      dislikedTags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
      setting: z.enum(["INDOOR", "OUTDOOR", "EITHER"]).optional(),
      maxIntensity: z.enum(["LOW", "MODERATE", "HIGH"]).optional(),
      accessibility: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
      dietaryNeeds: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
      naturalLanguage: z.string().trim().max(1000).nullable().optional(),
    }).strict()
      .refine((value) => Object.keys(value).length > 0, "Provide at least one profile field")
      .refine((value) => (value.homeLatitude === undefined) === (value.homeLongitude === undefined), { path: ["homeLatitude"], message: "Send home latitude and longitude together" })
      .safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Invalid profile update", details: parsed.error.flatten() });
    const { name, ...preference } = parsed.data;
    const uid = (request as typeof request & { userId: string }).userId;
    const [user] = await prisma.$transaction([
      prisma.user.update({ where: { id: uid }, data: name ? { name } : {}, select: { id: true, email: true, name: true } }),
      prisma.preference.upsert({ where: { userId: uid }, create: { userId: uid, ...preference }, update: preference }),
    ]);
    const preferences = await prisma.preference.findUnique({ where: { userId: uid } });
    return response.json({ user, preferences });
  } catch (error) { return next(error); }
});

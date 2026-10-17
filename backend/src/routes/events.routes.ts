import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../config/security.js";
import { eventSearchErrorCode, searchAndStoreEvents } from "../services/places.service.js";

export const eventsRouter = Router();
eventsRouter.get("/search", requireAuth, async (request, response, next) => {
  try {
    const experiences = await searchAndStoreEvents(request.query);
    return response.json({ experiences, provider: "geoapify", verifiedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) return response.status(400).json({ error: "Provide a search term or city, and check the optional country code." });
    const code = eventSearchErrorCode(error);
    if (code === "NOT_CONFIGURED") return response.status(503).json({ error: "Place search is not configured. Set GEOAPIFY_API_KEY on the backend." });
    if (code === "UPSTREAM_FAILED") return response.status(502).json({ error: "Geoapify could not complete the place search. Try again later." });
    return next(error);
  }
});

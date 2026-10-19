import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../config/security.js";
import { placeSearchErrorCode, searchAndStorePlaces } from "../services/places.service.js";

export const placesRouter = Router();
placesRouter.get("/search", requireAuth, async (request, response, next) => {
  try {
    const result = await searchAndStorePlaces(request.query);
    return response.json({ ...result, provider: "geoapify", verifiedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) return response.status(400).json({ error: "Provide a city or coordinates, and check the optional country code." });
    const code = placeSearchErrorCode(error);
    if (code === "NOT_CONFIGURED") return response.status(503).json({ error: "Place search is not configured. Set GEOAPIFY_API_KEY on the backend." });
    if (code === "LOCATION_NOT_FOUND") return response.status(404).json({ error: "Geoapify could not find that city. Check the spelling or country code." });
    if (code === "UPSTREAM_FAILED") return response.status(502).json({ error: "Geoapify could not complete the place search. Try again later." });
    return next(error);
  }
});

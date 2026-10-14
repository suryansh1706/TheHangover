import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "./security.js";
import { eventSearchErrorCode, searchAndStoreEvents } from "./ticketmaster.service.js";

export const eventsRouter = Router();
eventsRouter.get("/search", requireAuth, async (request, response, next) => {
  try {
    const experiences = await searchAndStoreEvents(request.query);
    return response.json({ experiences, provider: "ticketmaster-discovery", verifiedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) return response.status(400).json({ error: "Provide a search term or city, and check the optional country code." });
    const code = eventSearchErrorCode(error);
    if (code === "NOT_CONFIGURED") return response.status(503).json({ error: "Live event search is not configured. Set TICKETMASTER_API_KEY on the backend." });
    if (code === "UPSTREAM_FAILED") return response.status(502).json({ error: "The event provider could not complete the search. Try again later." });
    return next(error);
  }
});

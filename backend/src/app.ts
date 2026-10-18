import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authRouter } from "./routes/auth.routes.js";
import { groupsRouter } from "./routes/groups.routes.js";
import { experiencesRouter } from "./routes/experiences.routes.js";
import { profilesRouter } from "./routes/profiles.routes.js";
import { outingsRouter } from "./routes/feedback.routes.js";
import { placesRouter } from "./routes/places.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";

const env = z.object({
  NODE_ENV: z.string().default("development"),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
}).parse(process.env);

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "backend", environment: env.NODE_ENV });
});
app.use("/api/auth", authRouter);
app.use("/api/groups", groupsRouter);
app.use("/api/experiences", experiencesRouter);
app.use("/api/profile", profilesRouter);
app.use("/api", outingsRouter);
app.use("/api/places", placesRouter);
app.use("/api/analytics", analyticsRouter);

app.use((request, response) => {
  response.status(404).json({ error: "Not found", path: request.path });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  void _next;
  console.error("Request failed", error);
  response.status(500).json({ error: "Internal server error" });
});

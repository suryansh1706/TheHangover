import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "./db.js";
import { hashPassword, newToken, readCookie, requireAuth, tokenDigest, verifyPassword } from "./security.js";

export const authRouter = Router();
authRouter.use(rateLimit({ windowMs: 15 * 60_000, limit: 25, standardHeaders: "draft-7", legacyHeaders: false }));
const COOKIE_NAME = "hangover_session";
const SESSION_DAYS = 14;
const secureCookie = process.env.NODE_ENV === "production";
const cookieOptions = { httpOnly: true, secure: secureCookie, sameSite: "lax" as const, path: "/" };

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes"),
});
const registrationSchema = credentialsSchema.extend({ name: z.string().trim().min(1).max(80) });

authRouter.post("/register", async (request, response, next) => {
  try {
    const parsed = registrationSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Invalid registration details", details: parsed.error.flatten() });
    const { email, password, name } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return response.status(409).json({ error: "An account with this email already exists" });
    const user = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password), preferences: { create: {} } },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    const rawToken = newToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({ data: { userId: user.id, tokenHash: tokenDigest(rawToken), expiresAt } });
    response.cookie(COOKIE_NAME, rawToken, { ...cookieOptions, expires: expiresAt });
    return response.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/login", async (request, response, next) => {
  try {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Invalid login details" });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return response.status(401).json({ error: "Email or password is incorrect" });
    }
    const rawToken = newToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({ data: { userId: user.id, tokenHash: tokenDigest(rawToken), expiresAt } });
    response.cookie(COOKIE_NAME, rawToken, { ...cookieOptions, expires: expiresAt });
    return response.json({ user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/logout", async (request, response, next) => {
  try {
    const rawToken = readCookie(request, COOKIE_NAME);
    if (rawToken) await prisma.session.deleteMany({ where: { tokenHash: tokenDigest(rawToken) } });
    response.clearCookie(COOKIE_NAME, cookieOptions);
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", requireAuth, async (request, response, next) => {
  try {
    const sessionUser = await prisma.user.findUnique({
      where: { id: (request as typeof request & { userId: string }).userId },
      select: { id: true, email: true, name: true, createdAt: true, preferences: true },
    });
    if (!sessionUser) return response.status(401).json({ error: "Authentication required" });
    return response.json({ user: sessionUser });
  } catch (error) {
    return next(error);
  }
});

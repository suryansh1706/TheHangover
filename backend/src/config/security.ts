import { createHash, randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "./db.js";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return bcrypt.compare(password, stored);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = readCookie(request, "hangover_session");
    if (!rawToken) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    const session = await prisma.session.findFirst({
      where: { tokenHash: tokenDigest(rawToken), expiresAt: { gt: new Date() } },
      select: { userId: true },
    });
    if (!session) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    (request as Request & { userId: string }).userId = session.userId;
    next();
  } catch (error) {
    next(error);
  }
}

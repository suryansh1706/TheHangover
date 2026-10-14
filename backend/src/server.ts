import dotenv from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

async function start() {
  dotenv.config({ path: resolve(process.cwd(), ".env") });
  dotenv.config({ path: resolve(process.cwd(), "..", ".env") });
  const { app } = await import("./app.js");
  const config = z.object({ BACKEND_PORT: z.coerce.number().int().min(1).max(65535).default(process.env.PORT ? Number(process.env.PORT) : 4000) }).parse(process.env);
  const server = app.listen(config.BACKEND_PORT, () => console.log(`Backend listening on http://localhost:${config.BACKEND_PORT}`));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(() => process.exit(0)));
}

void start();

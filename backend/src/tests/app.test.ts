import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("GET /health", () => {
  it("returns the backend health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", service: "backend" });
  });
});

describe("private API routes", () => {
  it("rejects a group-list request without a session cookie", async () => {
    const response = await request(app).get("/api/groups");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "Authentication required" });
  });

  it("exposes authenticated place search at the places route", async () => {
    const response = await request(app).get("/api/places/search?city=Delhi&countryCode=IN");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "Authentication required" });
  });

});

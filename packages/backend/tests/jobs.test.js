import request from "supertest";
import app from "../src/app.js";

let token = "";

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@myats.dev", password: "password123" });
  token = res.body.data?.token || "";
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("GET /api/jobs", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/jobs");
    expect(res.status).toBe(401);
  });

  it("returns job list with token", async () => {
    const res = await request(app).get("/api/jobs").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("POST /api/jobs", () => {
  it("returns 400 when title is missing", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set(auth())
      .send({ description: "test" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("creates a job with valid payload", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set(auth())
      .send({ title: "Test Engineer (automated test)", job_type: "full_time", work_model: "onsite" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id");

    // Cleanup
    await request(app)
      .delete(`/api/jobs/${res.body.data.id}`)
      .set(auth());
  });
});

describe("GET /api/jobs/:id", () => {
  it("returns 404 for unknown id", async () => {
    const res = await request(app)
      .get("/api/jobs/00000000-0000-0000-0000-000000000000")
      .set(auth());
    expect(res.status).toBe(404);
  });
});

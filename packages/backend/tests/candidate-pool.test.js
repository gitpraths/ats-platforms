import request from "supertest";
import app from "../src/app.js";

let token = "";

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@myats.com", password: "password123" });
  token = res.body.data?.token || "";
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("GET /api/candidate-pool", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/candidate-pool");
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct shape", async () => {
    const res = await request(app).get("/api/candidate-pool").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      tab_counts: expect.objectContaining({
        all: expect.any(Number),
        in_progress: expect.any(Number),
        placed: expect.any(Number),
        not_successful: expect.any(Number),
        inactive: expect.any(Number),
      }),
    });
  });

  it("returns only placed candidates on placed tab", async () => {
    const res = await request(app)
      .get("/api/candidate-pool?tab=placed")
      .set(auth());
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row.work_status).toBe("placed");
    }
  });

  it("filters by search query", async () => {
    const res = await request(app)
      .get("/api/candidate-pool?q=nonexistent_xyz_abc_999")
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  it("paginates correctly", async () => {
    const res = await request(app)
      .get("/api/candidate-pool?page=1&limit=2")
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.page).toBe(1);
  });

  it("each row has required fields", async () => {
    const res = await request(app)
      .get("/api/candidate-pool?limit=1")
      .set(auth());
    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      const row = res.body.data[0];
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("name");
      expect(row).toHaveProperty("email");
      expect(row).toHaveProperty("welfare_checks");
      expect(Array.isArray(row.welfare_checks)).toBe(true);
    }
  });
});

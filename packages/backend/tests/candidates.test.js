import request from "supertest";
import app from "../src/app.js";

let token = "";

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@ats.com", password: "password123" });
  token = res.body.data?.token || "";
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("GET /api/candidates", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/candidates");
    expect(res.status).toBe(401);
  });

  it("returns candidate list", async () => {
    const res = await request(app).get("/api/candidates").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("filters by search query", async () => {
    const res = await request(app)
      .get("/api/candidates?q=nonexistent_xyz_abc")
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe("POST /api/candidates", () => {
  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/candidates")
      .set(auth())
      .send({ email: "test@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("creates a candidate with valid payload", async () => {
    const email = `test_${Date.now()}@example.com`;
    const res = await request(app)
      .post("/api/candidates")
      .set(auth())
      .send({ name: "Test Candidate", email });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.name).toBe("Test Candidate");
  });

  it("returns 409 for duplicate email", async () => {
    const email = `dup_${Date.now()}@example.com`;
    await request(app).post("/api/candidates").set(auth()).send({ name: "Dup A", email });
    const res = await request(app).post("/api/candidates").set(auth()).send({ name: "Dup B", email });
    expect(res.status).toBe(409);
  });
});

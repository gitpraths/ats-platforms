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
      .send({
        name: "Test Candidate",
        email,
        phone: "12345678",
        provider_id: "00000000-0000-0000-0005-000000000001",
        benchmark_hours: 38
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.name).toBe("Test Candidate");
    expect(res.body.data.created_by).toBe("00000000-0000-0000-0000-000000000001");
    expect(res.body.data.updated_by).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("returns 409 for duplicate email", async () => {
    const email = `dup_${Date.now()}@example.com`;
    await request(app)
      .post("/api/candidates")
      .set(auth())
      .send({
        name: "Dup A",
        email,
        phone: "12345678",
        provider_id: "00000000-0000-0000-0005-000000000001",
        benchmark_hours: 38
      });
    const res = await request(app)
      .post("/api/candidates")
      .set(auth())
      .send({
        name: "Dup B",
        email,
        phone: "12345678",
        provider_id: "00000000-0000-0000-0005-000000000001",
        benchmark_hours: 38
      });
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/candidates/:id", () => {
  it("updates candidate details and records updated_by", async () => {
    const email = `update_test_${Date.now()}@example.com`;
    const createRes = await request(app)
      .post("/api/candidates")
      .set(auth())
      .send({
        name: "Update Candidate",
        email,
        phone: "987654321",
        provider_id: "00000000-0000-0000-0005-000000000001",
        benchmark_hours: 38
      });
    const candidateId = createRes.body.data.id;

    const updateRes = await request(app)
      .put(`/api/candidates/${candidateId}`)
      .set(auth())
      .send({
        name: "Updated Name",
        phone: "111222333"
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.name).toBe("Updated Name");
    expect(updateRes.body.data.updated_by).toBe("00000000-0000-0000-0000-000000000001");
  });
});

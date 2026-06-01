import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

let adminToken = "";
let recruiterToken = "";
const createdIds = [];

beforeAll(async () => {
  const adminLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@myats.dev", password: "password123" });
  adminToken = adminLogin.body.data.token;

  const { rows } = await pool.query(
    `SELECT email FROM users WHERE role = 'recruiter' LIMIT 1`
  );
  if (rows[0]) {
    const recLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: rows[0].email, password: "password123" });
    recruiterToken = recLogin.body.data.token;
  }
});

afterAll(async () => {
  if (createdIds.length) {
    await pool.query("DELETE FROM trainings WHERE id = ANY($1)", [createdIds]);
  }
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe("GET /api/trainings", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/trainings");
    expect(res.status).toBe(401);
  });

  it("returns paginated list with meta", async () => {
    const res = await request(app).get("/api/trainings").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty("total");
  });
});

describe("POST /api/trainings", () => {
  it("creates a training as admin", async () => {
    const res = await request(app)
      .post("/api/trainings")
      .set(auth(adminToken))
      .send({ name: `Test Course ${Date.now()}`, code: "TST101" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toMatch(/Test Course/);
    expect(res.body.data.is_active).toBe(true);
    createdIds.push(res.body.data.id);
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/trainings")
      .set(auth(adminToken))
      .send({ code: "NONAME" });
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-admin role", async () => {
    if (!recruiterToken) return;
    const res = await request(app)
      .post("/api/trainings")
      .set(auth(recruiterToken))
      .send({ name: `Forbidden ${Date.now()}` });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/trainings/:id", () => {
  it("updates a training as admin", async () => {
    const id = createdIds[0];
    const res = await request(app)
      .patch(`/api/trainings/${id}`)
      .set(auth(adminToken))
      .send({ description: "Updated description" });
    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe("Updated description");
  });
});

describe("DELETE /api/trainings/:id", () => {
  it("soft-deletes a training (sets is_active=false)", async () => {
    const id = createdIds[0];
    const res = await request(app).delete(`/api/trainings/${id}`).set(auth(adminToken));
    expect(res.status).toBe(200);
    const fetched = await request(app).get(`/api/trainings/${id}`).set(auth(adminToken));
    expect(fetched.body.data.is_active).toBe(false);
  });
});

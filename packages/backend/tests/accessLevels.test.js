import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

describe("Staff Access Levels & Role-Based Authorization", () => {
  let adminToken = "";
  let staffToken = "";
  let trainingAdminToken = "";

  beforeAll(async () => {
    // Obtain tokens for all three roles
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@myats.dev", password: "password123" });
    adminToken = adminRes.body.data.token;

    const staffRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "staff@myats.dev", password: "password123" });
    staffToken = staffRes.body.data.token;

    const trainingRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "trainingadmin@myats.dev", password: "password123" });
    trainingAdminToken = trainingRes.body.data.token;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("Training Admin Restrictions & Permissions", () => {
    it("allows training_admin to GET candidates list (full search enabled)", async () => {
      const res = await request(app)
        .get("/api/candidates?search=John")
        .set("Authorization", `Bearer ${trainingAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("blocks training_admin from creating candidates (POST /api/candidates)", async () => {
      const res = await request(app)
        .post("/api/candidates")
        .set("Authorization", `Bearer ${trainingAdminToken}`)
        .send({ name: "Unauthorized Candidate", email: "unauth@test.com" });
      expect(res.status).toBe(403);
    });

    it("blocks training_admin from accessing vacancies/jobs (GET /api/jobs)", async () => {
      const res = await request(app)
        .get("/api/jobs")
        .set("Authorization", `Bearer ${trainingAdminToken}`);
      expect(res.status).toBe(403);
    });

    it("blocks training_admin from accessing placements (GET /api/placements)", async () => {
      const res = await request(app)
        .get("/api/placements")
        .set("Authorization", `Bearer ${trainingAdminToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("Staff Restrictions & Permissions", () => {
    it("allows staff to GET candidates list", async () => {
      const res = await request(app)
        .get("/api/candidates")
        .set("Authorization", `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
    });

    it("allows staff to GET vacancies list", async () => {
      const res = await request(app)
        .get("/api/jobs")
        .set("Authorization", `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
    });

    it("blocks staff from accessing Xero invoice endpoints (GET /api/xero/auth-url)", async () => {
      const res = await request(app)
        .get("/api/xero/auth-url")
        .set("Authorization", `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it("blocks staff from deleting vacancies (DELETE /api/jobs/:id)", async () => {
      const res = await request(app)
        .delete("/api/jobs/00000000-0000-0000-0000-000000000001")
        .set("Authorization", `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("Admin Full Privileges", () => {
    it("allows admin to access Xero auth url", async () => {
      const res = await request(app)
        .get("/api/xero/auth-url")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it("allows admin to view users list", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});

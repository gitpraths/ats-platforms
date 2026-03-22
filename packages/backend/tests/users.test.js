import request from "supertest";
import app from "../src/app.js";

let adminToken = "";

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@ats.com", password: "password123" });
  adminToken = res.body.data?.token || "";
});

const auth = () => ({ Authorization: `Bearer ${adminToken}` });

describe("GET /api/users/me", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/users/me");
    expect(res.status).toBe(401);
  });

  it("returns current user", async () => {
    const res = await request(app).get("/api/users/me").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data).toHaveProperty("email");
    expect(res.body.data).not.toHaveProperty("password_hash");
  });
});

describe("GET /api/users (admin only)", () => {
  it("returns user list for admin", async () => {
    const res = await request(app).get("/api/users").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("POST /api/users (admin only)", () => {
  it("returns 400 when fields missing", async () => {
    const res = await request(app)
      .post("/api/users")
      .set(auth())
      .send({ name: "No Email" });
    expect(res.status).toBe(400);
  });

  it("creates a user", async () => {
    const email = `newuser_${Date.now()}@ats.com`;
    const res = await request(app)
      .post("/api/users")
      .set(auth())
      .send({ name: "New User", email, password: "password123", role: "recruiter" });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(email);

    // Cleanup
    await request(app).delete(`/api/users/${res.body.data.id}`).set(auth());
  });
});

describe("PUT /api/users/me", () => {
  it("updates current user name", async () => {
    const res = await request(app)
      .put("/api/users/me")
      .set(auth())
      .send({ name: "Admin Updated" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Admin Updated");

    // Restore
    await request(app).put("/api/users/me").set(auth()).send({ name: "Admin" });
  });
});

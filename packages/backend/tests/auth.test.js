import request from "supertest";
import app from "../src/app.js";

describe("POST /api/auth/login", () => {
  it("returns 400 when email or password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 for invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns token and user for valid credentials", async () => {
    // Uses seed data: admin@myats.dev / password123
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@myats.dev", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("token");
    expect(res.body.data).toHaveProperty("user");
    expect(res.body.data.user).toHaveProperty("id");
    expect(res.body.data.user.email).toBe("admin@myats.dev");
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 200", async () => {
    const res = await request(app).post("/api/auth/logout").send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

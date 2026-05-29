import request from "supertest";
import app from "../src/app.js";

let token = "";
let recruiterToken = "";
let recruiterId = "";

beforeAll(async () => {
  const adminRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@myats.dev", password: "password123" });
  token = adminRes.body.data?.token || "";

  const recruiterRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "jane@myats.dev", password: "password123" });
  recruiterToken = recruiterRes.body.data?.token || "";
  recruiterId = recruiterRes.body.data?.user?.id || "";
});

const auth = () => ({ Authorization: `Bearer ${token}` });
const recruiterAuth = () => ({ Authorization: `Bearer ${recruiterToken}` });

describe("GET /api/stats", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(401);
  });

  it("returns placements_by_staff array", async () => {
    const res = await request(app).get("/api/stats").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.placements_by_staff)).toBe(true);
  });

  it("each placements_by_staff row has correct shape", async () => {
    const res = await request(app).get("/api/stats").set(auth());
    const staff = res.body.data.placements_by_staff;
    expect(staff.length).toBeGreaterThan(0);
    for (const row of staff) {
      expect(row).toMatchObject({
        user_id:               expect.any(String),
        name:                  expect.any(String),
        total_placements:      expect.any(Number),
        placements_this_month: expect.any(Number),
      });
    }
  });

  it("placements_by_staff is ordered by total_placements descending", async () => {
    const res = await request(app).get("/api/stats").set(auth());
    const staff = res.body.data.placements_by_staff;
    for (let i = 1; i < staff.length; i++) {
      expect(staff[i - 1].total_placements).toBeGreaterThanOrEqual(staff[i].total_placements);
    }
  });

  it("non-admin sees only their own row in placements_by_staff", async () => {
    const res = await request(app).get("/api/stats").set(recruiterAuth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const staff = res.body.data.placements_by_staff;
    expect(Array.isArray(staff)).toBe(true);
    expect(staff).toHaveLength(1);
    expect(staff[0].user_id).toBe(recruiterId);
  });
});

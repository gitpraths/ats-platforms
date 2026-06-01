import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

let token = "";
let trainingId = "";
const candidateIds = [];
const createdEnrolmentIds = [];

beforeAll(async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@myats.dev", password: "password123" });
  token = login.body.data.token;

  const tr = await pool.query(
    `INSERT INTO trainings (name) VALUES ('Bulk Test Course') RETURNING id`
  );
  trainingId = tr.rows[0].id;

  // Create 3 fresh candidates to keep this suite isolated.
  for (let i = 0; i < 3; i++) {
    const r = await pool.query(
      `INSERT INTO candidates (name, email) VALUES ($1, $2) RETURNING id`,
      [`Bulk Test ${i}`, `bulk_${Date.now()}_${i}@example.com`]
    );
    candidateIds.push(r.rows[0].id);
  }
});

afterAll(async () => {
  if (createdEnrolmentIds.length) {
    await pool.query("DELETE FROM candidate_trainings WHERE id = ANY($1)", [createdEnrolmentIds]);
  }
  await pool.query("DELETE FROM candidate_trainings WHERE training_id = $1", [trainingId]);
  await pool.query("DELETE FROM trainings WHERE id = $1", [trainingId]);
  await pool.query("DELETE FROM candidates WHERE id = ANY($1)", [candidateIds]);
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("POST /api/candidate-trainings/bulk", () => {
  it("creates one enrolment per candidate in one call (happy path)", async () => {
    const res = await request(app)
      .post("/api/candidate-trainings/bulk")
      .set(auth())
      .send({
        training_id: trainingId,
        start_date: "2026-07-01",
        end_date:   "2026-07-15",
        candidate_ids: [candidateIds[0], candidateIds[1]],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.created.length).toBe(2);
    expect(res.body.data.skipped.length).toBe(0);
    for (const row of res.body.data.created) {
      expect(row).toHaveProperty("candidate_name");
      expect(row).toHaveProperty("training_name");
      expect(row.status).toBe("enrolled");
      createdEnrolmentIds.push(row.id);
    }
  });

  it("skips candidates already holding a non-terminal enrolment for the same course", async () => {
    // candidateIds[0] was enrolled in the previous test; candidateIds[2] is fresh.
    const res = await request(app)
      .post("/api/candidate-trainings/bulk")
      .set(auth())
      .send({
        training_id: trainingId,
        start_date: "2026-08-01",
        candidate_ids: [candidateIds[0], candidateIds[2]],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.created.length).toBe(1);
    expect(res.body.data.created[0].candidate_id).toBe(candidateIds[2]);
    expect(res.body.data.skipped.length).toBe(1);
    expect(res.body.data.skipped[0]).toEqual({
      candidate_id: candidateIds[0],
      reason: "active_enrolment_exists",
    });
    createdEnrolmentIds.push(res.body.data.created[0].id);
  });

  it("rolls back when one insert fails (bad training_id)", async () => {
    const bogusTrainingId = "00000000-0000-0000-0000-000000000000";
    const before = await pool.query(
      "SELECT COUNT(*)::int AS n FROM candidate_trainings WHERE candidate_id = ANY($1)",
      [candidateIds]
    );
    const res = await request(app)
      .post("/api/candidate-trainings/bulk")
      .set(auth())
      .send({
        training_id: bogusTrainingId,
        start_date: "2026-09-01",
        candidate_ids: [candidateIds[1]],
      });
    expect(res.status).toBe(500);
    const after = await pool.query(
      "SELECT COUNT(*)::int AS n FROM candidate_trainings WHERE candidate_id = ANY($1)",
      [candidateIds]
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("returns 400 when candidate_ids is missing or empty", async () => {
    const res1 = await request(app)
      .post("/api/candidate-trainings/bulk")
      .set(auth())
      .send({ training_id: trainingId, start_date: "2026-07-01" });
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .post("/api/candidate-trainings/bulk")
      .set(auth())
      .send({ training_id: trainingId, start_date: "2026-07-01", candidate_ids: [] });
    expect(res2.status).toBe(400);
  });

  it("returns 400 when end_date precedes start_date", async () => {
    const res = await request(app)
      .post("/api/candidate-trainings/bulk")
      .set(auth())
      .send({
        training_id: trainingId,
        start_date: "2026-09-01",
        end_date:   "2026-08-01",
        candidate_ids: [candidateIds[2]],
      });
    expect(res.status).toBe(400);
  });
});

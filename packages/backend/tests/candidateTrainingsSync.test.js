import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";
import { syncCandidateActiveTraining } from "../src/services/candidateTrainings.js";

let token = "";
let candidateId = "";
let trainingId = "";

beforeAll(async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@myats.dev", password: "password123" });
  token = login.body.data.token;

  const cand = await pool.query(
    `INSERT INTO candidates (name, email) VALUES ('Sync Test', $1) RETURNING id`,
    [`sync_${Date.now()}@example.com`]
  );
  candidateId = cand.rows[0].id;

  const tr = await pool.query(
    `INSERT INTO trainings (name) VALUES ('Sync Test Course') RETURNING id`
  );
  trainingId = tr.rows[0].id;
});

afterAll(async () => {
  await pool.query("DELETE FROM candidate_trainings WHERE candidate_id = $1", [candidateId]);
  await pool.query("DELETE FROM trainings WHERE id = $1", [trainingId]);
  await pool.query("DELETE FROM candidates WHERE id = $1", [candidateId]);
});

describe("syncCandidateActiveTraining", () => {
  beforeEach(async () => {
    await pool.query("DELETE FROM candidate_trainings WHERE candidate_id = $1", [candidateId]);
    await pool.query(
      `UPDATE candidates SET training_start_date = NULL, training_end_date = NULL WHERE id = $1`,
      [candidateId]
    );
  });

  it("clears columns when no in_progress enrolment exists", async () => {
    await pool.query(
      `INSERT INTO candidate_trainings (candidate_id, training_id, status, start_date, end_date)
       VALUES ($1, $2, 'enrolled', '2026-01-01', '2026-02-01')`,
      [candidateId, trainingId]
    );
    await syncCandidateActiveTraining(candidateId);
    const { rows } = await pool.query(
      "SELECT training_start_date, training_end_date FROM candidates WHERE id = $1",
      [candidateId]
    );
    expect(rows[0].training_start_date).toBeNull();
    expect(rows[0].training_end_date).toBeNull();
  });

  it("sets columns from the latest in_progress enrolment", async () => {
    await pool.query(
      `INSERT INTO candidate_trainings (candidate_id, training_id, status, start_date, end_date)
       VALUES ($1, $2, 'in_progress', '2026-01-01', '2026-02-01'),
              ($1, $2, 'in_progress', '2026-03-01', '2026-04-01')`,
      [candidateId, trainingId]
    );
    await syncCandidateActiveTraining(candidateId);
    const { rows } = await pool.query(
      "SELECT training_start_date, training_end_date FROM candidates WHERE id = $1",
      [candidateId]
    );
    expect(rows[0].training_start_date.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(rows[0].training_end_date.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("ignores completed and withdrawn enrolments", async () => {
    await pool.query(
      `INSERT INTO candidate_trainings (candidate_id, training_id, status, start_date, end_date)
       VALUES ($1, $2, 'completed', '2026-01-01', '2026-02-01'),
              ($1, $2, 'withdrawn', '2026-03-01', '2026-04-01')`,
      [candidateId, trainingId]
    );
    await syncCandidateActiveTraining(candidateId);
    const { rows } = await pool.query(
      "SELECT training_start_date, training_end_date FROM candidates WHERE id = $1",
      [candidateId]
    );
    expect(rows[0].training_start_date).toBeNull();
    expect(rows[0].training_end_date).toBeNull();
  });
});

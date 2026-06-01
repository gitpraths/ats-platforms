import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/config/db.js";

let token = "";
let candidateId = "";
let trainingId = "";
const enrolmentIds = [];

beforeAll(async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@myats.dev", password: "password123" });
  token = login.body.data.token;

  const cand = await pool.query(
    `INSERT INTO candidates (name, email) VALUES ('Enrolment Test', $1) RETURNING id`,
    [`enrol_${Date.now()}@example.com`]
  );
  candidateId = cand.rows[0].id;

  const tr = await pool.query(
    `INSERT INTO trainings (name) VALUES ('Enrolment Test Course') RETURNING id`
  );
  trainingId = tr.rows[0].id;
});

afterAll(async () => {
  await pool.query("DELETE FROM candidate_trainings WHERE candidate_id = $1", [candidateId]);
  await pool.query("DELETE FROM trainings WHERE id = $1", [trainingId]);
  await pool.query("DELETE FROM candidates WHERE id = $1", [candidateId]);
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("POST /api/candidate-trainings", () => {
  it("creates an enrolment and returns expanded training name", async () => {
    const res = await request(app)
      .post("/api/candidate-trainings")
      .set(auth())
      .send({ candidate_id: candidateId, training_id: trainingId, status: "in_progress", start_date: "2026-05-01" });
    expect(res.status).toBe(201);
    expect(res.body.data.training_name).toBe("Enrolment Test Course");
    enrolmentIds.push(res.body.data.id);
  });

  it("syncs candidate.training_start_date when status is in_progress", async () => {
    const { rows } = await pool.query(
      "SELECT training_start_date FROM candidates WHERE id = $1",
      [candidateId]
    );
    expect(rows[0].training_start_date.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("returns 400 when candidate_id is missing", async () => {
    const res = await request(app)
      .post("/api/candidate-trainings")
      .set(auth())
      .send({ training_id: trainingId });
    expect(res.status).toBe(400);
  });

  it("returns 400 when end_date is before start_date", async () => {
    const res = await request(app)
      .post("/api/candidate-trainings")
      .set(auth())
      .send({
        candidate_id: candidateId,
        training_id: trainingId,
        start_date: "2026-06-01",
        end_date:   "2026-05-01",
      });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/candidates/:id/trainings", () => {
  it("returns the candidate's enrolment history", async () => {
    const res = await request(app)
      .get(`/api/candidates/${candidateId}/trainings`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty("training_name");
  });
});

describe("PATCH /api/candidate-trainings/:id", () => {
  it("updates the enrolment and re-syncs columns when status changes", async () => {
    const id = enrolmentIds[0];
    const res = await request(app)
      .patch(`/api/candidate-trainings/${id}`)
      .set(auth())
      .send({ status: "completed" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("completed");
    expect(res.body.data.completed_at).toBeTruthy();

    const { rows } = await pool.query(
      "SELECT training_start_date FROM candidates WHERE id = $1",
      [candidateId]
    );
    expect(rows[0].training_start_date).toBeNull();
  });
});

describe("DELETE /api/candidate-trainings/:id", () => {
  it("deletes the enrolment", async () => {
    const id = enrolmentIds[0];
    const res = await request(app).delete(`/api/candidate-trainings/${id}`).set(auth());
    expect(res.status).toBe(200);

    const fetched = await request(app).get(`/api/candidates/${candidateId}/trainings`).set(auth());
    expect(fetched.body.data.find((e) => e.id === id)).toBeUndefined();
  });
});

describe("GET /api/candidate-trainings (cross-candidate list)", () => {
  beforeAll(async () => {
    // Ensure at least one enrolment exists for the test candidate so the search test below
    // can locate them. The earlier suites may have deleted it.
    await pool.query(
      `INSERT INTO candidate_trainings (candidate_id, training_id, status, start_date)
       VALUES ($1, $2, 'enrolled', '2026-05-15')`,
      [candidateId, trainingId]
    );
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/candidate-trainings");
    expect(res.status).toBe(401);
  });

  it("returns paginated list with meta", async () => {
    const res = await request(app)
      .get("/api/candidate-trainings?limit=10")
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(0);
  });

  it("filters by training_id and includes expanded candidate_name", async () => {
    const res = await request(app)
      .get(`/api/candidate-trainings?training_id=${trainingId}`)
      .set(auth());
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row.training_id).toBe(trainingId);
      expect(row).toHaveProperty("candidate_name");
    }
  });

  it("filters by search (candidate name, case-insensitive partial match)", async () => {
    const res = await request(app)
      .get(`/api/candidate-trainings?search=enrolment`)
      .set(auth());
    expect(res.status).toBe(200);
    const found = res.body.data.find((r) => r.candidate_id === candidateId);
    expect(found).toBeDefined();
  });
});

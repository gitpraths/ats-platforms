# Training Module — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 slice of the Training Module — a catalogue of training courses (admin CRUD), per-candidate enrolment history on the Candidate Detail page, and an `in_progress` denormalisation that keeps the existing `candidates.training_start_date` / `training_end_date` columns in sync.

**Architecture:** Two new Postgres tables (`trainings`, `candidate_trainings`) behind two new Express routers (`/api/trainings`, `/api/candidate-trainings`) backed by two new service modules. Enrolment writes always re-sync the active-training shortcut columns on `candidates` via a single shared helper called from every write path. Frontend adds an Admin > Trainings page and a "Training" tab on Candidate Detail (which is refactored to use shadcn `Tabs`).

**Tech Stack:** Express, PostgreSQL (`pg`), React 18 + TypeScript, TanStack Query, shadcn/ui, Vitest (frontend), Jest + Supertest (backend).

**Source spec:** `docs/superpowers/specs/2026-06-01-training-module-design.md` — §2 (schema), §3 (API except `GET /api/candidate-trainings`, `/stats`, `/bulk`), §4 (frontend), §6 (sync), §7 (Phase 1 tests). Phase 2 is out of scope for this plan and will get its own plan.

---

## Task 1: Database schema

**Files:**
- Create: `database/012-training-module.sql`

- [ ] **Step 1: Create the migration file**

Path: `database/012-training-module.sql`

```sql
-- Migration 012: Training module
-- Catalogue of training courses + per-candidate enrolment history.

CREATE TYPE training_status AS ENUM ('enrolled','in_progress','completed','withdrawn','failed');

CREATE TABLE trainings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(50),
  description   TEXT,
  duration_days INTEGER,
  provider_id   UUID REFERENCES providers(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX trainings_provider_idx ON trainings(provider_id);
CREATE INDEX trainings_active_idx   ON trainings(is_active);

CREATE TABLE candidate_trainings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  training_id     UUID NOT NULL REFERENCES trainings(id)  ON DELETE RESTRICT,
  status          training_status NOT NULL DEFAULT 'enrolled',
  start_date      DATE,
  end_date        DATE,
  completed_at    DATE,
  certificate_no  VARCHAR(100),
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ct_candidate_idx ON candidate_trainings(candidate_id);
CREATE INDEX ct_training_idx  ON candidate_trainings(training_id);
CREATE INDEX ct_status_idx    ON candidate_trainings(status);
```

- [ ] **Step 2: Apply the migration locally**

Run: `psql "$DATABASE_URL" -f database/012-training-module.sql`
Expected: `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX` messages. No errors.

- [ ] **Step 3: Verify both tables exist**

Run: `psql "$DATABASE_URL" -c "\d trainings" -c "\d candidate_trainings"`
Expected: both `\d` describes succeed and show all columns from the migration.

- [ ] **Step 4: Commit**

```bash
git add database/012-training-module.sql
git commit -m "feat(db): add training_status enum, trainings, candidate_trainings tables"
```

---

## Task 2: Catalogue service module

**Files:**
- Create: `packages/backend/src/services/trainings.js`

- [ ] **Step 1: Write the service module**

Path: `packages/backend/src/services/trainings.js`

```js
import { pool } from "../config/db.js";

export async function listTrainings({ search, providerId, isActive, page = 1, limit = 20 }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(t.name ILIKE $${idx} OR t.code ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (providerId) {
    conditions.push(`t.provider_id = $${idx}`);
    params.push(providerId);
    idx++;
  }
  if (isActive !== undefined) {
    conditions.push(`t.is_active = $${idx}`);
    params.push(isActive);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (Number(page) - 1) * Number(limit);

  const { rows } = await pool.query(
    `SELECT t.*, p.name AS provider_name
       FROM trainings t
       LEFT JOIN providers p ON p.id = t.provider_id
       ${where}
       ORDER BY t.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, Number(limit), offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM trainings t ${where}`,
    params
  );

  return { rows, total: countRows[0].total };
}

export async function getTraining(id) {
  const { rows } = await pool.query(
    `SELECT t.*, p.name AS provider_name
       FROM trainings t
       LEFT JOIN providers p ON p.id = t.provider_id
       WHERE t.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createTraining({ name, code, description, duration_days, provider_id, is_active }) {
  const { rows } = await pool.query(
    `INSERT INTO trainings (name, code, description, duration_days, provider_id, is_active)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
     RETURNING *`,
    [name, code || null, description || null, duration_days || null, provider_id || null, is_active]
  );
  return rows[0];
}

export async function updateTraining(id, { name, code, description, duration_days, provider_id, is_active }) {
  const { rows } = await pool.query(
    `UPDATE trainings
        SET name          = COALESCE($1, name),
            code          = COALESCE($2, code),
            description   = COALESCE($3, description),
            duration_days = COALESCE($4, duration_days),
            provider_id   = COALESCE($5, provider_id),
            is_active     = COALESCE($6, is_active),
            updated_at    = NOW()
      WHERE id = $7
      RETURNING *`,
    [name, code, description, duration_days, provider_id, is_active, id]
  );
  return rows[0] || null;
}

export async function softDeleteTraining(id) {
  const { rows } = await pool.query(
    `UPDATE trainings SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/services/trainings.js
git commit -m "feat(backend): add trainings catalogue service module"
```

---

## Task 3: Enrolment service module + sync function

**Files:**
- Create: `packages/backend/src/services/candidateTrainings.js`
- Test: `packages/backend/tests/candidateTrainingsSync.test.js`

- [ ] **Step 1: Write the failing sync test**

Path: `packages/backend/tests/candidateTrainingsSync.test.js`

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && npm test -- candidateTrainingsSync`
Expected: FAIL with module-not-found or import error on `syncCandidateActiveTraining`.

- [ ] **Step 3: Write the service module**

Path: `packages/backend/src/services/candidateTrainings.js`

```js
import { pool } from "../config/db.js";

export async function syncCandidateActiveTraining(candidateId, client = pool) {
  const { rows } = await client.query(
    `SELECT start_date, end_date
       FROM candidate_trainings
      WHERE candidate_id = $1 AND status = 'in_progress'
      ORDER BY start_date DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [candidateId]
  );
  const active = rows[0] || { start_date: null, end_date: null };
  await client.query(
    `UPDATE candidates
        SET training_start_date = $1,
            training_end_date   = $2,
            updated_at          = NOW()
      WHERE id = $3`,
    [active.start_date, active.end_date, candidateId]
  );
}

export async function listEnrolmentsForCandidate(candidateId) {
  const { rows } = await pool.query(
    `SELECT ct.*,
            t.name AS training_name, t.code AS training_code,
            p.name AS provider_name
       FROM candidate_trainings ct
       JOIN trainings t  ON t.id = ct.training_id
       LEFT JOIN providers p ON p.id = t.provider_id
      WHERE ct.candidate_id = $1
      ORDER BY ct.start_date DESC NULLS LAST, ct.created_at DESC`,
    [candidateId]
  );
  return rows;
}

export async function getEnrolment(id) {
  const { rows } = await pool.query(
    `SELECT ct.*,
            t.name AS training_name, t.code AS training_code,
            p.name AS provider_name
       FROM candidate_trainings ct
       JOIN trainings t  ON t.id = ct.training_id
       LEFT JOIN providers p ON p.id = t.provider_id
      WHERE ct.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createEnrolment({ candidate_id, training_id, status, start_date, end_date, certificate_no, notes, created_by }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const effectiveStatus = status || "enrolled";
    const completed_at = effectiveStatus === "completed" ? new Date().toISOString().slice(0, 10) : null;
    const { rows } = await client.query(
      `INSERT INTO candidate_trainings
         (candidate_id, training_id, status, start_date, end_date, completed_at, certificate_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [candidate_id, training_id, effectiveStatus, start_date || null, end_date || null, completed_at, certificate_no || null, notes || null, created_by || null]
    );
    await syncCandidateActiveTraining(candidate_id, client);
    await client.query("COMMIT");
    return getEnrolment(rows[0].id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateEnrolment(id, fields) {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(
      `SELECT candidate_id, status, completed_at FROM candidate_trainings WHERE id = $1`,
      [id]
    );
    if (!existing[0]) return null;

    await client.query("BEGIN");

    let completed_at = fields.completed_at;
    if (completed_at === undefined && fields.status === "completed" && !existing[0].completed_at) {
      completed_at = new Date().toISOString().slice(0, 10);
    }

    await client.query(
      `UPDATE candidate_trainings
          SET status         = COALESCE($1, status),
              start_date     = COALESCE($2, start_date),
              end_date       = COALESCE($3, end_date),
              completed_at   = COALESCE($4, completed_at),
              certificate_no = COALESCE($5, certificate_no),
              notes          = COALESCE($6, notes),
              updated_at     = NOW()
        WHERE id = $7`,
      [
        fields.status ?? null,
        fields.start_date ?? null,
        fields.end_date ?? null,
        completed_at ?? null,
        fields.certificate_no ?? null,
        fields.notes ?? null,
        id,
      ]
    );
    await syncCandidateActiveTraining(existing[0].candidate_id, client);
    await client.query("COMMIT");
    return getEnrolment(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteEnrolment(id) {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(
      `SELECT candidate_id FROM candidate_trainings WHERE id = $1`,
      [id]
    );
    if (!existing[0]) return false;

    await client.query("BEGIN");
    await client.query(`DELETE FROM candidate_trainings WHERE id = $1`, [id]);
    await syncCandidateActiveTraining(existing[0].candidate_id, client);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/backend && npm test -- candidateTrainingsSync`
Expected: PASS, three tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/candidateTrainings.js packages/backend/tests/candidateTrainingsSync.test.js
git commit -m "feat(backend): add candidate trainings service with active-training sync"
```

---

## Task 4: Catalogue route + integration tests

**Files:**
- Create: `packages/backend/src/routes/trainings.js`
- Modify: `packages/backend/src/app.js`
- Test: `packages/backend/tests/trainings.test.js`

- [ ] **Step 1: Write the failing integration test**

Path: `packages/backend/tests/trainings.test.js`

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && npm test -- trainings.test`
Expected: FAIL — all routes return 404 because the router isn't mounted.

- [ ] **Step 3: Create the route file**

Path: `packages/backend/src/routes/trainings.js`

```js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listTrainings,
  getTraining,
  createTraining,
  updateTraining,
  softDeleteTraining,
} from "../services/trainings.js";

export const trainingsRouter = Router();
trainingsRouter.use(requireAuth);

trainingsRouter.get("/", async (req, res, next) => {
  try {
    const { page, limit, search, provider_id, is_active } = req.query;
    const isActive = is_active === undefined ? undefined : is_active === "true";
    const { rows, total } = await listTrainings({
      search,
      providerId: provider_id,
      isActive,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    res.json({
      success: true,
      data: rows,
      meta: { total, page: Number(page || 1), limit: Number(limit || 20) },
    });
  } catch (err) { next(err); }
});

trainingsRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getTraining(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Training not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

trainingsRouter.post("/", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "name is required" });
    }
    const row = await createTraining(req.body);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

trainingsRouter.patch("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const row = await updateTraining(req.params.id, req.body);
    if (!row) return res.status(404).json({ success: false, error: "Training not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

trainingsRouter.delete("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const row = await softDeleteTraining(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Training not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});
```

- [ ] **Step 4: Mount the router**

Modify `packages/backend/src/app.js`. After the `import { reportsRouter }` line, add:

```js
import { trainingsRouter } from "./routes/trainings.js";
```

And in the Routes section, after `app.use("/api/reports", reportsRouter);`, add:

```js
app.use("/api/trainings", trainingsRouter);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/backend && npm test -- trainings.test`
Expected: PASS, all 6 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/routes/trainings.js packages/backend/src/app.js packages/backend/tests/trainings.test.js
git commit -m "feat(backend): add /api/trainings catalogue routes"
```

---

## Task 5: Enrolment routes + integration tests

**Files:**
- Create: `packages/backend/src/routes/candidate-trainings.js`
- Modify: `packages/backend/src/app.js`
- Modify: `packages/backend/src/routes/candidates.js`
- Test: `packages/backend/tests/candidateTrainings.test.js`

- [ ] **Step 1: Write the failing integration test**

Path: `packages/backend/tests/candidateTrainings.test.js`

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && npm test -- candidateTrainings.test`
Expected: FAIL — routes return 404 because nothing is mounted.

- [ ] **Step 3: Create the enrolment route file**

Path: `packages/backend/src/routes/candidate-trainings.js`

```js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listEnrolmentsForCandidate,
  getEnrolment,
  createEnrolment,
  updateEnrolment,
  deleteEnrolment,
} from "../services/candidateTrainings.js";
import { pool } from "../config/db.js";

function validateDates(start_date, end_date) {
  if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
    return "end_date must be on or after start_date";
  }
  return null;
}

async function logActivity(entityId, action, performedBy, metadata) {
  try {
    await pool.query(
      `INSERT INTO activity_log (entity_type, entity_id, action, performed_by, metadata)
       VALUES ('candidate_training', $1, $2, $3, $4)`,
      [entityId, action, performedBy, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (_err) { /* non-fatal */ }
}

// Mounted at /api/candidate-trainings
export const candidateTrainingsRouter = Router();
candidateTrainingsRouter.use(requireAuth);

candidateTrainingsRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getEnrolment(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Enrolment not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

candidateTrainingsRouter.post(
  "/",
  requireRole("admin", "recruiter_admin", "recruiter"),
  async (req, res, next) => {
    try {
      const { candidate_id, training_id, start_date, end_date } = req.body;
      if (!candidate_id || !training_id) {
        return res.status(400).json({ success: false, error: "candidate_id and training_id are required" });
      }
      const dateError = validateDates(start_date, end_date);
      if (dateError) return res.status(400).json({ success: false, error: dateError });

      const row = await createEnrolment({ ...req.body, created_by: req.user.id });
      await logActivity(row.id, "created", req.user.id, { candidate_id, training_id, status: row.status });
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

candidateTrainingsRouter.patch(
  "/:id",
  requireRole("admin", "recruiter_admin", "recruiter"),
  async (req, res, next) => {
    try {
      const { start_date, end_date } = req.body;
      const dateError = validateDates(start_date, end_date);
      if (dateError) return res.status(400).json({ success: false, error: dateError });

      const row = await updateEnrolment(req.params.id, req.body);
      if (!row) return res.status(404).json({ success: false, error: "Enrolment not found" });
      await logActivity(row.id, "updated", req.user.id, { status: row.status });
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

candidateTrainingsRouter.delete("/:id", requireRole("admin", "recruiter_admin"), async (req, res, next) => {
  try {
    const ok = await deleteEnrolment(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Enrolment not found" });
    await logActivity(req.params.id, "deleted", req.user.id, null);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Exported helper for mounting the per-candidate list under /api/candidates/:id/trainings
export function mountCandidateTrainingsList(candidatesRouter) {
  candidatesRouter.get("/:id/trainings", requireAuth, async (req, res, next) => {
    try {
      const rows = await listEnrolmentsForCandidate(req.params.id);
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  });
}
```

- [ ] **Step 4: Wire the candidate-scoped GET into candidates.js**

Modify `packages/backend/src/routes/candidates.js`. Near the top imports, add:

```js
import { mountCandidateTrainingsList } from "./candidate-trainings.js";
```

After the `candidatesRouter` is declared but before any route handlers are defined, call:

```js
mountCandidateTrainingsList(candidatesRouter);
```

Pick the spot that puts this call right after `export const candidatesRouter = Router();`. (If the router is named differently, use whatever symbol is exported.)

- [ ] **Step 5: Mount the enrolment router in app.js**

Modify `packages/backend/src/app.js`. Add this import near the others:

```js
import { candidateTrainingsRouter } from "./routes/candidate-trainings.js";
```

And in the Routes section (right after the line you added for trainings in Task 4):

```js
app.use("/api/candidate-trainings", candidateTrainingsRouter);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/backend && npm test -- candidateTrainings.test`
Expected: PASS, all tests green.

- [ ] **Step 7: Run the full backend suite for regressions**

Run: `cd packages/backend && npm test`
Expected: PASS across all suites (no regressions introduced into other tests).

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/routes/candidate-trainings.js packages/backend/src/routes/candidates.js packages/backend/src/app.js packages/backend/tests/candidateTrainings.test.js
git commit -m "feat(backend): add candidate enrolment routes with activity logging"
```

---

## Task 6: Seed data for trainings + enrolments

**Files:**
- Modify: `database/002-seed-data.sql`

- [ ] **Step 1: Append seed inserts**

Append to `database/002-seed-data.sql` (after existing inserts, before any final notices). Pick candidate UUIDs that already exist in the seed by looking at the file first.

```sql
-- ── Training catalogue ──────────────────────────────────────────────────────
INSERT INTO trainings (name, code, description, duration_days, provider_id) VALUES
  ('Cert III in Aged Care',     'CHC33015', 'Foundational aged-care qualification.', 180, (SELECT id FROM providers ORDER BY created_at LIMIT 1)),
  ('Cert III in Individual Support', 'CHC33021', 'Disability and aged-care support cert.', 180, (SELECT id FROM providers ORDER BY created_at LIMIT 1)),
  ('White Card',                'CPCWHS', 'Construction site safety induction.', 1, NULL),
  ('First Aid Certificate',     'HLTAID011', 'Provide first aid.', 1, NULL),
  ('Forklift Licence',          'TLILIC0003', 'High-risk work licence.', 5, NULL),
  ('Food Handling',             'SITXFSA005', 'Use hygienic practices for food safety.', 1, NULL);

-- ── Enrolments (mix of statuses) ────────────────────────────────────────────
-- Pick the first 4 seeded candidates by created_at for deterministic seeding.
WITH cands AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn FROM candidates
), trs AS (
  SELECT id, name FROM trainings WHERE code IN ('CHC33015','CHC33021','CPCWHS','HLTAID011','TLILIC0003','SITXFSA005')
)
INSERT INTO candidate_trainings (candidate_id, training_id, status, start_date, end_date, completed_at, certificate_no)
SELECT c.id, t.id, 'completed', '2025-08-01', '2026-01-31', '2026-01-31', 'CERT-001'
  FROM cands c JOIN trs t ON t.name = 'Cert III in Aged Care' WHERE c.rn = 1
UNION ALL
SELECT c.id, t.id, 'in_progress', '2026-04-01', '2026-09-30', NULL, NULL
  FROM cands c JOIN trs t ON t.name = 'Cert III in Individual Support' WHERE c.rn = 2
UNION ALL
SELECT c.id, t.id, 'completed', '2026-03-15', '2026-03-15', '2026-03-15', 'WC-2026-002'
  FROM cands c JOIN trs t ON t.name = 'White Card' WHERE c.rn = 2
UNION ALL
SELECT c.id, t.id, 'enrolled', '2026-07-01', NULL, NULL, NULL
  FROM cands c JOIN trs t ON t.name = 'Forklift Licence' WHERE c.rn = 3
UNION ALL
SELECT c.id, t.id, 'withdrawn', '2026-02-01', '2026-02-14', NULL, NULL
  FROM cands c JOIN trs t ON t.name = 'Food Handling' WHERE c.rn = 4
UNION ALL
SELECT c.id, t.id, 'failed', '2025-10-01', '2025-10-01', NULL, NULL
  FROM cands c JOIN trs t ON t.name = 'First Aid Certificate' WHERE c.rn = 4;

-- Sync candidate.training_start_date/end_date for any in_progress enrolments we just inserted.
UPDATE candidates c
   SET training_start_date = ct.start_date,
       training_end_date   = ct.end_date,
       updated_at          = NOW()
  FROM candidate_trainings ct
 WHERE ct.candidate_id = c.id
   AND ct.status = 'in_progress';
```

- [ ] **Step 2: Re-seed locally**

Run: `psql "$DATABASE_URL" -f database/002-seed-data.sql`
Expected: completes without errors. (The full seed file is idempotent-friendly if it was before; if not, drop/recreate per CLAUDE.md run instructions.)

- [ ] **Step 3: Verify seed counts**

Run: `psql "$DATABASE_URL" -c "SELECT COUNT(*) AS trainings FROM trainings; SELECT status, COUNT(*) FROM candidate_trainings GROUP BY status ORDER BY status;"`
Expected: 6 trainings, enrolments grouped across `enrolled`, `in_progress`, `completed`, `withdrawn`, `failed`.

- [ ] **Step 4: Commit**

```bash
git add database/002-seed-data.sql
git commit -m "feat(db): seed training catalogue and sample enrolments"
```

---

## Task 7: Frontend types

**Files:**
- Modify: `packages/frontend/src/types/index.ts`

- [ ] **Step 1: Append training types**

Append to `packages/frontend/src/types/index.ts`:

```ts
export type TrainingStatus = "enrolled" | "in_progress" | "completed" | "withdrawn" | "failed";

export interface Training {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  duration_days: number | null;
  provider_id: string | null;
  provider_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CandidateTraining {
  id: string;
  candidate_id: string;
  training_id: string;
  status: TrainingStatus;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  certificate_no: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Expanded fields returned by the API
  training_name: string;
  training_code: string | null;
  provider_name: string | null;
}
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors related to these types. (If existing baseline has unrelated errors, ensure no new ones appear.)

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/types/index.ts
git commit -m "feat(frontend): add Training and CandidateTraining types"
```

---

## Task 8: Frontend hooks — catalogue

**Files:**
- Create: `packages/frontend/src/hooks/useTrainings.ts`

- [ ] **Step 1: Write the hook file**

Path: `packages/frontend/src/hooks/useTrainings.ts`

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Training } from "../types";

export interface TrainingFilters {
  search?: string;
  providerId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

function buildQuery(filters: TrainingFilters): string {
  const params = new URLSearchParams();
  if (filters.search)    params.set("search", filters.search);
  if (filters.providerId) params.set("provider_id", filters.providerId);
  if (filters.isActive !== undefined) params.set("is_active", String(filters.isActive));
  if (filters.page)  params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useTrainings(filters: TrainingFilters = {}) {
  return useQuery({
    queryKey: ["trainings", filters],
    queryFn:  () => api.list<Training>(`/trainings${buildQuery(filters)}`),
  });
}

export function useTraining(id: string | undefined) {
  return useQuery({
    queryKey: ["training", id],
    queryFn:  () => api.get<Training>(`/trainings/${id}`),
    enabled:  !!id,
  });
}

export interface TrainingPayload {
  name: string;
  code?: string | null;
  description?: string | null;
  duration_days?: number | null;
  provider_id?: string | null;
  is_active?: boolean;
}

export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TrainingPayload) => api.post<Training>("/trainings", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trainings"] }),
  });
}

export function useUpdateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<TrainingPayload> }) =>
      api.patch<Training>(`/trainings/${id}`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["trainings"] });
      qc.invalidateQueries({ queryKey: ["training", vars.id] });
    },
  });
}

export function useDeleteTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/trainings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trainings"] }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/hooks/useTrainings.ts
git commit -m "feat(frontend): add useTrainings catalogue hooks"
```

---

## Task 9: Frontend hooks — enrolments

**Files:**
- Create: `packages/frontend/src/hooks/useCandidateTrainings.ts`

- [ ] **Step 1: Write the hook file**

Path: `packages/frontend/src/hooks/useCandidateTrainings.ts`

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CandidateTraining, TrainingStatus } from "../types";

export function useCandidateTrainings(candidateId: string | undefined) {
  return useQuery({
    queryKey: ["candidate-trainings", candidateId],
    queryFn:  () => api.get<CandidateTraining[]>(`/candidates/${candidateId}/trainings`),
    enabled:  !!candidateId,
  });
}

export interface EnrolmentPayload {
  candidate_id: string;
  training_id: string;
  status?: TrainingStatus;
  start_date?: string | null;
  end_date?: string | null;
  certificate_no?: string | null;
  notes?: string | null;
}

export function useCreateEnrolment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EnrolmentPayload) => api.post<CandidateTraining>("/candidate-trainings", body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["candidate-trainings", vars.candidate_id] });
      qc.invalidateQueries({ queryKey: ["candidate", vars.candidate_id] });
    },
  });
}

export interface EnrolmentUpdate {
  id: string;
  candidate_id: string;
  body: Partial<Omit<EnrolmentPayload, "candidate_id" | "training_id">>;
}

export function useUpdateEnrolment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: EnrolmentUpdate) =>
      api.patch<CandidateTraining>(`/candidate-trainings/${id}`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["candidate-trainings", vars.candidate_id] });
      qc.invalidateQueries({ queryKey: ["candidate", vars.candidate_id] });
    },
  });
}

export function useDeleteEnrolment(candidateId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/candidate-trainings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate-trainings", candidateId] });
      qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/hooks/useCandidateTrainings.ts
git commit -m "feat(frontend): add useCandidateTrainings enrolment hooks"
```

---

## Task 10: Admin > Trainings page

**Files:**
- Create: `packages/frontend/src/pages/AdminTrainings.tsx`
- Modify: `packages/frontend/src/App.tsx`

- [ ] **Step 1: Write the page**

Path: `packages/frontend/src/pages/AdminTrainings.tsx`

```tsx
import { useState } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { useTrainings, useCreateTraining, useUpdateTraining, useDeleteTraining } from "../hooks/useTrainings";
import { useAuth } from "../contexts/AuthContext";
import type { Training } from "../types";
import { api } from "../lib/api";
import { useQuery } from "@tanstack/react-query";

interface ProviderOption { id: string; name: string }

const STATUS_BADGE = (active: boolean) =>
  active
    ? "border border-green-500 text-green-700 bg-transparent"
    : "border border-slate-400 text-slate-500 bg-transparent";

export default function AdminTrainings() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "recruiter_admin";

  const [search, setSearch] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [editing, setEditing] = useState<Training | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: result, isLoading } = useTrainings({
    search: search.trim() || undefined,
    isActive: showActiveOnly ? true : undefined,
    limit: 100,
  });
  const trainings = result?.data ?? [];

  const { data: providersResult } = useQuery({
    queryKey: ["providers-select"],
    queryFn:  () => api.list<ProviderOption>("/providers?limit=200"),
  });
  const providers = providersResult?.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Trainings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage the catalogue of training courses</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900"
          >
            <Plus size={14} /> New Training
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code..."
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
          />
          Active only
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : trainings.length === 0 ? (
          <p className="p-6 text-center text-slate-400">No trainings yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Code</th>
                <th className="text-left px-5 py-3">Provider</th>
                <th className="text-left px-5 py-3">Duration</th>
                <th className="text-left px-5 py-3">Active</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trainings.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3 text-slate-900">{t.name}</td>
                  <td className="px-5 py-3 text-slate-500">{t.code || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{t.provider_name || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{t.duration_days ? `${t.duration_days} days` : "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_BADGE(t.is_active)}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canEdit && (
                      <button
                        onClick={() => setEditing(t)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && (
        <TrainingFormDialog
          training={editing}
          providers={providers}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

interface DialogProps {
  training: Training | null;
  providers: ProviderOption[];
  onClose: () => void;
}

function TrainingFormDialog({ training, providers, onClose }: DialogProps) {
  const [name, setName] = useState(training?.name ?? "");
  const [code, setCode] = useState(training?.code ?? "");
  const [description, setDescription] = useState(training?.description ?? "");
  const [durationDays, setDurationDays] = useState<string>(training?.duration_days?.toString() ?? "");
  const [providerId, setProviderId] = useState<string>(training?.provider_id ?? "");
  const [isActive, setIsActive] = useState<boolean>(training?.is_active ?? true);
  const [error, setError] = useState("");

  const create = useCreateTraining();
  const update = useUpdateTraining();
  const softDelete = useDeleteTraining();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Name is required."); return; }
    const body = {
      name: name.trim(),
      code: code.trim() || null,
      description: description.trim() || null,
      duration_days: durationDays ? Number(durationDays) : null,
      provider_id: providerId || null,
      is_active: isActive,
    };
    const promise = training
      ? update.mutateAsync({ id: training.id, body })
      : create.mutateAsync(body);
    promise.then(onClose).catch((err: Error) => setError(err.message));
  }

  function handleDeactivate() {
    if (!training) return;
    if (!confirm(`Mark "${training.name}" as inactive?`)) return;
    softDelete.mutate(training.id, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {training ? "Edit Training" : "New Training"}
        </h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Duration (days)</label>
              <input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Provider</label>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— None —</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-between items-center pt-2">
            <div>
              {training && (
                <button type="button" onClick={handleDeactivate} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                  <Power size={12} /> Mark inactive
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50">
                {training ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the route and nav link**

Modify `packages/frontend/src/App.tsx`. Add this import near the other `AdminX` imports:

```tsx
import AdminTrainings   from "./pages/AdminTrainings";
```

Add the route alongside the other admin routes (after `/admin/locations`):

```tsx
<Route path="/admin/trainings" element={<AdminRoute><AdminTrainings /></AdminRoute>} />
```

If there is a navigation menu rendered in `App.tsx` (look for the existing "Admin" dropdown — it lists Departments/Locations/Users), add a new entry pointing to `/admin/trainings` with label "Trainings" and an appropriate `lucide-react` icon (`GraduationCap` is already a common pick).

- [ ] **Step 3: Run the dev server and verify**

Run: `cd packages/frontend && npm run dev` (in another terminal, ensure backend is also running)
- Log in as `admin@myats.dev` / `password123`
- Navigate to `/admin/trainings`
- Verify seed-data trainings show up
- Click "+ New Training", create a course, edit it, mark it inactive — each action should reflect in the list

Expected: page loads, CRUD works, filters work.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/AdminTrainings.tsx packages/frontend/src/App.tsx
git commit -m "feat(frontend): add Admin > Trainings catalogue page"
```

---

## Task 11: Candidate Detail — Training tab

**Files:**
- Modify: `packages/frontend/src/pages/CandidateDetail.tsx`

This task converts the existing Candidate Detail layout to a `Tabs` component if it isn't one already, and adds a "Training" tab populated by the new hooks.

- [ ] **Step 1: Read the current CandidateDetail to understand its structure**

Run: `wc -l packages/frontend/src/pages/CandidateDetail.tsx`
Then open and read it. Identify how the Profile and Applications sections are currently rendered. There are two cases:

- **Case A — already uses shadcn `Tabs`:** add a new `TabsTrigger` for "Training" and a new `TabsContent` with the implementation in Step 2.
- **Case B — sections stacked without tabs:** wrap them in `Tabs` (`<Tabs defaultValue="profile">…<TabsList>…</TabsList>…<TabsContent value="profile">…<TabsContent value="applications">…<TabsContent value="training">…</Tabs>`). Use `Tabs` from `@/components/ui/tabs` if shadcn is set up that way (verify via `ls packages/frontend/src/components/ui/`).

In either case, the new "Training" tab content is the same.

- [ ] **Step 2: Add the Training tab content**

Place the following near the top of `CandidateDetail.tsx` alongside the other imports:

```tsx
import {
  useCandidateTrainings,
  useCreateEnrolment,
  useUpdateEnrolment,
  useDeleteEnrolment,
} from "../hooks/useCandidateTrainings";
import { useTrainings } from "../hooks/useTrainings";
import type { CandidateTraining, TrainingStatus, Training } from "../types";
```

Add this `TRAINING_BADGE` map next to the existing `STAGE_BADGE` / `WORK_STATUS_BADGE`:

```tsx
const TRAINING_BADGE: Record<TrainingStatus, string> = {
  enrolled:    "border border-slate-400 text-slate-600 bg-transparent",
  in_progress: "border border-blue-400 text-blue-600 bg-transparent",
  completed:   "border border-green-500 text-green-700 bg-transparent",
  withdrawn:   "border border-amber-400 text-amber-600 bg-transparent",
  failed:      "border border-red-400 text-red-500 bg-transparent",
};
```

Render the Training tab body using this component (define it inside `CandidateDetail.tsx`, below the main component):

```tsx
function TrainingTab({ candidateId, canWrite }: { candidateId: string; canWrite: boolean }) {
  const { data: enrolments = [], isLoading } = useCandidateTrainings(candidateId);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<CandidateTraining | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Training history</h3>
        {canWrite && (
          <button
            onClick={() => { setEditing(null); setShowDialog(true); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-white hover:bg-slate-900"
          >
            + Enrol
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : enrolments.length === 0 ? (
        <p className="text-sm text-slate-400">No training records.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">Course</th>
                <th className="text-left px-4 py-2.5">Provider</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Start</th>
                <th className="text-left px-4 py-2.5">End</th>
                <th className="text-left px-4 py-2.5">Cert #</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrolments.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 text-slate-900">
                    {e.training_name}
                    {e.training_code && <span className="text-xs text-slate-400 ml-1">({e.training_code})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.provider_name || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${TRAINING_BADGE[e.status]}`}>
                      {e.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.start_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.end_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.certificate_no ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canWrite && (
                      <button
                        onClick={() => { setEditing(e); setShowDialog(true); }}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDialog && (
        <EnrolmentDialog
          candidateId={candidateId}
          enrolment={editing}
          onClose={() => { setShowDialog(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function EnrolmentDialog({
  candidateId,
  enrolment,
  onClose,
}: { candidateId: string; enrolment: CandidateTraining | null; onClose: () => void }) {
  const { data: catalogue } = useTrainings({ isActive: true, limit: 200 });
  const trainings: Training[] = catalogue?.data ?? [];

  const [trainingId, setTrainingId] = useState(enrolment?.training_id ?? "");
  const [status, setStatus] = useState<TrainingStatus>(enrolment?.status ?? "enrolled");
  const [startDate, setStartDate] = useState(enrolment?.start_date ?? "");
  const [endDate, setEndDate] = useState(enrolment?.end_date ?? "");
  const [certificateNo, setCertificateNo] = useState(enrolment?.certificate_no ?? "");
  const [notes, setNotes] = useState(enrolment?.notes ?? "");
  const [error, setError] = useState("");

  const create = useCreateEnrolment();
  const update = useUpdateEnrolment();
  const remove = useDeleteEnrolment(candidateId);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!trainingId) { setError("Please pick a course."); return; }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError("End date must be on or after start date.");
      return;
    }

    const payload = {
      training_id: trainingId,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      certificate_no: certificateNo || null,
      notes: notes || null,
    };

    const promise = enrolment
      ? update.mutateAsync({ id: enrolment.id, candidate_id: candidateId, body: payload })
      : create.mutateAsync({ candidate_id: candidateId, ...payload });
    promise.then(onClose).catch((err: Error) => setError(err.message));
  }

  function handleDelete() {
    if (!enrolment) return;
    if (!confirm("Remove this enrolment? This cannot be undone.")) return;
    remove.mutate(enrolment.id, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {enrolment ? "Edit Enrolment" : "Enrol in Training"}
        </h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Course *</label>
            <select
              value={trainingId}
              onChange={(e) => setTrainingId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              disabled={!!enrolment}
            >
              <option value="">— Pick a course —</option>
              {trainings.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TrainingStatus)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="enrolled">Enrolled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {status === "completed" && (
            <div>
              <label className="text-xs text-slate-500">Certificate #</label>
              <input value={certificateNo} onChange={(e) => setCertificateNo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-between items-center pt-2">
            <div>
              {enrolment && (
                <button type="button" onClick={handleDelete} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50">
                {enrolment ? "Save" : "Enrol"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
```

Then add the tab itself. Where the main JSX renders the tabs, insert the new tab next to "Applications":

```tsx
<TabsTrigger value="training">Training</TabsTrigger>
{/* ... existing TabsContent for profile, applications ... */}
<TabsContent value="training">
  {id && <TrainingTab candidateId={id} canWrite={canWrite} />}
</TabsContent>
```

If the file is in Case B (no tabs yet), the wrap looks like:

```tsx
<Tabs defaultValue="profile" className="mt-6">
  <TabsList>
    <TabsTrigger value="profile">Profile</TabsTrigger>
    <TabsTrigger value="applications">Applications</TabsTrigger>
    <TabsTrigger value="training">Training</TabsTrigger>
  </TabsList>
  <TabsContent value="profile">{/* existing profile JSX */}</TabsContent>
  <TabsContent value="applications">{/* existing applications JSX */}</TabsContent>
  <TabsContent value="training">
    {id && <TrainingTab candidateId={id} canWrite={canWrite} />}
  </TabsContent>
</Tabs>
```

Make sure to import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs` (or wherever shadcn's tabs live — confirm by checking `packages/frontend/src/components/ui/`). If shadcn `tabs` isn't installed, use the shadcn CLI in the frontend package: `npx shadcn-ui@latest add tabs`.

- [ ] **Step 3: Verify in browser**

Run dev server (`npm run dev` in `packages/frontend`). Open a seeded candidate from `/candidates`:
- Confirm Training tab is visible
- Seeded enrolment rows render (with status badges, correct colors)
- "+ Enrol" opens dialog, picking a course + status `in_progress` + start date saves successfully
- After save, the "active training" pill on Profile reflects the new start/end dates (proves the backend sync ran)
- Edit a record, mark it `completed`, save — active-training pill clears
- Remove an enrolment — row disappears

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/CandidateDetail.tsx
git commit -m "feat(frontend): add Training tab to Candidate Detail"
```

---

## Task 12: Frontend tests

**Files:**
- Create: `packages/frontend/src/pages/AdminTrainings.test.tsx`
- Create: `packages/frontend/src/pages/CandidateTrainingTab.test.tsx`

Note: existing `packages/frontend/` tests are minimal — confirm Vitest config is in place by running `cd packages/frontend && npm test -- --run` once before writing tests. If no tests exist yet, copy the setup mechanics from any one existing `*.test.tsx`; otherwise add the standard `@testing-library/react` boilerplate.

- [ ] **Step 1: Test the catalogue page renders rows**

Path: `packages/frontend/src/pages/AdminTrainings.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import AdminTrainings from "./AdminTrainings";
import { AuthProvider } from "../contexts/AuthContext";

vi.mock("../lib/api", () => ({
  api: {
    list: vi.fn(async (path: string) => {
      if (path.startsWith("/trainings")) {
        return {
          data: [
            { id: "t1", name: "White Card", code: "CPCWHS", description: null, duration_days: 1, provider_id: null, provider_name: null, is_active: true, created_at: "", updated_at: "" },
          ],
          meta: { total: 1, page: 1, limit: 100 },
        };
      }
      if (path.startsWith("/providers")) {
        return { data: [], meta: { total: 0, page: 1, limit: 200 } };
      }
      return { data: [], meta: { total: 0, page: 1, limit: 20 } };
    }),
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../contexts/AuthContext", async () => {
  const actual = await vi.importActual<typeof import("../contexts/AuthContext")>("../contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => ({ user: { id: "u1", role: "admin", name: "Admin", email: "a@b" } }),
  };
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <AdminTrainings />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe("AdminTrainings", () => {
  it("renders training rows from the catalogue", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("White Card")).toBeInTheDocument());
    expect(screen.getByText("CPCWHS")).toBeInTheDocument();
  });

  it("shows 'New Training' button for admin role", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /new training/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test the candidate training tab renders enrolments**

Path: `packages/frontend/src/pages/CandidateTrainingTab.test.tsx`

This test imports the `TrainingTab` component. **If you defined it inline inside `CandidateDetail.tsx`, export it from that file** (add `export` to the function declaration). Otherwise extract it into `packages/frontend/src/components/TrainingTab.tsx` first.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TrainingTab } from "./CandidateDetail";

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(async (path: string) => {
      if (path.endsWith("/trainings")) {
        return [
          {
            id: "ct1", candidate_id: "c1", training_id: "t1",
            status: "in_progress", start_date: "2026-05-01", end_date: "2026-09-30",
            completed_at: null, certificate_no: null, notes: null,
            created_by: null, created_at: "", updated_at: "",
            training_name: "Cert III in Aged Care", training_code: "CHC33015",
            provider_name: "Maxima Training",
          },
        ];
      }
      return null;
    }),
    list: vi.fn(async () => ({ data: [], meta: { total: 0, page: 1, limit: 200 } })),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("TrainingTab", () => {
  it("renders enrolment rows from the API", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <TrainingTab candidateId="c1" canWrite />
        </QueryClientProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Cert III in Aged Care")).toBeInTheDocument());
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run frontend tests**

Run: `cd packages/frontend && npm test -- --run`
Expected: PASS, both new test files green.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/AdminTrainings.test.tsx packages/frontend/src/pages/CandidateTrainingTab.test.tsx packages/frontend/src/pages/CandidateDetail.tsx
git commit -m "test(frontend): cover AdminTrainings and TrainingTab"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run all backend tests**

Run: `cd packages/backend && npm test`
Expected: all suites pass (existing + the three new training suites).

- [ ] **Step 2: Run all frontend tests**

Run: `cd packages/frontend && npm test -- --run`
Expected: all suites pass.

- [ ] **Step 3: Manual smoke test**

1. Start backend (`npm run dev` in `packages/backend`) and frontend (`npm run dev` in `packages/frontend`)
2. Log in as `admin@myats.dev` / `password123`
3. `/admin/trainings` — see seeded courses, create new course, edit, mark inactive
4. `/candidates/<id>` for a seeded candidate — see Training tab, enrol in a course with `in_progress`, observe active-training pill on Profile tab update
5. Edit the enrolment to `completed`, observe pill clear
6. Log out, log in as a non-admin recruiter — confirm Training tab is visible and read-only / write-allowed per spec (recruiters can enrol, only admins see catalogue edit controls)

- [ ] **Step 4: Verify spec coverage**

Walk through `docs/superpowers/specs/2026-06-01-training-module-design.md`:
- §2 schema → Task 1
- §3 catalogue routes (`/api/trainings`) → Tasks 2 + 4
- §3 per-candidate list + single enrolment endpoints → Tasks 3 + 5
- §3 activity logging → Task 5 (in `logActivity`)
- §4a Admin > Trainings → Tasks 8 + 10
- §4b Candidate "Training" tab → Tasks 9 + 11
- §6 sync function and call sites → Task 3
- §7 tests → Tasks 3, 4, 5, 12

Out of scope (handled in Phase 2 plan, not this one):
- `GET /api/candidate-trainings` cross-candidate list
- `GET /api/candidate-trainings/stats`
- `POST /api/candidate-trainings/bulk`
- Top-level `/training` page
- Bulk enrolment UI

- [ ] **Step 5: Push to remote (only if user asks)**

Do not push automatically. Ask the user first.

---

## Phase 2 hand-off

Once Phase 1 is merged and validated, write a separate plan covering:

- `GET /api/candidate-trainings` (filters, pagination, search by candidate name)
- `GET /api/candidate-trainings/stats`
- `POST /api/candidate-trainings/bulk` (with transactional rollback + skip-when-active behaviour)
- `packages/frontend/src/pages/Training.tsx` (Enrolments tab + Cohort enrol tab)
- Top-level nav entry

That work will reuse most of the service code already written here.

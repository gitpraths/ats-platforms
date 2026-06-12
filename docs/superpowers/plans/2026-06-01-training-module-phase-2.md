# Training Module — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 slice of the Training Module — the cross-candidate operational view (filtered enrolments list + status summary chips) and the cohort bulk-enrolment flow, exposed as a new top-level `/training` page.

**Architecture:** Three new endpoints on the existing `/api/candidate-trainings` router (`GET /`, `GET /stats`, `POST /bulk`) backed by new functions on the existing `services/candidateTrainings.js` module. The bulk endpoint inserts inside a single transaction, calls `syncCandidateActiveTraining` per affected candidate, and skips candidates already holding a non-terminal (`enrolled` or `in_progress`) enrolment for the same course. Frontend adds a top-level `/training` page with two tabs implemented as separate components (`EnrolmentsTab.tsx`, `CohortEnrolTab.tsx`) plus three new TanStack Query hooks. Nav entry placed between "Candidates" and "Placements", visible to admins and recruiters only.

**Tech Stack:** Express, PostgreSQL (`pg`), React 18 + TypeScript, TanStack Query, shadcn/ui Tabs, Vitest (frontend), Jest + Supertest (backend).

**Source spec:** `docs/superpowers/specs/2026-06-01-training-module-design.md` — §3 (the three remaining endpoints), §5 (frontend), §6 (sync call site for `bulk`), §7 (`candidateTrainingsBulk.test.js`, `Training.test.tsx`).

**Phase 1 prerequisite:** This plan assumes Phase 1 is merged (branch `feat/training-module-phase-1`, PR #2). It references the already-existing `services/candidateTrainings.js`, `routes/candidate-trainings.js`, `hooks/useCandidateTrainings.ts`, types from `src/types/index.ts`, and seed data.

---

## File map

**Backend — extend existing files (no new files in the routes layer):**
- `packages/backend/src/services/candidateTrainings.js` — add `listEnrolments`, `getEnrolmentStats`, `bulkEnrol`
- `packages/backend/src/routes/candidate-trainings.js` — wire the three new endpoints (`GET /`, `GET /stats`, `POST /bulk`)
- `packages/backend/tests/candidateTrainings.test.js` — extend with list + stats coverage
- `packages/backend/tests/candidateTrainingsBulk.test.js` — new file dedicated to bulk endpoint (3 scenarios: happy path, skip-when-active, rollback)

**Frontend — new files for the Training page, extend existing hooks file:**
- `packages/frontend/src/hooks/useCandidateTrainings.ts` — append `useCandidateTrainingsList`, `useTrainingStats`, `useBulkEnrolment`
- `packages/frontend/src/pages/Training.tsx` — top-level page with shadcn `Tabs`, default tab "enrolments"
- `packages/frontend/src/components/training/EnrolmentsTab.tsx` — filter bar + paginated table + summary chips
- `packages/frontend/src/components/training/CohortEnrolTab.tsx` — three-step inline flow with sticky footer + result dialog
- `packages/frontend/src/App.tsx` — import, register route, add nav entry
- `packages/frontend/src/pages/Training.test.tsx` — new Vitest file covering filter wiring and bulk-flow validation

---

## Task 1: Service — cross-candidate list + stats

**Files:**
- Modify: `packages/backend/src/services/candidateTrainings.js`

- [ ] **Step 1: Append `listEnrolments` and `getEnrolmentStats` to the service**

Open `packages/backend/src/services/candidateTrainings.js`. Below the existing `deleteEnrolment` export, append:

```js
function buildEnrolmentFilters({ status, training_id, provider_id, date_from, date_to, search }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status && status.length) {
    conditions.push(`ct.status = ANY($${idx}::training_status[])`);
    params.push(status);
    idx++;
  }
  if (training_id) {
    conditions.push(`ct.training_id = $${idx}`);
    params.push(training_id);
    idx++;
  }
  if (provider_id) {
    conditions.push(`t.provider_id = $${idx}`);
    params.push(provider_id);
    idx++;
  }
  if (date_from) {
    conditions.push(`ct.start_date >= $${idx}`);
    params.push(date_from);
    idx++;
  }
  if (date_to) {
    conditions.push(`ct.start_date <= $${idx}`);
    params.push(date_to);
    idx++;
  }
  if (search) {
    conditions.push(`c.name ILIKE $${idx}`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params, nextIdx: idx };
}

export async function listEnrolments(filters) {
  const { where, params, nextIdx } = buildEnrolmentFilters(filters);
  const page  = Math.max(1, Number(filters.page  || 1));
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 25)));
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT ct.*,
            t.name AS training_name, t.code AS training_code,
            p.name AS provider_name,
            c.name AS candidate_name
       FROM candidate_trainings ct
       JOIN trainings t      ON t.id = ct.training_id
       LEFT JOIN providers p ON p.id = t.provider_id
       JOIN candidates c     ON c.id = ct.candidate_id
       ${where}
       ORDER BY ct.start_date DESC NULLS LAST, ct.created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
    [...params, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM candidate_trainings ct
       JOIN trainings t  ON t.id = ct.training_id
       JOIN candidates c ON c.id = ct.candidate_id
       ${where}`,
    params
  );

  return { rows, total: countRows[0].total, page, limit };
}

export async function getEnrolmentStats(filters) {
  // Drop `status` from the active filters — stats are GROUPED by status.
  const { status: _ignored, ...rest } = filters;
  const { where, params } = buildEnrolmentFilters(rest);

  const { rows } = await pool.query(
    `SELECT ct.status, COUNT(*)::int AS count
       FROM candidate_trainings ct
       JOIN trainings t  ON t.id = ct.training_id
       JOIN candidates c ON c.id = ct.candidate_id
       ${where}
       GROUP BY ct.status`,
    params
  );

  const result = { enrolled: 0, in_progress: 0, completed: 0, withdrawn: 0, failed: 0 };
  for (const r of rows) result[r.status] = r.count;
  return result;
}
```

- [ ] **Step 2: Sanity-check parse**

Run: `node --check packages/backend/src/services/candidateTrainings.js`
Expected: no output (clean parse).

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/services/candidateTrainings.js
git commit -m "feat(backend): add listEnrolments + getEnrolmentStats services"
```

---

## Task 2: Service — bulk enrolment with skip-when-active

**Files:**
- Modify: `packages/backend/src/services/candidateTrainings.js`

- [ ] **Step 1: Append `bulkEnrol` to the service**

Append at the end of `packages/backend/src/services/candidateTrainings.js`:

```js
/**
 * Insert one enrolment per candidate in a single transaction.
 * Skips candidates already holding a non-terminal enrolment (`enrolled` or `in_progress`)
 * for the same `training_id`. Returns `{ created, skipped }`.
 *
 *  - `status` for each created row is `'enrolled'` (the bulk action is a cohort enrolment,
 *    not a state transition).
 *  - `completed_at` is null for created rows (status is `'enrolled'`).
 *  - `syncCandidateActiveTraining` is called once per AFFECTED candidate (those actually
 *    inserted) inside the same transaction.
 */
export async function bulkEnrol({ training_id, start_date, end_date, candidate_ids, created_by }) {
  if (!training_id) throw new Error("training_id is required");
  if (!start_date)  throw new Error("start_date is required");
  if (!Array.isArray(candidate_ids) || candidate_ids.length === 0) {
    throw new Error("candidate_ids must be a non-empty array");
  }
  if (end_date && new Date(end_date) < new Date(start_date)) {
    throw new Error("end_date must be on or after start_date");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1: find which candidates already have a non-terminal enrolment for this course.
    const { rows: blockedRows } = await client.query(
      `SELECT DISTINCT candidate_id
         FROM candidate_trainings
        WHERE training_id = $1
          AND status IN ('enrolled', 'in_progress')
          AND candidate_id = ANY($2::uuid[])`,
      [training_id, candidate_ids]
    );
    const blocked = new Set(blockedRows.map((r) => r.candidate_id));

    const skipped = [];
    const insertedIds = [];

    // Step 2: insert one row per non-blocked candidate.
    for (const candidateId of candidate_ids) {
      if (blocked.has(candidateId)) {
        skipped.push({ candidate_id: candidateId, reason: "active_enrolment_exists" });
        continue;
      }
      const { rows } = await client.query(
        `INSERT INTO candidate_trainings
           (candidate_id, training_id, status, start_date, end_date, created_by)
         VALUES ($1, $2, 'enrolled', $3, $4, $5)
         RETURNING id`,
        [candidateId, training_id, start_date, end_date || null, created_by || null]
      );
      insertedIds.push(rows[0].id);
    }

    // Step 3: sync the denormalised column for every affected candidate.
    const affected = candidate_ids.filter((id) => !blocked.has(id));
    for (const candidateId of affected) {
      await syncCandidateActiveTraining(candidateId, client);
    }

    await client.query("COMMIT");

    // Step 4: read back the inserted rows with their joined fields. Done outside the
    // transaction since the txn is committed.
    if (insertedIds.length === 0) return { created: [], skipped };
    const { rows: created } = await pool.query(
      `SELECT ct.*,
              t.name AS training_name, t.code AS training_code,
              p.name AS provider_name,
              c.name AS candidate_name
         FROM candidate_trainings ct
         JOIN trainings t      ON t.id = ct.training_id
         LEFT JOIN providers p ON p.id = t.provider_id
         JOIN candidates c     ON c.id = ct.candidate_id
        WHERE ct.id = ANY($1::uuid[])
        ORDER BY ct.created_at ASC`,
      [insertedIds]
    );
    return { created, skipped };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 2: Sanity-check parse**

Run: `node --check packages/backend/src/services/candidateTrainings.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/services/candidateTrainings.js
git commit -m "feat(backend): add bulkEnrol service with skip-when-active"
```

---

## Task 3: Route — GET /api/candidate-trainings (cross-candidate list)

**Files:**
- Modify: `packages/backend/src/routes/candidate-trainings.js`
- Modify: `packages/backend/tests/candidateTrainings.test.js`

- [ ] **Step 1: Add the failing test cases**

Open `packages/backend/tests/candidateTrainings.test.js`. **Before** the existing `afterAll` block, add a new `describe` block. The existing test fixture already creates one in_progress enrolment for `candidateId` — we'll lean on that plus the seeded enrolments. Append:

```js
describe("GET /api/candidate-trainings (cross-candidate list)", () => {
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
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `cd packages/backend && npm test -- candidateTrainings.test`
Expected: the 4 new tests fail with 404 (`Cannot GET /api/candidate-trainings`).

- [ ] **Step 3: Add the route handler**

Open `packages/backend/src/routes/candidate-trainings.js`. **Add** to the imports near the top (the `import { ... } from "../services/candidateTrainings.js"` block):

```js
import {
  listEnrolmentsForCandidate,
  getEnrolment,
  createEnrolment,
  updateEnrolment,
  deleteEnrolment,
  listEnrolments,
} from "../services/candidateTrainings.js";
```

(That is: add `listEnrolments` to the destructure that's already there.)

Then **insert a new route handler** above the existing `candidateTrainingsRouter.get("/:id", ...)` so the literal path `/` is matched before `/:id`:

```js
candidateTrainingsRouter.get("/", async (req, res, next) => {
  try {
    const { page, limit, status, training_id, provider_id, date_from, date_to, search } = req.query;
    const statusList = !status
      ? undefined
      : Array.isArray(status) ? status : String(status).split(",").filter(Boolean);

    const result = await listEnrolments({
      page, limit,
      status: statusList,
      training_id,
      provider_id,
      date_from,
      date_to,
      search,
    });
    res.json({
      success: true,
      data: result.rows,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) { next(err); }
});
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `cd packages/backend && npm test -- candidateTrainings.test`
Expected: all tests in this file pass (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/candidate-trainings.js packages/backend/tests/candidateTrainings.test.js
git commit -m "feat(backend): add GET /api/candidate-trainings cross-candidate list"
```

---

## Task 4: Route — GET /api/candidate-trainings/stats

**Files:**
- Modify: `packages/backend/src/routes/candidate-trainings.js`
- Modify: `packages/backend/tests/candidateTrainings.test.js`

- [ ] **Step 1: Add the failing test**

Append to `packages/backend/tests/candidateTrainings.test.js` (after the cross-candidate list describe block from Task 3, still before `afterAll`):

```js
describe("GET /api/candidate-trainings/stats", () => {
  it("returns counts grouped by status with all 5 keys", async () => {
    const res = await request(app).get("/api/candidate-trainings/stats").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({
      enrolled:    expect.any(Number),
      in_progress: expect.any(Number),
      completed:   expect.any(Number),
      withdrawn:   expect.any(Number),
      failed:      expect.any(Number),
    }));
  });

  it("ignores the status filter when computing stats", async () => {
    // Even when filtering by status, stats should report counts ACROSS all statuses
    // (matching the active filters minus `status`).
    const filtered = await request(app)
      .get("/api/candidate-trainings/stats?status=completed")
      .set(auth());
    const all = await request(app).get("/api/candidate-trainings/stats").set(auth());
    expect(filtered.body.data).toEqual(all.body.data);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `cd packages/backend && npm test -- candidateTrainings.test`
Expected: the 2 new tests fail with 404.

- [ ] **Step 3: Add the route handler**

Open `packages/backend/src/routes/candidate-trainings.js`. **Add** `getEnrolmentStats` to the service import block:

```js
import {
  listEnrolmentsForCandidate,
  getEnrolment,
  createEnrolment,
  updateEnrolment,
  deleteEnrolment,
  listEnrolments,
  getEnrolmentStats,
} from "../services/candidateTrainings.js";
```

Then **insert** the `/stats` handler immediately after the `/` handler from Task 3 (and still before `/:id`):

```js
candidateTrainingsRouter.get("/stats", async (req, res, next) => {
  try {
    const { training_id, provider_id, date_from, date_to, search } = req.query;
    const stats = await getEnrolmentStats({
      training_id, provider_id, date_from, date_to, search,
    });
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `cd packages/backend && npm test -- candidateTrainings.test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/candidate-trainings.js packages/backend/tests/candidateTrainings.test.js
git commit -m "feat(backend): add GET /api/candidate-trainings/stats endpoint"
```

---

## Task 5: Route — POST /api/candidate-trainings/bulk + dedicated tests

**Files:**
- Modify: `packages/backend/src/routes/candidate-trainings.js`
- Create: `packages/backend/tests/candidateTrainingsBulk.test.js`

- [ ] **Step 1: Write the failing dedicated test file**

Path: `packages/backend/tests/candidateTrainingsBulk.test.js`

```js
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
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `cd packages/backend && npm test -- candidateTrainingsBulk`
Expected: all 5 tests fail with 404 because the route is not mounted yet.

- [ ] **Step 3: Add the route handler**

Open `packages/backend/src/routes/candidate-trainings.js`. **Add** `bulkEnrol` to the service import block:

```js
import {
  listEnrolmentsForCandidate,
  getEnrolment,
  createEnrolment,
  updateEnrolment,
  deleteEnrolment,
  listEnrolments,
  getEnrolmentStats,
  bulkEnrol,
} from "../services/candidateTrainings.js";
```

**Insert** the bulk handler just above the existing `candidateTrainingsRouter.post("/", ...)` so the more specific `/bulk` path is registered before any catch-all:

```js
candidateTrainingsRouter.post(
  "/bulk",
  requireRole("admin", "recruiter_admin", "recruiter"),
  async (req, res, next) => {
    try {
      const { training_id, start_date, end_date, candidate_ids } = req.body;
      if (!training_id || !start_date) {
        return res.status(400).json({ success: false, error: "training_id and start_date are required" });
      }
      if (!Array.isArray(candidate_ids) || candidate_ids.length === 0) {
        return res.status(400).json({ success: false, error: "candidate_ids must be a non-empty array" });
      }
      if (end_date && new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ success: false, error: "end_date must be on or after start_date" });
      }

      const result = await bulkEnrol({
        training_id, start_date, end_date,
        candidate_ids,
        created_by: req.user.id,
      });

      for (const row of result.created) {
        await logActivity(row.id, "created", req.user.id, {
          candidate_id: row.candidate_id, training_id, bulk: true,
        });
      }

      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `cd packages/backend && npm test -- candidateTrainingsBulk`
Expected: 5 tests pass.

- [ ] **Step 5: Run the full backend suite for regressions**

Run: `cd packages/backend && npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/routes/candidate-trainings.js packages/backend/tests/candidateTrainingsBulk.test.js
git commit -m "feat(backend): add POST /api/candidate-trainings/bulk with skip + rollback"
```

---

## Task 6: Frontend hooks — list, stats, bulk

**Files:**
- Modify: `packages/frontend/src/hooks/useCandidateTrainings.ts`

- [ ] **Step 1: Append the three new hooks**

Open `packages/frontend/src/hooks/useCandidateTrainings.ts`. **Append** below the existing `useDeleteEnrolment` export:

```ts
export interface EnrolmentListFilters {
  status?: import("../types").TrainingStatus[];
  training_id?: string;
  provider_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

function buildListQuery(f: EnrolmentListFilters): string {
  const p = new URLSearchParams();
  if (f.status && f.status.length) p.set("status", f.status.join(","));
  if (f.training_id) p.set("training_id", f.training_id);
  if (f.provider_id) p.set("provider_id", f.provider_id);
  if (f.date_from)   p.set("date_from", f.date_from);
  if (f.date_to)     p.set("date_to", f.date_to);
  if (f.search)      p.set("search", f.search);
  if (f.page)        p.set("page", String(f.page));
  if (f.limit)       p.set("limit", String(f.limit));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function useCandidateTrainingsList(filters: EnrolmentListFilters) {
  return useQuery({
    queryKey: ["candidate-trainings-list", filters],
    queryFn:  () => api.list<CandidateTraining & { candidate_name: string }>(
      `/candidate-trainings${buildListQuery(filters)}`
    ),
    placeholderData: (prev) => prev, // smooth pagination
  });
}

export interface TrainingStats {
  enrolled: number;
  in_progress: number;
  completed: number;
  withdrawn: number;
  failed: number;
}

export function useTrainingStats(filters: Omit<EnrolmentListFilters, "status" | "page" | "limit">) {
  return useQuery({
    queryKey: ["training-stats", filters],
    queryFn:  () => api.get<TrainingStats>(`/candidate-trainings/stats${buildListQuery(filters)}`),
  });
}

export interface BulkEnrolPayload {
  training_id: string;
  start_date: string;
  end_date?: string | null;
  candidate_ids: string[];
}

export interface BulkEnrolResult {
  created: (CandidateTraining & { candidate_name: string })[];
  skipped: { candidate_id: string; reason: string }[];
}

export function useBulkEnrolment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkEnrolPayload) =>
      api.post<BulkEnrolResult>("/candidate-trainings/bulk", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate-trainings-list"] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      // affected candidates' per-candidate lists are invalidated wholesale:
      qc.invalidateQueries({ queryKey: ["candidate-trainings"] });
    },
  });
}
```

Make sure the existing top-of-file imports already include `useQuery`, `useMutation`, `useQueryClient`, `api`, and `CandidateTraining` — they do, from Phase 1. If `TrainingStatus` isn't already imported at the top, add it to the existing import block.

- [ ] **Step 2: Type-check the frontend**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/hooks/useCandidateTrainings.ts
git commit -m "feat(frontend): add useCandidateTrainingsList, useTrainingStats, useBulkEnrolment hooks"
```

---

## Task 7: Page scaffold — Training.tsx + nav entry + route

**Files:**
- Create: `packages/frontend/src/pages/Training.tsx`
- Modify: `packages/frontend/src/App.tsx`

- [ ] **Step 1: Confirm shadcn `Tabs` is available**

Run: `ls packages/frontend/src/components/ui/tabs.tsx`
Expected: file exists (it does — used by other pages).

- [ ] **Step 2: Create the page scaffold**

Path: `packages/frontend/src/pages/Training.tsx`

```tsx
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EnrolmentsTab } from "../components/training/EnrolmentsTab";
import { CohortEnrolTab } from "../components/training/CohortEnrolTab";
import type { TrainingStatus } from "../types";

export interface PrefilterToEnrolments {
  training_id?: string;
  date_from?: string;
  status?: TrainingStatus[];
}

export default function Training() {
  const [tab, setTab] = useState<"enrolments" | "cohort">("enrolments");
  // Allows the Cohort tab to push the user to Enrolments with pre-applied filters
  // after a successful bulk enrol.
  const [prefilter, setPrefilter] = useState<PrefilterToEnrolments | undefined>(undefined);

  function viewEnrolments(filters: PrefilterToEnrolments) {
    setPrefilter(filters);
    setTab("enrolments");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Training</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track enrolments and run cohort enrolments</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "enrolments" | "cohort")}>
        <TabsList>
          <TabsTrigger value="enrolments">Enrolments</TabsTrigger>
          <TabsTrigger value="cohort">Cohort enrol</TabsTrigger>
        </TabsList>

        <TabsContent value="enrolments" className="mt-4">
          <EnrolmentsTab prefilter={prefilter} onPrefilterConsumed={() => setPrefilter(undefined)} />
        </TabsContent>

        <TabsContent value="cohort" className="mt-4">
          <CohortEnrolTab onViewEnrolments={viewEnrolments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

(The two child components are placeholders for now — they're built in Tasks 8 and 9.)

- [ ] **Step 3: Create placeholder components so the page compiles**

Path: `packages/frontend/src/components/training/EnrolmentsTab.tsx`

```tsx
import type { PrefilterToEnrolments } from "../../pages/Training";

export function EnrolmentsTab({
  prefilter: _prefilter,
  onPrefilterConsumed: _onPrefilterConsumed,
}: {
  prefilter?: PrefilterToEnrolments;
  onPrefilterConsumed: () => void;
}) {
  return <p className="text-sm text-slate-500">Enrolments tab — coming in Task 8.</p>;
}
```

Path: `packages/frontend/src/components/training/CohortEnrolTab.tsx`

```tsx
import type { PrefilterToEnrolments } from "../../pages/Training";

export function CohortEnrolTab({
  onViewEnrolments: _onViewEnrolments,
}: {
  onViewEnrolments: (f: PrefilterToEnrolments) => void;
}) {
  return <p className="text-sm text-slate-500">Cohort enrol tab — coming in Task 9.</p>;
}
```

- [ ] **Step 4: Register the route and add the nav entry**

Open `packages/frontend/src/App.tsx`.

**Add the import** near the existing page imports:

```tsx
import Training         from "./pages/Training";
```

**Add the nav link.** Find the NavLink for "Candidates" and the NavLink for "Placements" (search for `to="/candidates"` and `to="/placements"`). Insert the new NavLink between them, guarded by an `isAdminOrRecruiter` check. If a variable like `isAdminOrRecruiter` doesn't exist, derive it next to the existing `isAdmin` declaration:

```tsx
// near the top of the App component, alongside the existing role flags:
const isAdminOrRecruiter = user?.role === "admin"
                        || user?.role === "recruiter_admin"
                        || user?.role === "recruiter";
```

And the new NavLink:

```tsx
{isAdminOrRecruiter && (
  <NavLink to="/training" className={navClass}>Training</NavLink>
)}
```

**Add the route** alongside the other top-level routes (look for `<Route path="/candidates"` and `<Route path="/placements"`):

```tsx
<Route path="/training" element={<Training />} />
```

If the project uses an `<AdminRoute>` or `<AuthRoute>` wrapper for the other top-level routes, copy whatever wrapping pattern `/candidates` uses. If `/candidates` is wrapped in `<AuthRoute>...</AuthRoute>`, do the same for `/training`. If it's not wrapped at all, leave the new route unwrapped — `requireAuth` is already enforced on the backend.

- [ ] **Step 5: Verify in the browser**

Run dev servers (`npm run dev` in both `packages/backend` and `packages/frontend`), log in as `admin@myats.dev` / `password123`, click the new "Training" nav link, confirm both tab labels render and clicking each tab swaps the placeholder text.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/pages/Training.tsx \
        packages/frontend/src/components/training/EnrolmentsTab.tsx \
        packages/frontend/src/components/training/CohortEnrolTab.tsx \
        packages/frontend/src/App.tsx
git commit -m "feat(frontend): scaffold /training page with Tabs, nav entry, route"
```

---

## Task 8: Enrolments tab — filters + paginated table + summary chips

**Files:**
- Modify: `packages/frontend/src/components/training/EnrolmentsTab.tsx`

- [ ] **Step 1: Replace the placeholder with the full implementation**

Path: `packages/frontend/src/components/training/EnrolmentsTab.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useCandidateTrainingsList, useTrainingStats } from "../../hooks/useCandidateTrainings";
import { useTrainings } from "../../hooks/useTrainings";
import { api } from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import type { TrainingStatus } from "../../types";
import type { PrefilterToEnrolments } from "../../pages/Training";

const ALL_STATUSES: TrainingStatus[] = ["enrolled", "in_progress", "completed", "withdrawn", "failed"];

const STATUS_BADGE: Record<TrainingStatus, string> = {
  enrolled:    "border border-slate-400 text-slate-600 bg-transparent",
  in_progress: "border border-blue-400 text-blue-600 bg-transparent",
  completed:   "border border-green-500 text-green-700 bg-transparent",
  withdrawn:   "border border-amber-400 text-amber-600 bg-transparent",
  failed:      "border border-red-400 text-red-500 bg-transparent",
};

interface ProviderOption { id: string; name: string }

export function EnrolmentsTab({
  prefilter,
  onPrefilterConsumed,
}: {
  prefilter?: PrefilterToEnrolments;
  onPrefilterConsumed: () => void;
}) {
  // ─── Filter state ─────────────────────────────────────────────
  const [statuses, setStatuses] = useState<TrainingStatus[]>([]);
  const [trainingId, setTrainingId] = useState<string>("");
  const [providerId, setProviderId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Apply prefilter from Cohort enrol "View enrolments" handoff
  useEffect(() => {
    if (!prefilter) return;
    if (prefilter.training_id) setTrainingId(prefilter.training_id);
    if (prefilter.date_from)   setDateFrom(prefilter.date_from);
    if (prefilter.status)      setStatuses(prefilter.status);
    setPage(1);
    onPrefilterConsumed();
  }, [prefilter, onPrefilterConsumed]);

  // ─── Catalogue + provider options for the comboboxes ──────────
  const { data: catalogueResult } = useTrainings({ isActive: true, limit: 200 });
  const trainings = catalogueResult?.data ?? [];

  const { data: providersResult } = useQuery({
    queryKey: ["providers-select"],
    queryFn:  () => api.list<ProviderOption>("/providers?limit=200"),
  });
  const providers = providersResult?.data ?? [];

  // ─── Server queries ───────────────────────────────────────────
  const filters = useMemo(() => ({
    status: statuses.length ? statuses : undefined,
    training_id: trainingId || undefined,
    provider_id: providerId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    search: search.trim() || undefined,
    page,
    limit: 25,
  }), [statuses, trainingId, providerId, dateFrom, dateTo, search, page]);

  const { data: listResult, isLoading } = useCandidateTrainingsList(filters);
  const { data: stats } = useTrainingStats({
    training_id: filters.training_id,
    provider_id: filters.provider_id,
    date_from: filters.date_from,
    date_to: filters.date_to,
    search: filters.search,
  });
  const rows = listResult?.data ?? [];
  const total = listResult?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  function toggleStatus(s: TrainingStatus) {
    setPage(1);
    setStatuses((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }

  function clearAll() {
    setStatuses([]); setTrainingId(""); setProviderId("");
    setDateFrom(""); setDateTo(""); setSearch(""); setPage(1);
  }

  const hasActiveFilters =
    statuses.length || trainingId || providerId || dateFrom || dateTo || search.trim();

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {ALL_STATUSES.map((s) => (
          <span key={s} className={`inline-block px-2 py-1 rounded ${STATUS_BADGE[s]}`}>
            {s.replace("_", " ")}: {stats?.[s] ?? 0}
          </span>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => {
            const active = statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  active ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select value={trainingId} onChange={(e) => { setTrainingId(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All courses</option>
            {trainings.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={providerId} onChange={(e) => { setProviderId(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All providers</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="From" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="To" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search candidate name..."
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {hasActiveFilters ? (
          <button onClick={clearAll} className="text-xs text-slate-500 hover:underline">Clear filters</button>
        ) : null}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-slate-400">No enrolments match these filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">Candidate</th>
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
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 text-slate-900">{e.candidate_name}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {e.training_name}
                    {e.training_code && <span className="text-xs text-slate-400 ml-1">({e.training_code})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.provider_name || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_BADGE[e.status]}`}>
                      {e.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.start_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.end_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.certificate_no ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      to={`/candidates/${e.candidate_id}`}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:underline"
                    >
                      Open <ExternalLink size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{total} enrolment{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
            >
              Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border border-slate-200 rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke test in browser**

Reload `/training`. Confirm: status chips toggle, course/provider dropdowns populate, name search filters, "Clear filters" appears only when something is set, "Open" link routes to the candidate detail page, pagination buttons enable/disable correctly, summary chips reflect filter changes (e.g. picking a course should update the per-status counts).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/training/EnrolmentsTab.tsx
git commit -m "feat(frontend): build Enrolments tab with filters, table, pagination, stats chips"
```

---

## Task 9: Cohort enrol tab — three-step inline flow

**Files:**
- Modify: `packages/frontend/src/components/training/CohortEnrolTab.tsx`

- [ ] **Step 1: Replace the placeholder with the full implementation**

Path: `packages/frontend/src/components/training/CohortEnrolTab.tsx`

```tsx
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useTrainings } from "../../hooks/useTrainings";
import { useBulkEnrolment } from "../../hooks/useCandidateTrainings";
import { api } from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import type { Training } from "../../types";
import type { PrefilterToEnrolments } from "../../pages/Training";

interface CandidateRow { id: string; name: string; email: string | null }

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CohortEnrolTab({ onViewEnrolments }: { onViewEnrolments: (f: PrefilterToEnrolments) => void }) {
  // ─── Step 1: course ────────────────────────────────────────────
  const [trainingId, setTrainingId] = useState<string>("");
  const { data: catalogueResult } = useTrainings({ isActive: true, limit: 200 });
  const trainings: Training[] = catalogueResult?.data ?? [];
  const selectedTraining = useMemo(
    () => trainings.find((t) => t.id === trainingId) || null,
    [trainings, trainingId]
  );

  // ─── Step 2: dates ─────────────────────────────────────────────
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  function handleStartDateChange(v: string) {
    setStartDate(v);
    if (v && selectedTraining?.duration_days && !endDate) {
      setEndDate(addDays(v, selectedTraining.duration_days));
    }
  }

  // ─── Step 3: candidates ────────────────────────────────────────
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const { data: candidatesResult } = useQuery({
    queryKey: ["candidates-pick", search, page],
    queryFn:  () => api.list<CandidateRow>(
      `/candidates?limit=20&page=${page}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`
    ),
  });
  const candidates = candidatesResult?.data ?? [];
  const candidatesTotal = candidatesResult?.meta?.total ?? 0;
  const candidatesPages = Math.max(1, Math.ceil(candidatesTotal / 20));

  const [selected, setSelected] = useState<CandidateRow[]>([]);
  function toggleSelected(c: CandidateRow) {
    setSelected((cur) => cur.some((x) => x.id === c.id)
      ? cur.filter((x) => x.id !== c.id)
      : [...cur, c]
    );
  }
  function removeSelected(id: string) {
    setSelected((cur) => cur.filter((x) => x.id !== id));
  }

  // ─── Action ────────────────────────────────────────────────────
  const bulk = useBulkEnrolment();
  const [result, setResult] = useState<{
    created: number;
    skipped: { candidate_id: string; reason: string; candidate_name: string }[];
  } | null>(null);
  const [error, setError] = useState("");

  const canSubmit = !!trainingId && !!startDate && selected.length > 0 && !bulk.isPending;

  function handleSubmit() {
    setError("");
    if (!canSubmit) return;
    if (endDate && new Date(endDate) < new Date(startDate)) {
      setError("End date must be on or after start date.");
      return;
    }
    bulk.mutateAsync({
      training_id: trainingId,
      start_date: startDate,
      end_date: endDate || null,
      candidate_ids: selected.map((c) => c.id),
    }).then((res) => {
      const selectedById = new Map(selected.map((c) => [c.id, c]));
      const skippedWithNames = res.skipped.map((s) => ({
        ...s,
        candidate_name: selectedById.get(s.candidate_id)?.name ?? "(unknown)",
      }));
      setResult({ created: res.created.length, skipped: skippedWithNames });
    }).catch((err: Error) => setError(err.message));
  }

  function resetFlow() {
    setTrainingId(""); setStartDate(""); setEndDate("");
    setSelected([]); setSearch(""); setPage(1); setResult(null);
  }

  // ─── Render ───────────────────────────────────────────────────
  const step2Enabled = !!trainingId;
  const step3Enabled = step2Enabled && !!startDate;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 pb-24">
      <div className="space-y-4">
        {/* Step 1 */}
        <section className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">1. Pick a course</h3>
          <select
            value={trainingId}
            onChange={(e) => setTrainingId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— Choose a course —</option>
            {trainings.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ""}</option>
            ))}
          </select>
          {selectedTraining && (
            <div className="mt-3 border border-slate-100 rounded-lg p-3 text-xs text-slate-600">
              <p className="text-sm text-slate-900 font-medium">{selectedTraining.name}</p>
              {selectedTraining.code && <p>{selectedTraining.code}</p>}
              {selectedTraining.provider_name && <p>{selectedTraining.provider_name}</p>}
              {selectedTraining.duration_days && <p>{selectedTraining.duration_days} days nominal</p>}
            </div>
          )}
        </section>

        {/* Step 2 */}
        <section className={`bg-white rounded-xl shadow-sm p-4 ${step2Enabled ? "" : "opacity-50 pointer-events-none"}`}>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">2. Set dates</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Start date *</label>
              <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        {/* Step 3 */}
        <section className={`bg-white rounded-xl shadow-sm p-4 ${step3Enabled ? "" : "opacity-50 pointer-events-none"}`}>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">3. Choose candidates</h3>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search candidates..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
          />
          <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {candidates.length === 0 ? (
              <p className="p-4 text-xs text-slate-400">No candidates match.</p>
            ) : (
              candidates.map((c) => {
                const checked = selected.some((s) => s.id === c.id);
                return (
                  <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleSelected(c)} />
                    <span className="text-slate-900">{c.name}</span>
                    {c.email && <span className="text-xs text-slate-400 ml-auto">{c.email}</span>}
                  </label>
                );
              })
            )}
          </div>
          {candidatesTotal > 20 && (
            <div className="flex items-center justify-end gap-2 text-xs text-slate-500 mt-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40">Prev</button>
              <span>Page {page} of {candidatesPages}</span>
              <button disabled={page >= candidatesPages} onClick={() => setPage((p) => Math.min(candidatesPages, p + 1))} className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40">Next</button>
            </div>
          )}
        </section>
      </div>

      {/* Right-hand selected panel */}
      <aside className="bg-white rounded-xl shadow-sm p-4 self-start sticky top-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Selected ({selected.length})</h3>
        {selected.length === 0 ? (
          <p className="text-xs text-slate-400">Pick candidates from the list to enrol them.</p>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {selected.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-1 py-1.5 text-sm">
                <span className="truncate">{c.name}</span>
                <button onClick={() => removeSelected(c.id)} className="text-slate-400 hover:text-red-500 ml-2"><X size={12} /></button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Sticky submit footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between z-10 shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.04)]">
        <span className="text-xs text-slate-500 ml-4">
          {selected.length} candidate{selected.length === 1 ? "" : "s"} selected
        </span>
        <div className="flex items-center gap-2 mr-4">
          {error && <span className="text-xs text-red-600 mr-2">{error}</span>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40"
          >
            {bulk.isPending ? "Enrolling..." : `Enrol ${selected.length} candidate${selected.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {/* Result dialog */}
      {result && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Bulk enrolment complete</h2>
            <p className="text-sm text-slate-600 mb-4">Created {result.created} enrolment{result.created === 1 ? "" : "s"}.</p>
            {result.skipped.length > 0 && (
              <details className="mb-4 border border-amber-200 rounded-lg p-3 bg-amber-50/40">
                <summary className="text-sm text-amber-700 cursor-pointer">{result.skipped.length} skipped — see why</summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {result.skipped.map((s) => (
                    <li key={s.candidate_id}>
                      <span className="font-medium">{s.candidate_name}</span> — {s.reason.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={resetFlow} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Start another</button>
              <button
                onClick={() => {
                  onViewEnrolments({
                    training_id: trainingId,
                    date_from: startDate,
                  });
                  resetFlow();
                }}
                className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900"
              >
                View enrolments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke test in browser**

In `/training` → Cohort enrol:
- Confirm step 2 disables until a course is picked, step 3 disables until a start date is set.
- Pick a course with `duration_days` set, set start date — end date should auto-fill to start + duration.
- Tick 2-3 candidates, watch the right-hand panel update; remove one via the X.
- Click "Enrol N candidates" — confirm the result dialog shows created/skipped counts. If you re-enrol overlapping candidates, the second run should show them in the skipped list with reason "active enrolment exists".
- Click "View enrolments" — should land on the Enrolments tab with the course and start date pre-filtered, and the new rows visible.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/training/CohortEnrolTab.tsx
git commit -m "feat(frontend): build Cohort enrol three-step flow with bulk result dialog"
```

---

## Task 10: Frontend tests for the Training page

**Files:**
- Create: `packages/frontend/src/pages/Training.test.tsx`

- [ ] **Step 1: Write the tests**

Path: `packages/frontend/src/pages/Training.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Training from "./Training";

const listMock = vi.fn();
const getMock  = vi.fn();
const postMock = vi.fn();

vi.mock("../lib/api", () => ({
  api: {
    list: (path: string) => listMock(path),
    get:  (path: string) => getMock(path),
    post: (path: string, body: unknown) => postMock(path, body),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <Training />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const baseListResponse = (rows: unknown[], total = rows.length) => ({
  data: rows,
  meta: { total, page: 1, limit: 25 },
});

beforeEach(() => {
  vi.clearAllMocks();

  listMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/trainings")) {
      return baseListResponse([
        { id: "t1", name: "White Card", code: "CPCWHS", description: null, duration_days: 1, provider_id: null, provider_name: null, is_active: true, created_at: "", updated_at: "" },
        { id: "t2", name: "Cert III in Aged Care", code: "CHC33015", description: null, duration_days: 180, provider_id: null, provider_name: null, is_active: true, created_at: "", updated_at: "" },
      ]);
    }
    if (path.startsWith("/providers")) {
      return baseListResponse([]);
    }
    if (path.startsWith("/candidate-trainings")) {
      const hasStatusFilter = path.includes("status=in_progress");
      return baseListResponse(hasStatusFilter ? [] : [
        {
          id: "ct1", candidate_id: "c1", training_id: "t1",
          status: "enrolled", start_date: "2026-07-01", end_date: null,
          completed_at: null, certificate_no: null, notes: null,
          created_by: null, created_at: "", updated_at: "",
          training_name: "White Card", training_code: "CPCWHS",
          provider_name: null, candidate_name: "Alice",
        },
      ]);
    }
    if (path.startsWith("/candidates")) {
      return baseListResponse([
        { id: "c1", name: "Alice", email: "a@x" },
        { id: "c2", name: "Bob",   email: "b@x" },
      ]);
    }
    return baseListResponse([]);
  });

  getMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/candidate-trainings/stats")) {
      return { enrolled: 5, in_progress: 2, completed: 3, withdrawn: 0, failed: 1 };
    }
    return null;
  });
});

describe("Training — Enrolments tab", () => {
  it("renders enrolment rows and summary chips", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("White Card")).toBeInTheDocument();
    expect(screen.getByText(/enrolled: 5/i)).toBeInTheDocument();
    expect(screen.getByText(/in progress: 2/i)).toBeInTheDocument();
  });

  it("applies a status chip filter and shows the empty state when no rows match", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    // First "in progress" hit is the chip toggle in the filter bar (not the summary chip).
    const inProgressChips = screen.getAllByRole("button", { name: /in progress/i });
    await user.click(inProgressChips[0]);

    await waitFor(() => expect(screen.getByText(/no enrolments match/i)).toBeInTheDocument());
  });
});

describe("Training — Cohort enrol tab", () => {
  it("disables the submit button until course, date, and a candidate are picked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /cohort enrol/i }));

    const submit = await screen.findByRole("button", { name: /enrol 0 candidates/i });
    expect(submit).toBeDisabled();

    // Pick course
    const courseSelect = await screen.findByRole("combobox", { name: undefined });
    fireEvent.change(courseSelect, { target: { value: "t2" } });

    // Set start date
    const startInputs = await screen.findAllByLabelText(/start date/i);
    fireEvent.change(startInputs[0], { target: { value: "2026-07-01" } });

    // Select a candidate
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    const aliceCheckbox = screen.getByRole("checkbox", { name: /alice/i });
    await user.click(aliceCheckbox);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /enrol 1 candidate/i })).toBeEnabled();
    });
  });

  it("surfaces skipped candidates from the bulk response", async () => {
    postMock.mockResolvedValueOnce({
      created: [],
      skipped: [{ candidate_id: "c1", reason: "active_enrolment_exists" }],
    });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /cohort enrol/i }));

    const courseSelect = await screen.findByRole("combobox", { name: undefined });
    fireEvent.change(courseSelect, { target: { value: "t2" } });
    const startInputs = await screen.findAllByLabelText(/start date/i);
    fireEvent.change(startInputs[0], { target: { value: "2026-07-01" } });

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    await user.click(screen.getByRole("checkbox", { name: /alice/i }));

    await user.click(screen.getByRole("button", { name: /enrol 1 candidate/i }));

    await waitFor(() => expect(screen.getByText(/bulk enrolment complete/i)).toBeInTheDocument());
    // The skipped <details> summary should mention "1 skipped"
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd packages/frontend && npm test -- --run Training.test`
Expected: 4 tests pass.

- [ ] **Step 3: Run the full frontend suite**

Run: `cd packages/frontend && npm test -- --run`
Expected: all suites pass (existing + this one).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/Training.test.tsx
git commit -m "test(frontend): cover Training enrolments filter and cohort bulk flow"
```

---

## Task 11: Final verification

- [ ] **Step 1: Backend suite**

Run: `cd packages/backend && npm test`
Expected: all suites pass (Phase 1 + the new `candidateTrainings.test.js` additions + `candidateTrainingsBulk.test.js`).

- [ ] **Step 2: Frontend suite**

Run: `cd packages/frontend && npm test -- --run`
Expected: all suites pass.

- [ ] **Step 3: Manual smoke**

1. `npm run dev` in both `packages/backend` and `packages/frontend`.
2. Log in as `admin@myats.dev` / `password123`. Confirm "Training" nav link is visible.
3. Visit `/training`. Confirm:
   - Enrolments tab loads with seeded rows and stats chips.
   - Status chip toggles filter the table. Course / provider / date / search filters work in combination.
   - "Open" link on a row routes to the candidate detail page.
   - Pagination Prev/Next behave at boundaries.
4. Switch to Cohort enrol.
   - Pick a course with `duration_days` set; set a start date; confirm end date auto-fills.
   - Tick 2 candidates. Sticky footer button activates.
   - Click "Enrol N candidates". Result dialog shows count + skipped list (if any).
   - Click "View enrolments". You should land on the Enrolments tab with the course pre-filtered and the just-created rows visible.
5. Log out, log in as a recruiter — "Training" nav link should still be visible (recruiters are allowed).
6. Log in as a non-admin / non-recruiter user (e.g. a "provider" role if present). The nav link should be hidden.

- [ ] **Step 4: Verify spec coverage**

Walk through `docs/superpowers/specs/2026-06-01-training-module-design.md`:
- §3 `GET /api/candidate-trainings` → Task 3
- §3 `GET /api/candidate-trainings/stats` → Task 4
- §3 `POST /api/candidate-trainings/bulk` → Tasks 2 + 5
- §3 activity logging on bulk → Task 5 (loop calling `logActivity` per created row)
- §5 Enrolments tab → Tasks 7 + 8
- §5 Cohort enrol tab → Tasks 7 + 9
- §5 hooks → Task 6
- §6 sync called per affected candidate in bulk → Task 2
- §7 `candidateTrainingsBulk.test.js` → Task 5
- §7 `Training.test.tsx` → Task 10

- [ ] **Step 5: Decide on push**

Do not push automatically. Hand back to the user with a summary of the branch state and ask whether to push + open PR.

---

## Phase 3 hand-off (not in scope here)

The spec's §8 "Out of scope" items remain follow-ups — separate plans, written when prioritised:

- Training-end / start notifications
- Dashboard tiles for "currently in training" counts
- Candidate self-service portal
- Attachments on enrolments (certificate PDFs)
- Cost / funding source fields
- CSV bulk import of catalogue or enrolments

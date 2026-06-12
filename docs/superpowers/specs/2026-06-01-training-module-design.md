# Training Module — Design Spec

**Date:** 2026-06-01
**Status:** Approved (design); implementation pending
**Delivery:** Phased — Phase 1 ships catalogue + per-candidate enrolment; Phase 2 ships top-level page + bulk enrolment.

---

## 1. Purpose

Track training programs that candidates undertake, so recruiters can:
- See each candidate's full training history (past, current, future)
- Match candidates to jobs based on the training they hold
- Enrol cohorts of candidates into a training course in one action (Phase 2)
- Report on training across the platform (Phase 2 page)

Replaces ad-hoc tracking via the single `training_start_date` / `training_end_date` columns on `candidates`. Those columns remain as denormalised "active training" shortcuts (see §6).

---

## 2. Data model

Two new tables. Both phases use this schema; no schema changes between phases.

### `trainings` (the catalogue)

```sql
CREATE TABLE trainings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(50),                       -- e.g. "CHC33015"
  description   TEXT,
  duration_days INTEGER,                           -- nominal length, optional
  provider_id   UUID REFERENCES providers(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX trainings_provider_idx ON trainings(provider_id);
CREATE INDEX trainings_active_idx   ON trainings(is_active);
```

### `candidate_trainings` (the enrolments)

```sql
CREATE TYPE training_status AS ENUM ('enrolled','in_progress','completed','withdrawn','failed');

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

### Migration

Single new file `database/012-training-module.sql` containing the enum and both tables. Migration `010-candidate-training-dates.sql` (which added `training_start_date` / `training_end_date` to `candidates`) is **not** rolled back — those columns stay (see §6).

### Seed data

Extend `database/002-seed-data.sql` with ~6 trainings (mix of provider-linked and standalone, e.g. "Cert III in Aged Care", "White Card", "First Aid", "Forklift Licence") and ~10 enrolments across the existing seeded candidates spanning all five status values.

---

## 3. Backend API

Two new route files following the existing JWT-protected `{ success, data }` envelope pattern.

### `packages/backend/src/routes/trainings.js` — Catalogue

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET`    | `/api/trainings`      | List. Query: `page`, `limit`, `search` (name/code), `provider_id`, `is_active` | any authenticated |
| `GET`    | `/api/trainings/:id`  | Single course with provider expanded | any |
| `POST`   | `/api/trainings`      | Create | admin |
| `PATCH`  | `/api/trainings/:id`  | Edit (name, code, description, duration, provider, is_active) | admin |
| `DELETE` | `/api/trainings/:id`  | Soft delete → sets `is_active = false`. Hard delete is blocked at the DB layer by `ON DELETE RESTRICT` on `candidate_trainings.training_id`. | admin |

### `packages/backend/src/routes/candidate-trainings.js` — Enrolments

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET`    | `/api/candidates/:id/trainings`       | History for one candidate, ordered by `start_date DESC`, training + provider expanded | any |
| `GET`    | `/api/candidate-trainings`            | Cross-candidate list (Phase 2). Query: `page`, `limit`, `status` (multi), `training_id`, `provider_id`, `date_from`, `date_to`, `search` (candidate name) | any |
| `GET`    | `/api/candidate-trainings/stats`      | Counts grouped by status, respecting active filters minus `status`. Used by Phase 2 summary chips. | any |
| `POST`   | `/api/candidate-trainings`            | Create one enrolment. Body: `{ candidate_id, training_id, status?, start_date?, end_date?, certificate_no?, notes? }` | recruiter+ |
| `PATCH`  | `/api/candidate-trainings/:id`        | Edit any field including status. | recruiter+ |
| `DELETE` | `/api/candidate-trainings/:id`        | Remove (for corrections) | admin |
| `POST`   | `/api/candidate-trainings/bulk`       | **Phase 2.** Body: `{ training_id, start_date, end_date?, candidate_ids: UUID[] }`. Inserts one enrolment per candidate inside a single transaction. Skips candidates already holding a non-terminal (`enrolled` or `in_progress`) enrolment for that training. Returns `{ created: CandidateTraining[], skipped: { candidate_id, reason }[] }`. | recruiter+ |

### Service layer

- `services/trainings.js` — catalogue CRUD
- `services/candidateTrainings.js` — enrolment CRUD; exports `syncCandidateActiveTraining(candidateId, client?)` used by every write path (see §6)

### Validation

- `end_date >= start_date` when both are set
- Status transitions: any → any (recruiters fix mistakes). When status moves to `completed` and `completed_at` is null, default it to today
- A candidate may have multiple historical enrolments for the same course (re-takes are allowed). Bulk-enrol skips candidates with an existing non-terminal enrolment for the same course (see above)

### Activity logging

Create / update / status-change of an enrolment writes to `activity_log`, matching how jobs and applications already log.

---

## 4. Frontend — Phase 1

### 4a. Admin > Trainings (catalogue page)

- **Route:** `/admin/trainings`
- **File:** `packages/frontend/src/pages/AdminTrainings.tsx`
- **Nav:** added to the Admin section alongside Departments / Locations / Users
- **Layout:** mirrors `AdminDepartments.tsx`
  - Top bar: page title, search input, "+ New Training" button (admins only)
  - Table columns: Name · Code · Provider · Duration · Active · Actions (Edit, Toggle active)
- **Create / Edit dialog** (shadcn `Dialog`): Name (required), Code, Description (textarea), Duration days (number), Provider (Combobox of active providers, "None" allowed), Active (Switch). React Hook Form + Zod.
- **Hooks (`src/hooks/useTrainings.ts`):** `useTrainings({ search, providerId, isActive })`, `useTraining(id)`, `useCreateTraining`, `useUpdateTraining`

### 4b. Candidate Detail — "Training" tab

- **File:** `packages/frontend/src/pages/CandidateDetail.tsx`
- Refactor existing layout to shadcn `Tabs` with: **Profile** · **Applications** · **Training**
- Training tab:
  - Header row: "Training history" + "+ Enrol" button
  - Table sorted by `start_date DESC`: Course (name + code) · Provider · Status badge · Start · End · Cert # · Actions
  - Status badge colours: `enrolled` gray, `in_progress` blue, `completed` green, `withdrawn` amber, `failed` red
  - "+ Enrol" dialog fields: Course (Combobox over active catalogue, search-as-you-type), Status (default `enrolled`), Start date, End date, Certificate # (only when status = `completed`), Notes
  - Row Edit opens the same dialog pre-filled
- The "Active training" pill on the Profile tab continues to read `candidates.training_start_date` / `training_end_date` — kept in sync by §6.

### Shared frontend additions

- **API client:** extend `src/lib/api.ts` with `trainingsApi` and `candidateTrainingsApi` (matches `jobsApi`, `placementsApi`)
- **Types:** `src/types/training.ts` — `Training`, `TrainingStatus`, `CandidateTraining`, plus expanded variants `TrainingWithProvider` and `CandidateTrainingWithCourse`
- **Hooks:** `useCandidateTrainings.ts` with `useCandidateTrainings(candidateId)`, `useCreateEnrolment`, `useUpdateEnrolment`, `useDeleteEnrolment`
- **Permissions:** non-admin users see the catalogue page read-only — "+ New" and Edit / Toggle buttons hidden (same pattern as `AdminUsers.tsx`)

---

## 5. Frontend — Phase 2

New route `/training` with a top-level nav entry between "Candidates" and "Placements" (admins + recruiters only). Page file `packages/frontend/src/pages/Training.tsx` with two tabs.

### Tab 1 — Enrolments (default)

Cross-candidate operational view.

- **Filter bar:**
  - Status (multi-select chips: enrolled / in_progress / completed / withdrawn / failed)
  - Course (Combobox)
  - Provider (Combobox)
  - Start date range (from / to)
  - Search by candidate name
- **Table** (server-paginated, `limit=25`, sortable by `start_date`):
  Candidate · Course · Provider · Status · Start · End · Cert # · Actions (Edit, Open candidate)
- **Empty state** when filters return no rows
- **Summary chips** above the table: "X enrolled · Y in progress · Z completed (this month)" — driven by `GET /api/candidate-trainings/stats` (respects active filters minus `status`)

### Tab 2 — Cohort enrol (bulk)

Inline three-step flow (stacked sections that progressively enable, no wizard chrome).

1. **Pick a course** — Combobox of active courses. Selected course card shows name, code, provider, nominal duration.
2. **Set dates** — Start date (required). End date auto-suggested as `start + duration_days` when duration is set; editable.
3. **Choose candidates** — Searchable paginated candidate list (reuses the same search component used by candidate pool). Multi-select with checkboxes; sticky right-hand "Selected (N)" panel listing selections with remove buttons.

Sticky footer "Enrol N candidates" button — disabled until course + start + ≥1 candidate. On click, calls `POST /api/candidate-trainings/bulk` and shows a result dialog: "Created N enrolments" plus a collapsible list of any skipped candidates with reasons. A "View enrolments" button switches to the Enrolments tab pre-filtered to the chosen course + today's date.

### Phase 2 hooks

- Reuse `useCandidateTrainings` from Phase 1
- New: `useCandidateTrainingsList({ filters, page })`, `useTrainingStats(filters)`, `useBulkEnrolment`

---

## 6. Denormalised column sync

`candidates.training_start_date` and `candidates.training_end_date` remain on the row as a denormalised shortcut for "the candidate's current active training". They reflect the candidate's most recent `in_progress` enrolment (by `start_date DESC`, then `created_at DESC`), and are NULL when no such enrolment exists.

### Sync function

```js
// packages/backend/src/services/candidateTrainings.js
async function syncCandidateActiveTraining(candidateId, client = db) {
  const { rows } = await client.query(`
    SELECT start_date, end_date
      FROM candidate_trainings
     WHERE candidate_id = $1 AND status = 'in_progress'
     ORDER BY start_date DESC NULLS LAST, created_at DESC
     LIMIT 1
  `, [candidateId]);
  const active = rows[0] || { start_date: null, end_date: null };
  await client.query(
    `UPDATE candidates SET training_start_date=$1, training_end_date=$2 WHERE id=$3`,
    [active.start_date, active.end_date, candidateId]
  );
}
```

### Call sites

Every write path in `candidateTrainings.js`:
- `create` — after insert
- `update` — after update
- `delete` — after delete
- `bulk` — once per affected `candidate_id`, inside the same `BEGIN / COMMIT` as the inserts

No DB trigger — sync stays in app code (matches the rest of the codebase, easier to test).

---

## 7. Testing

### Backend (Jest + Supertest, `packages/backend/tests/`)

- `trainings.test.js` — catalogue CRUD, auth gates, search / filter, soft-delete behaviour
- `candidateTrainings.test.js` — single enrolment CRUD, date validation, status transitions, response shape (expanded course + provider)
- `candidateTrainingsSync.test.js` — denormalisation: `in_progress` writes update the columns; transition out clears them or promotes the next eligible enrolment; delete syncs
- `candidateTrainingsBulk.test.js` — happy path, skip-when-active, transaction rollback on partial failure

### Frontend (Vitest)

- `AdminTrainings.test.tsx` — list + create / edit dialog renders, admin-only buttons gated
- `CandidateTrainingTab.test.tsx` — enrolment list, "+ Enrol" dialog flow, status badge colours
- `Training.test.tsx` (Phase 2) — filters apply, bulk-enrol three-step flow validates inputs and surfaces skipped rows

API hook tests mock the `lib/api.ts` fetch wrapper.

---

## 8. Out of scope (explicit)

These items came up during brainstorming and are deliberately **not** part of this spec. Each will be its own follow-up:

- Training-end / start notifications (blocked on stakeholder question — who receives, how far in advance)
- Dashboard tiles for "currently in training" counts
- Candidate self-service portal
- Attachments on enrolments (certificate PDFs)
- Cost / funding source fields
- CSV bulk import of catalogue or enrolments

---

## 9. Delivery plan

- **Phase 1 PR:** §2 schema + seed, §3 catalogue + per-candidate enrolment routes (everything except the cross-candidate list, stats, and bulk endpoint), §4 frontend, §6 sync, §7 backend + Phase 1 frontend tests.
- **Phase 2 PR:** the remaining §3 endpoints (cross-candidate list, stats, bulk), §5 frontend, Phase 2 frontend tests, nav entry.

Each phase is independently demoable.

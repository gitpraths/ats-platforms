# Candidate Pool — List View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Candidates page card grid with a tabbed, paginated list view that shows candidate + placement + welfare check data in one screen, matching the team's Google Sheets layout.

**Architecture:** New `/api/candidate-pool` backend route with rich JOINs powers the updated `Candidates.tsx`. The existing lightweight `/api/candidates` endpoint is untouched — all other components that call it (AssignTalentDialog, ProviderDetail, dropdowns) continue working unchanged.

**Tech Stack:** Express.js, PostgreSQL (LATERAL joins), React 18, TypeScript, TanStack React Query, TailwindCSS, date-fns

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `database/010-candidate-training-dates.sql` | Create | Add `training_start_date`, `training_end_date` DATE columns to candidates |
| `packages/backend/src/routes/candidate-pool.js` | Create | New rich endpoint — candidates + placements + welfare checks |
| `packages/backend/src/app.js` | Modify | Register `candidatePoolRouter` at `/api/candidate-pool` |
| `packages/frontend/src/types/index.ts` | Modify | Add `CandidatePoolRow` and `CandidatePoolMeta` interfaces |
| `packages/frontend/src/hooks/useCandidatePool.ts` | Create | TanStack React Query hook for the new endpoint |
| `packages/frontend/src/pages/Candidates.tsx` | Modify | Full replacement — tabs, list/card toggle, pagination, welfare sub-rows |

---

## Task 1: Database migration — training dates

**Files:**
- Create: `database/010-candidate-training-dates.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 010: Candidate training dates

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS training_start_date DATE,
  ADD COLUMN IF NOT EXISTS training_end_date   DATE;
```

- [ ] **Step 2: Apply the migration**

```bash
psql $DATABASE_URL -f database/010-candidate-training-dates.sql
```

Expected: no errors, `ALTER TABLE` confirmation.

- [ ] **Step 3: Verify columns exist**

```bash
psql $DATABASE_URL -c "\d candidates" | grep training
```

Expected: two rows showing `training_start_date` and `training_end_date` as `date` columns.

- [ ] **Step 4: Commit**

```bash
git add database/010-candidate-training-dates.sql
git commit -m "feat: add training_start_date and training_end_date to candidates"
```

---

## Task 2: Backend — `candidate-pool.js` route

**Files:**
- Create: `packages/backend/src/routes/candidate-pool.js`
- Test: `packages/backend/tests/candidate-pool.test.js`

- [ ] **Step 1: Write the failing test**

Create `packages/backend/tests/candidate-pool.test.js`:

```javascript
import request from "supertest";
import app from "../src/app.js";

let token = "";

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@ats.com", password: "password123" });
  token = res.body.data?.token || "";
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("GET /api/candidate-pool", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/candidate-pool");
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct shape", async () => {
    const res = await request(app).get("/api/candidate-pool").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      tab_counts: expect.objectContaining({
        all: expect.any(Number),
        in_progress: expect.any(Number),
        placed: expect.any(Number),
        not_successful: expect.any(Number),
        inactive: expect.any(Number),
      }),
    });
  });

  it("returns only placed candidates on placed tab", async () => {
    const res = await request(app)
      .get("/api/candidate-pool?tab=placed")
      .set(auth());
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row.work_status).toBe("placed");
    }
  });

  it("filters by search query", async () => {
    const res = await request(app)
      .get("/api/candidate-pool?q=nonexistent_xyz_abc_999")
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  it("paginates correctly", async () => {
    const res = await request(app)
      .get("/api/candidate-pool?page=1&limit=2")
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.page).toBe(1);
  });

  it("each row has required fields", async () => {
    const res = await request(app)
      .get("/api/candidate-pool?limit=1")
      .set(auth());
    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      const row = res.body.data[0];
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("name");
      expect(row).toHaveProperty("email");
      expect(row).toHaveProperty("welfare_checks");
      expect(Array.isArray(row.welfare_checks)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd packages/backend && npm test -- --testPathPattern=candidate-pool --forceExit
```

Expected: FAIL — `Cannot find module` or 404 responses (route doesn't exist yet).

- [ ] **Step 3: Create the route file**

Create `packages/backend/src/routes/candidate-pool.js`:

```javascript
import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const candidatePoolRouter = Router();
candidatePoolRouter.use(requireAuth);

function tabCondition(tab) {
  switch (tab) {
    case "in_progress":
      return `EXISTS (
        SELECT 1 FROM applications a
        WHERE a.candidate_id = c.id
          AND a.stage IN ('applied','screening','interview','offer')
      )`;
    case "placed":
      return `c.work_status = 'placed'`;
    case "not_successful":
      return `NOT EXISTS (
          SELECT 1 FROM applications a
          WHERE a.candidate_id = c.id
            AND a.stage IN ('applied','screening','interview','offer')
        )
        AND EXISTS (
          SELECT 1 FROM applications a2
          WHERE a2.candidate_id = c.id AND a2.stage = 'rejected'
        )
        AND c.work_status NOT IN ('placed','inactive')`;
    case "inactive":
      return `c.work_status = 'inactive'`;
    default:
      return "1=1";
  }
}

// GET /api/candidate-pool
candidatePoolRouter.get("/", async (req, res, next) => {
  try {
    const { tab = "all", page = 1, limit = 20, q = "" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const params = [];
    let idx = 1;

    const searchCondition = q
      ? `AND (c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx})`
      : "";
    if (q) { params.push(`%${q}%`); idx++; }

    const { rows } = await pool.query(
      `SELECT
         c.id, c.name, c.email, c.phone,
         c.city, c.state,
         c.work_status, c.notes,
         c.training_start_date, c.training_end_date,
         pr.name         AS provider_name,
         pr.contact_name AS provider_contact_name,
         pr.email        AS provider_contact_email,
         lp.id           AS placement_id,
         lp.start_date   AS job_start_date,
         lp.confirmed_by_employer,
         e.name          AS employer_name,
         j.title         AS job_title,
         la.stage        AS latest_stage,
         la.id           AS latest_application_id
       FROM candidates c
       LEFT JOIN providers pr ON pr.id = c.provider_id
       LEFT JOIN LATERAL (
         SELECT id, job_id, employer_id, start_date, confirmed_by_employer
         FROM placements
         WHERE candidate_id = c.id
         ORDER BY created_at DESC
         LIMIT 1
       ) lp ON true
       LEFT JOIN employers e ON e.id = lp.employer_id
       LEFT JOIN jobs j ON j.id = lp.job_id
       LEFT JOIN LATERAL (
         SELECT id, stage
         FROM applications
         WHERE candidate_id = c.id
         ORDER BY updated_at DESC
         LIMIT 1
       ) la ON true
       WHERE ${tabCondition(tab)} ${searchCondition}
       ORDER BY c.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    );

    // Attach welfare checks for placed candidates
    const placementIds = rows.map((r) => r.placement_id).filter(Boolean);
    const wcMap = {};
    if (placementIds.length) {
      const { rows: wcs } = await pool.query(
        `SELECT placement_id, check_type, due_date, completed_at, email_sent_at
         FROM welfare_checks WHERE placement_id = ANY($1)`,
        [placementIds]
      );
      for (const wc of wcs) {
        if (!wcMap[wc.placement_id]) wcMap[wc.placement_id] = [];
        wcMap[wc.placement_id].push(wc);
      }
    }

    const data = rows.map((r) => ({
      ...r,
      welfare_checks: r.placement_id ? (wcMap[r.placement_id] || []) : [],
    }));

    // Tab counts (always against full dataset, search applied)
    const countParams = q ? [`%${q}%`] : [];
    const countSearch = q
      ? `WHERE (c.name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1)`
      : "";

    const { rows: countRows } = await pool.query(
      `SELECT
         COUNT(*)::int AS all_count,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM applications a
           WHERE a.candidate_id = c.id
             AND a.stage IN ('applied','screening','interview','offer')
         ))::int AS in_progress_count,
         COUNT(*) FILTER (WHERE c.work_status = 'placed')::int AS placed_count,
         COUNT(*) FILTER (WHERE
           NOT EXISTS (
             SELECT 1 FROM applications a
             WHERE a.candidate_id = c.id
               AND a.stage IN ('applied','screening','interview','offer')
           )
           AND EXISTS (
             SELECT 1 FROM applications a2
             WHERE a2.candidate_id = c.id AND a2.stage = 'rejected'
           )
           AND c.work_status NOT IN ('placed','inactive')
         )::int AS not_successful_count,
         COUNT(*) FILTER (WHERE c.work_status = 'inactive')::int AS inactive_count
       FROM candidates c
       ${countSearch}`,
      countParams
    );

    const tabCounts = {
      all:            countRows[0].all_count,
      in_progress:    countRows[0].in_progress_count,
      placed:         countRows[0].placed_count,
      not_successful: countRows[0].not_successful_count,
      inactive:       countRows[0].inactive_count,
    };

    const totalForTab = tabCounts[tab] ?? tabCounts.all;

    res.json({
      success: true,
      data,
      meta: {
        total: totalForTab,
        page: Number(page),
        limit: Number(limit),
        tab_counts: tabCounts,
      },
    });
  } catch (err) { next(err); }
});
```

- [ ] **Step 4: Register the route in `app.js`**

In `packages/backend/src/app.js`, add after the existing imports (around line 18):

```javascript
import { candidatePoolRouter } from "./routes/candidate-pool.js";
```

And after the existing route registrations (around line 103), add:

```javascript
app.use("/api/candidate-pool", candidatePoolRouter);
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd packages/backend && npm test -- --testPathPattern=candidate-pool --forceExit
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/routes/candidate-pool.js packages/backend/src/app.js packages/backend/tests/candidate-pool.test.js
git commit -m "feat: add candidate-pool endpoint with tabs, search, pagination"
```

---

## Task 3: Frontend types

**Files:**
- Modify: `packages/frontend/src/types/index.ts`

- [ ] **Step 1: Add `CandidatePoolMeta` and `CandidatePoolRow` interfaces**

At the end of `packages/frontend/src/types/index.ts`, append:

```typescript
export interface CandidatePoolMeta {
  total: number;
  page: number;
  limit: number;
  tab_counts: {
    all: number;
    in_progress: number;
    placed: number;
    not_successful: number;
    inactive: number;
  };
}

export interface CandidatePoolRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  work_status?: CandidateWorkStatus;
  notes?: string;
  training_start_date?: string | null;
  training_end_date?: string | null;
  provider_name?: string;
  provider_contact_name?: string;
  provider_contact_email?: string;
  placement_id?: string | null;
  job_start_date?: string | null;
  confirmed_by_employer?: boolean;
  employer_name?: string;
  job_title?: string;
  latest_stage?: ApplicationStage | null;
  latest_application_id?: string | null;
  welfare_checks?: WelfareCheck[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/types/index.ts
git commit -m "feat: add CandidatePoolRow and CandidatePoolMeta types"
```

---

## Task 4: Frontend hook — `useCandidatePool`

**Files:**
- Create: `packages/frontend/src/hooks/useCandidatePool.ts`

- [ ] **Step 1: Create the hook**

Create `packages/frontend/src/hooks/useCandidatePool.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CandidatePoolRow, CandidatePoolMeta } from "../types";

interface UseCandidatePoolOptions {
  tab?: string;
  page?: number;
  limit?: number;
  q?: string;
}

export function useCandidatePool(options: UseCandidatePoolOptions = {}) {
  const { tab = "all", page = 1, limit = 20, q = "" } = options;

  return useQuery<{ data: CandidatePoolRow[]; meta: CandidatePoolMeta }>({
    queryKey: ["candidate-pool", { tab, page, q }],
    queryFn: async () => {
      const params = new URLSearchParams({
        tab,
        page: String(page),
        limit: String(limit),
      });
      if (q) params.set("q", q);
      const result = await api.list<CandidatePoolRow>(`/candidate-pool?${params}`);
      return result as { data: CandidatePoolRow[]; meta: CandidatePoolMeta };
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/hooks/useCandidatePool.ts
git commit -m "feat: add useCandidatePool hook"
```

---

## Task 5: Frontend page — `Candidates.tsx`

**Files:**
- Modify: `packages/frontend/src/pages/Candidates.tsx`

This is a complete replacement of the file.

- [ ] **Step 1: Replace `Candidates.tsx` with the new pool view**

Replace the entire contents of `packages/frontend/src/pages/Candidates.tsx`:

```tsx
import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { List, Grid, Search } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCandidatePool } from "../hooks/useCandidatePool";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import type { CandidatePoolRow, CandidateWorkStatus, WelfareCheck, WelfareCheckType } from "../types";

type Tab = "all" | "in_progress" | "placed" | "not_successful" | "inactive";
type View = "list" | "card";

const TABS: { id: Tab; label: string }[] = [
  { id: "all",            label: "All" },
  { id: "in_progress",    label: "In Progress" },
  { id: "placed",         label: "Placed" },
  { id: "not_successful", label: "Not Successful" },
  { id: "inactive",       label: "Inactive" },
];

const STATUS_BADGE: Record<string, string> = {
  placed:      "border border-green-500 text-green-700",
  job_seeking: "border border-amber-400 text-amber-600",
  employed:    "border border-blue-400 text-blue-600",
  inactive:    "border border-gray-300 text-gray-500",
};

const WELFARE_ORDER: WelfareCheckType[] = ["day_1", "week_1", "month_1", "month_3", "month_6"];
const WELFARE_LABELS: Record<WelfareCheckType, string> = {
  day_1:   "Day 1",
  week_1:  "Week 1",
  month_1: "1 Month",
  month_3: "3 Months",
  month_6: "6 Months",
};

function welfareBandClass(check: WelfareCheck | undefined, today: string): string {
  if (!check) return "bg-gray-100 text-gray-400";
  if (check.completed_at) return "bg-green-100 text-green-700";
  const overdue = check.due_date <= today;
  const soon = !overdue && new Date(check.due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (overdue) return "bg-red-100 text-red-700";
  if (soon) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function welfareBandStatus(check: WelfareCheck | undefined, today: string): string {
  if (!check) return "—";
  if (check.completed_at) return "Done";
  if (check.due_date <= today) return "Overdue";
  return `Due ${format(new Date(check.due_date), "d MMM")}`;
}

function WelfareSubRow({ checks, colSpan }: { checks: WelfareCheck[]; colSpan: number }) {
  const today = new Date().toISOString().split("T")[0];
  const checkMap = Object.fromEntries(checks.map((c) => [c.check_type, c])) as Record<string, WelfareCheck>;
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-1.5 bg-slate-50 border-b">
        <div className="flex gap-1">
          {WELFARE_ORDER.map((type) => {
            const check = checkMap[type];
            return (
              <div
                key={type}
                className={`flex-1 text-center text-xs rounded px-2 py-1 font-medium ${welfareBandClass(check, today)}`}
              >
                <div>{WELFARE_LABELS[type]}</div>
                <div className="font-normal opacity-75">{welfareBandStatus(check, today)}</div>
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

function getStatusLabel(row: CandidatePoolRow): string {
  if (row.work_status === "placed") return "Placed";
  if (row.work_status === "inactive") return "Inactive";
  if (row.work_status === "employed") return "Employed";
  if (
    row.latest_stage &&
    ["applied", "screening", "interview", "offer"].includes(row.latest_stage)
  ) return "In Progress";
  return "Job Seeking";
}

export default function Candidates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>(
    () => (localStorage.getItem("candidatesView") as View) || "list"
  );
  const [tab, setTab]       = useState<Tab>("all");
  const [q, setQ]           = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  const canCreate = ["admin", "recruiter_admin", "recruiter"].includes(user?.role ?? "");

  const { data, isLoading } = useCandidatePool({ tab, page, q: search });
  const rows      = data?.data ?? [];
  const meta      = data?.meta;
  const tabCounts = meta?.tab_counts ?? { all: 0, in_progress: 0, placed: 0, not_successful: 0, inactive: 0 };
  const totalPages = meta ? Math.ceil(meta.total / 20) : 1;

  const sendConfirmation = useMutation({
    mutationFn: (placementId: string) =>
      api.post(`/placements/${placementId}/send-confirmation`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate-pool"] }),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(q);
    setPage(1);
  }

  function handleTabChange(newTab: Tab) {
    setTab(newTab);
    setPage(1);
  }

  function handleViewChange(v: View) {
    setView(v);
    localStorage.setItem("candidatesView", v);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
          Candidates
          {meta && (
            <span className="ml-2 text-lg text-slate-400 font-normal">
              ({tabCounts.all})
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => handleViewChange("list")}
              className={`px-3 py-2 ${view === "list" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              title="List view"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => handleViewChange("card")}
              className={`px-3 py-2 ${view === "card" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              title="Card view"
            >
              <Grid size={15} />
            </button>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate("/candidates/new")}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              + Add Candidate
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
        >
          Search
        </button>
      </form>

      {/* Tabs */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        {TABS.map(({ id, label }) => {
          const count = tabCounts[id] ?? 0;
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-slate-800 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-slate-500 py-8">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400">No candidates found.</p>
        </div>
      ) : view === "list" ? (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {[
                  "Name", "Mobile", "Email", "Provider", "Consultant",
                  "Status", "Comment", "Training Dates", "Job Start",
                  "Employer", "Job Role", "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    onClick={() => navigate(`/candidates/${row.id}`)}
                    className="hover:bg-slate-50 cursor-pointer border-b"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full border border-blue-400 text-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 whitespace-nowrap">
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.email}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.provider_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.provider_contact_name ? (
                        <div>
                          <p className="text-slate-700 whitespace-nowrap">
                            {row.provider_contact_name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {row.provider_contact_email}
                          </p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs border rounded-full px-2 py-0.5 whitespace-nowrap ${
                          STATUS_BADGE[row.work_status as CandidateWorkStatus] ??
                          "border-slate-300 text-slate-600"
                        }`}
                      >
                        {getStatusLabel(row)}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-slate-500 max-w-[140px] truncate"
                      title={row.notes ?? ""}
                    >
                      {row.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.training_start_date
                        ? `${format(new Date(row.training_start_date), "d MMM yyyy")}${
                            row.training_end_date
                              ? ` – ${format(new Date(row.training_end_date), "d MMM yyyy")}`
                              : ""
                          }`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.job_start_date
                        ? format(new Date(row.job_start_date), "d MMM yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.employer_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.job_title || "—"}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.placement_id && !row.confirmed_by_employer && canCreate && (
                        <button
                          onClick={() => sendConfirmation.mutate(row.placement_id!)}
                          disabled={sendConfirmation.isPending}
                          className="text-xs text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
                        >
                          Email to Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                  {row.placement_id && (row.welfare_checks?.length ?? 0) > 0 && (
                    <WelfareSubRow checks={row.welfare_checks!} colSpan={12} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card view — preserved layout */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => navigate(`/candidates/${row.id}`)}
              className="bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full border border-blue-400 text-blue-600 bg-transparent flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {row.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{row.name}</p>
                  <p className="text-xs text-slate-500 truncate">{row.email}</p>
                </div>
              </div>
              {(row.city || row.state) && (
                <p className="text-xs text-slate-400 mb-2">
                  {[row.city, row.state].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs border rounded-full px-2 py-0.5 ${
                    STATUS_BADGE[row.work_status as CandidateWorkStatus] ??
                    "border-slate-300 text-slate-600"
                  }`}
                >
                  {getStatusLabel(row)}
                </span>
                {row.provider_name && (
                  <span className="text-xs text-slate-400">{row.provider_name}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start the dev server and verify in browser**

```bash
npm run dev
```

Open http://localhost:5173/candidates and verify:
- Page loads in list view by default
- Five tabs visible with counts
- Table shows all columns (Name, Mobile, Email, Provider, Consultant, Status, Comment, Training Dates, Job Start, Employer, Job Role)
- Placed candidates have a welfare check sub-row below them
- List/Card toggle works — card view matches previous layout
- Search filters the list and resets to page 1
- Switching tabs resets to page 1
- Pagination shows Previous/Next when more than 20 records
- View preference persists after page refresh (localStorage)
- Clicking a row navigates to `/candidates/:id`

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/pages/Candidates.tsx
git commit -m "feat: candidate pool list view with tabs, welfare sub-rows, and pagination"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] List view as default with card view toggle
- [x] Paginated (20/page, prev/next)
- [x] Tabs: All | In Progress | Placed | Not Successful | Inactive with counts
- [x] Columns: Name, Mobile, Email, Provider, Consultant, Status, Comment, Training Dates, Job Start, Employer, Job Role, Actions
- [x] Welfare check sub-rows below placed candidates (5 bands, colour-coded)
- [x] `/api/candidates` untouched — AssignTalentDialog, ProviderDetail unaffected
- [x] View preference persists via localStorage
- [x] "Email to Confirm" button for placed + unconfirmed candidates

**Type consistency:** `CandidatePoolRow` defined in Task 3, used in Tasks 4 and 5. `WelfareCheckType` already exists in types, reused in `WelfareSubRow`. `placement_id` is `string | null` — guarded with `row.placement_id &&` before calling `sendConfirmation.mutate(row.placement_id!)`.

**No placeholders:** All steps have complete code.

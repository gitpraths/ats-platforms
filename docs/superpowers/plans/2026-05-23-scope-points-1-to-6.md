# Scope Points 1–6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three genuine gaps from the "Scope for Recruitment Portal" PDF — the rest is already built.

**Architecture:** The project is a monorepo with an Express backend (`packages/backend`) and a React/TypeScript frontend (`packages/frontend`). Database is PostgreSQL via the `pg` driver. Most scope features are already implemented; only Gaps A, B, and C need code changes.

**Tech Stack:** Express.js, PostgreSQL, React 18, TypeScript, TanStack React Query, shadcn/ui, TailwindCSS

---

## Current State: What Is Already Built

Before coding, understand that the majority of the 6 scope points are **already complete**:

| Scope Point | Status | Notes |
|---|---|---|
| 1. Super Admin / Staff Logins | ✅ Built | `admin`, `recruiter_admin`, `recruiter`, `hiring_manager`, `provider` roles; AdminUsers page at `/admin/users` |
| 2. Candidate Details | ⚠️ Partial | DB + CandidateDetail complete; **CandidateNew missing extended fields** |
| 3. Provider wise (pool + stats) | ⚠️ Partial | Providers list complete; **ProviderDetail stats show "—"; Candidates page lacks provider filter** |
| 4. Vacancy Details | ❌ Incomplete | DB columns exist but **backend INSERT/UPDATE and frontend JobCreate/JobEdit don't expose employer, positions, job board URL, vacancy type** |
| 5. Employer Details | ✅ Built | Employers list, detail, create/edit all complete |
| 6. Placement Details | ✅ Built | Placements, welfare checks, email confirmation all complete |

**Three gaps to implement:**
- **Gap A** — CandidateNew extended fields
- **Gap B** — Provider detail stats + Candidates page provider filter
- **Gap C** — Vacancy Details wired end-to-end

---

## File Map

| File | Action | Reason |
|---|---|---|
| `packages/frontend/src/pages/CandidateNew.tsx` | Modify | Add provider, work_status, benchmark_hours, interested_job, address fields |
| `packages/backend/src/routes/providers.js` | Modify | Return work_status breakdown in GET /:id |
| `packages/frontend/src/pages/ProviderDetail.tsx` | Modify | Use real stats, show full candidates list with pagination |
| `packages/frontend/src/pages/Candidates.tsx` | Modify | Accept `?provider_id=` query param to filter |
| `database/008-vacancy-type.sql` | Create | Add `vacancy_type` and `staff_working_status` columns to jobs |
| `packages/backend/src/routes/jobs.js` | Modify | Include employer_id, positions_count, job_board_url, vacancy_type, staff_working_status in INSERT + PATCH |
| `packages/frontend/src/pages/JobEdit.tsx` | Modify | Add employer dropdown, positions count, job board URL, vacancy type, staff working status |
| `packages/frontend/src/pages/CreateJobDialog.tsx` or the Job Create wizard | Modify | Add employer and vacancy fields to the job create flow |

---

## Gap A — CandidateNew Extended Fields

**Files:**
- Modify: `packages/frontend/src/pages/CandidateNew.tsx`

The backend `POST /api/candidates` already accepts all extended fields. Only the frontend form is missing them.

- [ ] **Step 1: Add type imports and form state for extended fields**

In `CandidateNew.tsx`, update the `CandidateForm` interface and `EMPTY` constant:

```typescript
interface CandidateForm {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  resume_url: string;
  linkedin: string;
  notes: string;
  // Extended fields
  provider_id: string;
  work_status: string;
  benchmark_hours: string;
  interested_job: string;
  address_line1: string;
  postcode: string;
}

const EMPTY: CandidateForm = {
  name: "", email: "", phone: "", city: "", state: "",
  resume_url: "", linkedin: "", notes: "",
  provider_id: "", work_status: "job_seeking", benchmark_hours: "",
  interested_job: "", address_line1: "", postcode: "",
};
```

- [ ] **Step 2: Fetch providers list for the dropdown**

Add a `useQuery` call at the top of the component (after existing hooks):

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Provider } from "../types";

// Inside component:
const { data: providersData } = useQuery<{ data: Provider[] }>({
  queryKey: ["providers-select"],
  queryFn: () => api.get("/providers?limit=100"),
});
const providers = providersData?.data ?? [];
```

- [ ] **Step 3: Add extended fields to the form JSX**

After the "Notes" textarea and before the action buttons, add:

```tsx
{/* Provider + Work Status */}
<div className="grid sm:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
    <select
      value={form.provider_id}
      onChange={(e) => setForm((f) => ({ ...f, provider_id: e.target.value }))}
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">No Provider</option>
      {providers.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  </div>
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Work Status</label>
    <select
      value={form.work_status}
      onChange={(e) => setForm((f) => ({ ...f, work_status: e.target.value }))}
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="job_seeking">Job Seeking</option>
      <option value="employed">Employed</option>
      <option value="placed">Placed</option>
      <option value="inactive">Inactive</option>
    </select>
  </div>
</div>

{/* Benchmark Hours + Interested Job */}
<div className="grid sm:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Benchmark Hours / Week</label>
    <input
      type="number"
      min={1}
      max={168}
      value={form.benchmark_hours}
      onChange={(e) => setForm((f) => ({ ...f, benchmark_hours: e.target.value }))}
      placeholder="38"
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Interested Job</label>
    <input
      value={form.interested_job}
      onChange={(e) => setForm((f) => ({ ...f, interested_job: e.target.value }))}
      placeholder="e.g. Warehouse Packer, Forklift Operator"
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
</div>

{/* Address */}
<div className="grid sm:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
    <input
      value={form.address_line1}
      onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
      placeholder="123 Main St"
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Postcode</label>
    <input
      value={form.postcode}
      onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
      placeholder="2000"
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
</div>
```

- [ ] **Step 4: Update the mutationFn to pass extended fields**

Update the `create` mutation's `mutationFn`. The `api.post` call must send all fields:

```typescript
const create = useMutation({
  mutationFn: () =>
    api.post<Candidate>("/candidates", {
      ...form,
      benchmark_hours: form.benchmark_hours ? Number(form.benchmark_hours) : undefined,
      provider_id: form.provider_id || undefined,
    }),
  onSuccess: (candidate) => {
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    navigate(`/candidates/${candidate.id}`);
  },
  onError: (err: Error) => setError(err.message),
});
```

- [ ] **Step 5: Verify in the browser**

Start the dev server (`npm run dev` from repo root). Navigate to `/candidates/new`. Confirm all new fields render. Create a test candidate with a provider selected and benchmark hours. Confirm you land on the CandidateDetail page and the fields are shown in the "Provider / Placement" section.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/pages/CandidateNew.tsx
git commit -m "feat: add extended fields to CandidateNew form (provider, work status, benchmark hours, interested job, address)"
```

---

## Gap B — Provider Detail Stats + Candidates Filter

**Files:**
- Modify: `packages/backend/src/routes/providers.js`
- Modify: `packages/frontend/src/pages/ProviderDetail.tsx`
- Modify: `packages/frontend/src/pages/Candidates.tsx`

**Sub-task B1: Backend — work_status breakdown in GET /providers/:id**

- [ ] **Step 1: Update the providers/:id query to include work_status counts**

In `packages/backend/src/routes/providers.js`, find the GET `/:id` handler. Replace the main query with:

```javascript
const { rows } = await pool.query(
  `SELECT p.*,
          COUNT(DISTINCT c.id)::int AS candidate_count,
          COUNT(DISTINCT c.id) FILTER (WHERE c.work_status = 'placed')::int       AS placed_count,
          COUNT(DISTINCT c.id) FILTER (WHERE c.work_status = 'job_seeking')::int  AS job_seeking_count,
          COUNT(DISTINCT c.id) FILTER (WHERE c.work_status = 'employed')::int     AS employed_count,
          COUNT(DISTINCT c.id) FILTER (WHERE c.work_status = 'inactive')::int     AS inactive_count
   FROM providers p
   LEFT JOIN candidates c ON c.provider_id = p.id
   WHERE p.id = $1
   GROUP BY p.id`,
  [req.params.id]
);
```

Keep the `recent_candidates` sub-query as is. The response now includes `placed_count`, `job_seeking_count`, `employed_count`, `inactive_count`.

**Sub-task B2: Frontend — ProviderDetail real stats**

- [ ] **Step 2: Update the ProviderDetailData type**

In `packages/frontend/src/pages/ProviderDetail.tsx`, update the interface:

```typescript
interface ProviderDetailData extends Provider {
  candidate_count: number;
  placed_count: number;
  job_seeking_count: number;
  employed_count: number;
  inactive_count: number;
  recent_candidates: Pick<Candidate, "id" | "name" | "work_status" | "created_at">[];
}
```

- [ ] **Step 3: Replace "—" placeholders with real stats**

Find the stats grid in `ProviderDetail.tsx` (the array with `{ label: "Total Candidates", value: provider.candidate_count ?? 0, ... }`). Replace the entire array:

```tsx
const stats = [
  { label: "Total Candidates",  value: provider.candidate_count ?? 0,   icon: <Users size={16} /> },
  { label: "Placed",            value: provider.placed_count ?? 0,       icon: <UserCheck size={16} /> },
  { label: "Job Seeking",       value: provider.job_seeking_count ?? 0,  icon: <Briefcase size={16} /> },
  { label: "Inactive",          value: provider.inactive_count ?? 0,     icon: <UserX size={16} /> },
];
```

Then in the JSX, change `.map((s) => ...)` to use `stats`:
```tsx
{stats.map((s) => (
  <div key={s.label} className="bg-white rounded-xl shadow-sm p-4">
    ...
  </div>
))}
```

**Sub-task B3: Frontend — Candidates page provider_id filter**

- [ ] **Step 4: Read the provider_id query param in Candidates.tsx**

In `packages/frontend/src/pages/Candidates.tsx`, add `useSearchParams` (already in react-router-dom):

```typescript
import { useSearchParams } from "react-router-dom";

// Inside component:
const [searchParams] = useSearchParams();
const initialProvider = searchParams.get("provider_id") ?? "";
const [providerFilter, setProviderFilter] = useState(initialProvider);
```

- [ ] **Step 5: Pass provider_id to the API query**

Find the `useQuery` that fetches candidates. Add `providerFilter` to the queryKey and the URL:

```typescript
const { data, isLoading } = useQuery({
  queryKey: ["candidates", search, page, providerFilter],
  queryFn: () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      search,
    });
    if (providerFilter) params.set("provider_id", providerFilter);
    return api.get(`/candidates?${params}`);
  },
});
```

The backend already accepts `?provider_id=` — confirm by checking `candidates.js` GET / handler (look for `provider_id` in WHERE clause). If the backend doesn't filter by `provider_id`, add it:

```javascript
// In candidates GET /, after existing filters:
if (provider_id) {
  conditions.push(`c.provider_id = $${idx}`);
  params.push(provider_id);
  idx++;
}
```

- [ ] **Step 6: Verify**

From a ProviderDetail page, click "View all" — it should navigate to `/candidates?provider_id=<uuid>` and show only that provider's candidates. Check the stat numbers on ProviderDetail match the candidate counts.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/routes/providers.js \
        packages/backend/src/routes/candidates.js \
        packages/frontend/src/pages/ProviderDetail.tsx \
        packages/frontend/src/pages/Candidates.tsx
git commit -m "feat: provider detail real stats and candidates pool filter by provider"
```

---

## Gap C — Vacancy Details End-to-End

**Files:**
- Create: `database/008-vacancy-type.sql`
- Modify: `packages/backend/src/routes/jobs.js`
- Modify: `packages/frontend/src/pages/JobEdit.tsx`
- Modify: `packages/frontend/src/pages/CreateJobDialog.tsx` (or the Job Create wizard)

The scope requires: "Add Vacancy link to current Job Board", "Type of Vacancy", "No of Positions", "End Date", "Staff Working Status".

`employer_id`, `positions_count`, `job_board_url` already exist in the DB (from `006-alter-candidates-jobs.sql`). Missing: `vacancy_type` and `staff_working_status`.

**Sub-task C1: Database migration**

- [ ] **Step 1: Create migration file**

Create `database/008-vacancy-type.sql`:

```sql
-- Run after 007-demo-australia.sql

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS vacancy_type         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS staff_working_status VARCHAR(50) DEFAULT 'active';
-- vacancy_type values: full_time | part_time | casual | contract | temporary
-- staff_working_status values: active | on_leave | resigned | terminated
```

- [ ] **Step 2: Apply to local DB**

```bash
psql $DATABASE_URL -f database/008-vacancy-type.sql
```

Expected output: `ALTER TABLE` (no errors).

**Sub-task C2: Backend — include all vacancy fields in jobs CRUD**

- [ ] **Step 3: Add fields to the POST /api/jobs INSERT**

In `packages/backend/src/routes/jobs.js`, find the `POST /` handler. Update the destructuring and INSERT:

```javascript
const {
  title, description, department_id, location_id,
  skills_required, skills_desired, job_type, work_model,
  cover_letter_required, min_annual_salary, max_annual_salary, currency_code,
  experience_years_min, deadline, team,
  // New vacancy fields:
  employer_id, positions_count, job_board_url, vacancy_type, staff_working_status,
} = req.body;
```

Update the INSERT query to include the new columns. Replace the INSERT statement:

```javascript
const { rows } = await pool.query(
  `INSERT INTO jobs (
     title, description, department_id, location_id,
     skills_required, skills_desired,
     job_type, work_model,
     cover_letter_required, min_annual_salary, max_annual_salary, currency_code,
     experience_years_min, deadline, team,
     employer_id, positions_count, job_board_url, vacancy_type, staff_working_status,
     status, created_by, updated_by
   ) VALUES (
     $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
     $16,$17,$18,$19,$20,
     'draft', $21, $21
   ) RETURNING id, job_number, created_at`,
  [
    title, description, department_id || null, location_id || null,
    skills_required || [], skills_desired || [],
    job_type, work_model,
    cover_letter_required ?? false,
    min_annual_salary || null, max_annual_salary || null, currency_code || "AUD",
    experience_years_min || null, deadline || null, team || null,
    employer_id || null, positions_count || 1, job_board_url || null,
    vacancy_type || null, staff_working_status || "active",
    req.user.id,
  ]
);
```

- [ ] **Step 4: Add fields to PATCH /api/jobs/:id (update)**

In the same file, find the PATCH `/:id` handler. Add the new fields to the `ALLOWED` set (or wherever the dynamic update list is built):

```javascript
const ALLOWED_JOB_FIELDS = [
  "title", "description", "department_id", "location_id",
  "skills_required", "skills_desired", "job_type", "work_model",
  "cover_letter_required", "min_annual_salary", "max_annual_salary", "currency_code",
  "experience_years_min", "deadline", "team",
  "employer_id", "positions_count", "job_board_url", "vacancy_type", "staff_working_status",
];
```

If the handler builds updates dynamically (e.g., `Object.keys(req.body).filter(...)`), ensure all 5 new fields are in the allowlist. Check the existing pattern in `jobs.js` and mirror it.

**Sub-task C3: Frontend — JobEdit extended vacancy fields**

- [ ] **Step 5: Read current JobEdit.tsx to find where to add fields**

Open `packages/frontend/src/pages/JobEdit.tsx`. Find the form section that has salary/deadline fields — the new vacancy fields go in a new section below "Job Details".

- [ ] **Step 6: Add employer query + new form state**

At the top of `JobEdit.tsx`, add a query for employers:

```typescript
import type { Employer } from "../types";

// Inside component, alongside existing queries:
const { data: employersData } = useQuery<{ data: Employer[] }>({
  queryKey: ["employers-select"],
  queryFn: () => api.get("/employers?limit=100"),
});
const employers = employersData?.data ?? [];
```

Ensure the form state initialisation includes the new fields:

```typescript
// In the useEffect that sets form from job data, add:
employer_id:           job.employer_id ?? "",
positions_count:       job.positions_count ?? 1,
job_board_url:         job.job_board_url ?? "",
vacancy_type:          job.vacancy_type ?? "",
staff_working_status:  job.staff_working_status ?? "active",
```

- [ ] **Step 7: Add vacancy fields section to the JSX**

After the existing salary section in the form, add:

```tsx
{/* Vacancy Details */}
<div className="border-t pt-4">
  <h3 className="text-sm font-semibold text-slate-700 mb-3">Vacancy Details</h3>
  <div className="grid sm:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Employer</label>
      <select
        value={form.employer_id ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, employer_id: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">No Employer</option>
        {employers.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Type of Vacancy</label>
      <select
        value={form.vacancy_type ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, vacancy_type: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select type</option>
        <option value="full_time">Full Time</option>
        <option value="part_time">Part Time</option>
        <option value="casual">Casual</option>
        <option value="contract">Contract</option>
        <option value="temporary">Temporary</option>
      </select>
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">No. of Positions</label>
      <input
        type="number"
        min={1}
        value={form.positions_count ?? 1}
        onChange={(e) => setForm((f) => ({ ...f, positions_count: Number(e.target.value) }))}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Staff Working Status</label>
      <select
        value={form.staff_working_status ?? "active"}
        onChange={(e) => setForm((f) => ({ ...f, staff_working_status: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="active">Active</option>
        <option value="on_leave">On Leave</option>
        <option value="resigned">Resigned</option>
        <option value="terminated">Terminated</option>
      </select>
    </div>
    <div className="sm:col-span-2">
      <label className="block text-sm font-medium text-slate-700 mb-1">Job Board URL</label>
      <input
        type="url"
        value={form.job_board_url ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, job_board_url: e.target.value }))}
        placeholder="https://seek.com.au/job/12345"
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>
</div>
```

- [ ] **Step 8: Ensure PATCH payload includes new fields**

Find where `JobEdit` submits the form (the `useMutation` `mutationFn`). Make sure the body passed to `api.patch` (or `api.put`) includes:
- `employer_id`
- `positions_count`
- `job_board_url`
- `vacancy_type`
- `staff_working_status`

These should already be in `form` state after Step 6, so if the mutation sends `...form` or the full form object, they'll be included automatically. Verify by checking what the mutation currently sends.

**Sub-task C4: Frontend — JobCreate wizard vacancy fields**

- [ ] **Step 9: Check which file is the Job Create wizard**

The Job Create wizard is the 4-step wizard in `packages/frontend/src/pages/CreateJobDialog.tsx` (or whichever file has "Basics → Description → Requirements → Assignment"). Open it and find "Step 1: Basics".

- [ ] **Step 10: Add employer and vacancy fields to Step 1 (Basics)**

In Step 1 of the wizard, after the existing fields (title, department, location), add the employer dropdown, vacancy type, and positions count using the same JSX pattern from Step 7. Fetch employers with the same `useQuery` call.

Add `job_board_url` to Step 1 or Step 2 (Description step) — wherever job board link fits contextually.

- [ ] **Step 11: Ensure the final create API call includes new fields**

In the wizard's submission handler (where it calls `api.post("/jobs", ...)`), ensure `employer_id`, `positions_count`, `job_board_url`, `vacancy_type`, `staff_working_status` are in the payload.

- [ ] **Step 12: Verify end-to-end**

1. Create a new job from the wizard — confirm vacancy type and employer can be set
2. Open an existing job and click Edit — confirm vacancy fields load and save
3. Open `JobDetail` page and confirm employer name, positions count, and job board link are displayed (add display if missing)

- [ ] **Step 13: Commit**

```bash
git add database/008-vacancy-type.sql \
        packages/backend/src/routes/jobs.js \
        packages/frontend/src/pages/JobEdit.tsx \
        packages/frontend/src/pages/CreateJobDialog.tsx
git commit -m "feat: vacancy details — employer link, positions count, job board URL, vacancy type, staff working status"
```

---

## Self-Review Against PDF Scope

**Point 1 — Super Admin / Staff Logins:** Already built. `admin` role = super admin. AdminUsers page manages all staff. No new work needed.

**Point 2 — Candidate Details (name/email/phone/address, provider, interested job, benchmark hours, WS, CV upload):** Gap A closes this. All fields now available at creation time.

**Point 3 — Provider wise (candidates pool, stats):** Gap B closes this. ProviderDetail shows real breakdowns; Candidates page filters by provider.

**Point 4 — Vacancy Details (job board link, vacancy type, no. of positions, end date, staff working status):** Gap C closes this. Note: "End Date" maps to the existing `deadline` field already in the DB and the JobEdit form — confirm it is labelled "End Date" or "Closing Date" in the UI. If not, rename the label in JobEdit from "Deadline" to "End Date / Deadline" for clarity.

**Point 5 — Employer Details (general, vacancies, types, contact):** Already built. EmployerDetail shows job counts by status and contact info.

**Point 6 — Placement Details (email, one-click, tracking, welfare checks):** Already built. Placements + welfare checks + email confirmation all exist.

**Reports (provider wise, placement tracking, staff):** Already built. Reports page has all three tabs.

---

## Execution Order

Execute Gaps in this order (each is independent):

1. **Gap A first** — smallest change, no DB migration needed, fastest to verify
2. **Gap B second** — backend change + two frontend changes; no DB migration
3. **Gap C last** — requires DB migration first, then backend, then frontend


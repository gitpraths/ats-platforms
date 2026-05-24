# Staff Placement KPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-staff placement leaderboard to the dashboard showing total and this-month placement counts for each recruiter.

**Architecture:** Extend the existing `GET /api/stats` endpoint with a `placements_by_staff` array (no new route). Admins get all staff; non-admins get only their own row. The frontend adds a leaderboard table to `Dashboard.tsx` using the existing `useDashboardStats` hook — only the type definition and the page component change.

**Tech Stack:** Node.js/Express, PostgreSQL (`pg`), React 18, TypeScript, TailwindCSS, TanStack React Query, Jest/Supertest

---

## File Map

| File | Action |
|---|---|
| `packages/backend/src/routes/stats.js` | Modify — add `placements_by_staff` query |
| `packages/backend/tests/stats.test.js` | Create — new test file |
| `packages/frontend/src/hooks/useDashboardStats.ts` | Modify — add `placements_by_staff` to `DashboardStats` type |
| `packages/frontend/src/pages/Dashboard.tsx` | Modify — add leaderboard section |

---

## Task 1: Backend — placements_by_staff in stats endpoint

**Files:**
- Modify: `packages/backend/src/routes/stats.js`
- Create: `packages/backend/tests/stats.test.js`

### Context

`GET /api/stats` is at `packages/backend/src/routes/stats.js`. It runs a `Promise.all` with 6 parallel queries and returns them merged into one response object. The `req.user` object has `id` and `role` fields. Admins have role `admin` or `recruiter_admin`.

The database has:
- `placements` table with columns: `id`, `created_by` (UUID, FK to users), `created_at`
- `users` table with columns: `id`, `name`, `role`
- Roles that create placements: `admin`, `recruiter_admin`, `recruiter`

Run tests with: `cd packages/backend && DATABASE_URL=postgresql://ats_user:ats_pass@localhost:5432/ats_db npm test -- --testPathPattern=stats`

- [ ] **Step 1: Write the failing test**

Create `packages/backend/tests/stats.test.js`:

```javascript
import request from "supertest";
import app from "../src/app.js";

let token = "";

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@myats.com", password: "password123" });
  token = res.body.data?.token || "";
});

const auth = () => ({ Authorization: `Bearer ${token}` });

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
        user_id:              expect.any(String),
        name:                 expect.any(String),
        total_placements:     expect.any(Number),
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
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd packages/backend && DATABASE_URL=postgresql://ats_user:ats_pass@localhost:5432/ats_db npm test -- --testPathPattern=stats
```

Expected: 3 failures — `placements_by_staff` is not in the response yet.

- [ ] **Step 3: Add the placements_by_staff query to stats.js**

Open `packages/backend/src/routes/stats.js`. The `Promise.all` currently has 6 entries. Add a 7th:

Replace:
```javascript
    const [jobs, apps, candidates, placements, providers, employers] = await Promise.all([
```
With:
```javascript
    const staffParams = isAdmin ? [] : [userId];
    const staffScope  = isAdmin
      ? ""
      : "AND u.id = $1";

    const [jobs, apps, candidates, placements, providers, employers, staffPlacements] = await Promise.all([
```

Then add the new query as the 7th entry in the `Promise.all` array, after the `employers` query and before the closing `]);`:

```javascript
      pool.query(
        `SELECT
           u.id          AS user_id,
           u.name,
           COUNT(p.id)::int AS total_placements,
           COUNT(p.id) FILTER (
             WHERE DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', NOW())
           )::int AS placements_this_month
         FROM users u
         LEFT JOIN placements p ON p.created_by = u.id
         WHERE u.role IN ('admin', 'recruiter_admin', 'recruiter')
           ${staffScope}
         GROUP BY u.id, u.name
         ORDER BY total_placements DESC, u.name ASC`,
        staffParams
      ),
```

Then add `placements_by_staff` to the response object. Find the closing `res.json({...})` block and add after the `employers` key:

```javascript
        placements_by_staff: staffPlacements.rows.map((r) => ({
          user_id:               r.user_id,
          name:                  r.name,
          total_placements:      r.total_placements,
          placements_this_month: r.placements_this_month,
        })),
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd packages/backend && DATABASE_URL=postgresql://ats_user:ats_pass@localhost:5432/ats_db npm test -- --testPathPattern=stats
```

Expected: 4 tests pass (401, array present, shape correct, ordering correct).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/stats.js packages/backend/tests/stats.test.js
git commit -m "feat: add placements_by_staff to stats endpoint"
```

---

## Task 2: Frontend — type update and leaderboard

**Files:**
- Modify: `packages/frontend/src/hooks/useDashboardStats.ts`
- Modify: `packages/frontend/src/pages/Dashboard.tsx`

### Context

`useDashboardStats.ts` exports the `DashboardStats` interface and a React Query hook. `Dashboard.tsx` imports `useDashboardStats` and `useAuth` (the latter gives `user.id` and `user.role`). The page uses Tailwind for styling — follow the existing pattern (white card, `rounded-xl shadow-sm p-5`).

TypeScript check: `cd packages/frontend && npx tsc --noEmit`

- [ ] **Step 1: Add placements_by_staff to the DashboardStats interface**

In `packages/frontend/src/hooks/useDashboardStats.ts`, add to the `DashboardStats` interface after the `employers` block:

```typescript
  placements_by_staff?: {
    user_id: string;
    name: string;
    total_placements: number;
    placements_this_month: number;
  }[];
```

- [ ] **Step 2: Add the leaderboard section to Dashboard.tsx**

In `packages/frontend/src/pages/Dashboard.tsx`, add the following section after the `{/* Recent Activity Feed */}` closing `</div>` (after line 219, before the final closing `</div>`):

```tsx
      {/* Placements by Staff */}
      {(stats?.placements_by_staff?.length ?? 0) > 0 && (() => {
        const staffRows = stats!.placements_by_staff!;
        const isAdmin   = user?.role === "admin" || user?.role === "recruiter_admin";
        const maxTotal  = Math.max(...staffRows.map((r) => r.total_placements), 1);
        return (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 tracking-tight mb-4">
              {isAdmin ? "Placements by Staff" : "Your Placements"}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">This Month</th>
                  <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {staffRows.map((row) => {
                  const isMe = row.user_id === user?.id;
                  return (
                    <tr key={row.user_id} className={isMe ? "bg-blue-50" : ""}>
                      <td className="py-2 px-3 text-slate-900 font-medium">
                        {row.name}
                        {isMe && <span className="ml-2 text-xs text-blue-500 font-normal">you</span>}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">{row.placements_this_month}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex-1 max-w-[80px] bg-slate-100 rounded-full h-1.5">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full"
                              style={{ width: `${(row.total_placements / maxTotal) * 100}%` }}
                            />
                          </div>
                          <span className="text-slate-700 font-semibold w-6 text-right">{row.total_placements}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
```

- [ ] **Step 3: TypeScript check**

```bash
cd packages/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/hooks/useDashboardStats.ts packages/frontend/src/pages/Dashboard.tsx
git commit -m "feat: add staff placement leaderboard to dashboard"
```

---

## Self-Review

**Spec coverage:**
- ✅ Admin sees all staff leaderboard
- ✅ Individual staff sees only their own row (backend scoping)
- ✅ Total placements (all time) shown
- ✅ This month placements shown
- ✅ Current user's row highlighted (bg-blue-50 + "you" label)
- ✅ Ordered by total descending
- ✅ Relative bar for visual scanning
- ✅ No new routes, pages, or hooks
- ✅ Section not rendered if data is empty

**Placeholder scan:** None found.

**Type consistency:** `placements_by_staff` array item shape matches between backend response, TypeScript interface, and Dashboard render.

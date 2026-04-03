# Task - Frontend: Reports Page

## Goal
Build a Reports page with 3 tabs: Provider Report, Placement Tracking, and Staff Report.

## Page
- `src/pages/Reports.tsx` — at `/reports`
- Access: admin and recruiter_admin only (redirect others to `/dashboard`)

## Layout

### Header
- "Reports" title
- Date range filter (shared across tabs): From | To date pickers
- Export button per tab (CSV download — see Steps)

### Tab 1 — Provider Report
Table columns: Provider | Total Candidates | Placed | Job Seeking | Inactive | Placement Rate

- Placement rate displayed as a progress bar + percentage
- Click provider name → navigate to `/providers/:id`

API: `GET /api/reports/providers?from=&to=`

### Tab 2 — Placement Tracking
Table columns: Candidate | Job | Employer | Provider | Start Date | Confirmed | D1 | W1 | M1 | M3 | M6

- D1/W1/M1/M3/M6 = welfare check dot indicators (reuse `WelfareCheckDots` component)
- Click candidate name → navigate to `/candidates/:id`
- Click placement row → navigate to `/placements/:id`
- Filter: Employer dropdown | Provider dropdown

API: `GET /api/reports/placements?from=&to=&employer_id=&provider_id=`

### Tab 3 — Staff Report
Table columns: Staff Member | Role | Jobs Assigned | Active Jobs | Total Applications | Total Placements

- Click staff name → navigate to `/users/:id` (if user detail page exists)

API: `GET /api/reports/staff?from=&to=`

## CSV Export
Each tab has an "Export CSV" button:
- Fetches full data (no pagination limit) from the same endpoint with `?limit=1000`
- Converts JSON to CSV using a simple utility function in `src/lib/utils.ts`
- Triggers browser download: `report-providers-2026-03-28.csv`

## Steps
- Add "Reports" link to sidebar navigation (admin/recruiter_admin only)
- Use shadcn/ui `Tabs`, `Table`, `Badge`, `DatePicker`, `Select`, `Button`
- Date range defaults to: from = first day of current month, to = today
- Show loading skeleton while data fetches
- Show empty state with illustration if no data matches filters

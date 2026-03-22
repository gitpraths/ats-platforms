# Task - Frontend Home Dashboard

## Goal
Implement a home dashboard at `/` (redirect to `/dashboard` after login).

## Dashboard Widgets

### Summary Cards (top row)
- **Open Jobs** — count of jobs with `status = 'published'`
- **Total Candidates** — count from candidates table
- **Active Applications** — count of applications not in `hired` or `rejected`
- **Hired This Month** — count of applications with `stage = 'hired'` in current month

### Recent Activity (list)
- Last 10 job applications, showing:
  - Candidate name
  - Job title
  - Stage badge
  - Applied date (relative: "2 days ago")

### Jobs by Status (bar chart)
- Use Recharts `BarChart`
- Data: count of jobs grouped by status (draft, published, archived)

### Pipeline Funnel (horizontal bar)
- Applications count at each stage
- Visual funnel showing drop-off

## API Calls
- `GET /api/jobs?limit=100` — for status counts
- `GET /api/applications?limit=10` — for recent activity
- All data fetched with React Query on mount

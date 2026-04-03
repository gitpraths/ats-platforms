# Task - Frontend: Placements List Page

## Goal
Build a Placements list page showing all active placements with start dates and quick-access welfare check status indicators.

## Page
- `src/pages/Placements.tsx` — at `/placements`

## Layout

### Header
- "Placements" title
- Filter bar: Employer | Provider | Date range (from/to) | Search (candidate name)
- "New Placement" button — opens Create Placement dialog (admin/recruiter/recruiter_admin)

### Placements Table
Columns:
| Column | Content |
|---|---|
| Candidate | Name + work_status badge |
| Job | Job title |
| Employer | Employer name |
| Provider | Provider name |
| Start Date | Formatted date |
| Welfare Checks | 5 dot indicators (see below) |
| Confirmed | Checkmark if `confirmed_by_employer = true` |
| Actions | View / Send Confirmation |

### Welfare Check Dot Indicators
5 small circles representing day_1 → week_1 → month_1 → month_3 → month_6:
- Gray = not yet due
- Yellow = due (overdue, not completed)
- Green = completed
- Tooltip on hover: check type + due date

## Create Placement Dialog
Form fields:
- Candidate (searchable dropdown — `GET /api/candidates`)
- Job (searchable dropdown — `GET /api/jobs`)
- Employer (auto-filled from job if linked, otherwise manual select)
- Start Date (date picker)
- Notes (optional textarea)

Submit: `POST /api/placements`

On success: close dialog, refresh list, navigate to `/placements/:id`

## API Calls
- `GET /api/placements?page=&limit=20&employer_id=&provider_id=&from=&to=`
- `POST /api/placements`
- `POST /api/placements/:id/send-confirmation`

## Steps
- Add "Placements" link to sidebar navigation (below Hiring Board)
- Paginate with 20 per page
- Use shadcn/ui `Table`, `Badge`, `Tooltip`, `Dialog`, `DatePicker`
- Welfare check dots use a custom `WelfareCheckDots` component (reuse on detail page)

# Task - Frontend: Placement Detail & Welfare Check Timeline

## Goal
Build the Placement Detail page showing full placement info and an interactive welfare check milestone timeline.

## Page
- `src/pages/PlacementDetail.tsx` — at `/placements/:id`

## Layout

### Header
- Back link to `/placements`
- Placement title: "[Candidate Name] → [Job Title]"
- Employer name (with link to `/employers/:id`)
- "Send Confirmation Email" button (if `confirmed_by_employer = false`)
- Status pill: Confirmed / Pending Confirmation

### Info Cards (top row)
| Card | Content |
|---|---|
| Candidate | Name, work_status badge, provider name, link to candidate profile |
| Job | Job title, employer, job type, link to job detail |
| Placement | Start date, created by, notes |

### Welfare Check Timeline
Vertical timeline showing 5 milestones in order:

For each milestone:
- Icon: clock (pending) / check (complete) / alert (overdue)
- Label: "Day 1 Check", "Week 1 Check", etc.
- Due date
- Status: Pending / Overdue / Completed (with completed date)
- Employer response text (if completed)
- Actions:
  - "Send Email" button (if `email_sent_at IS NULL`)
  - "Mark Complete" button (opens dialog — if not completed)

### Mark Complete Dialog
- Textarea: Employer response / notes
- Confirm button → `PATCH /api/welfare-checks/:id`

## API Calls
- `GET /api/placements/:id` — placement + welfare_checks array
- `PATCH /api/welfare-checks/:id` — mark complete
- `POST /api/welfare-checks/:id/send-email` — send welfare email
- `POST /api/placements/:id/send-confirmation` — send confirmation email

## Steps
- Reuse `WelfareCheckDots` component from prompt `0037` in the timeline header summary
- Use shadcn/ui `Card`, `Badge`, `Dialog`, `Textarea`, `Button`, `Separator`
- Show overdue checks highlighted in red/amber
- Refresh welfare check list after any mutation (React Query invalidation)

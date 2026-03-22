# Task - Frontend Assign Talent (Candidate Assignment)

## Goal
Implement the "Assign Talent" dialog that allows recruiters to assign a candidate to a job posting.

## Trigger
"Assign Talent" button on the Job Detail page (`/jobs/:id`).

## Dialog: Assign Candidate

### Search & List
- Search input: filter by candidate name or email (calls `GET /api/candidates?q=...`)
- Candidate list — each row shows:
  - Avatar (initials fallback)
  - Full Name
  - Email
  - City, State
  - Radio button to select

### Buttons
- "Assign Candidate" (primary) — disabled until a candidate is selected
- "Cancel"

### On Submit
- Call `POST /api/applications` with `{ job_id, candidate_id, source: "manual_assignment" }`
- On success: close dialog, show success toast, refresh application list
- **BUG FIX**: Only recruiters assigned to the job OR the job owner should see the Assign Talent button

## Component
`components/AssignTalentDialog.tsx`
- Props: `jobId`, `isOpen`, `onClose`, `onAssigned`

# Task - Hiring Board Page (Frontend)

## Goal
Implement the Hiring Board page with two view modes: Pipeline (Kanban) and List.

## Page: `/hiring-board`

### Pipeline View (Kanban)
- One column per application stage: `applied | screening | interview | offer | hired | rejected`
- Each card shows:
  - Candidate full name
  - Candidate email
  - Job title
  - Application date
  - Source (linkedin, company_website, referral, etc.)
- Drag and drop cards between columns using `@hello-pangea/dnd`
- On drop: call `PATCH /api/applications/:id/stage`

### List View
- Simple table with columns:
  - Applicant (name + email)
  - Job Posting (title)
  - Status (stage badge)
  - Score (star rating 1-5)
  - Source
  - Applied Date

### View Toggle
- Toggle button top-right: "Pipeline" | "List"
- Default: Pipeline view

### Card Actions Dropdown
Each card/row has a dropdown menu with:
- **Change Stage** — opens a select dialog to move to any stage
- **View Candidate** — navigates to candidate profile
- **Add Note** — opens a textarea dialog to add notes to the application

## Data
- Fetch from `GET /api/applications`
- Invalidate and refetch on stage change

## Component Structure
```
HiringBoard.tsx
├── PipelineView.tsx    (Kanban columns)
│   └── ApplicationCard.tsx
└── ListView.tsx        (Table)
    └── ApplicationRow.tsx
```

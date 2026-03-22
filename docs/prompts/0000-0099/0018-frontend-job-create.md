# Task - Frontend Job Create / Edit Form

## Goal
Implement a Job Create dialog and Job Edit page with full field support and AI assist buttons.

## Job Create — Dialog triggered from Jobs page "New Job" button

### Form Fields
- Job Title (text, required) + "Suggest Titles" AI button
- Department (select, from GET /api/departments)
- Location (select, from GET /api/locations)
- Job Type (select: Full Time, Part Time, Contract, Internship)
- Work Model (select: Onsite, Remote, Hybrid)
- Description (textarea) + "Generate with AI" button
- Required Skills (tag input — comma-separated or Enter to add)
- Desired Skills (tag input)
- Min / Max Annual Salary (number inputs) + Currency (USD, EUR, CAD, MXN)
- Experience (years minimum, number)
- Deadline (date picker)
- Team (text)
- Cover Letter Required (checkbox)

### Behavior
- Validate required fields with Zod + React Hook Form
- On submit: `POST /api/jobs`
- On success: close dialog, invalidate jobs query, show success toast
- **BUG FIX**: Dialog MUST close automatically after successful job creation

## Job Edit — Full page at `/jobs/:id/edit`
- Same fields as create, pre-populated from `GET /api/jobs/:id`
- Submit calls `PATCH /api/jobs/:id`
- Separate "Change Status" section using `PATCH /api/jobs/:id/status`

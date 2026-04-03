# Task - Frontend: Job Create Wizard — Extended Fields

## Goal
Extend the existing Job Create wizard (`src/pages/JobCreate.tsx`) with new fields: employer selector, positions count, and job board URL.

## Changes to Step 1 — Basics
Add 3 new fields after the existing ones:

### Employer (optional)
- Label: "Employer"
- Component: searchable `Select` or `Combobox`
- Source: `GET /api/employers?limit=100&is_active=true`
- Display: employer name in dropdown options
- Stores: `employer_id` (UUID)
- Placeholder: "Select employer (optional)"

### Number of Positions
- Label: "Number of Positions"
- Component: `Input` type=number, min=1, max=999
- Default: 1
- Validation: required, integer ≥ 1

### Job Board URL
- Label: "External Job Board URL"
- Component: `Input` type=url
- Placeholder: "https://seek.com.au/job/..."
- Validation: optional, valid URL format if provided

## Changes to Job Edit Page
Extend `src/pages/JobEdit.tsx` with the same 3 fields.
Prefill values from `GET /api/jobs/:id`.

## Changes to Job Detail Page
Show new fields in the job detail view (`src/pages/JobDetail.tsx`):
- Employer: display name linked to `/employers/:id`
- Positions Count: "X positions"
- Job Board URL: external link icon that opens in new tab (if set)

## Zod Schema Update
```typescript
// In the job form schema
employer_id: z.string().uuid().optional().nullable(),
positions_count: z.number().int().min(1).default(1),
job_board_url: z.string().url().optional().or(z.literal('')),
```

## API Calls
- `GET /api/employers?limit=100` — for employer dropdown
- `POST /api/jobs` — already used; ensure new fields are sent in body
- `PUT /api/jobs/:id` — same

## Steps
- Do not break existing job create wizard steps or validation
- Employer dropdown: show "No employer" / empty option at top
- Positions count defaults to 1 if not changed by user

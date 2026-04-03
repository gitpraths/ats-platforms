# Task - Frontend: Employers CRUD Pages

## Goal
Build the Employers section: list page, detail page, and create/edit forms for managing employer companies.

## Pages
- `src/pages/Employers.tsx` — list page at `/employers`
- `src/pages/EmployerDetail.tsx` — detail + inline edit at `/employers/:id`
- `src/pages/EmployerCreate.tsx` — create form at `/employers/new`

## Employers List Page (`/employers`)
- Page header: "Employers" + "Add Employer" button (admin/recruiter_admin only)
- Search bar: filter by name
- Industry filter dropdown
- Table columns: Name | Industry | Contact | Open Jobs | Total Jobs | Status | Actions
- Status badge: Active / Inactive
- Actions: View, Edit (admin/recruiter_admin), Deactivate (admin)
- Pagination: 20 per page

## Employer Detail Page (`/employers/:id`)
- Header: employer name + website link + Edit button
- Info card: industry, description, contact name/email/phone, address
- Jobs section: table of linked jobs (title, status, type, positions, deadline)
  - Click row → navigate to `/jobs/:id`
- Stats row: Open Jobs | Total Jobs | Total Placements

## Employer Create / Edit Form
- Fields:
  - Company Name*
  - Industry
  - Website
  - Description (textarea)
  - Contact Name | Contact Email | Contact Phone
  - Address (textarea)
  - Active toggle
- Validation via Zod + React Hook Form
- Submit: POST `/api/employers` or PUT `/api/employers/:id`
- On success: navigate to `/employers/:id`

## API Calls
- `GET /api/employers?page=&limit=20&search=&industry=`
- `GET /api/employers/:id`
- `POST /api/employers`
- `PUT /api/employers/:id`
- `DELETE /api/employers/:id`

## Job Creation Integration
- On the Job Create wizard (Step 1 — Basics), add an "Employer" selector dropdown
  - Fetches `GET /api/employers?limit=100` for options
  - Optional field (not all jobs require an employer)
- Also add "Positions Count" number input (default 1) and "Job Board URL" text input

## Steps
- Add route entries to `App.tsx` router
- Add "Employers" link to sidebar navigation (below Providers)
- Use shadcn/ui: `Table`, `Badge`, `Button`, `Input`, `Textarea`, `Select`, `Dialog`, `Form`
- Only show Add/Edit/Delete to `admin` and `recruiter_admin` roles

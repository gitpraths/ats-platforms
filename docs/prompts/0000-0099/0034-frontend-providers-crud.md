# Task - Frontend: Providers CRUD Pages

## Goal
Build the Providers section: list page and detail/edit page for managing provider organisations.

## Pages
- `src/pages/Providers.tsx` — list page at `/providers`
- `src/pages/ProviderDetail.tsx` — detail + edit at `/providers/:id`
- `src/pages/ProviderCreate.tsx` — create form at `/providers/new`

## Providers List Page (`/providers`)
- Page header: "Providers" + "Add Provider" button (admin/recruiter_admin only)
- Search bar: filter by name (debounced)
- Table columns: Name | Contact | Email | Phone | Candidates | Status | Actions
- Status badge: Active (green) / Inactive (gray)
- Actions: View, Edit (admin/recruiter_admin), Deactivate (admin only)
- Pagination: 20 per page
- Empty state if no providers

## Provider Detail Page (`/providers/:id`)
- Header: provider name + Edit button + back link
- Info card: contact name, email, phone, address, active status
- Candidates section: table of linked candidates (name, work_status, date added)
  - Click candidate row → navigate to `/candidates/:id`
- Stats row: Total | Placed | Job Seeking | Inactive

## Provider Create / Edit Form
- Fields: Name* | Contact Name | Email | Phone | Address | Active (toggle)
- Validation via Zod + React Hook Form
- Submit: POST `/api/providers` (create) or PUT `/api/providers/:id` (edit)
- On success: navigate to `/providers/:id`
- On delete (edit page): confirmation dialog → soft-delete

## API Calls
- `GET /api/providers?page=&limit=20&search=`
- `GET /api/providers/:id`
- `POST /api/providers`
- `PUT /api/providers/:id`
- `DELETE /api/providers/:id`

## Steps
- Add route entries to `App.tsx` router
- Add "Providers" link to sidebar navigation (below Candidates)
- Use shadcn/ui: `Table`, `Badge`, `Button`, `Input`, `Dialog`, `Form`
- Data fetched with React Query (`useQuery`, `useMutation`)
- Only show Add/Edit/Delete actions to `admin` and `recruiter_admin` roles

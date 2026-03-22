# Task - Department REST API

## Routes (`src/routes/departments.js`)

All routes require `requireAuth` middleware.

### GET /api/departments
- Return all departments ordered by name
- Response: `{ success: true, data: [{ id, name, created_at }] }`

### POST /api/departments
- Body: `{ name: string }` — required
- Prevent duplicate name: return 409 if department with same name exists
- Response: `{ success: true, data: { id, name, created_at } }`

### DELETE /api/departments/:id
- Only `admin` or `recruiter_admin` may delete
- Use `requireRole('admin', 'recruiter_admin')` middleware
- Response: `{ success: true }`

## Rules
- Name must be unique (case-insensitive check before insert)
- Return clear error messages on validation failure

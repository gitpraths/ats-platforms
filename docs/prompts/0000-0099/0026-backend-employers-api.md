# Task - Backend: Employers API

## Goal
Implement full CRUD REST API for employers. Employers are companies that post vacancies through the agency.

## File
Create `packages/backend/src/routes/employers.js`
Register in `server.js` as `/api/employers`

## Endpoints

### GET /api/employers
- Returns paginated list of employers
- Query params: `?page=1&limit=20&search=name&industry=`
- Include `open_jobs_count` (jobs with status = 'published')
- Include `total_jobs_count`
- Auth: all staff roles

### GET /api/employers/:id
- Returns single employer with full details
- Include `jobs` array (id, title, status, job_type, positions_count)
- Include `open_jobs_count`, `total_placements_count`
- Auth: all staff roles

### POST /api/employers
- Create a new employer
- Body: `{ name, industry, website, description, contact_name, contact_email, contact_phone, address }`
- Validation: `name` required
- Auth: `admin`, `recruiter_admin`

### PUT /api/employers/:id
- Update employer fields (all optional)
- Auth: `admin`, `recruiter_admin`

### DELETE /api/employers/:id
- Soft-delete: set `is_active = false`
- Return 409 if employer has open jobs linked
- Auth: `admin` only

## Response Shape
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "industry": "Technology",
    "website": "https://acme.com",
    "description": "...",
    "contact_name": "Jane Smith",
    "contact_email": "jane@acme.com",
    "contact_phone": "+61 400 000 000",
    "address": "...",
    "is_active": true,
    "open_jobs_count": 3,
    "total_jobs_count": 7,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## Steps
- Add `authMiddleware` to all routes
- Log creates/updates/deletes to `activity_log` with `entity_type = 'employer'`
- When an employer is linked to a job, return employer name in job response (join in jobs route)

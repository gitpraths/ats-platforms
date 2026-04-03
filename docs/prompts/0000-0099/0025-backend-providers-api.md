# Task - Backend: Providers API

## Goal
Implement full CRUD REST API for providers. Providers are organisations that refer candidates to the agency.

## File
Create `packages/backend/src/routes/providers.js`
Register in `server.js` as `/api/providers`

## Endpoints

### GET /api/providers
- Returns paginated list of providers
- Query params: `?page=1&limit=20&search=name`
- Filter by `is_active` (default: all)
- Include `candidate_count` (count of candidates linked to each provider)
- Auth: all staff roles

### GET /api/providers/:id
- Returns single provider with full details
- Include `candidate_count` and recent 5 candidates (id, name, work_status)
- Auth: all staff roles

### POST /api/providers
- Create a new provider
- Body: `{ name, contact_name, email, phone, address, is_active }`
- Validation: `name` required
- Auth: `admin`, `recruiter_admin`

### PUT /api/providers/:id
- Update provider fields
- Same body as POST (all fields optional)
- Auth: `admin`, `recruiter_admin`

### DELETE /api/providers/:id
- Soft-delete: set `is_active = false` (do not hard delete)
- Return 409 if provider has active candidates
- Auth: `admin` only

## Response Shape
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "...",
    "contact_name": "...",
    "email": "...",
    "phone": "...",
    "address": "...",
    "is_active": true,
    "candidate_count": 12,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## Steps
- Add `authMiddleware` to all routes
- Add `requireRole(['admin', 'recruiter_admin'])` helper for write routes
- Log all creates/updates/deletes to `activity_log` table with `entity_type = 'provider'`

# Task - Location REST API

## Routes (`src/routes/locations.js`)

All routes require `requireAuth` middleware.

### GET /api/locations
- Optional query: `?q=` for city/state search (ILIKE)
- Response: `{ success: true, data: [{ id, city, state, country, is_remote }] }`

### POST /api/locations
- Body: `{ city, state, country, is_remote }`
- `city` and `country` are required
- Response: `{ success: true, data: location }`

### DELETE /api/locations/:id
- Only `admin` or `recruiter_admin` may delete
- Response: `{ success: true }`

## Rules
- Review location search: use parameterized queries only — never string interpolation (prevent SQL injection)
- `is_remote` defaults to `false`
- Future: support geolocation search by mile radius (not implemented yet, add TODO comment)

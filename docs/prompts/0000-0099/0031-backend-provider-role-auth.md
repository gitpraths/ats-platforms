# Task - Backend: Provider Role Authentication

## Goal
Add support for the `provider` role. Provider users can log in and see only the candidates and placements belonging to their provider organisation.

## Changes Required

### 1. users table
Ensure `provider` is a valid value for the `role` column (see prompt `0024`).
Add `provider_id` FK on users:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id) ON DELETE SET NULL;
```

### 2. Auth route — no changes
Login already works via `POST /api/auth/login`. JWT payload must now include `provider_id` if the user is a provider.

Update `packages/backend/src/routes/auth.js` login handler:
- Include `provider_id` in the JWT payload when `role = 'provider'`

### 3. Auth middleware — scope enforcement
In `packages/backend/src/middleware/auth.js` (or equivalent), add a helper:

```javascript
export function requireProviderScope(req, candidateProviderIdField = 'provider_id') {
  // If user role is 'provider', filter queries to their provider_id only
  // Attach req.providerScope = user.provider_id (or null for staff)
}
```

### 4. Candidate routes — scope
In `GET /api/candidates` and `GET /api/candidates/:id`:
- If `req.user.role === 'provider'`, add `WHERE provider_id = req.user.provider_id`

### 5. Placement routes — scope
In `GET /api/placements`:
- If provider role, join candidates and filter by `candidates.provider_id = req.user.provider_id`

### 6. Blocked routes for providers
Providers must NOT access:
- `POST/PUT/DELETE /api/candidates`
- `POST/PUT/DELETE /api/jobs`
- Any `/api/reports/*` endpoint
- Any `/api/providers/*` write endpoints
- `/api/users` write endpoints

Return 403 for blocked routes.

## Steps
- Update `POST /api/users` (admin create user) to accept optional `provider_id` when role is `provider`
- Add seed user with role `provider` linked to a seed provider in `002-seed-data.sql`
- Write test: provider user cannot access another provider's candidates

# Task - Candidate Search API

## Goal
Implement full-text candidate search for the "Assign Talent" dialog.

## GET /api/candidates — Search Candidates
- Requires `requireAuth`
- Query params:
  - `q`: string, optional — search by name or email (ILIKE)
  - `page`, `limit` (default 1, 20)
- Returns list of candidates with `application_count`

## GET /api/candidates/:id — Load Candidate
- Returns candidate with their application history:
```json
{
  "id": "...",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "...",
  "city": "Austin",
  "state": "TX",
  "resume_url": "...",
  "notes": "...",
  "applications": [
    {
      "id": "...",
      "stage": "screening",
      "job_title": "Software Engineer",
      "applied_at": "..."
    }
  ]
}
```

## POST /api/candidates — Create Candidate
- Body: `{ name, email, phone, city, state, resume_url, notes }`
- `name` and `email` required
- Return 409 if email already exists
- Returns: created candidate

## PUT /api/candidates/:id — Update Candidate
- Body: all fields optional
- Returns: updated candidate

## Database Changes Needed
Add to `candidates` table:
```sql
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS city  VARCHAR(255);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS state VARCHAR(255);
```

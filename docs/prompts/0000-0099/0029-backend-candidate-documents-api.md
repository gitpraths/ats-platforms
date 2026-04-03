# Task - Backend: Candidate Document Upload API

## Goal
Extend the candidates API to support uploading and managing multiple documents (CV, ID, certificates, etc.) per candidate.

## New Table
```sql
CREATE TABLE candidate_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,  -- 'cv', 'id', 'certificate', 'other'
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_size     INTEGER,
  mime_type     VARCHAR(100),
  uploaded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

Add to `database/006-alter-candidates-jobs.sql` or a new `007-candidate-documents.sql`.

## Endpoints
Add to `packages/backend/src/routes/candidates.js`

### GET /api/candidates/:id/documents
- Returns all documents for a candidate
- Auth: all staff roles + provider (scoped)

### POST /api/candidates/:id/documents
- Upload a document using Multer
- Form fields: `document_type` (required), file (required)
- Allowed types: `cv`, `id`, `certificate`, `other`
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Max file size: 10 MB
- Store in `uploads/candidates/:candidate_id/` directory
- Auth: all staff roles

### DELETE /api/candidates/:id/documents/:doc_id
- Delete document record and file from disk
- Auth: `admin`, `recruiter_admin`

## Response Shape
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "candidate_id": "uuid",
    "document_type": "cv",
    "file_name": "john-doe-cv.pdf",
    "file_size": 204800,
    "mime_type": "application/pdf",
    "uploaded_by": "uuid",
    "created_at": "..."
  }
}
```

## File Serving
- Add `GET /api/candidates/:id/documents/:doc_id/download` to stream file with correct Content-Disposition header

## Steps
- Reuse the existing Multer config pattern from `services/upload.js` or `routes/users.js`
- Ensure upload directory is created if not exists (`fs.mkdirSync`)
- Log document uploads to `activity_log` with `entity_type = 'candidate_document'`

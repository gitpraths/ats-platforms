# Task - Frontend: Candidate Profile Extended

## Goal
Extend the existing Candidate Detail page with new fields: full address, work status, benchmark hours, provider link, interested job, and document upload/management.

## File
Modify `src/pages/CandidateDetail.tsx` (and related components)

## New Fields to Display & Edit

### Personal Info Section (extend existing)
- Address Line 1
- Address Line 2
- Postcode
- Country
- Phone (already exists — verify it's shown)

### Work & Placement Section (new section)
- **Work Status** badge: `job_seeking` (blue) | `employed` (green) | `placed` (purple) | `inactive` (gray)
- **Provider** — display linked provider name with link to `/providers/:id`
  - Edit: dropdown to select provider (fetch `GET /api/providers?limit=100`)
- **Benchmark Hours** — numeric input (hours/week)
- **Interested Job** — text field describing the type of role the candidate is looking for

## Documents Section (new)
- Section header: "Documents" + "Upload Document" button
- List of uploaded documents as rows:
  - Icon (PDF/image), filename, document type badge, upload date, Download button, Delete button
- Document type badge: `CV` (blue) | `ID` (orange) | `Certificate` (green) | `Other` (gray)
- Upload dialog:
  - File picker (drag & drop or click)
  - Document type select: CV | ID | Certificate | Other
  - Submit button
  - Max file size: 10 MB (show error if exceeded)
  - Accepted formats: PDF, JPG, PNG, DOC, DOCX

## API Calls
- `GET /api/candidates/:id` — already called; ensure new fields are in response
- `PUT /api/candidates/:id` — extend with new fields
- `GET /api/candidates/:id/documents`
- `POST /api/candidates/:id/documents` (multipart/form-data)
- `DELETE /api/candidates/:id/documents/:doc_id`
- `GET /api/candidates/:id/documents/:doc_id/download`

## Steps
- Use shadcn/ui `Select` for work status and provider dropdowns
- Use shadcn/ui `Dialog` for upload modal
- Document download: open URL in new tab or trigger download via `<a href download>`
- Show work status badge prominently near the candidate name/header
- Provider field only editable by admin/recruiter_admin

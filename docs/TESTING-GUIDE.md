# My ATS Platform — Testing Guide

**Live URL:** https://comfortable-mindfulness-production.up.railway.app  
**API URL:** https://ats-platforms-production.up.railway.app  
**Date:** 23 May 2026

---

## Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@atsplatform.com.au | password123 |
| Recruiter Admin | sarah@atsplatform.com.au | password123 |
| Recruiter | michael@atsplatform.com.au | password123 |
| Hiring Manager | emma@atsplatform.com.au | password123 |
| Provider | provider@atsplatform.com.au | password123 |

---

## 1. Super Admin / Staff Logins ✅ DONE

### What was built
- 5 user roles: **admin**, **recruiter_admin**, **recruiter**, **hiring_manager**, **provider**
- JWT-based login with 8-hour session expiry
- Session expiry warning dialog with one-click refresh
- Admin Users page for creating and managing staff accounts

### How to test
1. Go to the live URL → you will see the Login page
2. Log in with each role above and confirm the dashboard loads
3. Log in as **admin** → go to **Admin Users** (sidebar) → verify you can create a new staff account
4. Log in as **provider** → confirm you can only see candidates linked to your organisation
5. Try accessing `/providers/new` as a recruiter → you should be redirected to the dashboard (access denied)

---

## 2. Candidate Details ✅ DONE

### What was built
- Full candidate profile: Name, Email, Phone, Address, Postcode
- **Provider** dropdown — links candidate to a provider organisation
- **Work Status** — Job Seeking / Employed / Placed / Inactive
- **Benchmark Hours / Week** — number input
- **Interested Job** — free text (e.g. Forklift Operator)
- CV and document upload (PDF, Word, image) on Candidate Detail page
- Document download and delete

### How to test
1. Log in as admin or recruiter → sidebar → **Candidates** → **Add Candidate**
2. Fill in: Name, Email, Phone, Address, Postcode
3. Select a **Provider** from the dropdown (e.g. MAX Employment)
4. Set **Work Status** to "Job Seeking"
5. Enter **Benchmark Hours** (e.g. 38) and **Interested Job** (e.g. Warehouse Packer)
6. Click **Add Candidate** → you should be taken to the Candidate Detail page
7. On the Candidate Detail page → scroll to **Documents** → upload a PDF file
8. Confirm the file appears in the documents list and can be downloaded

---

## 3. Provider Wise — Candidates Pool & Stats ✅ DONE

### What was built
- Provider list page with candidate count per provider
- Provider detail page showing candidate breakdown:
  - Total Candidates / Placed / Job Seeking / Employed / Inactive
- "View all" link on Provider Detail filters the Candidates list to that provider's pool

### How to test
1. Sidebar → **Providers** → confirm the list loads with all providers and candidate counts
2. Click any provider (e.g. MAX Employment) → confirm the stats panel shows real numbers across all 5 categories
3. Click **View all** → confirm the Candidates page filters to only show candidates from that provider
4. Add a new candidate linked to that provider → go back to the provider page → confirm the counts update

---

## 4. Vacancy Details ✅ DONE

### What was built
- Job Board URL — external link to the job posting
- Type of Vacancy — Full Time / Part Time / Casual / Contract / Temporary
- No. of Positions — number field
- Staff Working Status — Active / On Leave / Resigned / Terminated
- All fields available in both **Create Job wizard** and **Edit Job** page

### How to test
1. Sidebar → **Jobs** → **+ New Job** (top right button)
2. In Step 1 (Basics): fill in title, then scroll to **Vacancy Details** section
3. Select **Type of Vacancy** (e.g. Casual), enter **No. of Positions** (e.g. 3)
4. Select **Staff Working Status** (e.g. Active) and paste a Job Board URL
5. Complete the wizard and save
6. Open the job → click **Edit** → confirm all vacancy fields are pre-filled and editable

### ⚠️ Pending — End Date
The scope includes an **End Date** field for vacancies. This has **not yet been added** to the database or forms. See Pending Items section below.

---

## 5. Employer Details ✅ DONE

### What was built
- Full employer profile: Name, Industry, Website, Description
- Contact details: Contact Name, Contact Email, Contact Phone, Address
- Open job count and total job count displayed on employer card and detail page
- Placement count on employer detail page
- Active / Inactive toggle (admin only)

### How to test
1. Sidebar → **Employers** → confirm the list loads with all employers
2. Click any employer → confirm the detail page shows contact info and job counts
3. Click **Add Employer** (admin/recruiter_admin only) → create a new employer with all fields
4. Click **Edit** on an existing employer → update the industry or contact details → save → confirm changes persist

---

## 6. Placement Details ✅ DONE

### What was built
- One-click placement from any application (Applications tab on Job Detail)
- Enter job start date and optional notes on placement creation
- Employment confirmation email automatically sent to employer on placement
- Welfare check tracking at: **Day 1, Week 1, Month 1, Month 3, Month 6**
- Automated emails sent to employer at each welfare check milestone
- Welfare check status visible on the Placements list (dot indicators)
- Manual welfare check completion from the Placement Detail page

### How to test
1. Sidebar → **Jobs** → open any job with applications → go to **Applications** tab
2. Find an application at any stage → click **Place** (one-click placement)
3. Enter a start date → click **Confirm Placement**
4. Confirm an email confirmation is sent to the employer (check employer email)
5. Sidebar → **Placements** → find the new placement → check welfare check dots
6. Open the placement → mark a welfare check as complete → confirm the dot updates

---

## 7. Reports ✅ DONE

### What was built
- **Provider Report** — placement rates and candidate counts by provider, filterable by date range
- **Placement Tracking** — all placements with welfare check completion status
- **Staff Report** — jobs managed and placements made per staff member
- CSV export on all three tabs

### How to test
1. Sidebar → **Reports**
2. **Provider Report tab** — set a date range → confirm provider rows update with counts → click **Export CSV**
3. **Placement Tracking tab** — confirm all active placements show with welfare check status
4. **Staff Report tab** — confirm each staff member's job and placement counts appear → export to CSV
5. Verify exported CSV opens correctly in Excel/Numbers

---

## Pending Items

The following items from the original scope are **not yet implemented**:

| # | Item | Details |
|---|------|---------|
| 1 | **Vacancy End Date** | The scope requires an End Date field on vacancies. The database column, backend API field, and frontend form field still need to be added to `database/009-vacancy-end-date.sql`, `packages/backend/src/routes/jobs.js`, and `packages/frontend/src/pages/JobEdit.tsx` + `CreateJobDialog.tsx`. |

---

## Known Issues Fixed in This Release

| Issue | Fix Applied |
|-------|------------|
| Provider/Employer save appeared to fail | `activity_log` inserts were blocking — changed to fire-and-forget |
| Providers / Employers / Placements list showed empty | `api.get()` returned the raw array; components accessed `.data` on it (undefined). Added `api.list()` that correctly returns `{ data, meta }` |
| Provider/Employer dropdowns empty in forms | Same root cause as above — fixed in CandidateNew, CandidateDetail, JobEdit, CreateJobDialog |
| CORS errors blocking Railway frontend | Backend CORS was hardcoded to `localhost:5173` — updated to accept all `*.up.railway.app` domains |
| Backend crashed on startup (Railway) | Added startup guard for missing `DATABASE_URL` with a clear error message |
| PostgreSQL SSL error (Railway) | Auto-detects remote database by hostname and enables SSL accordingly |

---

## Database Migration Order

Run these files in order on the PostgreSQL database:

```
database/001-create-tables.sql
database/002-seed-data.sql
database/003-alter-tables.sql
database/004-providers-employers.sql
database/005-placements-welfare-checks.sql
database/006-alter-candidates-jobs.sql
database/007-demo-australia.sql
database/008-vacancy-type.sql          ← adds vacancy_type, staff_working_status
```

---

## Architecture Notes

| Layer | Detail |
|-------|--------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS, deployed on Railway |
| Backend | Node.js + Express.js REST API, deployed on Railway |
| Database | PostgreSQL hosted on Railway (internal URL) |
| Auth | JWT — 8-hour expiry, stored in localStorage |
| Email | Nodemailer — sends placement confirmation and welfare check emails |
| File Upload | Multer — stored on disk in `/uploads/candidates/<id>/` |
| AI | Claude API (`claude-opus-4-6`) — job description generation, title suggestions, candidate screening |

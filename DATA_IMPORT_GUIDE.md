# 📦 Client Data Import & Deployment Guide

> **Purpose:** This document explains how to clean sample data, import real client data, and verify the database before go-live.

---

## 📁 Data Files Location

All import files live in:
```
/Users/deeproot/data/21MARCH2026/my-ats-platform/data/
```

| File | Description |
| :--- | :--- |
| `candidates_import_completed.xlsx` | 2,873 real candidate records |
| `employers_import_template.xlsx` | Real employer (company) data |
| `vacancies_import_template.xlsx` | Real vacancy/job listings |
| `placements added.xlsx` | Real active placement records |

**CSV Templates (for collecting new client data):**
```
/csv-templates/
  candidates_import_template.csv
  employers_import_template.csv
  vacancies_import_template.csv
  placements_import_template.csv
  training_providers_import_template.csv
```

---

## ⚠️ Current Status (Dev / Staging)

> All data currently in the database is **sample/test data** used for development and testing.
> On go-live, this must be removed and replaced with real client data.

| Table | Current Count | Status |
| :--- | :---: | :--- |
| Candidates | ~100 | ⚠️ Sample + partial real (JS-059 to JS-111) |
| Employers | ~18 | ⚠️ Mix of sample + real |
| Vacancies | ~21 | ⚠️ Mix of sample + real |
| Placements | ~26 | ⚠️ Mix of sample + real |
| Providers | ~17 | ⚠️ Mix of sample + real |
| Users | ~6 | ⚠️ Test accounts only |

---

## 🚀 Go-Live Import Order

> [!IMPORTANT]
> Follow this exact order. Each step depends on the previous one due to foreign key constraints.

```
Step 1 — BACKUP DATABASE
Step 2 — CLEAN all sample data
Step 3 — PROVIDERS    (training providers: AMES, WISE, Jobfind...)
Step 4 — EMPLOYERS    (companies: Langham Hotels, OracleCMS...)
Step 5 — CONSULTANTS  (staff linked to providers — optional)
Step 6 — VACANCIES    (open job positions)
Step 7 — CANDIDATES   (all 2,873 real records)
Step 8 — PLACEMENTS   (link placed candidates to jobs)
Step 9 — VERIFY       (check all data is correct)
```

---

## Step 1 — Backup Database

Before doing anything on production, take a full backup:

```bash
# Using Railway CLI or pg_dump:
pg_dump "postgresql://postgres:<PASSWORD>@kodama.proxy.rlwy.net:56435/railway" \
  --no-owner --no-acl \
  -f backup_$(date +%Y%m%d_%H%M%S).sql

echo "Backup complete ✅"
```

---

## Step 2 — Clean Sample Data

> [!CAUTION]
> This permanently deletes ALL current data. Only run after a confirmed backup.

```sql
-- Run in this order to respect foreign key constraints

-- 1. Remove placements and applications
DELETE FROM placements;
DELETE FROM applications;

-- 2. Remove candidate documents
DELETE FROM candidate_documents;

-- 3. Remove candidates
DELETE FROM candidates;

-- 4. Remove vacancies / jobs
DELETE FROM jobs;

-- 5. Remove employers
DELETE FROM employers;

-- 6. Remove consultants and providers
DELETE FROM consultants;
DELETE FROM providers;

-- 7. Remove test users (keep real admin only)
DELETE FROM users
WHERE email NOT IN (
  'admin@myats.dev',
  'your-real-admin@clientemail.com'  -- ← update this
);

-- 8. Reset candidate SR number sequence back to 1
SELECT setval('candidate_sr_seq', 1, false);

-- Verify cleanup
SELECT 'candidates' AS tbl, count(*) FROM candidates
UNION ALL SELECT 'employers', count(*) FROM employers
UNION ALL SELECT 'jobs', count(*) FROM jobs
UNION ALL SELECT 'placements', count(*) FROM placements
UNION ALL SELECT 'providers', count(*) FROM providers;
```

---

## Step 3 — Import Providers

Add all training providers (AMES, WISE, Jobfind etc.) via the ATS admin UI:

```
Admin → Providers → + Add Provider
```

Or use the import script (to be built):
```bash
node packages/backend/scripts/import-providers.js \
  --file data/real_providers.xlsx
```

---

## Step 4 — Import Employers

```bash
node packages/backend/scripts/import-all.js
```

This reads from:
```
data/employers_import_template.xlsx
```

Expected output:
```
✅ INSERT | Langham Hotels | Room Attendant | Michelle McIntosh
✅ INSERT | OracleCMS | Customer Service | Flyn Eisner
✅ INSERT | CP Recruitment | Warehousing and Logistics | Daniele Marrocco
...
Employers: X inserted | Y skipped
```

---

## Step 5 — Import Vacancies (Jobs)

```bash
node packages/backend/scripts/import-all.js
```

This reads from:
```
data/vacancies_import_template.xlsx
```

Vacancies are automatically linked to employers imported in Step 4.

---

## Step 6 — Import Candidates

The candidates file has **2,873 real records**. Import all at once:

```bash
# Import all candidates
npm run import:candidates
```

Or in batches (safer for large datasets):
```bash
# First 500
npm run import:candidates -- --limit 500

# Next 500
npm run import:candidates -- --offset 500 --limit 500

# And so on...
```

**Dry-run first (no data written):**
```bash
npm run import:candidates -- --dry-run --limit 50
```

**What the script does automatically:**
- ✅ Skips blank/empty rows
- ✅ Detects duplicate emails and names — skips safely
- ✅ Normalises phone numbers (adds leading `0` if missing)
- ✅ Converts `car`, `police_check`, `wwc` to `yes/no`
- ✅ Auto-assigns SR numbers (`JS-001`, `JS-002` etc.)
- ✅ Resolves or creates providers by name
- ✅ Handles candidates without email address

---

## Step 7 — Import Placements

```bash
node packages/backend/scripts/import-all.js
```

This reads from:
```
data/placements added.xlsx
```

> [!IMPORTANT]
> Placements are linked by **candidate SR number** (e.g. `JS-001`) or **full name**.
> Make sure the placement file uses the correct SR numbers assigned in Step 6.

---

## Step 8 — Verify All Data

Run the verification script to compare files vs database:

```bash
node packages/backend/scripts/verify-db.js
```

Then check manually in the ATS UI:

- [ ] **Candidates** — correct count, names, providers, SR numbers
- [ ] **Providers** — all providers listed correctly
- [ ] **Employers** — all companies showing
- [ ] **Vacancies** — all open positions visible
- [ ] **Placements** — active placements showing correct candidates
- [ ] **Search** — candidate search and filter works
- [ ] **Email** — broadcast email to providers works
- [ ] **Login** — admin login with real credentials works

---

## 🛠️ Available Import Scripts

All scripts are in `packages/backend/scripts/`:

| Script | Command | Purpose | Status |
| :--- | :--- | :--- | :---: |
| `import-candidates.js` | `npm run import:candidates` | Import candidates from Excel | ✅ Ready |
| `import-all.js` | `node scripts/import-all.js` | Import employers, vacancies, placements | ✅ Ready |
| `verify-db.js` | `node scripts/verify-db.js` | Compare data files vs database | ✅ Ready |
| `link-placements.js` | `node scripts/link-placements.js` | Link placements to specific candidates | ✅ Ready |
| `import-providers.js` | `node scripts/import-providers.js` | Import training providers | 🔲 To build |
| `import-consultants.js` | `node scripts/import-consultants.js` | Import consultants | 🔲 To build |

---

## 📋 Data Checklist — What to Collect from Client

Before go-live, obtain the following real data files from the client:

- [ ] Full list of **training providers** with contact details
- [ ] Full list of **employers** (companies) with contacts
- [ ] Current **open vacancies** with employer names
- [ ] Complete **candidate database** (confirm `candidates_import_completed.xlsx` is final)
- [ ] Current **active placements** with correct candidate SR numbers and start dates
- [ ] Real **admin user email and name** for production login
- [ ] Client's **custom email templates** for broadcasts (if different from defaults)

---

## 🔐 Production Environment Variables

Confirm these are set in Railway before go-live:

```env
DATABASE_URL=postgresql://...         # Railway PostgreSQL connection
JWT_SECRET=...                        # Secure random string (64+ chars)
ANTHROPIC_API_KEY=...                 # Claude AI API key
AZURE_CLIENT_ID=...                   # Microsoft OAuth (for provider login)
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=common
MS_REDIRECT_URI=https://your-domain.com/api/ms-auth/callback
TOKEN_ENCRYPTION_KEY=...              # 64-char hex key
UPLOAD_DIR=/uploads                   # Railway volume path
```

---

## 🗓️ Go-Live Day Runsheet

| Time | Action | Owner |
| :--- | :--- | :--- |
| T-1 day | Take DB backup | Developer |
| T-1 day | Test all import scripts on staging | Developer |
| T-1 day | Confirm all real data files are ready | Client |
| Go-Live | Run cleanup SQL | Developer |
| Go-Live | Import providers → employers → vacancies | Developer |
| Go-Live | Import all candidates | Developer |
| Go-Live | Import placements | Developer |
| Go-Live | Run verify-db.js | Developer |
| Go-Live | Client spot-checks data in UI | Client + Developer |
| Go-Live | Create real admin user login | Developer |
| Go-Live + 1hr | Hand over to client ✅ | Developer |

---

*Last updated: October 2026*
*Project: My ATS Platform — `my-ats-platform`*

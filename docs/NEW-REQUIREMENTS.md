# New Requirements — Recruitment Portal Scope

Derived from: `docs/Scope for Recruitment Portal.pdf`
Date added: 2026-03-22

---

## Overview

The PDF scope describes a **workforce placement agency** system — a staffing agency that:
- Manages **Providers** (organisations that refer candidates)
- Works with **Employers** (companies offering jobs)
- Tracks **Placements** (candidate placed in a job with a start date)
- Runs **welfare checks** after placement to confirm employment is ongoing

This extends the current corporate ATS with agency-specific workflows.

---

## Status Key

| Symbol | Meaning |
|---|---|
| ✅ | Already built |
| 🔨 | Partially built — needs extension |
| ❌ | Not built — new work required |

---

## 1. Authentication & Roles

| Requirement | Status | Notes |
|---|---|---|
| Super Admin login | ✅ | `admin` role exists |
| Staff logins | ✅ | `recruiter`, `recruiter_admin`, `hiring_manager` roles exist |
| Provider-level login | ❌ | New role needed: `provider` — can only see their own candidates |

---

## 2. Candidate Details

| Requirement | Status | Notes |
|---|---|---|
| Name / Email / Phone | ✅ | In `candidates` table |
| Address (full) | 🔨 | Only `city` / `state` stored — need `address_line1`, `address_line2`, `postcode`, `country` |
| Provider association | ❌ | `provider_id` FK needed on candidates |
| Interested Job | ❌ | New field or table: candidate job preferences/interests before applying |
| Benchmark hours | ❌ | New field: `benchmark_hours` (integer) on candidates |
| WS (Work Status) | ❌ | New field: `work_status` enum — e.g. `job_seeking`, `employed`, `placed`, `inactive` |
| CV upload | 🔨 | Multer is configured but no CV upload UI on candidate profile |
| Other document upload | ❌ | Support multiple document types (CV, ID, certificates) |

---

## 3. Provider Module

Providers are organisations (e.g. job agencies, training providers) that manage a pool of candidates.

| Requirement | Status | Notes |
|---|---|---|
| Provider entity (CRUD) | ❌ | New `providers` table: `id`, `name`, `contact_name`, `email`, `phone`, `address`, `created_at` |
| Candidate pool per provider | ❌ | Filter candidates by `provider_id` |
| Candidates stats per provider | ❌ | Count by stage, placement rate, active candidates |
| Provider dashboard/view | ❌ | Dedicated provider summary page |

### Proposed `providers` table
```sql
CREATE TABLE providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email        VARCHAR(255),
  phone        VARCHAR(50),
  address      TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Vacancy Details

| Requirement | Status | Notes |
|---|---|---|
| Type of Vacancy | ✅ | `job_type`: full_time, part_time, contract, internship |
| No. of Positions | ❌ | New field: `positions_count` (integer, default 1) on `jobs` |
| End Date | ✅ | `deadline` field on `jobs` |
| Link to external Job Board | ❌ | New field: `job_board_url` (text) on `jobs` |
| Staff Working Status | ❌ | Visibility of which staff member is actively working on the vacancy |

---

## 5. Employer Details

Employers are the companies offering jobs — separate from internal departments.

| Requirement | Status | Notes |
|---|---|---|
| Employer entity (CRUD) | ❌ | New `employers` table |
| General details | ❌ | Name, industry, website, description |
| Contact details | ❌ | Contact name, email, phone |
| No. of vacancies | ❌ | Count of open jobs linked to employer |
| Type of vacancies | ❌ | Aggregated job types per employer |
| Link jobs to employer | ❌ | `employer_id` FK on `jobs` table |

### Proposed `employers` table
```sql
CREATE TABLE employers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  industry      VARCHAR(255),
  website       VARCHAR(500),
  description   TEXT,
  contact_name  VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address       TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Placement Details

A placement is when a candidate is confirmed for a job with a defined start date.

| Requirement | Status | Notes |
|---|---|---|
| One-click add candidate to job | ✅ | Assign Talent dialog exists |
| Job start date on placement | ❌ | New field: `start_date` on `applications` (or new `placements` table) |
| Employment confirmation email to employer | ❌ | Triggered when stage = `hired` + start date set |
| Post-placement tracking from start date | ❌ | Timeline of welfare check milestones |
| Welfare check indicators / notifications | ❌ | Scheduled reminders at day 1, week 1, month 1, month 3, month 6 |
| Automated welfare check email to employer | ❌ | Email template sent at each milestone for confirmation |

### Proposed `placements` table
```sql
CREATE TABLE placements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id      UUID NOT NULL REFERENCES candidates(id),
  job_id            UUID NOT NULL REFERENCES jobs(id),
  employer_id       UUID REFERENCES employers(id),
  start_date        DATE NOT NULL,
  confirmed_by_employer BOOLEAN DEFAULT false,
  confirmation_sent_at  TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE welfare_checks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id   UUID NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  check_type     VARCHAR(50) NOT NULL,  -- 'day_1', 'week_1', 'month_1', 'month_3', 'month_6'
  due_date       DATE NOT NULL,
  completed_at   TIMESTAMPTZ,
  employer_response TEXT,
  email_sent_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Reports

| Requirement | Status | Notes |
|---|---|---|
| Provider-wise report | ❌ | Candidates per provider, placement rate, active/inactive breakdown |
| Placement tracking report | ❌ | All placements with start dates, welfare check status, employer confirmation |
| Staff-wise report | ❌ | Jobs and placements managed per staff member (recruiter) |

---

## Implementation Roadmap

### Phase 1 — Data Model (Database)
- [ ] Add `providers` table
- [ ] Add `employers` table
- [ ] Add `placements` table
- [ ] Add `welfare_checks` table
- [ ] Alter `candidates`: add `provider_id`, `address_line1`, `address_line2`, `postcode`, `benchmark_hours`, `work_status`, `interested_job`
- [ ] Alter `jobs`: add `employer_id`, `positions_count`, `job_board_url`

### Phase 2 — Backend API
- [ ] `GET/POST/PUT/DELETE /api/providers`
- [ ] `GET/POST/PUT/DELETE /api/employers`
- [ ] `GET/POST/PUT/DELETE /api/placements`
- [ ] `GET /api/placements/:id/welfare-checks`
- [ ] `PATCH /api/welfare-checks/:id` (mark complete)
- [ ] `POST /api/placements/:id/send-confirmation` (trigger confirmation email)
- [ ] `GET /api/reports/providers`
- [ ] `GET /api/reports/placements`
- [ ] `GET /api/reports/staff`
- [ ] Extend candidate routes to support document upload (CV, ID, etc.)

### Phase 3 — Frontend
- [ ] Providers list & detail page (CRUD)
- [ ] Employers list & detail page (CRUD)
- [ ] Candidate profile: address fields, work status, benchmark hours, CV/doc upload
- [ ] Placements page: list all placements with start dates
- [ ] Placement detail: welfare check timeline with status indicators
- [ ] Job creation: employer selector, positions count, job board URL
- [ ] Reports page: provider-wise, placement tracking, staff-wise tabs

### Phase 4 — Notifications & Email
- [ ] Email service (Nodemailer or similar)
- [ ] Employment confirmation email template (to employer on placement)
- [ ] Welfare check email templates (day 1 / week 1 / month 1 / month 3 / month 6)
- [ ] Scheduled job to check due welfare checks and send emails (cron)

---

## Open Questions

1. **WS** — does this mean "Work Status" or "Work Search" or something else? Needs clarification.
2. **Benchmark hours** — is this minimum contracted hours per week, or a target placement hours figure?
3. **Provider login** — should providers log in and see only their own candidates, or is this staff-only with a filter?
4. **Email service** — which provider? (SendGrid, SES, SMTP/Nodemailer)
5. **Welfare check schedule** — are the milestones (day 1, week 1, etc.) fixed or configurable per placement?

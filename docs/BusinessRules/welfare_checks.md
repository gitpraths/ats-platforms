# Welfare Checks — Business Rules & Requirements

**Applicable to:** Disability Employment Services (DES) / Employment Service Providers
**Regulation:** Australian Government employment services funding compliance
**Last updated:** April 2026

---

## 1. What Are Welfare Checks?

Welfare checks are mandatory follow-up contacts made by an employment service provider after a candidate has been placed into a job. They serve two purposes:

1. **Candidate welfare** — ensure the candidate is settling in, has support if needed, and remains employed
2. **Compliance & funding** — providers must demonstrate sustained employment at each milestone to receive their full placement fee from the funding body

Welfare checks are **not optional**. Missing a check or failing to record it can result in loss of funding payment for that milestone.

---

## 2. The 5 Milestones

Every placement automatically generates 5 welfare check records, calculated from the candidate's **start date**:

| Milestone | `check_type` | Due Date Formula       | Purpose                                              |
|-----------|-------------|------------------------|------------------------------------------------------|
| Day 1     | `day_1`     | start_date + 1 day     | Confirm candidate attended. Identify any first-day issues. |
| Week 1    | `week_1`    | start_date + 7 days    | Check settling-in period. Address any early concerns. |
| Month 1   | `month_1`   | start_date + 30 days   | Confirm ongoing employment. Note performance or support needs. |
| Month 3   | `month_3`   | start_date + 90 days   | Sustained employment check. Triggers first funding milestone. |
| Month 6   | `month_6`   | start_date + 180 days  | Long-term sustainability check. Triggers final funding milestone. |

---

## 3. Welfare Check Statuses

Each welfare check is in one of three states at any point in time:

| Status      | Condition                                        | Visual Indicator |
|-------------|--------------------------------------------------|------------------|
| **Pending** | Due date is in the future, not completed         | Grey dot ⬜       |
| **Overdue** | Due date has passed, not completed               | Yellow dot 🟡    |
| **Completed**| `completed_at` timestamp is set                 | Green dot 🟢     |

---

## 4. Who Is Responsible?

| Role              | Responsibility                                                       |
|-------------------|----------------------------------------------------------------------|
| **Recruiter**     | Creates the placement, monitors welfare check timeline               |
| **Provider user** | Views checks for their own candidates, contacts employer             |
| **Admin**         | Full visibility across all placements, can mark any check complete   |

> Provider users (e.g. Rachel at MAX Employment) can only see welfare checks for candidates assigned to their own organisation.

---

## 5. Completing a Welfare Check

A welfare check is marked complete when a staff member or provider:

1. Contacts the employer (or candidate) to confirm ongoing employment
2. Records the employer's response/notes in the system
3. Clicks **Mark Complete** on the welfare check

**Rules:**
- A welfare check **cannot be un-completed** once marked done — this protects audit integrity
- The system records **who** completed it and **when** (`completed_at` timestamp)
- An optional **employer response** field captures what was said

---

## 6. Email Notifications

The system sends email reminders automatically and manually:

### Automated (Daily Cron — 8:00am)
- Runs every day at 08:00 server time
- Finds all checks where:
  - `due_date <= today`
  - `completed_at IS NULL` (not yet done)
  - `email_sent_at IS NULL` (not already notified)
- Sends a reminder email and sets `email_sent_at = NOW()`
- Controlled by `WELFARE_CRON_ENABLED=true` in environment config

### Manual (Per Check)
- Any authorised user can click **Send Email** on a specific welfare check
- Useful for resending a reminder or notifying a different contact

### Placement Confirmation Email
- Sent to the employer when a placement is created
- Asks the employer to confirm they have received the candidate
- Sets `confirmed_by_employer = true` once acknowledged

---

## 7. Dashboard & Alerts

### Overdue Alert Banner
- Appears at the top of the Dashboard whenever any welfare check is overdue
- Shows the count of overdue checks
- Links directly to the Placements page
- Disappears automatically once all overdue checks are completed

### Placement Summary Panel
- Shows total overdue welfare checks highlighted in amber
- Visible to all admin and recruiter roles

---

## 8. Placements List — Welfare Dots

Every row in the Placements list shows 5 coloured dots representing the 5 milestones:

```
● ● ● ○ ○
```

| Dot Colour | Meaning              |
|------------|----------------------|
| 🟢 Green   | Completed            |
| 🟡 Yellow  | Overdue              |
| ⬜ Grey    | Pending (not due yet)|

Hover over any dot to see the milestone name, due date, and status.

---

## 9. Example — Full Lifecycle

**Scenario:** Marcus Williams is placed at DHL Supply Chain on 20 January 2026.

```
Placement created: 2026-01-20
├── Day 1 check     due: 2026-01-21  ✅ Completed 2026-01-21
│                                       "Marcus settled in well. Forklift operations on point."
├── Week 1 check    due: 2026-01-27  ✅ Completed 2026-01-27
│                                       "Excellent first week. Productive and punctual."
├── Month 1 check   due: 2026-02-20  ✅ Completed 2026-02-21
│                                       "Marcus is a valued team member. We want to keep him on."
├── Month 3 check   due: 2026-04-20  🟡 Overdue — action required
└── Month 6 check   due: 2026-07-20  ⬜ Pending
```

On **20 April 2026**, the system detects the Month 3 check is overdue. At 8:00am it sends an automated email to the assigned provider (Rachel at MAX Employment). The alert banner appears on the Dashboard for all admin users. Rachel calls DHL, confirms Marcus is still employed, and marks the check complete with notes.

---

## 10. Reporting

Welfare check data appears in two report views under `/reports`:

### Placement Details Report
- Lists every placement with welfare dot indicators per row
- Filterable by date range
- Exportable to CSV for funding body submissions

### Provider Performance Report
- Shows placement rate per provider
- Indirectly reflects welfare check compliance through sustained placement counts

---

## 11. Business Rules Summary

| Rule | Detail |
|------|--------|
| Auto-generation | 5 welfare checks created automatically on placement creation |
| Due date calculation | Calculated from `start_date` — cannot be manually set |
| Completion is final | Once marked complete, cannot be reversed |
| One email per check | Automated cron sends at most one email per check (idempotent) |
| Provider scoping | Providers only see checks for their own candidates |
| Admin override | Admins can complete any check regardless of ownership |
| Start date change | If placement `start_date` is updated, welfare check due dates recalculate |
| Overdue definition | `due_date <= today AND completed_at IS NULL` |

---

## 12. Database Reference

**Table:** `welfare_checks`

| Column            | Type        | Description                                  |
|-------------------|-------------|----------------------------------------------|
| `id`              | UUID        | Primary key                                  |
| `placement_id`    | UUID FK     | Links to `placements.id`                     |
| `check_type`      | VARCHAR     | `day_1`, `week_1`, `month_1`, `month_3`, `month_6` |
| `due_date`        | DATE        | Calculated from placement start_date         |
| `completed_at`    | TIMESTAMPTZ | Set when marked complete (NULL = incomplete) |
| `employer_response`| TEXT       | Notes recorded at completion                 |
| `email_sent_at`   | TIMESTAMPTZ | Set when automated/manual email sent         |
| `notified_user_id`| UUID FK     | User who was notified                        |
| `created_at`      | TIMESTAMPTZ | Record creation timestamp                    |

**Key indexes:**
- `idx_welfare_checks_due_date` — supports efficient cron queries
- `idx_welfare_checks_placement` — supports placement detail lookups

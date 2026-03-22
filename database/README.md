# Database Setup

## Execution Order

Run files in this order:

```bash
psql -d your_db -f 000-drop-tables.sql   # optional — wipes all data
psql -d your_db -f 001-create-tables.sql  # create base schema
psql -d your_db -f 003-alter-tables.sql   # add extended columns + job_recruiter + job_activity
psql -d your_db -f 002-seed-data.sql      # insert demo data
```

Or as a single command:

```bash
psql -d your_db \
  -f 001-create-tables.sql \
  -f 003-alter-tables.sql \
  -f 002-seed-data.sql
```

## Reset & Reseed

```bash
psql -d your_db \
  -f 000-drop-tables.sql \
  -f 001-create-tables.sql \
  -f 003-alter-tables.sql \
  -f 002-seed-data.sql
```

## Demo Credentials

All seed users share the same password: **`password123`**

| Name              | Email                  | Role             |
|-------------------|------------------------|------------------|
| Alex Admin        | admin@myats.dev        | admin            |
| Jane Recruiter    | jane@myats.dev         | recruiter        |
| Mark Spencer      | mark@myats.dev         | recruiter        |
| Sarah Talent      | sarah@myats.dev        | recruiter_admin  |
| Tom HiringManager | tom@myats.dev          | hiring_manager   |

## What the seed data includes

- **5 users** across all roles
- **6 departments** — Engineering, Design, Product, Marketing, Sales, HR
- **5 locations** — San Francisco, New York, Austin, Chicago, Remote
- **10 jobs** — mix of published (6), draft (2), archived (1), contract (1)
- **15 candidates** with contact details and notes
- **17 applications** across all pipeline stages (applied → screening → interview → offer → hired → rejected)
- **Job recruiter assignments** on 7 jobs
- **Job activity history** showing status changes with comments

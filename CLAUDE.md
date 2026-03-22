# CLAUDE.md — My ATS Platform

This file provides Claude Code with context, conventions, and instructions for this project.
Claude should read this file at the start of every session before making any changes.

---

## Project Overview

**Name:** My ATS Platform
**Type:** Applicant Tracking System (ATS) — Full-stack web application
**Purpose:** Manage job postings, candidates, applications, and hiring pipelines
**AI Feature:** Claude API powers job description suggestions and candidate screening hints

---

## Architecture

```
my-ats-platform/              ← monorepo root
├── CLAUDE.md                 ← YOU ARE HERE — read this first
├── package.json              ← npm workspaces root
├── docker-compose.yaml       ← PostgreSQL local dev
├── .env.example              ← environment variable template
├── packages/
│   ├── backend/              ← Express.js REST API (Node.js)
│   │   ├── src/
│   │   │   ├── routes/       ← API route handlers
│   │   │   ├── services/     ← business logic (auth, ai, upload, etc.)
│   │   │   ├── middleware/   ← auth guard, error handler, logger
│   │   │   ├── config/       ← db, jwt, aws, ai config
│   │   │   └── utils/        ← helpers
│   │   ├── tests/            ← Jest tests
│   │   └── package.json
│   └── frontend/             ← React 18 + TypeScript + Vite
│       ├── src/
│       │   ├── pages/        ← route-level page components
│       │   ├── components/   ← reusable UI components (shadcn/ui)
│       │   ├── contexts/     ← React contexts (Auth, Session)
│       │   ├── hooks/        ← custom React hooks
│       │   ├── types/        ← TypeScript interfaces
│       │   └── lib/          ← API client, utils
│       └── package.json
└── database/
    ├── 001-create-tables.sql ← schema
    └── 002-seed-data.sql     ← dev seed data
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| State | TanStack React Query, React Hook Form, Zod |
| Routing | React Router v6 |
| Drag & Drop | @hello-pangea/dnd (Hiring Board Kanban) |
| Backend | Node.js, Express.js |
| Auth | JWT (jsonwebtoken + bcrypt) — no SSO, no third-party auth |
| Database | PostgreSQL (via `pg` driver) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| File Upload | Multer + local disk (or S3) |
| Logging | Winston |
| Testing | Jest + Supertest (backend), Vitest (frontend) |
| Dev Infra | Docker Compose (PostgreSQL), PM2 (process manager) |

---

## Environment Variables

All secrets are in `.env` files (never committed). See `.env.example` for the full list.

Key variables:
```
# Database
DATABASE_URL=postgresql://ats_user:ats_pass@localhost:5432/ats_db

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=8h

# Anthropic Claude API
ANTHROPIC_API_KEY=your-anthropic-api-key

# App
PORT=3001
NODE_ENV=development
```

---

## Claude AI Integration

The AI service lives at `packages/backend/src/services/ai.js`.

**Model to use:** `claude-opus-4-6` (latest capable model as of 2026-03)

**Features powered by Claude:**
1. **Job Description Generator** — given a job title + department, returns a full job description
2. **Job Title Suggestions** — suggests related/alternative job titles
3. **Candidate Screening Notes** — summarizes candidate profile fit for a role

**Usage pattern:**
```javascript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model: "claude-opus-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }]
});
return response.content[0].text;
```

**API Routes for AI:**
- `POST /api/ai/job-description` — generate job description
- `POST /api/ai/job-titles` — suggest job titles
- `POST /api/ai/screen-candidate` — screen candidate notes

---

## Database Schema (PostgreSQL)

Core tables:
- `users` — platform users (recruiters, hiring managers, admins)
- `jobs` — job postings
- `candidates` — candidate profiles
- `applications` — job application records (links jobs ↔ candidates)
- `departments` — company departments
- `locations` — office/remote locations
- `activity_log` — audit trail for all entity changes

Hiring pipeline stages (stored in `applications.stage`):
```
applied → screening → interview → offer → hired | rejected
```

---

## API Conventions

- All routes prefixed with `/api`
- Authentication via `Authorization: Bearer <token>` header
- Responses always follow this shape:
  ```json
  { "success": true, "data": {...} }
  { "success": false, "error": "message" }
  ```
- Use HTTP status codes correctly (200, 201, 400, 401, 403, 404, 500)
- Paginated list endpoints accept `?page=1&limit=20`

---

## Frontend Conventions

- All API calls go through `src/lib/api.ts` (axios or fetch wrapper)
- Pages live in `src/pages/`, components in `src/components/`
- Use shadcn/ui components — do not write raw HTML for UI elements
- Forms use React Hook Form + Zod schema validation
- Server state managed by TanStack React Query
- Use TypeScript strictly — no `any` types

---

## Code Style

- **JavaScript (backend):** ES modules (`import/export`), async/await, no callbacks
- **TypeScript (frontend):** strict mode on, explicit return types on functions
- **Naming:** camelCase variables/functions, PascalCase components/types, kebab-case files
- **No ADP references:** Do not reference Nexo, SiteMinder, Asimov, ADP OAuth, or Brightjump anywhere
- **No hardcoded secrets** — always use `process.env`

---

## Running Locally

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Run DB migrations + seed
psql $DATABASE_URL -f database/001-create-tables.sql
psql $DATABASE_URL -f database/003-alter-tables.sql
psql $DATABASE_URL -f database/002-seed-data.sql

# 3. Install dependencies
npm install

# 4. Start all services
npm run dev
# OR with PM2:
npx pm2 start pm2.config.js
```

Frontend runs on: http://localhost:5173
Backend runs on: http://localhost:3001
API docs (Swagger): http://localhost:3001/api-docs

---

## Testing

```bash
# Backend tests
cd packages/backend && npm test

# Frontend tests
cd packages/frontend && npm test

# Run all
npm test --workspaces
```

---

## What NOT to do

- Do not add SiteMinder, ADP, Nexo, or any ADP-specific integrations
- Do not commit `.env` files
- Do not use `any` in TypeScript
- Do not bypass JWT middleware on protected routes
- Do not call Claude API from the frontend — always proxy through backend
- Do not hardcode pagination limits lower than 20 or higher than 100

---

## Docs Directory

All business rules and implementation prompts live in `docs/`:

```
docs/
├── BusinessRules/
│   ├── candidates.md        ← Candidate & hiring pipeline rules
│   ├── job_status.md        ← Job status lifecycle rules
│   ├── user_registration.md ← Auth & registration flow
│   └── user_roles.md        ← Role definitions & permissions
└── prompts/
    ├── TODO.md              ← Backlog, bugs, and upcoming features
    └── 0000-0099/
        ├── 0001-backend-init.md
        ├── 0002-backend-auth.md
        ├── 0003-backend-department-api.md
        ├── 0004-backend-location-api.md
        ├── 0005-backend-jobs-api.md
        ├── 0006-backend-job-status-api.md
        ├── 0007-backend-job-recruiter-api.md
        ├── 0008-backend-job-application-api.md
        ├── 0009-backend-ai-job-title-suggestions.md   ← Claude API
        ├── 0010-backend-ai-job-desc-suggestion.md     ← Claude API
        ├── 0011-backend-ai-screen-candidate.md        ← Claude API
        ├── 0012-backend-user-avatar.md
        ├── 0013-backend-user-profile.md
        ├── 0014-backend-search-candidate-api.md
        ├── 0015-frontend-hiring-board.md
        ├── 0016-frontend-ai-job-title-suggestions.md
        ├── 0017-frontend-ai-job-desc-suggestion.md
        ├── 0018-frontend-job-create.md
        ├── 0019-frontend-assign-talent.md
        ├── 0020-frontend-user-profile.md
        └── 0021-frontend-home-dashboard.md
```

**When implementing a feature:** read the relevant prompt file in `docs/prompts/` first.
**Business rules:** always check `docs/BusinessRules/` before writing authorization or validation logic.

---

## Current Status (as of 2026-03-21)

### Backend — Complete
- [x] Auth: JWT login/logout (`routes/auth.js`)
- [x] Session: get current user + token refresh (`routes/session.js`)
- [x] Jobs: full CRUD, status transitions, recruiter assignment, activity log (`routes/jobs.js`)
- [x] Applications: CRUD, stage updates, job_id filter, flat response fields (`routes/applications.js`)
- [x] Candidates: search, full profile with applications (`routes/candidates.js`)
- [x] Users: CRUD, avatar upload/serve with Sharp resize (`routes/users.js`)
- [x] Departments + Locations: CRUD (`routes/departments.js`, `routes/locations.js`)
- [x] AI: job title suggestions, description generation, candidate screening (`routes/ai.js`)
- [x] Stats: dashboard aggregates endpoint (`routes/stats.js`)
- [x] Middleware: requestId, requestLogger, errorHandler, auth guard

### Frontend — Complete
- [x] Login page with email/password form
- [x] Dashboard with live stats, bar chart, pipeline funnel, recent applications
- [x] Jobs list with status badges and application counts
- [x] Job Detail: status change, recruiter list, applications, activity history
- [x] Job Edit page: full field edit form
- [x] 4-step Job Creation wizard: Basics → Description → Requirements → Assignment
- [x] Hiring Board: Kanban drag-and-drop + list view + stage change dialog
- [x] Candidates list: search, card grid
- [x] Candidate Detail: profile + application history across jobs
- [x] User Profile: avatar upload, editable name, account info section
- [x] 404 Not Found page
- [x] Session expiry warning dialog with one-click refresh
- [x] AI: title suggestions, description generation, candidate screening (inline buttons)
- [x] Assign Talent dialog (search candidates + assign to job)
- [x] hooks: `useDashboardStats`, `useRecruiters`
- [x] Centralized `lib/api.ts` fetch wrapper

### Database — Complete
- [x] Base schema (`001-create-tables.sql`)
- [x] Extended columns + `job_recruiter` + `job_activity` tables (`003-alter-tables.sql`)
- [x] Full demo seed data: 5 users, 10 jobs, 15 candidates, 17 applications (`002-seed-data.sql`)

### Infra
- [x] Docker Compose (PostgreSQL)
- [x] PM2 config
- [x] GitHub Actions CI (`/.github/workflows/ci.yml`)
- [x] README.md with full setup + API reference

# Technical Architecture — ATS Platform

**Version:** 1.0
**Date:** April 2026
**Type:** Full-Stack Web Application — Applicant Tracking System (ATS)

---

## 1. System Overview

The ATS Platform is a multi-tenant, role-based recruitment management system purpose-built for Australian Employment Services (DES) providers. It manages the full recruitment lifecycle — from job creation to candidate placement and post-placement welfare checks — with integrated AI assistance powered by Anthropic Claude.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client Browser                    │
│         React 18 + TypeScript + Vite SPA            │
│         http://localhost:5173 (dev)                  │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS / REST JSON
                      ▼
┌─────────────────────────────────────────────────────┐
│               Express.js REST API                    │
│         Node.js 20 + ES Modules                     │
│         http://localhost:3001/api                   │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │  Routes  │  │ Services │  │    Middleware       │ │
│  │ 14 files │  │ auth,ai  │  │ auth, logger, err  │ │
│  └──────────┘  │ email,   │  └───────────────────┘ │
│                │ cron     │                         │
│                └──────────┘                         │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
┌─────────────────┐   ┌──────────────────────────────┐
│   PostgreSQL 16  │   │      External Services        │
│   ats_db         │   │                              │
│   15 tables      │   │  Anthropic Claude API        │
│   Docker/local   │   │  (claude-opus-4-6)           │
└─────────────────┘   │                              │
                       │  Nodemailer / SMTP           │
                       │  (Ethereal in dev)           │
                       └──────────────────────────────┘
```

---

## 2. Technology Stack

### Frontend

| Concern              | Technology                        | Version  |
|----------------------|-----------------------------------|----------|
| Framework            | React                             | 18.3     |
| Language             | TypeScript                        | 5.5      |
| Build Tool           | Vite                              | 8.0      |
| Routing              | React Router                      | v6       |
| Server State         | TanStack React Query              | v5       |
| Forms & Validation   | React Hook Form + Zod             | 7.x / 3.x|
| UI Components        | Radix UI primitives + shadcn/ui   | 2.x      |
| Styling              | TailwindCSS                       | 3.4      |
| Charts               | Recharts                          | 2.x      |
| Drag & Drop          | @hello-pangea/dnd                 | 16.x     |
| Icons                | Lucide React                      | 0.46     |
| Date Utilities       | date-fns                          | 3.x      |
| Testing              | Vitest                            | 4.x      |

### Backend

| Concern              | Technology                        | Version  |
|----------------------|-----------------------------------|----------|
| Runtime              | Node.js                           | 20 LTS   |
| Framework            | Express.js                        | 4.x      |
| Language             | JavaScript (ES Modules)           | ES2022   |
| Authentication       | jsonwebtoken + bcrypt             | 9.x / 6.x|
| Database Driver      | pg (node-postgres)                | 8.x      |
| File Upload          | Multer                            | 1.x      |
| Image Processing     | Sharp                             | 0.34     |
| Email                | Nodemailer                        | 8.x      |
| Scheduled Jobs       | node-cron                         | 4.x      |
| Logging              | Winston                           | 3.x      |
| AI Integration       | @anthropic-ai/sdk                 | 0.27     |
| API Docs             | Swagger UI + swagger-jsdoc        | 5.x      |
| Testing              | Jest + Supertest                  | 29.x     |
| Process Manager      | PM2                               | —        |

### Infrastructure

| Concern              | Technology                        |
|----------------------|-----------------------------------|
| Database             | PostgreSQL 16 (Docker in dev)     |
| Containerisation     | Docker Compose (dev only)         |
| CI/CD                | GitHub Actions                    |
| File Storage         | Local disk (uploads/) or S3       |
| Package Management   | npm workspaces (monorepo)         |

---

## 3. Monorepo Structure

```
my-ats-platform/
├── package.json               ← npm workspaces root
├── pm2.config.js              ← PM2 process definitions
├── docker-compose.yaml        ← PostgreSQL container
├── .env.example               ← environment variable template
├── .github/workflows/ci.yml  ← GitHub Actions CI
│
├── packages/
│   ├── backend/               ← Express.js API
│   │   └── src/
│   │       ├── server.js      ← HTTP server entry point
│   │       ├── app.js         ← Express app, router registration
│   │       ├── routes/        ← 14 route handlers
│   │       ├── services/      ← business logic services
│   │       ├── middleware/    ← auth, logger, error handler
│   │       ├── config/        ← db, jwt, ai config modules
│   │       └── utils/         ← shared helpers
│   │
│   └── frontend/              ← React SPA
│       └── src/
│           ├── main.tsx        ← React entry point
│           ├── App.tsx         ← Router + layout + nav
│           ├── pages/          ← 20+ route-level components
│           ├── components/     ← reusable UI components
│           ├── contexts/       ← AuthContext, SessionContext
│           ├── hooks/          ← custom React hooks
│           ├── types/          ← TypeScript interfaces
│           └── lib/
│               └── api.ts      ← centralised fetch wrapper
│
└── database/
    ├── 001-create-tables.sql  ← base schema
    ├── 002-seed-data.sql      ← dev seed (US data)
    ├── 003-alter-tables.sql   ← extended columns + indexes
    ├── 004-providers-employers.sql
    ├── 005-placements-welfare-checks.sql
    ├── 006-alter-candidates-jobs.sql
    └── 007-demo-australia.sql ← AU demo dataset
```

---

## 4. Database Schema

### Entity-Relationship Overview

```
users ──────────────────────────────────────────────────┐
  │ created_by                                           │
  ▼                                                      │
jobs ──────────────── applications ──── candidates       │
  │  department_id         │                │            │
  │  location_id           │                │ provider_id│
  │  employer_id           │                ▼            │
  │                        │            providers        │
  ▼                        │                             │
departments               ▼                             │
locations             placements ◄── applications        │
employers                 │                             │
                          ▼                             │
                    welfare_checks                      │
                                                        │
activity_log ◄──────────────────────────────────────────┘
candidate_documents ◄── candidates
job_recruiter ◄── jobs + users
```

### Core Tables

| Table                | Purpose                                          | Key Columns |
|----------------------|--------------------------------------------------|-------------|
| `users`              | Platform users (all roles)                       | role, provider_id, avatar_url |
| `jobs`               | Job postings                                     | status, employer_id, positions_count |
| `candidates`         | Candidate profiles                               | provider_id, work_status, benchmark_hours |
| `applications`       | Job ↔ Candidate link                             | stage, score, source |
| `departments`        | Org departments                                  | name |
| `locations`          | Office/remote locations                          | city, state, country, is_remote |
| `providers`          | Employment service organisations                 | is_active, contact_name |
| `employers`          | Hiring businesses                                | industry, is_active |
| `placements`         | Confirmed hires                                  | start_date, confirmed_by_employer |
| `welfare_checks`     | Post-placement follow-ups (5 milestones)         | check_type, due_date, completed_at |
| `candidate_documents`| Uploaded files per candidate                     | document_type, file_path, mime_type |
| `job_recruiter`      | Many-to-many: jobs ↔ assigned recruiters         | job_id, user_id |
| `activity_log`       | Immutable audit trail                            | entity_type, action, metadata (JSONB) |

### Welfare Check Milestones

Each placement automatically generates 5 welfare check records on creation:

| Milestone | `check_type` | Due Date Calculation   |
|-----------|-------------|------------------------|
| Day 1     | `day_1`     | start_date + 1 day     |
| Week 1    | `week_1`    | start_date + 7 days    |
| Month 1   | `month_1`   | start_date + 30 days   |
| Month 3   | `month_3`   | start_date + 90 days   |
| Month 6   | `month_6`   | start_date + 180 days  |

### Application Pipeline Stages

```
applied → screening → interview → offer → hired
                                        ↘ rejected
```

---

## 5. Backend Architecture

### API Layer (`packages/backend/src/`)

**Entry point:** `server.js` → `app.js`

All routes are prefixed with `/api`. Every response follows a consistent envelope:

```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": "message" }
```

### Route Handlers

| File                 | Base Path              | Purpose                                  |
|----------------------|------------------------|------------------------------------------|
| `auth.js`            | `/api/auth`            | Login, logout                            |
| `session.js`         | `/api/session`         | Current user, token refresh              |
| `users.js`           | `/api/users`           | User CRUD, avatar upload                 |
| `jobs.js`            | `/api/jobs`            | Job CRUD, status transitions             |
| `applications.js`    | `/api/applications`    | Application CRUD, stage updates          |
| `candidates.js`      | `/api/candidates`      | Candidate CRUD, documents, search        |
| `departments.js`     | `/api/departments`     | Department CRUD                          |
| `locations.js`       | `/api/locations`       | Location CRUD                            |
| `providers.js`       | `/api/providers`       | Provider CRUD                            |
| `employers.js`       | `/api/employers`       | Employer CRUD                            |
| `placements.js`      | `/api/placements`      | Placements + welfare check actions       |
| `stats.js`           | `/api/stats`           | Dashboard aggregates                     |
| `reports.js`         | `/api/reports`         | Provider / placement / staff reports     |
| `ai.js`              | `/api/ai`              | Claude AI endpoints                      |

### Middleware Stack

```
Request
  │
  ├── requestId        — attaches X-Request-ID to every request
  ├── requestLogger    — Winston logs method, path, status, duration
  ├── cors             — allows frontend origin (CORS_ORIGIN env var)
  ├── express.json()   — body parsing
  ├── requireAuth      — JWT validation (applied per-router)
  ├── requireRole(...) — role-based access control (applied per-route)
  │
Route Handler
  │
  └── errorHandler     — catches all next(err), returns JSON error
```

### Services

| File                   | Responsibility                                         |
|------------------------|--------------------------------------------------------|
| `auth.js`              | Password hashing (bcrypt), JWT sign/verify             |
| `ai.js`                | Anthropic Claude API calls (job desc, titles, screening)|
| `email.js`             | Nodemailer setup, sendEmail, welfare/confirmation mailers|
| `welfare-check-cron.js`| node-cron daily job at 08:00 — emails overdue checks   |

### Authentication & Authorisation

- **Mechanism:** JWT Bearer token (`Authorization: Bearer <token>`)
- **Signing:** HMAC-SHA256 with `JWT_SECRET` env var
- **Expiry:** Configurable (`JWT_EXPIRES_IN`, default 8h)
- **Payload:** `{ id, email, name, role, provider_id }`
- **Refresh:** `POST /api/session/refresh` issues a new token before expiry

**Role hierarchy:**

| Role              | Access Level                                              |
|-------------------|-----------------------------------------------------------|
| `admin`           | Full access to all data and admin settings                |
| `recruiter_admin` | Full recruitment access, no system admin                  |
| `recruiter`       | Own jobs + assigned jobs, candidates, placements          |
| `hiring_manager`  | View-only on jobs and applications                        |
| `provider`        | Own provider's candidates and placements only             |

**Scoping rules:**
- Admins bypass all ownership filters
- Recruiters see only jobs they created or were assigned to
- Provider users see only candidates with `provider_id = their provider`

---

## 6. Frontend Architecture

### Routing Structure (`App.tsx`)

```
/login                    ← public
/dashboard                ← ProtectedRoute (all roles)
/jobs                     ← ProtectedRoute
/jobs/:id                 ← ProtectedRoute
/jobs/:id/edit            ← ProtectedRoute
/hiring-board             ← ProtectedRoute
/candidates               ← ProtectedRoute
/candidates/new           ← ProtectedRoute
/candidates/:id           ← ProtectedRoute
/placements               ← ProtectedRoute
/placements/:id           ← ProtectedRoute
/providers                ← ProtectedRoute
/providers/:id            ← ProtectedRoute
/providers/new            ← AdminRoute
/providers/:id/edit       ← AdminRoute
/employers                ← ProtectedRoute
/employers/:id            ← ProtectedRoute
/employers/new            ← AdminRoute
/employers/:id/edit       ← AdminRoute
/reports                  ← AdminRoute
/admin/users              ← AdminRoute
/admin/departments        ← AdminRoute
/admin/locations          ← AdminRoute
/profile                  ← ProtectedRoute
*                         ← NotFound (404)
```

### State Management

| State Type         | Tool                    | Usage                                  |
|--------------------|-------------------------|----------------------------------------|
| Server state       | TanStack React Query    | All API data fetching and caching      |
| Form state         | React Hook Form + Zod   | All forms with validation              |
| Auth state         | React Context (AuthContext) | User object, login/logout          |
| Session expiry     | React Context (SessionContext) | 15-min warning dialog, refresh  |
| Local UI state     | useState                | Modals, filters, toggles               |

### API Client (`lib/api.ts`)

Single fetch wrapper used by all pages and hooks:

```typescript
api.get<T>(path)           → Promise<T>
api.post<T>(path, body)    → Promise<T>
api.put<T>(path, body)     → Promise<T>
api.patch<T>(path, body)   → Promise<T>
api.delete(path)           → Promise<void>
```

- Automatically attaches `Authorization: Bearer <token>` header
- Reads token from `localStorage`
- Throws on non-2xx responses with the server's `error` message

### Key Components

| Component              | Purpose                                           |
|------------------------|---------------------------------------------------|
| `WelfareCheckDots`     | 5-dot visual indicator for welfare check status   |
| `HiringBoard`          | Kanban drag-and-drop via @hello-pangea/dnd         |
| `SessionWarning`       | Dialog shown 15 min before JWT expiry             |
| `ProtectedRoute`       | Redirects unauthenticated users to /login         |
| `AdminRoute`           | Restricts routes to admin/recruiter_admin roles   |

---

## 7. AI Integration

All AI features are proxied through the backend — the Anthropic API key is never exposed to the browser.

### Endpoints

| Endpoint                    | Input                        | Output                         |
|-----------------------------|------------------------------|--------------------------------|
| `POST /api/ai/job-titles`   | `{ title }`                  | Array of 5 suggested titles    |
| `POST /api/ai/job-description` | `{ title, department }`   | Full job description (markdown)|
| `POST /api/ai/screen-candidate` | `{ candidateId, jobId }` | Screening notes (strengths, gaps, recommendation) |

### Model

- **Model:** `claude-opus-4-6`
- **SDK:** `@anthropic-ai/sdk` v0.27
- **Max tokens:** 1024 per request
- **Pattern:** Single `messages.create()` call per request, no streaming

---

## 8. File Upload

### Candidate Documents

- **Library:** Multer (disk storage)
- **Storage path:** `uploads/candidates/<candidate_id>/<timestamp>-<original_name>`
- **Max file size:** 10 MB
- **Allowed MIME types:** PDF, JPEG, PNG, DOCX, DOC
- **Download:** `GET /api/candidates/:id/documents/:doc_id/download` — streams file with `Content-Disposition: attachment`
- **Image thumbnails for avatars:** Sharp resizes to 256×256 JPEG

---

## 9. Email & Notifications

### Email Service

- **Library:** Nodemailer
- **Development:** Ethereal (fake SMTP — emails captured at ethereal.email, never delivered)
- **Production:** SMTP configured via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- **From address:** `EMAIL_FROM` env var (default: `ATS Platform <noreply@myats.dev>`)

### Email Types

| Trigger                          | Recipient         | Template                        |
|----------------------------------|-------------------|---------------------------------|
| Placement created                | Employer contact  | Placement confirmation request  |
| Welfare check overdue (cron)     | Provider/staff    | Welfare check reminder          |
| Manual welfare email triggered   | Provider/staff    | Individual welfare check email  |

### Welfare Check Cron Job

- **Schedule:** Daily at 08:00 (server local time)
- **Enabled by:** `WELFARE_CRON_ENABLED=true` env var
- **Logic:** Queries all `welfare_checks` where `due_date <= TODAY` AND `completed_at IS NULL` AND `email_sent_at IS NULL`, sends email, marks `email_sent_at = NOW()`
- **Manual trigger:** `POST /api/admin/run-welfare-checks` (admin only)

---

## 10. Security

| Concern                  | Implementation                                              |
|--------------------------|-------------------------------------------------------------|
| Password storage         | bcrypt with cost factor 10                                  |
| API authentication       | JWT Bearer token, validated on every protected route        |
| SQL injection            | Parameterised queries via `pg` — no string interpolation    |
| CORS                     | Restricted to `CORS_ORIGIN` env var only                    |
| File upload safety       | MIME type whitelist, 10MB limit, no executable extensions   |
| Secret management        | All secrets in `.env` files, never committed                |
| AI proxy                 | Anthropic API key only on backend, never in browser         |
| Role enforcement         | `requireRole()` middleware applied per route                |
| Data scoping             | Provider users — DB-level WHERE filter on `provider_id`     |

---

## 11. Logging & Observability

- **Library:** Winston
- **Log format:** JSON in production, coloured text in development
- **Request logging:** Method, path, status code, duration (ms), request ID
- **Error logging:** Stack traces captured in error handler
- **Request IDs:** UUID attached to every request via `X-Request-ID` header for traceability

---

## 12. Development Setup

### Prerequisites

- Node.js 20 LTS
- Docker Desktop (for PostgreSQL)
- npm 10+

### Quick Start

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Run migrations in order
psql $DATABASE_URL -f database/001-create-tables.sql
psql $DATABASE_URL -f database/003-alter-tables.sql
psql $DATABASE_URL -f database/004-providers-employers.sql
psql $DATABASE_URL -f database/005-placements-welfare-checks.sql
psql $DATABASE_URL -f database/006-alter-candidates-jobs.sql
psql $DATABASE_URL -f database/002-seed-data.sql
psql $DATABASE_URL -f database/007-demo-australia.sql

# 3. Install dependencies
npm install

# 4. Start all services
npm run dev
# OR with PM2:
npx pm2 start pm2.config.js
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://ats_user:ats_pass@localhost:5432/ats_db

# Auth
JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=8h

# AI
ANTHROPIC_API_KEY=sk-ant-...

# App
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=5

# Email (leave blank in dev for Ethereal auto-config)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=ATS Platform <noreply@myats.dev>

# Cron
WELFARE_CRON_ENABLED=true
```

---

## 13. CI/CD Pipeline

**GitHub Actions** (`.github/workflows/ci.yml`) runs on every push and PR:

1. Checkout code
2. Set up Node.js 20
3. `npm install` (all workspaces)
4. `npm test --workspaces` — Jest (backend) + Vitest (frontend)
5. `npm run build` — TypeScript compile + Vite production build

---

## 14. Production Deployment Considerations

| Concern               | Recommendation                                              |
|-----------------------|-------------------------------------------------------------|
| Database              | Managed PostgreSQL (AWS RDS, Supabase, or Render)          |
| Backend hosting       | Node.js on Railway, Render, or EC2 with PM2                |
| Frontend hosting      | Vite build → S3 + CloudFront, Vercel, or Netlify           |
| File storage          | Replace local `uploads/` with AWS S3 + presigned URLs      |
| Environment secrets   | AWS Secrets Manager or platform env vars (never in git)    |
| SSL/TLS               | Let's Encrypt via nginx reverse proxy or platform-managed  |
| Database backups      | Automated daily snapshots via managed DB provider          |
| Logging               | Ship Winston logs to CloudWatch, Datadog, or Logtail       |
| Process management    | PM2 cluster mode for multi-core utilisation                |

---

## 15. Key Design Decisions

| Decision                          | Rationale                                                   |
|-----------------------------------|-------------------------------------------------------------|
| No ORM (raw SQL with `pg`)        | Full control over queries, easier optimisation, no N+1 abstraction |
| JWT over sessions                 | Stateless — scales horizontally without shared session store|
| React Query for server state      | Automatic caching, background refresh, stale-while-revalidate|
| Monorepo (npm workspaces)         | Shared types possible, single repo, simpler CI             |
| No SSO / third-party auth         | Simpler deployment, no OAuth provider dependency            |
| AI calls backend-only             | API key security, rate limit control, logging               |
| Welfare checks auto-generated     | Prevents human error in scheduling; compliance requirement  |
| Provider data scoping at DB level | Security enforced at query layer, not just UI               |

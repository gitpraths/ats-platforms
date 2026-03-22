# My ATS Platform

A full-stack **Applicant Tracking System (ATS)** built with Node.js, React, and PostgreSQL. Manage job postings, candidates, applications, and hiring pipelines — with AI-powered features powered by the Claude API.

---

## Features

### Job Management
- Create, edit, publish, and archive job postings
- 4-step creation wizard: Basics → Description → Requirements → Recruiter Assignment
- AI-generated job descriptions and job title suggestions
- Job status lifecycle: `draft → published → archived`
- Full status change history / audit log per job
- Assign multiple recruiters to each job

### Hiring Pipeline
- Kanban-style hiring board with drag-and-drop between stages
- List view alternative for tabular overview
- Pipeline stages: `applied → screening → interview → offer → hired → rejected`
- AI candidate screening — instant fit summary for any applicant

### Candidate Management
- Candidate profiles with contact details, LinkedIn, resume, and notes
- Search and filter candidates by name, email, location
- Full application history per candidate across all jobs

### User Management
- Role-based access: `admin`, `recruiter_admin`, `recruiter`, `hiring_manager`
- Avatar upload with automatic resize (max 1024×1024, stored as WebP)
- Profile page with account info and member since date

### Dashboard
- Live stats: open jobs, active applications, hired this month
- Jobs by status bar chart
- Pipeline funnel visualization
- Recent applications feed

### Authentication
- Email + password login with JWT tokens
- Session expiry warning with one-click refresh
- HTTP-only Bearer token auth on all protected routes

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **UI Components** | shadcn/ui (Radix UI primitives) |
| **State / Data** | TanStack React Query |
| **Routing** | React Router v6 |
| **Drag & Drop** | @hello-pangea/dnd |
| **Charts** | Recharts |
| **Backend** | Node.js, Express.js (ES Modules) |
| **Auth** | JWT (`jsonwebtoken` + `bcrypt`) |
| **Database** | PostgreSQL (via `pg` driver) |
| **AI** | Anthropic Claude API (`@anthropic-ai/sdk`) |
| **File Upload** | Multer + Sharp (local disk) |
| **Dev Infra** | Docker Compose (PostgreSQL), PM2 |

---

## Project Structure

```
my-ats-platform/
├── packages/
│   ├── backend/                  Express.js REST API
│   │   └── src/
│   │       ├── config/db.js      PostgreSQL pool
│   │       ├── middleware/
│   │       │   ├── auth.js       JWT guard (requireAuth, requireRole)
│   │       │   ├── errorHandler.js
│   │       │   ├── requestId.js  Unique request ID per request
│   │       │   └── requestLogger.js
│   │       ├── routes/
│   │       │   ├── auth.js       POST /api/auth/login
│   │       │   ├── session.js    GET /api/session, /api/session/refresh
│   │       │   ├── jobs.js       Jobs CRUD + status + recruiters + activity
│   │       │   ├── applications.js
│   │       │   ├── candidates.js
│   │       │   ├── users.js      Users CRUD + avatar
│   │       │   ├── departments.js
│   │       │   ├── locations.js
│   │       │   ├── ai.js         Claude API routes
│   │       │   └── stats.js      Dashboard aggregates
│   │       ├── services/
│   │       │   ├── auth.js       bcrypt helpers
│   │       │   └── ai.js         Claude API calls
│   │       └── server.js
│   └── frontend/                 React 18 + TypeScript + Vite
│       └── src/
│           ├── pages/
│           │   ├── Dashboard.tsx
│           │   ├── Jobs.tsx
│           │   ├── JobDetail.tsx
│           │   ├── JobEdit.tsx
│           │   ├── HiringBoard.tsx
│           │   ├── Candidates.tsx
│           │   ├── CandidateDetail.tsx
│           │   ├── Profile.tsx
│           │   ├── Login.tsx
│           │   └── NotFound.tsx
│           ├── components/
│           │   ├── CreateJobDialog.tsx     4-step wizard
│           │   ├── AISuggestTitles.tsx
│           │   ├── AIGenerateDescription.tsx
│           │   ├── ScreenCandidateButton.tsx
│           │   ├── AssignTalentDialog.tsx
│           │   ├── SessionExpiringDialog.tsx
│           │   └── SkillsInput.tsx
│           ├── contexts/AuthContext.tsx
│           ├── hooks/
│           │   ├── useDashboardStats.ts
│           │   └── useRecruiters.ts
│           ├── lib/api.ts                  Centralized fetch wrapper
│           └── types/index.ts
├── database/
│   ├── 000-drop-tables.sql
│   ├── 001-create-tables.sql
│   ├── 002-seed-data.sql         Demo data (5 users, 10 jobs, 15 candidates, 17 applications)
│   ├── 003-alter-tables.sql
│   └── README.md
├── docs/
│   ├── BusinessRules/
│   └── prompts/
├── docker-compose.yaml
├── .env.example
├── package.json                  npm workspaces root
└── pm2.config.js
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL) or a running PostgreSQL instance

### 1. Clone and install

```bash
git clone <repo-url>
cd my-ats-platform
npm install
```

### 2. Configure environment

```bash
cp .env.example packages/backend/.env
```

Edit `packages/backend/.env`:

```env
DATABASE_URL=postgresql://ats_user:ats_pass@localhost:5432/ats_db
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=8h
ANTHROPIC_API_KEY=your-anthropic-api-key
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 3. Start PostgreSQL

```bash
docker-compose up -d
```

### 4. Set up the database

```bash
psql $DATABASE_URL -f database/001-create-tables.sql
psql $DATABASE_URL -f database/003-alter-tables.sql
psql $DATABASE_URL -f database/002-seed-data.sql
```

### 5. Start the app

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |

---

## Demo Login Credentials

All seed users share the password: **`password123`**

| Name | Email | Role |
|---|---|---|
| Alex Admin | admin@myats.dev | admin |
| Jane Recruiter | jane@myats.dev | recruiter |
| Mark Spencer | mark@myats.dev | recruiter |
| Sarah Talent | sarah@myats.dev | recruiter_admin |
| Tom HiringManager | tom@myats.dev | hiring_manager |

---

## API Reference

All endpoints require `Authorization: Bearer <token>` except login.

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login with email + password |
| GET | `/api/session` | Get current user session |
| GET | `/api/session/refresh` | Issue a fresh JWT |

### Jobs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/jobs` | List jobs (filter by status, dept, location, title) |
| POST | `/api/jobs` | Create a new job (status defaults to `draft`) |
| GET | `/api/jobs/:id` | Get job by ID |
| PATCH | `/api/jobs/:id` | Update job fields |
| DELETE | `/api/jobs/:id` | Delete job |
| PATCH | `/api/jobs/:id/status` | Change job status + log activity |
| GET | `/api/jobs/:id/activity` | Get job status change history |
| POST | `/api/jobs/:id/recruiters` | Assign recruiters |
| DELETE | `/api/jobs/:id/recruiters` | Remove recruiters |

### Applications
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/applications` | List applications (filter by job_id, candidate, job_title) |
| POST | `/api/applications` | Create an application |
| PATCH | `/api/applications/:id` | Update stage / score / notes |
| DELETE | `/api/applications/:id` | Delete application |

### Candidates
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/candidates` | Search candidates |
| POST | `/api/candidates` | Create candidate |
| GET | `/api/candidates/:id` | Get candidate by ID |
| PATCH | `/api/candidates/:id` | Update candidate |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/me` | Update name |
| GET | `/api/users` | List users (admin/recruiter_admin only) |
| POST | `/api/users` | Create user (admin only) |
| POST | `/api/users/:id/avatar` | Upload avatar image |
| GET | `/api/users/:id/avatar` | Serve avatar image |

### Departments & Locations
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/departments` | List departments |
| POST | `/api/departments` | Create department |
| GET | `/api/locations` | List locations |
| POST | `/api/locations` | Create location |

### AI (Claude API)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/job-titles` | Suggest alternative job titles |
| POST | `/api/ai/job-description` | Generate a job description |
| POST | `/api/ai/screen-candidate` | Screen candidate notes against a job |

### Stats
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stats` | Dashboard aggregates (jobs by status, pipeline counts, hired this month) |

---

## Database Schema

```
users            — platform users (id, name, email, password_hash, role, avatar_url)
departments      — company departments (id, name)
locations        — office/remote locations (id, city, state, country, is_remote)
jobs             — job postings (id, title, status, job_type, work_model, skills, salary, ...)
job_recruiter    — many-to-many: jobs ↔ recruiters
job_activity     — audit log of job status changes
candidates       — candidate profiles (id, name, email, phone, linkedin, notes, city, state)
applications     — job applications (id, job_id, candidate_id, stage, score, source, notes)
activity_log     — general audit log (entity_type, entity_id, action, metadata)
```

### Hiring pipeline stages

```
applied → screening → interview → offer → hired
                                        → rejected
```

### Job status lifecycle

```
draft → published → archived
```

---

## Response Format

All API responses follow this shape:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Human-readable message" }
```

---

## AI Features

Powered by **Anthropic Claude API** (`claude-opus-4-6`). All AI calls are proxied through the backend — the API key is never exposed to the frontend.

| Feature | Where | How |
|---|---|---|
| **Job Title Suggestions** | Job creation wizard (Step 1) | Enter a title → click "Suggest Titles" → pick from AI list |
| **Job Description Generator** | Job creation wizard (Step 2) | Click "Generate with AI" → get a full draft description |
| **Candidate Screening** | Hiring Board cards + list | Click "Screen" → get a fit summary for the candidate against the job |

---

## Scripts

```bash
# Root
npm run dev          # start backend + frontend concurrently
npm run build        # build both packages

# Backend only
cd packages/backend
npm run dev          # nodemon
npm test             # Jest + Supertest

# Frontend only
cd packages/frontend
npm run dev          # Vite dev server
npm run build        # production build
npm test             # Vitest
```

---

## Roles & Permissions

| Action | admin | recruiter_admin | recruiter | hiring_manager |
|---|---|---|---|---|
| Create / delete users | ✅ | — | — | — |
| List all users | ✅ | ✅ | — | — |
| Create / edit jobs | ✅ | ✅ | ✅ | — |
| Assign recruiters | ✅ | ✅ | owner only | — |
| Update application stage | ✅ | ✅ | assigned only | assigned only |
| View dashboard | ✅ | ✅ | ✅ | ✅ |

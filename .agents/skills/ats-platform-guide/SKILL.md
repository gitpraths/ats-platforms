---
name: ats-platform-guide
description: Provides architecture context, code conventions, tech stack details, database schema, and project rules for the My ATS Platform. Activate this skill whenever working on tasks within this project to ensure adherence to established conventions and rules.
---

# ATS Platform Project Guide

This document provides context, conventions, and instructions for the My ATS Platform project.

## Project Overview

**Name:** My ATS Platform
**Type:** Applicant Tracking System (ATS) — Full-stack web application
**Purpose:** Manage job postings, candidates, applications, and hiring pipelines
**AI Feature:** AI API powers job description suggestions and candidate screening hints

## Architecture

```
my-ats-platform/              ← monorepo root
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

## Tech Stack

| Layer       | Technology                                                |
| ----------- | --------------------------------------------------------- |
| Frontend    | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui        |
| State       | TanStack React Query, React Hook Form, Zod                |
| Routing     | React Router v6                                           |
| Drag & Drop | @hello-pangea/dnd (Hiring Board Kanban)                   |
| Backend     | Node.js, Express.js                                       |
| Auth        | JWT (jsonwebtoken + bcrypt) — no SSO, no third-party auth |
| Database    | PostgreSQL (via `pg` driver)                              |
| AI          | Anthropic Claude API (`@anthropic-ai/sdk`) / OpenAI       |
| File Upload | Multer + local disk (or S3)                               |
| Logging     | Winston                                                   |
| Testing     | Jest + Supertest (backend), Vitest (frontend)             |
| Dev Infra   | Docker Compose (PostgreSQL), PM2 (process manager)        |

## Environment Variables

All secrets are in `.env` files (never committed). See `.env.example` for the full list.

Key variables:

```
# Database
DATABASE_URL=postgresql://ats_user:ats_pass@localhost:5432/ats_db

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=8h

# AI API Keys
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key

# App
PORT=3001
NODE_ENV=development
```

## AI Integration

The AI service lives at `packages/backend/src/services/ai.js`.

**Features powered by AI:**

1. **Job Description Generator** — given a job title + department, returns a full job description
2. **Job Title Suggestions** — suggests related/alternative job titles
3. **Candidate Screening Notes** — summarizes candidate profile fit for a role

**API Routes for AI:**

- `POST /api/ai/job-description` — generate job description
- `POST /api/ai/job-titles` — suggest job titles
- `POST /api/ai/screen-candidate` — screen candidate notes

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

## Frontend Conventions

- All API calls go through `src/lib/api.ts` (axios or fetch wrapper)
- Pages live in `src/pages/`, components in `src/components/`
- Use shadcn/ui components — do not write raw HTML for UI elements
- Forms use React Hook Form + Zod schema validation
- Server state managed by TanStack React Query
- Use TypeScript strictly — no `any` types

## Code Style

- **JavaScript (backend):** ES modules (`import/export`), async/await, no callbacks
- **TypeScript (frontend):** strict mode on, explicit return types on functions
- **Naming:** camelCase variables/functions, PascalCase components/types, kebab-case files
- **No ADP references:** Do not reference Nexo, SiteMinder, Asimov, ADP OAuth, or Brightjump anywhere
- **No hardcoded secrets** — always use `process.env`

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

## Testing

```bash
# Backend tests
cd packages/backend && npm test

# Frontend tests
cd packages/frontend && npm test

# Run all
npm test --workspaces
```

## What NOT to do

- Do not commit `.env` files
- Do not use `any` in TypeScript
- Do not bypass JWT middleware on protected routes
- Do not call AI APIs from the frontend — always proxy through backend
- Do not hardcode pagination limits lower than 20 or higher than 100

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
```

**When implementing a feature:** read the relevant prompt file in `docs/prompts/` first.
**Business rules:** always check `docs/BusinessRules/` before writing authorization or validation logic.

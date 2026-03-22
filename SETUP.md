# Setup Guide — My ATS Platform

Step-by-step instructions to get the project running locally from scratch.

---

## Prerequisites

Make sure the following are installed before starting:

| Tool | Version | Check | Install |
|---|---|---|---|
| Node.js | 18+ | `node --version` | https://nodejs.org |
| npm | 9+ | `npm --version` | Comes with Node.js |
| Docker Desktop | any | `docker --version` | https://www.docker.com/products/docker-desktop |
| PostgreSQL client | any | `psql --version` | `brew install postgresql` (Mac) |

> **Docker Desktop must be running** before Step 4.

---

## Step 1 — Navigate to the project

```bash
cd /Users/deeproot/data/21MARCH2026/my-ats-platform
```

---

## Step 2 — Install dependencies

```bash
npm install
```

This installs dependencies for both `packages/backend` and `packages/frontend` in one command using npm workspaces.

---

## Step 3 — Create the environment file

```bash
cp .env.example .env
```

Open `.env` and set the values:

```env
# ── Database ───────────────────────────────────────────────
# Matches docker-compose.yaml — no changes needed for local dev
DATABASE_URL=postgresql://ats_user:ats_pass@localhost:5432/ats_db

# ── Auth ───────────────────────────────────────────────────
# Any long random string (min 32 characters)
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=8h

# ── Anthropic Claude API ────────────────────────────────────
# Required for AI features (job descriptions, title suggestions, screening)
# Get your key at: https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-your-key-here

# ── App ────────────────────────────────────────────────────
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# ── File Upload ────────────────────────────────────────────
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=5
```

> **Never commit** `.env` to git — it is already in `.gitignore`.

---

## Step 4 — Start PostgreSQL

```bash
docker-compose up -d
```

Verify it is running:

```bash
docker ps
```

You should see:

```
CONTAINER ID   IMAGE                PORTS                    NAMES
xxxxxxxxxxxx   postgres:16-alpine   0.0.0.0:5432->5432/tcp   ats_postgres
```

Wait about 5 seconds for the database to be ready before continuing.

---

## Step 5 — Set up the database

Run migrations (creates all tables):

```bash
npm run db:migrate
```

Load demo seed data:

```bash
npm run db:seed
```

Or do both in one command:

```bash
npm run db:reset
```

### What gets created

| Script | What it runs |
|---|---|
| `db:migrate` | `001-create-tables.sql` + `003-alter-tables.sql` |
| `db:seed` | `002-seed-data.sql` |
| `db:reset` | Drop all → migrate → seed |

---

## Step 6 — Start the application

```bash
npm run dev
```

This starts both backend and frontend simultaneously.

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Health check | http://localhost:3001/health |

You should see output like:

```
[backend]  Backend running on http://localhost:3001
[frontend] VITE v5.x.x  ready in xxx ms
[frontend] ➜  Local: http://localhost:5173/
```

---

## Step 7 — Log in

Open http://localhost:5173 in your browser.

All demo accounts use the password: **`password123`**

| Email | Role | What you can do |
|---|---|---|
| `admin@myats.dev` | Admin | Everything — create users, manage all jobs |
| `jane@myats.dev` | Recruiter | Create/edit jobs, manage applications |
| `mark@myats.dev` | Recruiter | Create/edit jobs, manage applications |
| `sarah@myats.dev` | Recruiter Admin | Recruiter + list all users |
| `tom@myats.dev` | Hiring Manager | View jobs, update application stages |

---

## Demo Data Included

After seeding, the app comes pre-loaded with:

| Data | Count |
|---|---|
| Users | 5 (across all roles) |
| Departments | 6 (Engineering, Design, Product, Marketing, Sales, HR) |
| Locations | 5 (San Francisco, New York, Austin, Chicago, Remote) |
| Jobs | 10 (6 published, 2 draft, 1 archived, 1 contract) |
| Candidates | 15 |
| Applications | 17 (spread across all pipeline stages) |

---

## Available Scripts

Run from the project root (`my-ats-platform/`):

```bash
npm run dev          # Start backend + frontend together
npm run build        # Build both packages for production
npm test             # Run all tests (backend Jest + frontend Vitest)
npm run db:migrate   # Create all database tables
npm run db:seed      # Insert demo data
npm run db:reset     # Drop → migrate → seed (full fresh start)
```

---

## Project URLs Summary

| What | URL |
|---|---|
| App (frontend) | http://localhost:5173 |
| API (backend) | http://localhost:3001 |
| Health check | http://localhost:3001/health |
| PostgreSQL | `localhost:5432` / db: `ats_db` / user: `ats_user` / pass: `ats_pass` |

---

## Stopping the App

```bash
# Stop the dev server
Ctrl + C

# Stop PostgreSQL (keeps your data)
docker-compose stop

# Stop PostgreSQL and remove data volume (full wipe)
docker-compose down -v
```

---

## Reset Everything from Scratch

```bash
docker-compose down -v      # wipe the database volume
docker-compose up -d        # start fresh PostgreSQL
npm run db:reset            # recreate schema + reload seed data
npm run dev                 # start the app
```

---

## Troubleshooting

### `psql: command not found`
Install the PostgreSQL client:
```bash
brew install postgresql   # macOS
```

### `Cannot connect to the database`
Make sure Docker is running and the container is up:
```bash
docker-compose up -d
docker ps   # check ats_postgres is listed
```

### `Port 5432 already in use`
A local PostgreSQL service may be running. Stop it:
```bash
brew services stop postgresql   # macOS
```

### `Port 3001 already in use`
Kill the process using that port:
```bash
lsof -ti:3001 | xargs kill
```

### `Port 5173 already in use`
```bash
lsof -ti:5173 | xargs kill
```

### `Error: JWT_SECRET is not defined`
Make sure `.env` exists at the project root and has `JWT_SECRET` set.

### `Error: ANTHROPIC_API_KEY is not defined`
AI features (job description, title suggestions, candidate screening) require a valid Anthropic API key in `.env` at the project root. Get one at https://console.anthropic.com.

### `Cannot find module` errors after pulling changes
Re-run install to pick up any new dependencies:
```bash
npm install
```

---

## Folder Structure (quick reference)

```
my-ats-platform/
├── packages/
│   ├── backend/            Node.js + Express API
│   │   └── src/
│   │       ├── routes/     API endpoints
│   │       ├── services/   Business logic (auth, AI)
│   │       └── middleware/ Auth guard, error handler, logger
│   └── frontend/           React 18 + TypeScript + Vite
│       └── src/
│           ├── pages/      Route-level page components
│           ├── components/ Reusable UI components
│           ├── hooks/      Custom React hooks
│           └── lib/api.ts  Centralized API client
├── database/
│   ├── 001-create-tables.sql
│   ├── 003-alter-tables.sql
│   ├── 002-seed-data.sql
│   └── README.md
├── docker-compose.yaml     PostgreSQL local setup
├── .env.example            Environment variable template
├── package.json            npm workspaces root
├── README.md               Full project documentation
└── CLAUDE.md               AI assistant context file
```

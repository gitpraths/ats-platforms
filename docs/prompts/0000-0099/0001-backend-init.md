# Task - Backend Initialization

## Goal
Initialize the Express.js backend for the ATS platform.

## Steps

- Create `packages/backend/src/server.js` as the app entry point
- Set up Express with:
  - `cors` middleware (allow `CORS_ORIGIN` from env)
  - `express.json()` body parser
  - `express.urlencoded({ extended: true })`
  - Request logger middleware
  - Error handler middleware (last in chain)

- Register all routes under `/api` prefix
- Add a `GET /health` endpoint returning `{ status: "ok" }`
- Load `.env` via `dotenv/config`
- Listen on `process.env.PORT` (default 3001)

## Environment Variables Required
```
PORT=3001
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://ats_user:ats_pass@localhost:5432/ats_db
JWT_SECRET=your-secret
JWT_EXPIRES_IN=8h
```

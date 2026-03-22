# TODO List

## Known Bugs

- [ ] When finishing job creation the dialog must close automatically
- [ ] Recruiters should only be able to assign talent to jobs they own or are assigned to

## Now (High Priority)

- [ ] User profile icon with avatar in top nav menu
- [ ] Implement Admin User page for users with the `admin` role
- [ ] Job number: isolated auto-increment per company (use PostgreSQL SERIAL or sequence with client scope)

## GenAI (Claude API)

- [ ] Add support for required skills in job description prompt
- [ ] Add support for desired skills in job description prompt
- [ ] Add support for whole job creation from a single prompt
- [ ] Client context passed to all Claude API calls for better personalization

## Authentication

- [ ] Session refresh endpoint (`POST /api/auth/refresh`)
- [ ] Frontend session expiry handling — show warning before logout
- [ ] Add support for user session history (last login, IP, user agent)

## User

- [ ] User avatar upload (local disk for now, S3-ready abstraction)
- [ ] User entitlement mechanism (role-based feature flags)
- [ ] User session history (last login date)

## Job

- [ ] Job number isolated sequence per organization
- [ ] Public job page at `/jobs/public/:company_code` (no auth required)
- [ ] Job status lifecycle enforcement (blocked transitions)
- [ ] Job questions API (custom screening questions per job)

## Location

- [ ] Frontend: Location CRUD management page
- [ ] Location search: SQL injection check — always use parameterized queries
- [ ] Future: geolocation search by mile radius

## Department

- [ ] Prevent duplicate department name DB error — validate before insert with 409 response

## Code Quality

- [ ] Add ESLint to backend (`@eslint/js`, `eslint-plugin-import`)
- [ ] Add Zod validation to backend route handlers (replace manual `if (!field)` checks)
- [ ] Refactor backend routes to separate repository modules (reusable DB queries)
- [ ] Migrate backend to TypeScript (long-term)
- [ ] Add Swagger/OpenAPI docs for all routes (`swagger-jsdoc`)
- [ ] Health check endpoint includes: version, git SHA, uptime

## Infrastructure

- [ ] Generate version identifier in health check (git SHA + package version)
- [ ] GitHub Actions: add deploy step (Railway / Render / AWS)
- [ ] Add Docker multi-stage build for production image

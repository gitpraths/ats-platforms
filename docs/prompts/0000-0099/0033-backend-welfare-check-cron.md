# Task - Backend: Welfare Check Cron Job

## Goal
Implement a scheduled background job that runs daily, finds welfare checks due today or overdue, and sends reminder emails to employers.

## File
Create `packages/backend/src/services/welfare-check-cron.js`

## Dependencies
```bash
npm install node-cron --workspace=packages/backend
```

## Schedule
Run daily at 08:00 (local server time):
```javascript
import cron from 'node-cron';
cron.schedule('0 8 * * *', runWelfareCheckJob);
```

## Job Logic (`runWelfareCheckJob`)
1. Query all welfare checks where:
   - `due_date <= TODAY`
   - `completed_at IS NULL`
   - `email_sent_at IS NULL` (not yet emailed)
2. For each check:
   - Load placement, candidate, job, employer data
   - Call `sendWelfareCheckEmail(...)` from `services/email.js`
   - On success: update `welfare_checks.email_sent_at = NOW()`
   - On failure: log error, continue to next check
3. Log summary at end: `Welfare check cron: X emails sent, Y failed`

## Startup
Register the cron in `server.js`:
```javascript
import { startWelfareCheckCron } from './services/welfare-check-cron.js';
startWelfareCheckCron(); // only if NODE_ENV !== 'test'
```

## Manual Trigger Endpoint (admin only)
```
POST /api/admin/run-welfare-checks
```
- Runs the job immediately on demand
- Returns `{ sent: N, failed: M }`
- Auth: `admin` only

## Steps
- Do not send duplicate emails — check `email_sent_at IS NULL` strictly
- Handle placements where employer has no contact email: log warning, skip
- Add environment variable `WELFARE_CRON_ENABLED=true` to allow disabling in specific environments

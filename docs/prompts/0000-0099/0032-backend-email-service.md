# Task - Backend: Email Service

## Goal
Set up a reusable email service using Nodemailer for sending placement confirmation and welfare check emails to employers.

## File
Create `packages/backend/src/services/email.js`

## Dependencies
```bash
npm install nodemailer --workspace=packages/backend
```

## Environment Variables
Add to `.env` and `.env.example`:
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-smtp-password
EMAIL_FROM="ATS Platform <noreply@example.com>"
```

## Email Service API
```javascript
// Send any email
export async function sendEmail({ to, subject, html, text })

// Send employment confirmation to employer
export async function sendPlacementConfirmation({ placement, employer, candidate, job })

// Send welfare check notification to employer
export async function sendWelfareCheckEmail({ welfareCheck, placement, employer, candidate, job })
```

## Email Templates

### Placement Confirmation
Subject: `Employment Confirmation – [Candidate Name] at [Job Title]`

Body (HTML):
- Greeting to employer contact name
- Candidate name, job title, start date
- Ask employer to confirm employment by replying or clicking a link
- Agency contact details

### Welfare Check (per check_type)
Subject: `[Day 1 / Week 1 / 1 Month / 3 Month / 6 Month] Check-in – [Candidate Name]`

Body (HTML):
- Greeting to employer
- Milestone label and due date
- Request to confirm candidate is still employed
- Agency contact details

## Steps
- Log all sent emails to console (Winston logger) with `to`, `subject`, `timestamp`
- Wrap `sendEmail` in try/catch — log error but do not throw (non-blocking)
- Export a `testEmailConnection()` function that calls `transporter.verify()`
- In development (`NODE_ENV=development`), default to Ethereal (fake SMTP) if SMTP_HOST is not set

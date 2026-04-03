# Video 5 — Placements & Welfare Checks
**Duration:** ~5 minutes
**Login as:** admin@myats.dev / password123

---

## Pre-recording Checklist
- [ ] App is running
- [ ] Navigate to http://localhost:5173/placements before recording
- [ ] Confirm 4 demo placements are listed (Marcus, Tom, Mia, Ethan)

---

## Script

### [0:00–0:30] Placements List
**ACTION:** Show the Placements list page.

**NARRATE:**
> "The Placements module tracks every candidate who has been successfully placed
> into employment. This is where recruitment converts into real outcomes.
> Each row shows the candidate, the employer, the job, their start date,
> and the status of their welfare check schedule."

**ACTION:** Point to the coloured dots in the welfare check column.

**NARRATE:**
> "These five dots represent the five welfare check milestones —
> Day 1, Week 1, Month 1, Month 3, and Month 6.
> Green means completed, yellow means overdue, grey means not yet due."

---

### [0:30–1:15] Create a New Placement
**ACTION:** Click **New Placement** or **+ Create Placement**.

**NARRATE:**
> "When a candidate is hired, we create a placement record.
> This links the candidate, the employer, and the job together."

**ACTION:** Fill in:
- Candidate: search and select any hired candidate (e.g. `Sophie`)
- Employer: select `Coles Group`
- Job: select `Nightfill Team Member`
- Start Date: today's date or next Monday

**ACTION:** Click **Create Placement**.

**NARRATE:**
> "The moment we save this placement, the system automatically generates
> five welfare check records — one for each milestone — with their due dates
> calculated from the start date.
> Day 1 is due tomorrow, Week 1 is seven days out, and so on.
> No manual scheduling required."

---

### [1:15–2:00] Placement Detail Page
**ACTION:** Click on the Marcus Webb placement (DHL Supply Chain).

**NARRATE:**
> "Let me open an existing placement to show the full detail view."

**ACTION:** Show the placement header — candidate name, employer, job, start date, status.

**NARRATE:**
> "The header gives us the key facts at a glance —
> who, where, which role, and when they started."

---

### [2:00–3:00] Welfare Check Timeline
**ACTION:** Scroll down to the Welfare Check Timeline section.

**NARRATE:**
> "The welfare check timeline is the centrepiece of this module.
> Each milestone shows its due date, whether it's been completed,
> who completed it, and when.
> Overdue checks are highlighted so they're impossible to miss."

**ACTION:** Click on a pending welfare check — click **Mark as Complete**.

**NARRATE:**
> "Marking a check complete records the timestamp and the staff member's name.
> Once completed, it cannot be undone — this creates a reliable audit trail
> for compliance and DES reporting requirements."

**ACTION:** Show the check is now green/completed.

---

### [3:00–3:45] Send Email Notifications
**ACTION:** Find the **Send Email** button on a welfare check or the placement header.

**NARRATE:**
> "The platform can send automated email notifications for welfare checks.
> Clicking 'Send Email' dispatches a reminder to the relevant provider or staff member.
> In development mode these emails are captured by Ethereal — a test inbox —
> so no real emails are sent during testing."

**ACTION:** Click **Send Email**, show the success toast notification.

---

### [3:45–4:30] Employer Confirmation
**ACTION:** Find the **Confirm by Employer** toggle or button on the placement.

**NARRATE:**
> "Once the employer confirms the placement — usually after the first week —
> we mark it as confirmed here. This updates the 'Confirmed by Employer' count
> on the Dashboard and feeds into the Provider performance reports."

**ACTION:** Toggle confirmed status on.

---

### [4:30–5:00] Daily Cron — Automated Welfare Reminders
**ACTION:** Stay on the placements page or go back to the list.

**NARRATE:**
> "Behind the scenes, the system runs a daily job at 8am.
> It scans all welfare checks due today or overdue and sends email reminders
> automatically — without any manual intervention.
> This means providers and staff are always notified when follow-ups are required,
> even if they haven't logged into the platform that day."

**NARRATE:**
> "In the next video we'll look at Providers — the employment service organisations
> that support candidates through to employment."

**ACTION:** Stop recording.

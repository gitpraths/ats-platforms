# Video 9 — AI Features (Powered by Claude)
**Duration:** ~5 minutes
**Login as:** admin@myats.dev / password123

---

## Pre-recording Checklist
- [ ] App is running
- [ ] ANTHROPIC_API_KEY is set in packages/backend/.env
- [ ] Navigate to http://localhost:5173/jobs before recording

---

## Script

### [0:00–0:30] Introduction
**ACTION:** Show the Jobs list.

**NARRATE:**
> "The ATS Platform integrates Claude AI by Anthropic to assist recruiters
> with three tasks that normally take significant time:
> generating job descriptions, suggesting job titles, and screening candidates.
> Let me show each one."

---

### [0:30–1:30] Feature 1 — Job Title Suggestions
**ACTION:** Click **New Job** to start the job creation wizard. You are on Step 1 (Basics).

**NARRATE:**
> "When creating a new job, the first step is entering the job title.
> If you're not sure of the exact title to use, the AI can suggest alternatives."

**ACTION:** Type `Warehouse` in the job title field.

**ACTION:** Click the **Suggest Titles** button (AI sparkle icon near the title field).

**NARRATE:**
> "I clicked 'Suggest Titles' and the AI is thinking..."

**ACTION:** Wait for the suggestions to appear (3–5 seconds).

**NARRATE:**
> "Claude returns five related title suggestions — things like
> 'Warehouse Storeperson', 'Logistics Team Member', 'Pick and Pack Operator',
> 'Distribution Centre Worker', and 'Warehouse Operations Assistant'.
> These are real job titles used in the Australian market,
> not generic suggestions."

**ACTION:** Click one of the suggested titles to apply it.

**NARRATE:**
> "One click and the title is populated. No typing required."

---

### [1:30–2:45] Feature 2 — Job Description Generator
**ACTION:** Move to Step 2 of the wizard — Description. Show the empty description field.

**NARRATE:**
> "Step two is the job description — usually the most time-consuming part
> of creating a new role. Let me use the AI to generate a full description."

**ACTION:** Click the **Generate Description** button (near the description field).

**NARRATE:**
> "The AI uses the job title, department, and location we entered in step one
> to write a contextually relevant description.
> It knows we're hiring a Warehouse Storeperson in Melbourne."

**ACTION:** Wait for the description to stream in (5–10 seconds).

**NARRATE:**
> "Here's the generated description — it includes a role overview,
> key responsibilities, and what the candidate can expect from the role.
> It's written in professional Australian English, appropriate for a job board."

**ACTION:** Scroll through the generated description.

**NARRATE:**
> "Recruiters can edit this freely — it's a starting point, not a final draft.
> But it saves ten to fifteen minutes per job posting.
> Across a team creating twenty jobs a month, that's hours saved every month."

---

### [2:45–3:45] Feature 3 — Candidate Screening Notes
**ACTION:** Navigate to any candidate profile (e.g. /candidates, click a candidate).

**NARRATE:**
> "The third AI feature is candidate screening.
> When a recruiter is reviewing a candidate for a specific job,
> they can ask Claude to summarise the candidate's fit."

**ACTION:** Find the **Screen Candidate** or **AI Screening** button on the candidate profile.

**NARRATE:**
> "Clicking 'Screen for Role' sends the candidate's profile — their work history,
> skills, location, and benchmark hours — to Claude along with the job requirements."

**ACTION:** If a job selector appears, select a job. Click **Generate Screening Notes**.

**NARRATE:**
> "Claude analyses the match and returns structured notes —
> strengths, potential gaps, and a recommended next step.
> This gives recruiters a starting point for their own assessment
> rather than starting from a blank page."

**ACTION:** Show the screening notes that appear.

**NARRATE:**
> "These notes can be saved against the application record so the whole team
> has visibility of the initial screening rationale."

---

### [3:45–4:30] How It Works — Architecture Note
**ACTION:** Stay on the candidate profile or navigate to a neutral page.

**NARRATE:**
> "A quick note on how this is built securely.
> All AI requests are made from the backend server — never directly from the browser.
> The Anthropic API key lives in environment variables on the server
> and is never exposed to the client.
> This is best practice for any production AI integration."

**NARRATE:**
> "The model in use is Claude claude-opus-4-6 — Anthropic's most capable model as of 2026.
> Responses typically arrive within three to eight seconds depending on length."

---

### [4:30–5:00] Wrap Up — All 9 Videos Done
**ACTION:** Navigate to the Dashboard.

**NARRATE:**
> "That completes the walkthrough of all nine feature areas of the ATS Platform:
> Dashboard, Jobs, Hiring Board, Candidates, Placements, Providers, Employers,
> Reports, and AI Features.
> The platform is production-ready, built on Node.js and React,
> with PostgreSQL for data storage and Claude AI for intelligent assistance.
> Thank you for watching."

**ACTION:** Stop recording.

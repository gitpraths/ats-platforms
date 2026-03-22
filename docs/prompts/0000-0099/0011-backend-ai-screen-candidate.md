# Task - AI Candidate Screening (Claude API)

## Goal
Implement an endpoint that calls the Claude API to screen a candidate against a job.
This is a new feature (no equivalent in original project — extends AI capabilities).

## Route: POST /api/ai/screen-candidate

- Requires `requireAuth` middleware
- Body:
```json
{
  "candidate_notes": "string (required)",
  "job_title": "string (required)",
  "job_description": "string (optional)"
}
```

- Response:
```json
{
  "success": true,
  "data": {
    "summary": "Candidate appears to be a strong fit...",
    "score": 8
  }
}
```

## Implementation (`src/services/ai.js`)

Call Claude API:
- Model: `claude-opus-4-6`
- Prompt:
```
You are an ATS assistant. Review this candidate for the role of "{job_title}".

Job Description:
{job_description}

Candidate Notes:
{candidate_notes}

Provide a brief screening summary (2-3 sentences) and a fit score from 1-10.
Return JSON only: { "summary": "...", "score": N }
```
- Parse response as JSON
- If parse fails, return `{ summary: raw_text, score: null }`

## Error Handling
- Return 400 if `candidate_notes` or `job_title` missing
- Return 500 if Claude API fails

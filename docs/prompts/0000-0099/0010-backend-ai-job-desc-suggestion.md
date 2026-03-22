# Task - AI Job Description Suggestion (Claude API)

## Goal
Implement an endpoint that calls the Claude API to generate a job description.
This replaces the original AWS Lambda / Asimov integration.

## Route: POST /api/ai/job-description

- Requires `requireAuth` middleware
- Body:
```json
{
  "job_title": "string (required)",
  "job_desc": "string (optional, partial description to enhance)",
  "required_skills": ["string"] (optional),
  "desired_skills": ["string"] (optional)
}
```

- Response:
```json
{
  "success": true,
  "data": {
    "job_desc": "Full generated job description text..."
  }
}
```

## Implementation (`src/services/ai.js`)

Call Claude API using `@anthropic-ai/sdk`:
- Model: `claude-opus-4-6` (see CLAUDE.md)
- Build prompt from request fields:
```
Write a professional job description for a "{job_title}" role.
Required skills: {required_skills}.
Desired skills: {desired_skills}.
Existing description context: {job_desc}.

Include:
- Role summary (2-3 sentences)
- Key responsibilities (5-7 bullet points)
- Required qualifications (4-5 bullet points)
- Preferred qualifications (2-3 bullet points)

Be concise and professional. Do not include salary or company name.
```
- Return the raw text response as `job_desc`

## Error Handling
- Return 400 if `job_title` is missing
- Return 500 with `{ success: false, error: "AI service error" }` if Claude API fails
- Never expose raw Claude API errors to the client

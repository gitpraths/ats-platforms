# Task - AI Job Title Suggestions (Claude API)

## Goal
Implement an endpoint that calls the Claude API to generate job title suggestions.
This replaces the original AWS Lambda / Asimov integration.

## Route: POST /api/ai/job-title-suggestions

- Requires `requireAuth` middleware
- Body:
```json
{
  "job_title": "string (required)",
  "skills_required": ["string"] (optional),
  "job_desc": "string (optional)"
}
```

- Response:
```json
{
  "success": true,
  "data": {
    "job_titles": [
      "Suggested Title 1",
      "Suggested Title 2",
      "Suggested Title 3",
      "Suggested Title 4",
      "Suggested Title 5"
    ]
  }
}
```

## Implementation (`src/services/ai.js`)

Call Claude API using `@anthropic-ai/sdk`:
- Model: `claude-opus-4-6` (see CLAUDE.md)
- Build prompt from request fields:
```
Suggest 5 alternative or related job titles for "{job_title}".
Skills required: {skills_required}.
Context: {job_desc}.
Return only a JSON array of strings, nothing else.
```
- Parse the response as JSON array
- If parse fails, return the raw text split into lines as fallback

## Error Handling
- Return 400 if `job_title` is missing
- Return 500 with `{ success: false, error: "AI service error" }` if Claude API fails
- Never expose raw Claude API errors to the client

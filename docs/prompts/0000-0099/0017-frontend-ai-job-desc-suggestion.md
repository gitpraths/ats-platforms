# Task - Frontend AI Job Description Suggestion

## Goal
Add a "Generate Description" button on the Job Create/Edit form powered by Claude API.

## Location
Job create/edit form — above or below the description textarea.

## UI Behavior
1. User fills in job title (required) and optionally skills
2. User clicks "Generate with AI" button
3. Button shows loading spinner
4. On success: description textarea is filled with the generated text
5. User can edit the generated text freely

## API Call
```
POST /api/ai/job-description
{
  "job_title": "current title value",
  "job_desc": "existing description (optional context)",
  "required_skills": ["..."],
  "desired_skills": ["..."]
}
```

## Component
`components/AIGenerateDescription.tsx`
- Props: `jobTitle`, `requiredSkills`, `desiredSkills`, `currentDesc`, `onGenerated(desc: string)`
- Uses `useMutation`
- Disable button if `jobTitle` is empty
- Show toast notification on success/failure

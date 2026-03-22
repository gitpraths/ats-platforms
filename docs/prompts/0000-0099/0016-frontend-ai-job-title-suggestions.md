# Task - Frontend AI Job Title Suggestions

## Goal
Add a "Suggest Titles" button on the Job Create/Edit form that calls the Claude-powered API.

## Location
Job create/edit form — next to the job title input field.

## UI Behavior
1. User types a job title and optionally fills in skills
2. User clicks "Suggest Titles" button (with sparkle icon)
3. Button shows loading spinner while waiting for API response
4. A popover/dropdown appears with 5 suggested titles
5. Clicking a suggestion fills the title input with that value and closes the popover

## API Call
```
POST /api/ai/job-title-suggestions
{
  "job_title": "current title input value",
  "skills_required": ["...current skills"],
  "job_desc": "current description text"
}
```

## Component
`components/AISuggestTitles.tsx`
- Props: `currentTitle`, `skills`, `description`, `onSelect(title: string)`
- Uses TanStack React Query `useMutation`
- Disable button if `currentTitle` is empty

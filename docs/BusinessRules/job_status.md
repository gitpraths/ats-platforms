# Job

## Job Status

- A job is always created in `draft` status
- The job create and update operations (POST or PATCH) should NOT allow for job status change
- There are specific endpoints for job status update: `PATCH /api/jobs/:id/status`
- When updating a job status, a record will be created in the `job_activity` table to record who changed the status and when
- Valid status values: `draft` | `published` | `archived`

## Job Status Lifecycle

```
draft → published → archived
  ↑__________↓
```

- A job can move back to `draft` from `published` (unpublish)
- A job in `archived` status cannot be changed

# User Roles

- **admin**
  - Full system access
  - Manages users, roles, settings, and has visibility into all data

- **hiring_manager**
  - Reviews candidates, provides feedback, schedules interviews, and makes hiring decisions for their department

- **recruiter_admin**
  - Oversees recruiters, manages recruiting teams, and has elevated permissions over standard recruiters

- **recruiter**
  - Manages job postings, candidate sourcing, screening, and communication

- **user**
  - Read-only access with limited features

## Role Hierarchy for Authorization

```
admin > recruiter_admin > hiring_manager > recruiter > user
```

## Job-Level Authorization

- Only the **job owner** (`created_by` field) or an **assigned recruiter** (`job_recruiter` table) can modify applications for that job
- Only the **job owner** can assign/remove recruiters from a job
- `admin` and `recruiter_admin` can override job-level restrictions

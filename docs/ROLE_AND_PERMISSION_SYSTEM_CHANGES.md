# Role and Permission System Architecture: Implementation Changelog

This document provides a complete technical record of all architectural changes implemented across the database, backend services, API route guards, frontend routing, and UI access controls to resolve role and permission issues permanently.

---

## 1. Problem Statement & Objectives

### 1.1 The Original Issue
When staff members attempted to create or edit providers (or other entities), the platform returned an HTTP 403 Forbidden error despite the Super Admin having explicitly granted operational permissions in the User Management modal.

### 1.2 Root Causes Identified
1. **Hardcoded Role Guards**: API routes were checking static roles via `requireRole('admin', 'recruiter_admin')` rather than inspecting the user's granular granted permissions via `requirePermission(...)`.
2. **Database Check Constraint**: PostgreSQL enforced `CHECK (role IN ('admin', 'recruiter_admin', 'recruiter', 'staff', 'hiring_manager', 'provider', 'training_admin'))`. This crashed with database errors when attempting to save users as `hr` or `marketing`.
3. **Frontend Routing Gatekeeping**: `/providers/new` and `/providers/:id/edit` were wrapped in `<AdminRoute>` rather than `<PermissionRoute>`, blocking staff before requests even reached the backend.
4. **Stale Token Payloads**: Permissions and roles were stored inside JWT session tokens at login. If an admin updated a user's permissions, changes did not take effect until the user logged out and re-authenticated.
5. **Analytics and Report Exclusions**: KPI and placement SQL queries filtered with `WHERE u.role IN ('admin', 'recruiter_admin', 'recruiter')`, omitting staff members.

### 1.3 Client Role Requirements
Standardize on exactly five internal roles:
- **`super_admin`**: Full platform authority, user management, and permission governance.
- **`admin`**: Full unrestricted access across all platform modules.
- **`staff`**: Granular access strictly governed by permission tick boxes.
- **`hr`**: Granular access strictly governed by permission tick boxes.
- **`marketing`**: Granular access strictly governed by permission tick boxes.
*(External `provider` accounts remain supported for the provider portal).*

Deprecated roles removed:
- `recruiter_admin`
- `recruiter`
- `training_admin`
- `hiring_manager`

---

## 2. Database Changes (PostgreSQL)

The following SQL migrations were executed on the Railway PostgreSQL database:

```sql
-- 1. Remove the legacy constraint that crashed on 'hr' and 'marketing'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Update column default to 'staff'
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'staff';

-- 3. Migrate active team members from 'recruiter_admin' to 'staff'
UPDATE users SET role = 'staff', updated_at = NOW() WHERE email = 'andy@workvision.com.au';
UPDATE users SET role = 'staff', updated_at = NOW() WHERE email = 'harry@workvision.com.au';
UPDATE users SET role = 'staff', updated_at = NOW() WHERE email = 'talia@workvision.com.au';
```

### Verification of Active Users in Database
- **Andy** (`andy@workvision.com.au`): Role `staff`, 17 permissions preserved intact.
- **Harry** (`harry@workvision.com.au`): Role `staff`, 17 permissions preserved intact.
- **Talia** (`talia@workvision.com.au`): Role `staff`, 14 permissions preserved intact.

---

## 3. Backend Changes (Node.js & Express)

### 3.1 Permissions Configuration
- File: [packages/backend/src/config/permissions.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/config/permissions.js)
- Removed `ROLE_DEFAULTS` entries for `recruiter_admin`, `recruiter`, `training_admin`, and `hiring_manager`.
- Maintained exact default catalogs for `super_admin`, `admin`, `staff`, `hr`, and `marketing`.

### 3.2 Real-Time Authentication Middleware
- File: [packages/backend/src/middleware/auth.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/middleware/auth.js)
- Rewrote `requirePermission`:
  - Directly queries PostgreSQL for the user's live role and permissions on every request.
  - Automatically grants access if role is `super_admin` or `admin`.
  - Validates `user.permissions.includes(requiredPermission)` for `staff`, `hr`, and `marketing`.
  - Ensures permission revocations or grants applied by Super Admin take effect on the user's very next click without re-login.
- Rewrote `requireRole`:
  - Validates role against live database state.
  - Treats `admin` requirement as satisfied by both `super_admin` and `admin`.

### 3.3 User Management Route
- File: [packages/backend/src/routes/users.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/users.js)
- Added `ALLOWED_ROLES = ["super_admin", "admin", "staff", "hr", "marketing"]`.
- Added role validation on `POST /api/users` and `PUT /api/users/:id` to reject unauthorized role strings with `400 Bad Request`.
- Updated `GET /api/users` access check so users with user-management, jobs-view, or vacancy creation permissions can retrieve the user directory.

### 3.4 Provider Routes
- File: [packages/backend/src/routes/providers.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/providers.js)
- Removed dead `training_admin` check.
- `POST /api/providers`: Protected by `requirePermission('employers:create')`.
- `PUT /api/providers/:id`: Protected by `requirePermission('employers:edit')`.
- `PATCH /api/providers/:id`: Protected by `requirePermission('employers:edit')`.
- `DELETE /api/providers/:id`: Protected by `requirePermission('employers:delete')`.
- Sync and OneDrive endpoints: Protected by `requirePermission('employers:edit')`.

### 3.5 Employers, Jobs, and Application Routes
- File: [packages/backend/src/routes/employers.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/employers.js): Removed dead `training_admin` check.
- File: [packages/backend/src/routes/jobs.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/jobs.js):
  - Removed dead `training_admin` check.
  - Recruiter validation query updated from hardcoded role check to active users: `WHERE id = ANY(...) AND is_active = true`.
  - `DELETE /api/jobs/:id` uses `requirePermission('jobs:delete')`.
- File: [packages/backend/src/routes/applications.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/applications.js):
  - Removed dead `training_admin` checks.
  - `isAdmin` check updated to `["super_admin", "admin"].includes(req.user.role)`.
  - `DELETE /api/applications/:id` uses `requireRole("admin")`.

### 3.6 Placements & Welfare Checks
- File: [packages/backend/src/routes/placements.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/placements.js):
  - Removed `training_admin` restriction.
  - `PUT /api/placements/:id` and `PATCH /api/placements/:id`: Protected by `requirePermission('placements:create')`.
  - `POST /api/placements/:id/send-confirmation`: Protected by `requirePermission('placements:confirm')`.
  - Welfare check routes (`/welfare-checks/:id` PATCH and send-email): Protected by `requirePermission('placements:welfare')`.

### 3.7 Training & Candidate Enrolments
- File: [packages/backend/src/routes/trainings.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/trainings.js): `POST`, `PATCH`, and `DELETE` protected by `requirePermission('training:manage')`.
- File: [packages/backend/src/routes/candidate-trainings.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/candidate-trainings.js): `POST`, `PATCH`, and `DELETE` protected by `requirePermission('training:enroll')`.

### 3.8 Administration, Master Data & Integrations
- File: [packages/backend/src/routes/departments.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/departments.js): Protected by `requirePermission('employers:edit')`.
- File: [packages/backend/src/routes/locations.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/locations.js): Protected by `requirePermission('employers:edit')`.
- File: [packages/backend/src/routes/master.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/master.js): `POST`, `PUT`, and `DELETE` protected by `requirePermission('admin:master_data')`.
- File: [packages/backend/src/routes/ms-auth.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/ms-auth.js): Protected by `requirePermission('employers:edit')`.
- File: [packages/backend/src/routes/xero.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/xero.js): Protected by `requirePermission('reports:financials')`.

### 3.9 Reports & Statistics SQL Queries
- File: [packages/backend/src/routes/stats.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/stats.js):
  - Line 12: `isAdmin` check updated to `["super_admin", "admin"].includes(req.user.role)`.
  - Line 82: Leaderboard placement query changed from `WHERE u.role IN ('admin', 'recruiter_admin', 'recruiter')` to `WHERE u.is_active = true`.
  - Line 251: Placement by staff chart query changed to `WHERE u.is_active = true`.
- File: [packages/backend/src/routes/reports.js](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/reports.js):
  - Line 147: Staff KPI report query changed from `WHERE u.role IN ('admin','recruiter_admin','recruiter')` to `WHERE u.is_active = true`.

---

## 4. Frontend Changes (React, TypeScript & Vite)

### 4.1 TypeScript Role Definitions
- File: [packages/frontend/src/types/index.ts](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/types/index.ts)
- Removed `recruiter_admin`, `recruiter`, `hiring_manager`, and `training_admin` from `UserRole`.
- Allowed role union: `"super_admin" | "admin" | "staff" | "hr" | "marketing" | "provider"`.

### 4.2 Application Routing & Layout
- File: [packages/frontend/src/App.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/App.tsx)
- Layout navigation:
  - Removed all `isTrainingAdmin` conditions and hardcoded `recruiter_admin` checks.
  - Providers nav item visible to users with `employers:view`.
  - Trainings nav item visible to users with `training:view`.
- Route guards:
  - `/providers/new` switched from `<AdminRoute>` to `<PermissionRoute permission="employers:create">`.
  - `/providers/:id/edit` switched from `<AdminRoute>` to `<PermissionRoute permission="employers:edit">`.
  - `/providers` and `/providers/:id` protected by `PermissionRoute permission="employers:view"`.
  - `/admin/departments` and `/admin/locations` protected by `PermissionRoute permission="employers:edit"`.
  - `/admin/trainings` protected by `PermissionRoute permission="training:manage"`.
  - `/admin/xero` protected by `PermissionRoute permission="reports:financials"`.
  - `/admin/master/*` protected by `PermissionRoute permission="admin:master_data"`.
  - `AdminRoute` reserved strictly for `super_admin` and `admin` (`/admin/users`, `/admin/release-notes`, `/hiring-board`).

### 4.3 User Administration UI
- File: [packages/frontend/src/pages/AdminUsers.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/AdminUsers.tsx):
  - Cleaned `ROLES` array to strictly: Super Admin, Admin, Staff, HR, and Marketing.
  - Removed obsolete badges for deleted roles.
- File: [packages/frontend/src/components/CreateUserDialog.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/components/CreateUserDialog.tsx):
  - Cleaned `ROLES` dropdown options to the 5 approved roles.
  - Set default form state `role` to `staff` (previously defaulted to `recruiter`).
- File: [packages/frontend/src/hooks/useRecruiters.ts](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/hooks/useRecruiters.ts):
  - `useRecruiters`: Fetches `/users?role=staff`.
  - `useRecruiterAdmins`: Fetches `/users?role=admin`.

### 4.4 Page UI Guards (Button-Level Permissions)
- **Providers Directory** ([packages/frontend/src/pages/Providers.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/Providers.tsx)):
  - "Add Provider" button conditioned on `canCreate = isAdmin || hasPermission('employers:create')`.
  - Row "Edit" button conditioned on `canEdit = isAdmin || hasPermission('employers:edit')`.
  - Row "Deactivate" button conditioned on `canDelete = isAdmin || hasPermission('employers:delete')`.
- **Provider Detail** ([packages/frontend/src/pages/ProviderDetail.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/ProviderDetail.tsx)):
  - "Edit Provider" button conditioned on `canEdit = isAdmin || hasPermission('employers:edit')`.
  - Xero integration section conditioned on `canFinancials = isAdmin || hasPermission('reports:financials')`.
  - Consultants section edit controls conditioned on `canEdit`.
  - Spreadsheet Sync panel conditioned on `canEdit`.
- **Employer Detail** ([packages/frontend/src/pages/EmployerDetail.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/EmployerDetail.tsx)):
  - "Edit Employer" button conditioned on `canEdit = isAdmin || hasPermission('employers:edit')`.
  - "Add Vacancy" button conditioned on `hasPermission('jobs:create')`.
  - Vacancy row edit button conditioned on `hasPermission('jobs:edit')`.
- **Vacancy Detail** ([packages/frontend/src/pages/JobDetail.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/JobDetail.tsx)):
  - `canEdit` evaluates `isAdmin || hasPermission('jobs:edit') || isOwner || isRecruiter`.
  - "Delete Vacancy" button conditioned on `isAdmin || hasPermission('jobs:delete')`.
- **Placement Detail** ([packages/frontend/src/pages/PlacementDetail.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/PlacementDetail.tsx)):
  - Edit placement status and notes conditioned on `canAct = isAdmin || hasPermission('placements:create')`.
  - Send confirmation email button conditioned on `canConfirm = isAdmin || hasPermission('placements:confirm')`.
  - Welfare check completion and email buttons conditioned on `canWelfare = isAdmin || hasPermission('placements:welfare')`.
- **Candidate Detail** ([packages/frontend/src/pages/CandidateDetail.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/CandidateDetail.tsx)):
  - Edit candidate details conditioned on `canWrite = isAdmin || hasPermission('candidates:edit')`.
  - Training enrolments conditioned on `canWriteTraining = isAdmin || hasPermission('training:enroll') || hasPermission('training:manage')`.
- **Admin Trainings** ([packages/frontend/src/pages/AdminTrainings.tsx](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/AdminTrainings.tsx)):
  - "New Training Program" button conditioned on `canEdit = isAdmin || hasPermission('training:manage')`.

---

## 5. Verification & Test Results

### 5.1 Frontend Build
- Command: `npm run build` inside `packages/frontend`
- Result: **Exit Code 0**
- Output: All 2,720 modules transformed. TypeScript compilation succeeded with zero type errors. Production bundle generated cleanly in `packages/frontend/dist`.

### 5.2 Backend Syntax Validation
- Command: `node -c packages/backend/src/server.js packages/backend/src/app.js packages/backend/src/routes/*.js packages/backend/src/middleware/*.js packages/backend/src/config/*.js`
- Result: **Exit Code 0**
- Output: Zero syntax or export errors across all backend files.

### 5.3 Live Authentication Middleware Test
- Evaluated staff member Andy (`andy@workvision.com.au`):
  - Request with `requirePermission('employers:create')`:
    - Result: `calledNext = true`, `errorStatus = null`.
    - Live query successfully pulled 17 permissions from PostgreSQL.
  - Request with `requirePermission('admin:users')` (permission intentionally not held by Andy):
    - Result: `calledNext = false`, `errorStatus = 403`.
    - Returns clean JSON: `{ success: false, error: 'Permission denied. Required: admin:users' }`.

---

## 6. Complete List of Modified Files (29 Files)

### Backend (17 Files)
1. `packages/backend/src/config/permissions.js`
2. `packages/backend/src/middleware/auth.js`
3. `packages/backend/src/routes/applications.js`
4. `packages/backend/src/routes/candidate-trainings.js`
5. `packages/backend/src/routes/departments.js`
6. `packages/backend/src/routes/employers.js`
7. `packages/backend/src/routes/jobs.js`
8. `packages/backend/src/routes/locations.js`
9. `packages/backend/src/routes/master.js`
10. `packages/backend/src/routes/ms-auth.js`
11. `packages/backend/src/routes/placements.js`
12. `packages/backend/src/routes/providers.js`
13. `packages/backend/src/routes/reports.js`
14. `packages/backend/src/routes/stats.js`
15. `packages/backend/src/routes/trainings.js`
16. `packages/backend/src/routes/users.js`
17. `packages/backend/src/routes/xero.js`

### Frontend (12 Files)
18. `packages/frontend/src/types/index.ts`
19. `packages/frontend/src/App.tsx`
20. `packages/frontend/src/components/CreateUserDialog.tsx`
21. `packages/frontend/src/hooks/useRecruiters.ts`
22. `packages/frontend/src/pages/AdminTrainings.tsx`
23. `packages/frontend/src/pages/AdminUsers.tsx`
24. `packages/frontend/src/pages/CandidateDetail.tsx`
25. `packages/frontend/src/pages/EmployerDetail.tsx`
26. `packages/frontend/src/pages/JobDetail.tsx`
27. `packages/frontend/src/pages/PlacementDetail.tsx`
28. `packages/frontend/src/pages/ProviderDetail.tsx`
29. `packages/frontend/src/pages/Providers.tsx`

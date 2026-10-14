# Release Notes — 14 October 2026 (v1.6.0)

**Release Version:** `1.6.0`  
**Date:** 14 October 2026  
**Status:** Deployed & Verified on Production (`crm.workvision.com.au` / `peaceful-vision`)  
**Git Commits:**
* `8f008e7` (*feat(auth): implement 5-role architecture and granular permission guards*)
* `c5ad046` (*feat(access): restrict invoice generation and important updates links to admin role*)

---

## Executive Summary

Today's release delivers a comprehensive authorization overhaul:
1. Implemented the standardized **5-Role RBAC Architecture** (`super_admin`, `admin`, `staff`, `hr`, `marketing`).
2. Converted backend endpoints from rigid role-based gating to **granular permission guards** with real-time PostgreSQL validation, unblocking staff users from provider management workflows without needing administrator status.
3. Hardened access controls across financial and candidate pipeline features by strictly restricting **Invoice Generation** (Placements, Training Enrolments, and Xero API) and **Important Updates** (`/hiring-board`) to **Admin-only**.
4. Updated all Dashboard stat cards and activity links to eliminate redirect loops for non-admin users.

---

## Detailed Code Changes & Features

### 1. 5-Role RBAC Architecture & Database Migration
* **5 System Roles:**
  * `super_admin`: Full system ownership, protected from deletion or privilege stripping.
  * `admin`: Complete administrative management across all operational entities.
  * `staff`: Default operational role with 17 standard permissions covering vacancies, candidates, placements, training, employers, and providers.
  * `hr`: Focused talent and training management (candidates, welfare, and training cohorts).
  * `marketing`: Vacancy and reports analysis.
* **Database Migration:**
  * Dropped the legacy `users_role_check` constraint on the `users` table to support the 5 roles.
  * Assigned standard permission presets to existing active staff accounts in PostgreSQL.

### 2. Live Database RBAC Middleware
* **Real-Time Permission Verification ([`packages/backend/src/middleware/auth.js`](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/middleware/auth.js)):**
  * `requireRole` and `requirePermission` now query live user roles and permissions directly from PostgreSQL.
  * Permission changes made in the User Management UI take effect instantly on the next request without requiring users to log out and log back in.
* **Provider Management Fix ([`packages/backend/src/routes/providers.js`](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/providers.js)):**
  * Replaced `requireRole("admin")` with `requirePermission("employers:view")`, `requirePermission("employers:create")`, and `requirePermission("employers:edit")`.
  * Staff users with provider permissions can now create, view, and edit providers without hitting `403 Forbidden` errors.

### 3. Strict Admin-Only Guard for Invoicing
* **Placements Table ([`packages/frontend/src/pages/Placements.tsx`](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/Placements.tsx)):**
  * The row-level **Invoice** button is now guarded by `isAdmin`. Non-admin staff only see the `View` button.
* **Training Program Enrolments ([`packages/frontend/src/components/training/EnrolmentsTab.tsx`](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/components/training/EnrolmentsTab.tsx)):**
  * "Generate invoice" and direct Xero invoice links in `InvoiceCell` are restricted to `isAdmin`.
* **Candidate Detail Training Tab ([`packages/frontend/src/pages/CandidateDetail.tsx`](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/CandidateDetail.tsx)):**
  * Restricts `InvoiceCell` actions to `isAdmin`.
* **Backend Invoicing API ([`packages/backend/src/routes/xero.js`](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/backend/src/routes/xero.js)):**
  * Guarded `POST /api/xero/invoices` with `requireRole("admin")` so non-admins cannot trigger invoice generation directly.

### 4. Important Updates Route & Dashboard Hardening
* **Navigation & Route Protection ([`packages/frontend/src/App.tsx`](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/App.tsx)):**
  * Retained strict Admin-only visibility for the **Important Updates** navbar item (`{isAdmin && <NavLink to="/hiring-board">...}`) and route protection (`AdminRoute`).
* **Dashboard Links ([`packages/frontend/src/pages/Dashboard.tsx`](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/Dashboard.tsx)):**
  * Updated "Active Applications" and "Hired This Month" cards, along with the "View board →" link under Recent Activity, to only link to `/hiring-board` for Admins. Non-admin staff are not redirected into a 403 / redirect loop.

### 5. In-App Administrative Release Documentation
* **Admin Release Notes Page ([`packages/frontend/src/pages/AdminReleaseNotes.tsx`](file:///Users/deeproot/data/21MARCH2026/my-ats-platform/packages/frontend/src/pages/AdminReleaseNotes.tsx)):**
  * Added version `1.6.0` to the date-wise release log under `Admin > Release Notes`.

---

## Affected Files Summary

| File | Change Description |
| :--- | :--- |
| `packages/backend/src/middleware/auth.js` | Live PostgreSQL lookup in `requireRole` & `requirePermission` |
| `packages/backend/src/routes/providers.js` | Refactored routes to granular `employers:*` permissions |
| `packages/backend/src/routes/xero.js` | Enforced `requireRole("admin")` on `POST /invoices` |
| `packages/frontend/src/pages/Placements.tsx` | Restricted Invoice button to `isAdmin` |
| `packages/frontend/src/components/training/EnrolmentsTab.tsx` | Restricted Invoice cell to `isAdmin` |
| `packages/frontend/src/pages/CandidateDetail.tsx` | Restricted Invoice cell to `isAdmin` |
| `packages/frontend/src/pages/Dashboard.tsx` | Conditioned `/hiring-board` links on `isAdmin` |
| `packages/frontend/src/pages/AdminUsers.tsx` | Added 5-role dropdown support and permission summary badges |
| `packages/frontend/src/components/ManagePermissionsModal.tsx` | Added role presets for all 5 roles |
| `packages/frontend/src/pages/AdminReleaseNotes.tsx` | Added v1.6.0 release entry with technical details |
| `docs/ROLE_AND_PERMISSION_ARCHITECTURE.md` | Complete architectural documentation |
| `docs/ROLE_AND_PERMISSION_SYSTEM_CHANGES.md` | Detailed implementation report |
| `docs/RELEASE_NOTES_2026_10_14.md` | Official release notes for 14 October 2026 |

---

## Verification & Status

* **Frontend Build:** `tsc && vite build` passed with zero errors.
* **Backend Validation:** Validated with zero syntax errors on Node.js.
* **Git Remotes Synced:** Both `origin/main` (`gitpraths/ats-platforms`) and `workvision/main` (`workvisionau/crm.workvision.com.au`) are up to date.

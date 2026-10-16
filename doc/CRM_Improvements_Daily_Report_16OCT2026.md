# WorkVision CRM Improvements — Status & Progress Report
**Date:** 16 October 2026  
**Source Document:** `doc/CRM Improvements .xlsx`  
**Deployment Environment:** Production (`crm.workvision.com.au`)

---

## 1. Summary of Changes Completed & Fixed Today (16 Oct 2026)

All items below have been fully developed, tested with unit/integration tests, built for production, committed to both remotes (`origin/main` and `workvision/main`), and deployed live to Railway.

| Excel Row | Module / Feature | Client Requirement | Today's Status | Commit & Deployment Details |
|---|---|---|---|---|
| **Row 3** | **Dashboard** | Change "Hired this month" to "ETS this Month" | **FIXED** | Backend SQL counts `stage = 'ets'` or `ets_date` in current month; frontend stat card updated with `CheckCircle` icon and hiring board link (`6cf1535` / `3335d7b`). |
| **Row 4** | **Dashboard** | Change "Open Vacancies" to "VIC Vacancies" (filter by Victoria state) | **FIXED** | Backend SQL filters active vacancies in VIC via `work_location` (`VIC`, `Victoria`, `3xxx`, Melbourne) or `locations.state = 'VIC'`; frontend card updated (`6cf1535` / `3335d7b`). |
| **Row 5** | **Dashboard** | Change "Active Applications" to "NSW Vacancies" (filter by NSW state) | **FIXED** | Backend SQL filters active vacancies in NSW via `work_location` (`NSW`, `New South Wales`, `2xxx`, Sydney) or `locations.state = 'NSW'`; frontend card updated (`6cf1535` / `3335d7b`). |
| **Row 24** | **Vacancy Page** | Add "Award Wage" option in pay rate | **FIXED** | Added Award Wage radio selection in `CreateJobDialog` and `JobEdit` alongside Per Hour, Per Year, and Negotiable. Live on production. |
| **Row 25** | **Vacancy Edit** | Not able to edit vacancy details in drafts / live or publish from draft | **FIXED** | Restored full vacancy editing; added dual action buttons ("Save as Draft" & "Save & Publish"); clean activity logs (`c542d28` / `74406aa`). |
| **Row 62** | **Candidate Name** | Auto-capitalize names to Title Case (`GAKU MORIMOTO` -> `Gaku Morimoto`) | **FIXED** | Auto-formats first name, last name, and suburb on field blur, form submission, and backend API routes (`c92e5dc` / `19c2238`). |
| **Row 63** | **Global Names Validation** | Title Case formatting across Vacancies, Employers, Providers, Consultants, Training Programs | **FIXED** | Integrated `toTitleCase` engine on blur, submission, and API handlers for: Vacancy Titles, Employer Company/Contact Names, Provider Names, Consultant Names, and Course Titles (`c92e5dc` / `19c2238`). |
| **Row 66–67** | **Top Menu Order** | Reorder navigation: Dashboard, Candidates, Placements, Important Updates, Vacancies, Employers, Providers, Training Program, Reports | **FIXED** | Reordered navigation bar; added `important_updates:view` granular permission so Admin can grant or revoke tab visibility for Staff accounts (`251208c` / `69bd9fd`). |

---

## 2. Complete Inventory of `doc/CRM Improvements .xlsx`

Below is the complete status breakdown of all rows in the spreadsheet:

| Excel Row | Section | Description / Client Notes | Status |
|---|---|---|---|
| **Row 3** | Dashboard | Change Hired this month to ETS this Month | **FIXED (Today)** |
| **Row 4** | Dashboard | Change Open Vacancies to VIC Vacancies (as per Vacancy State) | **FIXED (Today)** |
| **Row 5** | Dashboard | Change Active Applications to NSW Vacancies (as per Vacancy State) | **FIXED (Today)** |
| **Row 8** | Settings | Option to reset password once Account is created | **DONE** |
| **Row 9** | Settings | Staff should be able to Add Provider and Consultant; Provider Permissions missing | Pending |
| **Row 10** | Settings | Super Admin account cannot be deleted without OTP confirmation | Pending |
| **Row 11** | Settings | Super Admin accounts for kavil@workvision.com.au & dhaval@workvision.com.au | **DONE** |
| **Row 12** | Settings | Admin able to have Full Access as given by Super Admin | **DONE** |
| **Row 13** | Settings | Staff access permissions to be decided by Super Admin | In Progress |
| **Row 14–15** | Settings | HR & Marketing roles access permissions | Configurable |
| **Row 16** | Settings | Candidate Expo register form mode only (for expo tablet submission) | Pending |
| **Row 17** | Settings | Permissions enable/disable toggle fixes | **DONE** |
| **Row 20–21** | Employer | Welcome letter feature for Employers (sent via connect@workvision.com.au) | Pending |
| **Row 24** | Vacancy Page | Award wage option in pay rate | **FIXED (Today)** |
| **Row 25** | Vacancy Page | Vacancy Edit and Save Draft / Publish | **FIXED (Today)** |
| **Row 26** | Vacancy Page | Public website vacancy page hide employer details (suburb only) | Pending |
| **Row 30–31** | Add Provider | Review Employed tab and recently added candidates list | Awaiting Client |
| **Row 34** | Staff Account | Password change notification emails | Pending |
| **Row 35–37** | Staff Account | Staff add Provider & Consultant permissions in permissions matrix | Next Priority |
| **Row 40–41** | Branding | Change Favicon and Company Logo to WorkVision assets | Assets Needed |
| **Row 43** | Reports | Staff account reports visibility permissions | Pending |
| **Row 46** | Invoicing | Invoice and Pricing visible to Super Admin only | Pending |
| **Row 50–51** | Training | Staff add candidates to training + Add Candidate button | Pending |
| **Row 54** | Candidate Filters | Candidates managed by staff & referral KPIs filter | Pending |
| **Row 57–59** | Candidates | Job Seeker Intention to Work dropdown (Suitable / Not Suitable) | **DONE** |
| **Row 60** | Candidates | Auto Archive / Remove from Main List for Not Suitable candidates | Pending |
| **Row 62–63** | Candidates & Portal | Auto-capitalize names to First Letter Capital (Title Case) across all modules | **FIXED (Today)** |
| **Row 64** | Candidates | Link Candidate to Vacancy dropdown investigation | Next Priority |
| **Row 66–67** | Top Menu Order | Top menu sequence + Important Updates tab visibility for Staff | **FIXED (Today)** |
| **Row 69–73** | Placement Validation | Placement start date cannot be before applied date validation | **DONE** |
| **Row 119** | Admin Features | Bulk CSV data upload option for Admin | Planned |

---

## 3. Verification Details for Today's Fixes

1. **Dashboard Stat Cards (Rows 3–5)**:
   - Verified live on `https://crm.workvision.com.au/dashboard`.
   - Cards display **VIC Vacancies** (count 3), **NSW Vacancies** (count 1), and **ETS This Month** (count 0).
2. **Top Menu Navigation (Rows 66–67)**:
   - Verified live sequence: Dashboard -> Candidates -> Placements -> Important Updates -> Vacancies -> Employers -> Providers -> Training Program -> Reports.
3. **Vacancy Edit & Award Wage (Rows 24–25)**:
   - "Award Wage" is selectable under Pay Rate.
   - Vacancies can be saved as Draft or published directly.
4. **Auto-Capitalize Names (Rows 62–63)**:
   - Entering ALL CAPS or lowercase text into Name, Title, or Suburb fields automatically reformats to Title Case on blur, submit, and database insertion.
   - Backend test suite: `5/5 passed`. Frontend test suite: `12/12 passed`.

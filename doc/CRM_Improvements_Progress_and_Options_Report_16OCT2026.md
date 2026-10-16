# WorkVision Australia CRM Platform — Improvements & Status Report

**Date:** 16 October 2026  
**Target Environment:** Production (`crm.workvision.com.au`)  
**Reference Document:** `doc/CRM Improvements .xlsx` (Sheet: `CRM Changes`)  
**Audience:** Management, Product Owners, and Technical Team  

---

## 1. Executive Summary of Recently Delivered Enhancements

The following client-requested improvements have been developed, tested, and deployed to production on `crm.workvision.com.au`:

### A. Award Wage Support in Vacancies (Row 24)
- **Requirement:** Allow users to set "Award Wage" as the pay rate type in both Create Vacancy and Edit Vacancy dialogs.
- **Implementation:**
  - Added a dedicated "Award Wage" toggle option alongside Hourly and Annual pay rates.
  - Automatically populates the text "Award Wage" into the pay rate input upon selection.
  - Automatically clears the text when switching back to Hourly or Annual, preventing accidental data mixing.
  - Formatted properly across all vacancy listings, details, and provider broadcast templates.

### B. Vacancy Edit & Publish Workflow (Row 25)
- **Requirement:** Allow recruiters to edit draft and live vacancies easily, and publish draft vacancies directly from the edit screen.
- **Implementation:**
  - Added context-sensitive dual action buttons placed at **both the top right (immediately visible on load)** and at the **bottom of the form** (after scrolling):
    - **Draft Vacancies:** `[Cancel]`, `[Save Draft]`, `[Save & Publish]` (Orange primary button).
    - **Open / Live Vacancies:** `[Cancel]`, `[Revert to Draft]` (Amber outline button), `[Save Changes]` (Orange primary button).
    - **Archived Vacancies:** `[Cancel]`, `[Restore to Open]` (Green outline button), `[Save Changes]` (Orange primary button).
  - Resolved backend status validation rules so legacy vacancies transition smoothly between Draft, Open, and Archived.
  - Cleaned up activity audit logs so that an entry is only created when a vacancy actually transitions between different statuses, preventing duplicate log spam.

### C. Top Navigation Menu Reordering & Staff Access (Rows 66–67)
- **Requirement:** Reorder the main navigation bar to match the company workflow sequence, and ensure Staff accounts can access Important Updates.
- **Implementation:**
  - Reordered the top navigation bar to the exact sequence requested:
    1. **Dashboard**
    2. **Candidates**
    3. **Placements**
    4. **Important Updates**
    5. **Vacancies**
    6. **Employers**
    7. **Providers**
    8. **Training Program**
    9. **Reports**
  - Introduced a granular permission (`important_updates:view`) configurable under **Admin > Users > Manage Permissions**.
  - Administrators can now choose whether individual Staff members or roles can view the Important Updates board.

---

## 2. Clarification on Website Vacancy Page Privacy (Row 26)

**Spreadsheet Note (Row 26, Col 10):**  
*"Website Vacancy page should not show Employer Name or Other Contact Details or Full Address (Only Suburb Name to be displayed)"*

### Context & Recommendation:
- **Business Rationale:** WorkVision is an employment agency. Exposing client employer names, exact street addresses, or staff contact details on a public job board risks candidate disintermediation (candidates contacting the employer directly) and client poaching by competitors.
- **Current Operational Status:** Vacancies from the CRM are currently internal and are not yet fed dynamically to the public marketing site (`workvision.com.au`).
- **Action Taken:** This item is paused until the public website integration / API feed is scheduled. When the public feed is developed, the endpoint will automatically mask the employer name, hide staff contacts, and truncate addresses to Suburb and State only (e.g., `Richmond, VIC`).

---

## 3. Explanation of Dashboard Metric Cards (Rows 3–5)

**Spreadsheet Request:**
- Row 3: Change "Hired This Month" to "ETS This Month"
- Row 4: Change "Open Vacancies" to "VIC Vacancies" (as per Vacancy State)
- Row 5: Change "Active Applications" to "NSW Vacancies" (as per Vacancy State)

### Key Distinction: Why This is a Functional Change, Not Just a Caption Change

It is critical to note that this update **is not merely renaming the text labels**. If only the text labels were renamed, the underlying data would be incorrect and misleading:

| Dashboard Card | What It Currently Calculates | What The Client Requested | Required Functional Change |
| :--- | :--- | :--- | :--- |
| **Card 1** | **All open vacancies** across all of Australia (VIC, NSW, QLD, WA, etc.) | **VIC Vacancies** | Backend query must specifically filter active vacancies where `location = Victoria (VIC)`. |
| **Card 2** | **Active candidate applications** in progress | **NSW Vacancies** | Replaces the application count entirely with an active vacancy count filtered specifically by `location = New South Wales (NSW)`. |
| **Card 3** | Candidates who reached the **`hired`** stage this month | **ETS This Month** | Backend query must count placements that reached the **`ets` (Employment Transition Support)** stage within the current calendar month. |

### Proposed Implementation Details:
1. **Backend Analytics API (`GET /api/stats`):**
   - Query 1: Calculate `vic_vacancies` by matching state against `VIC` or `Victoria`.
   - Query 2: Calculate `nsw_vacancies` by matching state against `NSW` or `New South Wales`.
   - Query 3: Calculate `ets_this_month` by counting applications whose stage transitioned to `ets` in the current month.
2. **Frontend Stat Cards (`Dashboard.tsx`):**
   - Card 1: Display `VIC Vacancies` with a direct link to `/jobs?state=VIC`.
   - Card 2: Display `NSW Vacancies` with a direct link to `/jobs?state=NSW`.
   - Card 3: Display `ETS This Month` with a direct link to the candidate placement board.

---

## 4. Summary of Upcoming Improvement Items for Client Review

Following Dashboard Metric Cards (Option 2), the remaining items from the spreadsheet are grouped below for scheduling:

### Group A: Candidate Module Improvements (Rows 57–64)
- **Auto Name Formatting (Row 62–63):** Automatically format candidate names to Title Case on input or paste (e.g., `GAKU MORIMOTO` to `Gaku Morimoto`).
- **Job Seeker Intention to Work (Rows 57–60):** Add a dropdown status on candidate profiles:
  - *Suitable*
  - *Not Suitable*
  - *Remove from Main List* (auto-archives the candidate profile)
- **Link with Vacancy Dropdown (Row 64):** Ensure the open vacancies dropdown displays reliably on candidate profiles so staff can directly associate a candidate with an active role.

### Group B: Financial & Placement Privacy (Rows 45–46)
- **Invoice & Pricing Guard:** Restrict placement fees, hourly bill rates, and invoice figures so they are visible **only to Super Admin accounts**, shielding commercial rates from standard staff.

### Group C: Provider & Consultant Permissions (Rows 35–37)
- **Granular Provider Permissions:** Add explicit "Create Provider" and "Create Consultant" checkboxes to the Admin Permissions matrix, enabling staff to add external service providers without requiring full administrative access.

---

*Document prepared for review and alignment with client stakeholders.*

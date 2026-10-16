# Vacancies Module: Client Issues Analysis & Implementation Plan

**Source Document:** `doc/CRM Improvements .xlsx` (Sheet: CRM Changes)  
**Module:** Vacancies  
**Status:** In Review — Awaiting User Approval (Zero Code Modified)  

---

## 1. Overview of Client Feedback on Vacancies

From the client feedback spreadsheet, the Vacancies module has four directly related items:

| Spreadsheet Row | Requirement / Title | Exact Client Notes & Comments | Priority |
|:---|:---|:---|:---|
| **Row 24** | Vacancy Page: Award Wage in Pay Rate | *"it should have award wage option in payrate"* | Resolved & Verified |
| **Row 25** | Vacancy Edit: Drafts, Live, and Publish | *"Not able to Edit Vacancy Details in Drafts and Live Vacancy or Save Draft to Publish"* | Critical (Red Highlight) |
| **Row 26** | Website Vacancy Page: Candidate Privacy | *"Website Vacancy page should not show Employer Name or Other Contact Details or Full Address (Only Suburb Name to be displayed)"* | High |
| **Row 64** | Candidate Profile: Link to Vacancy | *"Vacancy list is not coming in drop down list to link with candidates from their profile"* | Resolved (Already Fixed) |

---

## 2. In-Depth Root Cause Analysis

### Issue 1 (Row 24): Award Wage Option in Pay Rate
* **Client Statement:** *"it should have award wage option in payrate"*
* **Current Implementation:**
  * In `packages/frontend/src/components/CreateJobDialog.tsx` (lines 394–416) and `packages/frontend/src/pages/JobEdit.tsx` (lines 330–352), the toggle group only provides two options: **Per Hour** (`per_hour`) and **Annual** (`annual`).
  * In PostgreSQL, the `jobs` table has a strict check constraint:
    `CHECK (pay_rate_type = ANY (ARRAY['per_hour'::text, 'annual'::text]))`
  * The pay rate input field has a hardcoded leading `$` symbol, which is unsuitable when entering modern award wage classifications (e.g., "Award Wage - Level 2").
* **Root Cause:**
  * Database constraint prohibits any value other than `per_hour` and `annual`.
  * Frontend toggle lacks the third "Award Wage" button.
  * UI input formatting assumes purely numeric figures with a currency prefix.

---

### Issue 2 (Row 25): Not Able to Edit Vacancy Details in Drafts / Live or Save Draft to Publish
* **Client Statement:** *"Not able to Edit Vacancy Details in Drafts and Live Vacancy or Save Draft to Publish"*
* **Current Implementation:**
  * **Status Transition Machine:** In `packages/backend/src/utils/jobStatusErrorHandler.js`, the status transitions are strictly limited to `draft`, `published`, and `archived`.
  * **Database Status Mismatch:** 12 active jobs in the PostgreSQL database currently have their status stored as `'open'`. Because `'open'` is missing from the state machine, any status change triggers an unhandled HTTP 422 error: `Unknown current status: "open"`.
  * **JobEdit UI Missing Publish Action:** In `packages/frontend/src/pages/JobEdit.tsx`, the form submit button only calls `api.patch('/jobs/:id', body)`. It has no button or logic to transition a `draft` vacancy to `published` upon saving. Users are forced to leave edit mode and find the status dropdown on `JobDetail.tsx`.
* **Root Cause:**
  * Legacy database records with `status = 'open'` break the backend state machine.
  * `JobEdit.tsx` lacks workflow buttons ("Save as Draft" vs "Save & Publish").

---

### Issue 3 (Row 26): Website Vacancy Page Privacy & Address Masking
* **Client Statement:** *"Website Vacancy page should not show Employer Name or Other Contact Details or Full Address (Only Suburb Name to be displayed)"*
* **Current Implementation:**
  * When vacancies are queried or exported for external display/website job boards, database records contain the full employer record (employer name, contact name, contact email, contact phone, and exact street address like "14 Park Road, Richmond VIC 3121").
* **Root Cause:**
  * The job endpoints do not sanitize sensitive client information for public/external consumers.
  * Street numbers and street names are not stripped to protect employer anonymity; Australian recruitment confidentiality requires exposing only `{suburb}, {state}` (e.g., "Richmond, VIC").

---

### Issue 4 (Row 64): Candidate Profile Cannot Link to Vacancy
* **Status:** Already Fixed & Verified.
* **Client Statement:** *"Vacancy list is not coming in drop down list to link with candidates from their profile"*
* **Current Status:** Tested and operational; candidates can link to vacancies from profile. No further action needed.

---

## 3. Step-by-Step Implementation Plan (Awaiting Confirmation)

### Step 1: Award Wage Option
* **Status:** Completed & Verified.
  1. PostgreSQL check constraint updated: `CHECK (pay_rate_type IN ('per_hour', 'annual', 'award_wage'))`.
  2. Startup auto-migration added to `packages/backend/src/app.js` and `packages/backend/src/config/schema.sql`.
  3. Added "Award Wage" button to toggle group in `CreateJobDialog.tsx` and `JobEdit.tsx`.
  4. Dynamic input formatting: hides leading currency sign and provides award-specific placeholder when "Award Wage" is selected.
  5. Updated pay rate formatters across `JobDetail.tsx`, `Jobs.tsx`, `BroadcastToProvidersModal.tsx`, `Reports.tsx`, and `email.js`.

### Step 2: Vacancy Edit & Save Draft to Publish
1. **Backend Status Normalization (`packages/backend/src/utils/jobStatusErrorHandler.js`):**
   * Map `'open'` to `'published'` in the status state machine so legacy records do not throw HTTP 422 errors.
   * Standardize all existing `'open'` records in PostgreSQL:
     ```sql
     UPDATE jobs SET status = 'published' WHERE status = 'open';
     ```
2. **Frontend Edit Experience (`JobEdit.tsx`):**
   * If a vacancy has status `draft`, provide two clear primary actions:
     * **Save as Draft** (keeps status as draft)
     * **Save & Publish** (updates details and changes status to `published`)
   * If a vacancy is `published`, provide **Save Changes**.

### Step 3: Public Website Vacancy Privacy & Address Masking
1. **Backend Data Sanitization:**
   * On public/external job listings, omit `employer_name`, `contact_name`, `contact_email`, and `contact_phone`.
   * Parse the location string and return only `{suburb}, {state}` (e.g., "Parramatta, NSW") instead of the full street address.
2. **Frontend Vacancy Display:**
   * Ensure public cards render only Job Title, Suburb/State, Work Type, Pay Rate / Award Wage, and Description.

### Step 4: Candidate Profile Vacancy Dropdown
* Completed: Already implemented and verified. No further action needed.

---

## 4. Client Testing & Verification Case: Warehouse Operator

When communicating with the client or having them test the **Award Wage** feature, provide this exact sample scenario from the data folder (`data/vacancies_import_template.xlsx`):

### Sample Vacancy Test Data
* **Job Title:** Warehouse Operator
* **Employer:** Acme Manufacturing
* **Industry:** Warehouse
* **Work Type:** Full-time
* **No. of Positions:** 2
* **Pay Rate Option:** Select **Award Wage**
* **Pay Rate Value:** `Award Wage - Level 2`
* **Work Location:** `Parramatta NSW 2150`
* **Police Check:** Not Required
* **Drug & Alcohol Test:** No
* **WWC:** No
* **Car Required:** No
* **Public Transport:** Yes

### Testing Steps for Client:
1. Navigate to **Vacancies** (`/jobs`) and click **+ Add Vacancy**.
2. Select **Acme Manufacturing** and enter the title `Warehouse Operator`.
3. In the **Pay Rate** section:
   * Notice the three options: **Per Hour**, **Annual**, and **Award Wage**.
   * Click **Award Wage** (the currency symbol `$` is automatically hidden).
   * Enter `Award Wage - Level 2` (or leave default `Award Wage`).
   * Test switching to **Per Hour** / **Annual** — verify the text automatically clears to empty.
   * Switch back to **Award Wage** and proceed.
4. Click through and save the vacancy.
5. On the vacancy details page, verify the pay rate badge displays cleanly as **Award Wage (Level 2)** without `$NaN`.
6. Open **Edit Vacancy** (`/jobs/:id/edit`), confirm the Award Wage toggle is preserved, and save changes.

---

## 5. Ready-to-Send Client Message

> "Hi team,
> 
> We have completed and deployed the update for the Award Wage option in the vacancy creation and edit screens. 
> 
> For testing, please try creating or editing a vacancy with the following sample details:
> - **Job Title:** Warehouse Operator
> - **Employer:** Acme Manufacturing
> - **Pay Rate Option:** Award Wage
> - **Pay Rate Classification:** Award Wage - Level 2
> - **Location:** Parramatta NSW 2150
> 
> You will notice that selecting 'Award Wage' removes the dollar sign prefix and supports award classification levels. If you switch between Award Wage and Hourly/Annual, the field automatically clears cleanly.
> 
> Please test this on your end and let us know if everything functions smoothly for your team."

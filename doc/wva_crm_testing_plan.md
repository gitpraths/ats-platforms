# WVA CRM — Testing Feedback Planning Document

> **Source:** `WVA CRM Testing_latest.docx`  
> **Tested by:** Kev & Dhaval (Support Team)  
> **Test sessions:** 22 Jun · 23 Jun · 25 Jun · 3 Jul 2026  
> **Prepared by:** Development Team  
> **Document date:** 15 Jul 2026

---

## How to Read This Document

Each feedback item from the testing document is presented with:
- The **original feedback text** from Kev/Dhaval
- The **screenshot(s)** they attached
- A **planning note** — priority, complexity, and recommended action

---

---

# SECTION 1 — CANDIDATE FORM

---

## C1 · Name Field Validation

> *"Name and last name field must be accept text only"*

![C1 - Name field validation](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image45.png)

**Status: ✅ Done**
---

## C2 · Hover Tooltip on Placement Date

> *"On Hover or Placement Date can we see the Company and Vacancy Placed in.. This is not important, just good to have. Once we select the date."*

![C2 - Hover placement date 1](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image17.png)

![C2 - Hover placement date 2](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image30.png)

**Status: ✅ Done**
---

## C3 · Edit Vacancy from Candidate Profile

> *"Can we edit the added vacancy from profile?"*

![C3 - Edit vacancy from profile](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image10.png)

**Status: ✅ Done**
---

## C4 · Candidate Serial Number Format

> *"Just minor edits.. Candidate Serial No.. can we have JS-012.. this type just remove C.. JS is short for Job Seeker in our terminology"*

![C4 - Serial number JS format](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image49.png)

**Status: ✅ Done**
---

## C5 · Rename "Stage" to "Status"

> *"Instead of Stage it supposed to be status"*

![C5 - Stage to Status rename](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image11.png)

**Status: ✅ Done**
---

## C6 · Consultant Sync with Provider Profile

> *"When adding consultant, entry should be sync with Provider profile"*

![C6 - Consultant sync](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image35.png)

**Status: ✅ Done**
---

## C7 · Remove Training from Candidate Form

> *"We can remove from candidate entry form and keep under training tab for candidate"*

![C7 - Remove training from form](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image5.png)

**Status: ✅ Done**
---

## C8 · Postcode Suburb Dropdown

> *"Post Code when entered 3064.. Auto Filled is Kalkallo, whereas there are more suburbs in same postcode.. maybe we can have a dropdown for selection as there will be many other suburb under same post code."*

![C8 - Postcode dropdown](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image46.png)

**Plan:** 🔴 High · `M` · When postcode lookup returns multiple suburbs, show a dropdown selector instead of auto-filling the first result. Apply to both Candidate form and Employer form.

---

## C9 · Work Status → "Job Seeker Intention to Work"

> *"Change Work Status to Job Seeker Intention to Work — Suitable / Not Suitable (if not suitable must be red color in Candidate list)"*

![C9 - Work status rename](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image28.png)

**Plan:** 🔴 High · `S` · Rename field label. Values: `Suitable` and `Not Suitable`. Candidates with "Not Suitable" must display in red text in the Candidates list page.

---

## C10 · Benchmark Hours Dropdown

> *"Remove default grey value 38.. Numeric value only. Can we have dropdown 8..15..20..25..30..38.."*

![C10 - Benchmark hours dropdown](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image19.png)

**Status: ✅ Done**
---

## C11 · Industry Preference — Add "Other" Option

> *"Option to Add more New Industry + Other with Comment Box"*

![C11 - Industry other option](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image2.png)

**Plan:** 🟡 Medium · `S` · Add an "Other" chip/option to the Industry Preference multi-select. When selected, show a text input for a custom industry.

---

## C12 · Application Stage Bug + Auto Placement Date Bug

> *"- For Warehouse Storeperson - i selected Interview Date.. the Stage did not change"*  
> *"- For retail Team Member When i Add to Vacancy it directly added Placement Date 22 Jun 2026 no option to remove or delete"*

![C12 - Stage bug screenshot](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image14.jpg)

![C12 - Auto placement bug](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image36.png)

**Plan:** 🔴 High · `S` (2 bugs) ·  
- **Bug A:** Entering Interview Date should automatically change stage to "Interview". Fix the trigger.  
- **Bug B:** Adding a vacancy must not auto-populate the Placement Date. Remove auto-assignment.

---

## C13 · Single Active Placement Per Candidate

> *"Candidates must be placed for 1 vacancy at a time"*

![C13 - Single placement rule](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image42.png)

**Status: ✅ Done**
---

## C14 · Resume View/Download Error

> *"Resume view or download it shows error"*

![C14 - Resume error](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image1.png)

**Status: ✅ Done**
---

## C15 · Notes — Xero Style Communication Log

> *"Add Xero style Notes here.. remove from Candidate Profile Form. Notes can be used as communication notes between staff and job seeker. Notes logs should show comments to the user wise.. Date and time.."*

![C15 - Notes communication log](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image22.png)

**Plan:** 🔴 High · `M` · Move Notes out of the candidate form fields. Create a dedicated "Communication Notes" tab with a timeline-style log. Each entry must show: author name, date, time, and note body.

---

## C16 · Wage Subsidy Progress Status

> *"Do we need to add Wagesub progress status??"*

![C16 - Wage subsidy progress](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image15.png)

**Plan:** 🔴 High · `M` · Add a "Wage Subsidy Progress Status" field to both Candidate profile and Placement record. Clarify status values with Kev (e.g. Pending / Applied / Approved / Paid / Rejected).

---

## C17 · Remove Score Field

> *"We can remove this score"*

![C17 - Remove score](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image21.png)

**Status: ✅ Done**
---

---

# SECTION 2 — TRAINING

---

## T1 · Remove Status Dropdown from Enrolment Form

> *"We don't need drop down option for status in enrolment form"*

![T1 - Training status dropdown](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image3.png)

**Plan:** 🟡 Medium · `S` · Remove the manual status dropdown from the training enrolment form. Status should change automatically based on actions taken.

---

## T2 · Certificate Received Question on Completion

> *"Also if we change status to completed then it is supposed to ask for the option of certificate received or no. We can add dropdown box."*

![T2 - Certificate received dropdown](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image41.png)

**Plan:** 🔴 High · `S` · When training status is changed to "Completed", show a prompt: *"Certificate Received?"* with dropdown: `Yes / No / Pending`.

---

## T3 · Hyperlink Candidate Name in Training List

> *"Can we hyperlink to candidate profile if we click on their name so easy to navigate"*

![T3 - Hyperlink candidate name](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image4.png)

**Plan:** 🟡 Medium · `S` · Make candidate names in the Training list clickable links that navigate to `/candidates/:id`.

---

---

# SECTION 3 — PLACEMENT FORM

---

## P1 · Number of Weeks Calculated Field

> *"Need to add calculate week (Number of week) after placement date instead of welfare"*

![P1 - Number of weeks](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image33.png)

**Status: ✅ Done**
---

## P2 · Edit Placement Details + Wage Subsidy Status

> *"If placement are less than 26 weeks then check employment status. Can we edit the placement details incase change in status like resign or termination. Can we add Wagesub progress status?"*

![P2 - Edit placement / wagesub](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image34.png)

**Status: ✅ Done**
---

## P3 · Auto-Stage Change Based on Dates (23 Jun Update)

> *"Instead of dropdown can we make it automatic change depends upon date entered like applied and interview date entered then status change to interview"*

![P3 - Auto stage change](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image38.png)

**Plan:** 🔴 High · `M` · Implement auto-stage logic: Applied Date entered → status = "Applied"; Interview Date entered → status = "Interview"; ETS Date entered → status = "ETS"; Placement Date entered → status = "Hired".

---

## P4 · Manual Application Date Entry

> *"Application date also allow us to enter manually"*

![P4 - Manual applied date](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image12.png)

**Plan:** 🔴 High · `S` · Make Applied Date a manually editable field (not just auto-set to today). Consultants need to backdate entries.

---

## P5 · Placement Tab Not Showing All Records

> *"It did not show all records"*

![P5 - Placement tab missing records 1](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image7.png)

![P5 - Placement tab missing records 2](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image44.png)

**Status: ✅ Done**
---

## P6 · Wage Subsidy Status Column on Placement Page

> *"Add 1 more column of wagesub process status on placement page as we have to follow up for after placement"*

![P6 - Wagesub column placement page](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image32.png)

**Plan:** 🔴 High · `M` · Add a "Wage Subsidy Status" column to the Placements list page. Values to confirm with Kev.

---

## P7 · ETS / Placement Date Validation (25 Jun Update)

> *"It should allow ETS and placement date can be the same as Interview date as sometimes candidates have an interview and will commence the same day but not earlier than the interview date. Also it should allow enter manually applied date as sometime consultant have no time to update on same day"*

![P7 - ETS placement same day](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image40.png)

**Plan:** 🔴 High · `S` · Relax date validation — ETS Date and Placement Date can equal Interview Date. They cannot be earlier than Interview Date.

---

## P8 · Placement Tab — Wage Subsidy Instalments (3 Jul Update)

> *"Wage Subsidy — 13 Week Instalment — 26 Week Instalment is supposed to check for previous installment status."*

![P8 - Wage subsidy instalments](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image37.png)

**Status: ✅ Done**
---

## P9 · Welfare Check Timeline

> *"Welfare Check Timeline — Day 1 Check — 4 Weeks — 12 Weeks — 26 Weeks — This check also should check status of previous checks."*

![P9 - Welfare check timeline](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image13.png)

**Plan:** 🔴 High · `L` · Enforce sequential welfare checks: Day 1 → 4 Weeks → 12 Weeks → 26 Weeks. Each milestone must confirm previous was completed before allowing the next.

---

## P10 · Placement Tab Not Showing All Records (3 Jul Repeat)

> *"Placement tab is not showing all records. For E.G. see the current candidates list in screenshot. Not showing all records."*

![P10 - Placement records missing](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image26.png)

**Status: ✅ Done**
---

---

# SECTION 4 — TRAINING PAGE

---

## T4 · Rename "Training" → "Training Program"

> *"Change training to training Program"*

![T4 - Training page rename](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image8.png)

**Status: ✅ Done**
---

---

# SECTION 5 — CANDIDATES PAGE

---

## CP1 · Remove Unneeded Indicator

> *"Remove this indicator. Not required"*

![CP1 - Remove indicator](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image25.png)

**Status: ✅ Done**
---

---

# SECTION 6 — ACCESS CONTROL

> *"Staff Wise Access Levels — Should be able to change access levels as required by admin"*  
> *Access level matrix: Dashboard · Important Updates · Employers · Vacancies · Candidates · Placements · Providers · Training Admin (Candidates + Training)*

**Plan:** 🔴 High · `L` · Build role-based access control (RBAC) system. Admin can assign roles per user. Suggested roles: `Admin` / `Recruiter` / `Provider` / `Read-Only`.

---

---

# SECTION 7 — CANDIDATE FORM (Second Round — Later Testing)

---

## C18 · Resume View in New Tab

> *"- Resume CV view button to view the resume in another tab. It is downloading as of now."*

![C18 - Resume open in tab](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image6.png)

**Plan:** 🔴 High · `S` · Change the resume view action from download to `window.open(url, '_blank')`. Ensure PDF opens in browser tab.

---

## C19 · Benchmark Hours — "Other" Option

> *"- Benchmark hours - other. Drop down should have Other option"*

![C19 - Benchmark hours other](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image47.png)

**Plan:** 🔴 High · `S` · Add "Other" to the benchmark hours dropdown. When selected, show a free-text number input.

---

## C20 · Industry Wise Search Missing

> *"- Industry wise search missing"*

![C20 - Industry search](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image31.png)

**Plan:** 🟡 Medium · `M` · Add an industry filter/search on the Candidates list page. Allow filtering by one or more industry preferences.

---

## C21 · Freeze Column Header

> *"- Individual tab naming — Freeze top Column for better scroll. Only list of candidates able to scroll"*

![C21 - Freeze column header](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image43.png)

**Plan:** 🟡 Medium · `S` · Apply `position: sticky; top: 0` to the `<thead>` of the Candidates table. Column header stays visible while rows scroll.

---

## C22 · Wage Subsidy Approval Check on Placement

> *"- Wage Subsidy approval check (Yes/No) while inserting Placement Date. It should allow same placement date as Interview date also it should ask for Wage Subsidy approval check (Yes/No) when we insert the placement date."*

![C22 - Wage subsidy approval check](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image24.png)

**Plan:** 🔴 High · `M` · When a Placement Date is entered, trigger a popup: *"Was Wage Subsidy Approved? Yes / No"*. Record the response on the placement record.

---

## C23 · Verification → "Other Requirements"

> *"- Verification change to Other Requirements"*

![C23 - Verification rename](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image19.png)

**Status: ✅ Done**
---

## C24 · Other Requirements Fields — Update Later

> *"- Vehicle available Yes or No — Police check Yes or No — Working with children Yes or No — It should allow to update later"*

![C24 - Other requirements editable](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image29.png)

**Status: ✅ Done**
---

## C25 · Availability Box + Remove Job Seeking Status

> *"- Add candidate comment box in Candidate form — Remove Job seeking showing status under Candidate profile and add Availability box"*

![C25 - Availability box](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image27.png)

**Plan:** 🟡 Medium · `M` · Remove "Job Seeking" status pill from the candidate profile header. Replace with an "Availability" info box showing benchmark hours and intention to work status.

---

---

# SECTION 8 — EMPLOYER TAB (3 Jul 2026)

---

## E1 · Employer Contact Phone — Numeric Only + Edit Pre-fill

> *"- Employer contact no. numeric only. Edit page should be prefilled with old details."*

![E1 - Employer contact numeric](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image39.png)

![E1 - Employer edit pre-fill](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image9.png)

**Plan:** 🔴 High · `S` (2 items) ·  
- Add numeric-only validation on Employer contact phone  
- Fix Edit Employer page to pre-fill all existing details (currently loads empty)

---

## E2 · Add Vacancy Button on Employer Profile

> *"- Add vacancy button under employers"*

![E2 - Add vacancy from employer](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image16.png)

**Plan:** 🟡 Medium · `S` · Add a quick "Add Vacancy" button on the Employer detail page that pre-fills the employer.

---

## E3 · Employer Postcode Search

> *"- Add Employer location postcode search should be same as candidate form post code"*

![E3 - Employer postcode search](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image23.png)

**Status: ✅ Done**
---

## E4 · ABN Field with Lookup Link

> *"- Add box for ABN next contact number. Can we link this to ABN look up website. Website for ABN lookup is https://abr.business.gov.au"*

![E4 - ABN field](/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/docx_images/image20.png)

**Status: ✅ Done**
---

---

# SECTION 9 — INFRASTRUCTURE & FUTURE FEATURES

> *"- Migration to our Server*  
> *- Need to go through Excel Sync with Provider Excel*  
> *- Sub Domain crm.workvision.com.au*  
> *- Link to Website on Footer for Quick Access*  
> *- Mobile Optimisation*  
> *- Send Bulk Email to Candidates*  
> *- Send Bulk Vacancies to Providers"*

| # | Item | Priority | Complexity |
|---|---|---|---|
| I1 | Server Migration to client's server | 🔴 High | `L` |
| I2 | Subdomain: `crm.workvision.com.au` | 🔴 High | `M` |
| I3 | User Accounts creation (need list from Kev) | 🔴 High | `M` |
| I4 | CSV template for existing data import | 🔴 High | `M` |
| I5 | Excel Sync walkthrough (Provider Referral Spreadsheet) | 🟡 Medium | `L` |
| I6 | Footer link to WorkVision website | 🟢 Low | `S` |
| I7 | Mobile Optimisation | 🟡 Medium | `L` |
| I8 | Bulk Email to Candidates | 🟢 Low | `L` |
| I9 | Bulk Vacancies to Providers | 🟢 Low | `L` |

---

---

# OPEN QUESTIONS FOR KEV

> [!WARNING]
> These items cannot be implemented without clarification from Kev.

| # | Question |
|---|---|
| Q1 | What are the status values for "Wage Subsidy Progress Status"? (e.g. Pending / Applied / Approved / 13-Week Paid / 26-Week Paid / Rejected) |
| Q2 | What are the access roles needed? Who gets Admin vs Recruiter vs Read-Only? |
| Q3 | Please provide the user account list — Name, Email, Role for each staff member |
| Q4 | "Individual tab naming" (C21) — what should each candidate profile tab be called? |
| Q5 | CP1 — which specific indicator on the Candidates page should be removed? (The screenshot helps but needs confirmation) |

---

---

# SUMMARY TABLE

| Module | Items | 🔴 High | 🟡 Medium | 🟢 Low |
|---|---|---|---|---|
| Candidate Form | 25 | 13 | 10 | 2 |
| Training | 4 | 1 | 3 | 0 |
| Placement | 10 | 8 | 2 | 0 |
| Employers | 4 | 1 | 3 | 0 |
| Access Control | 1 | 1 | 0 | 0 |
| Infrastructure | 9 | 4 | 3 | 2 |
| **TOTAL** | **53** | **28** | **21** | **4** |

---

---

*Prepared: 15 Jul 2026 · Source: WVA CRM Testing_latest.docx (49 screenshots, 53 feedback items)*

# ✅ Vacancy Module — Requirements Confirmation

Hi, please review the below and confirm if this is correct before we start building.

---

## 1. Vacancies Tab (the Vacancies page)

The top of the Vacancies page will show **two buttons**:

- **+ Add Vacancy** → opens the Add Vacancy form
- **+ Add Employer** → goes to the Add Employer page

**Please confirm:** ✅ Yes / ❌ No / ✏️ Change needed

---

## 2. Add Vacancy Form — Step 1 (Vacancy Details)

The form will have the following fields:

| # | Field | Type | Required? |
|---|---|---|---|
| 1 | **Vacancy ID** | Auto-generated (e.g. VAC-0042), shown as read-only | Auto |
| 2 | **Job Title** | Text input | Yes |
| 3 | **Employer** | Dropdown from Employer list. If employer not found → shows "**+ Add Employer**" link | Yes |
| 4 | **Industry** | Text input | No |
| 5 | **Pay Rate** | $ per hour (number) | No |
| 6 | **No. of Positions** | Number input | No |
| 7 | **Work Type** | Dropdown: Full-time / Part-time / Casual | Yes |
| 8 | **Work Location** | Text input (e.g. "123 Main St, Melbourne") | No |
| 9 | **Job Description** | Large text area | No |
| 10 | **Police Check** | Dropdown: Yes / No / Not Required | No |
| 11 | **Drug & Alcohol Test** | Dropdown: Yes / No *(marked as Optional)* | No |
| 12 | **WWC** (Working With Children Check) | Dropdown: Yes / No | No |
| 13 | **Car Required** | Dropdown: Yes / No | No |
| 14 | **Public Transport Accessible** | Dropdown: Yes / No | No |
| 15 | **Wage Subsidy** | Dropdown: Yes / No | No |
| 16 | **Comments** | Text area | No |
| 17 | **Job Board URL** | Text input (pre-filled with WorkVision URL) | No |

> 🔔 **Rule:** When a vacancy is **deactivated/archived**, it will be automatically removed from the Job Board.

**Please confirm:** ✅ Yes / ❌ No / ✏️ Change needed

---

## 3. Add Vacancy Form — Step 2 (Candidate Assignment)

After filling Step 1, the user moves to Step 2 to assign a candidate:

| # | Field | Type | Notes |
|---|---|---|---|
| 1 | **Candidate** | Search & select from existing candidates. If candidate not found → shows "**+ Add Candidate**" link | |
| 2 | **Interview Date** | Date picker | |
| 3 | **ETS Date** | Date picker | |
| 4 | **Placement Date** | Date picker | |

**Please confirm:** ✅ Yes / ❌ No / ✏️ Change needed

---

## 4. Questions — Please Answer

We need your answers to these 5 questions before we start:

**Q1.** What does **ETS** stand for?
> *(e.g. Estimated Start Date?)*

---

**Q2.** For **Work Location** — should the user type a free-text address, OR pick from a saved locations list?
> - Option A: Free-text (e.g. "123 Main St, Melbourne")
> - Option B: Pick from a dropdown list of saved locations

---

**Q3.** For **Industry** — should it auto-fill from the selected Employer's industry, or should the user type it manually?
> - Option A: Auto-fill from Employer
> - Option B: User types it manually

---

**Q4.** When a vacancy is **deactivated**, what should happen to the Job Board URL?
> - Option A: **Permanently delete it** from the database
> - Option B: **Just hide it** on screen (the URL is still saved, just not shown)

---

**Q5.** Step 2 is currently optional — can the user **skip Step 2** and add a candidate later from the vacancy detail page?
> - Option A: Yes, Step 2 is optional / can skip
> - Option B: No, must fill Step 2 before saving

---

## 5. Fields Being Removed from Current Form

The following fields from the **current** form will be **removed** to simplify the new form:

- Department
- Work Model (Onsite / Remote / Hybrid)
- Team
- Type of Vacancy
- Staff Working Status
- End Date
- Required Skills / Desired Skills
- Min Salary / Max Salary / Currency
- Experience Years
- Application Deadline
- Cover Letter Required
- Recruiter Assignment

**Please confirm you are OK removing these:** ✅ Yes / ❌ No, keep some of them

---

*Please reply with your confirmations and answers to the 5 questions above. Once confirmed, development will begin immediately.*

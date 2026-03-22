# Candidate

- Candidates are registered as they apply for a job
  - We publish the Job Posting in different Job Boards (our own Portal, or external boards like LinkedIn)
  - When the candidate visits a Job Board and clicks "Apply", the integration sends a request to our backend to register the Candidate

- For now we won't implement support for the user to apply on our own Portal

- The only way for the Recruiter to select a candidate is by using the "Assign Talent" button

- Clicking the button will bring the Assign Candidate dialog
  - Candidate Card
    - Candidate Avatar
    - Full Name
    - Email
    - City, State
  - The dialog lists candidates with a radio button to pick the desired candidate
  - Default button: Assign Candidate
  - Cancel button

- When the recruiter clicks "Assign Talent" the Job Application is created
  - status: Applied

- The Hiring Board is a screen that lists all Job Applications
  - Job Application stages:
    - Applied
    - Screening
    - Interview
    - Offer
    - Hired
    - Rejected

- The only recruiter authorized to change a job application is:
  - Those present in the `job_recruiter` relation for that job
  - The job owner (the `created_by` field on the job record)

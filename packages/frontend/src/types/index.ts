export type UserRole = "admin" | "recruiter_admin" | "recruiter" | "hiring_manager";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface Location {
  id: string;
  city: string;
  state?: string;
  country: string;
  is_remote: boolean;
}

export type JobStatus = "draft" | "published" | "archived";
export type JobType = "full_time" | "part_time" | "contract" | "internship";
export type WorkModel = "onsite" | "remote" | "hybrid";

export interface Job {
  id: string;
  job_number?: number;
  title: string;
  description?: string;
  department_id?: string;
  department_name?: string;
  location_id?: string;
  city?: string;
  state?: string;
  country?: string;
  is_remote?: boolean;
  job_type?: JobType;
  work_model?: WorkModel;
  status: JobStatus;
  skills_required?: string[];
  skills_desired?: string[];
  cover_letter_required?: boolean;
  min_annual_salary?: number;
  max_annual_salary?: number;
  currency_code?: string;
  experience_years_min?: number;
  deadline?: string;
  team?: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  application_count?: number;
  recruiters?: { id: string; name: string; email: string }[];
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  resume_url?: string;
  linkedin?: string;
  notes?: string;
  application_count?: number;
  created_at: string;
}

export type ApplicationStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export interface Application {
  id: string;
  job_id: string;
  job_title?: string;
  candidate_id: string;
  candidate_name?: string;
  candidate_email?: string;
  // Flattened job location fields returned by GET /applications
  department_name?: string;
  city?: string;
  state?: string;
  country?: string;
  is_remote?: boolean;
  stage: ApplicationStage;
  source?: string;
  score?: number;
  notes?: string;
  applied_at: string;
  updated_at: string;
}

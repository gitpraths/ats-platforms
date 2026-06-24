export type UserRole = "admin" | "recruiter_admin" | "recruiter" | "hiring_manager" | "provider";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  provider_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Provider {
  id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  candidate_count?: number;
  created_at: string;
  updated_at: string;
  // Spreadsheet sync fields
  ms_user_email?: string | null;
  onedrive_file_id?: string | null;
  onedrive_sheet_name?: string;
  last_synced_at?: string | null;
  // Xero integration
  xero_contact_id?: string | null;
}

export interface SyncLog {
  id: string;
  provider_id: string;
  triggered_by: string | null;
  triggered_by_name: string | null;
  status: 'running' | 'success' | 'partial' | 'failed';
  candidates_created: number;
  candidates_updated: number;
  rows_written_back: number;
  rows_skipped: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface SyncResult {
  status: string;
  candidates_created: number;
  candidates_updated: number;
  rows_written_back: number;
  rows_skipped: number;
}

export interface Employer {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  description?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  is_active: boolean;
  open_jobs_count?: number;
  total_jobs_count?: number;
  total_placements_count?: number;
  created_at: string;
  updated_at: string;
}

export type WelfareCheckType = "day_1" | "week_1" | "month_1" | "month_3" | "month_6";

export interface WelfareCheck {
  id: string;
  placement_id: string;
  check_type: WelfareCheckType;
  due_date: string;
  completed_at?: string | null;
  employer_response?: string | null;
  email_sent_at?: string | null;
  created_at: string;
}

export type CandidateWorkStatus = "job_seeking" | "employed" | "placed" | "inactive";

export interface Placement {
  id: string;
  application_id: string;
  candidate_id: string;
  candidate_name?: string;
  candidate_work_status?: CandidateWorkStatus;
  job_id: string;
  job_title?: string;
  employer_id?: string;
  employer_name?: string;
  provider_id?: string;
  provider_name?: string;
  start_date: string;
  confirmed_by_employer: boolean;
  confirmation_sent_at?: string | null;
  notes?: string;
  welfare_checks?: WelfareCheck[];
  created_at: string;
  updated_at: string;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  document_type: "cv" | "id" | "certificate" | "other";
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  created_at: string;
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
  employer_id?: string | null;
  employer_name?: string;
  positions_count?: number;
  job_board_url?: string;
  vacancy_type?: string;
  staff_working_status?: string;
  end_date?: string;
  // ATS-specific fields
  industry?: string;
  pay_rate?: number;
  pay_rate_type?: string;
  work_location?: string;
  police_check?: string;
  drug_alcohol_test?: string;
  wwc?: string;
  car_required?: string;
  public_transport?: string;
  wage_subsidy_required?: string;
  comments?: string;
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
  provider_id?: string | null;
  provider_name?: string;
  address_line1?: string;
  address_line2?: string;
  postcode?: string;
  country?: string;
  benchmark_hours?: number | null;
  work_status?: CandidateWorkStatus;
  interested_job?: string;
  wage_subsidy?: boolean;
  wage_subsidy_amount?: number | null;
  created_at: string;
}

export type ApplicationStage =
  | "applied"
  | "screening"
  | "interview"
  | "ets"
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
  interview_date?: string | null;
  ets_date?: string | null;
  placement_date?: string | null;
}

export interface CandidatePoolMeta {
  total: number;
  page: number;
  limit: number;
  tab_counts: {
    all: number;
    in_progress: number;
    placed: number;
    not_successful: number;
    inactive: number;
  };
}

export interface CandidatePoolRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  suburb?: string;
  date_referred?: string | null;
  work_status?: CandidateWorkStatus;
  notes?: string;
  benchmark_hours?: number | null;
  wage_subsidy?: boolean;
  industry_preference?: string[];
  training_start_date?: string | null;
  training_end_date?: string | null;
  provider_name?: string;
  provider_contact_name?: string;
  provider_contact_email?: string;
  consultant_name?: string;
  placement_id?: string | null;
  job_start_date?: string | null;
  confirmed_by_employer?: boolean;
  employer_name?: string;
  job_title?: string;
  latest_stage?: ApplicationStage | null;
  latest_application_id?: string | null;
  latest_interview_date?: string | null;
  latest_ets_date?: string | null;
  latest_placement_date?: string | null;
  welfare_checks?: WelfareCheck[];
}

export type TrainingStatus = "enrolled" | "in_progress" | "completed" | "withdrawn" | "failed";

export interface Training {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  duration_days: number | null;
  provider_id: string | null;
  provider_name: string | null;
  is_active: boolean;
  unit_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateTraining {
  id: string;
  candidate_id: string;
  training_id: string;
  status: TrainingStatus;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  certificate_no: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Expanded fields returned by the API
  training_name: string;
  training_code: string | null;
  provider_name: string | null;
}

export interface XeroConnection {
  tenant_id: string;
  tenant_name: string | null;
  connected_by_name: string | null;
  connected_at: string;
}

export interface XeroContact {
  contact_id: string;
  name: string;
  email: string | null;
}

export interface XeroInvoiceRow {
  id: string;
  candidate_training_id: string;
  xero_invoice_id: string;
  xero_invoice_number: string | null;
  xero_contact_id: string;
  status: string;
  total_amount: string | null;     // pg numerics come back as strings
  currency_code: string;
  created_by: string | null;
  created_at: string;
}

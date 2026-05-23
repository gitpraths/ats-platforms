import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { api } from "../lib/api";
import type { Department, Employer, Location, User } from "../types";
import AISuggestTitles      from "./AISuggestTitles";
import AIGenerateDescription from "./AIGenerateDescription";
import SkillsInput           from "./SkillsInput";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const JOB_TYPES   = ["full_time", "part_time", "contract", "internship"] as const;
const WORK_MODELS = ["onsite", "remote", "hybrid"] as const;
const CURRENCIES  = ["USD", "EUR", "CAD", "MXN"] as const;

const LABEL: Record<string, string> = {
  full_time: "Full Time", part_time: "Part Time", contract: "Contract", internship: "Internship",
  onsite: "Onsite", remote: "Remote", hybrid: "Hybrid",
};

const STEPS = ["Basics", "Description", "Requirements", "Assignment"] as const;
type Step = 0 | 1 | 2 | 3;

interface FormState {
  title: string;
  department_id: string;
  location_id: string;
  job_type: string;
  work_model: string;
  team: string;
  description: string;
  skills_required: string[];
  skills_desired: string[];
  min_annual_salary: string;
  max_annual_salary: string;
  currency_code: string;
  experience_years_min: string;
  deadline: string;
  cover_letter_required: boolean;
  recruiter_ids: string[];
  employer_id: string;
  positions_count: number;
  job_board_url: string;
  vacancy_type: string;
  staff_working_status: string;
}

const EMPTY: FormState = {
  title: "", department_id: "", location_id: "", job_type: "full_time",
  work_model: "onsite", team: "", description: "",
  skills_required: [], skills_desired: [],
  min_annual_salary: "", max_annual_salary: "", currency_code: "USD",
  experience_years_min: "", deadline: "", cover_letter_required: false,
  recruiter_ids: [],
  employer_id: "", positions_count: 1, job_board_url: "",
  vacancy_type: "", staff_working_status: "active",
};

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        const last    = i === STEPS.length - 1;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                done   ? "bg-blue-600 border-blue-600 text-white" :
                active ? "border-blue-600 text-blue-600 bg-white" :
                         "border-gray-200 text-gray-400 bg-white"
              }`}>
                {done ? <Check size={12} /> : i + 1}
              </div>
              <span className={`text-xs mt-1 font-medium ${active ? "text-blue-600" : done ? "text-gray-600" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {!last && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < current ? "bg-blue-600" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Basics ────────────────────────────────────────────────────────────
function StepBasics({
  form, set, departments, locations, employers,
}: {
  form: FormState;
  set: (k: keyof FormState, v: unknown) => void;
  departments: Department[];
  locations: Location[];
  employers: Employer[];
}) {
  const cls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <div className="space-y-4">
      {/* Title + AI Suggest */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
        <div className="flex gap-2">
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Senior Software Engineer"
            autoFocus
          />
          <AISuggestTitles
            currentTitle={form.title}
            skills={form.skills_required}
            description={form.description}
            onSelect={(t) => set("title", t)}
          />
        </div>
      </div>

      {/* Job Type + Work Model */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Type *</label>
          <select value={form.job_type} onChange={(e) => set("job_type", e.target.value)} className={cls}>
            {JOB_TYPES.map((t) => <option key={t} value={t}>{LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work Model *</label>
          <select value={form.work_model} onChange={(e) => set("work_model", e.target.value)} className={cls}>
            {WORK_MODELS.map((m) => <option key={m} value={m}>{LABEL[m]}</option>)}
          </select>
        </div>
      </div>

      {/* Department + Location */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select value={form.department_id} onChange={(e) => set("department_id", e.target.value)} className={cls}>
            <option value="">— None —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <select value={form.location_id} onChange={(e) => set("location_id", e.target.value)} className={cls}>
            <option value="">— None —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.is_remote ? "Remote" : `${l.city}${l.state ? `, ${l.state}` : ""}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Team */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
        <input
          value={form.team}
          onChange={(e) => set("team", e.target.value)}
          className={cls}
          placeholder="e.g. Platform"
        />
      </div>

      {/* Vacancy Details */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vacancy Details</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employer</label>
            <select value={form.employer_id} onChange={(e) => set("employer_id", e.target.value)} className={cls}>
              <option value="">No Employer</option>
              {employers.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type of Vacancy</label>
            <select value={form.vacancy_type} onChange={(e) => set("vacancy_type", e.target.value)} className={cls}>
              <option value="">Select type</option>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="casual">Casual</option>
              <option value="contract">Contract</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. of Positions</label>
            <input
              type="number"
              min={1}
              value={form.positions_count}
              onChange={(e) => set("positions_count", Number(e.target.value))}
              className={cls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff Working Status</label>
            <select value={form.staff_working_status} onChange={(e) => set("staff_working_status", e.target.value)} className={cls}>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="resigned">Resigned</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Board URL</label>
            <input
              type="url"
              value={form.job_board_url}
              onChange={(e) => set("job_board_url", e.target.value)}
              placeholder="https://seek.com.au/job/12345"
              className={cls}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Description ───────────────────────────────────────────────────────
function StepDescription({
  form, set, departments,
}: {
  form: FormState;
  set: (k: keyof FormState, v: unknown) => void;
  departments: Department[];
}) {
  const departmentName = departments.find((d) => d.id === form.department_id)?.name;
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Job Description</label>
          <AIGenerateDescription
            jobTitle={form.title}
            requiredSkills={form.skills_required}
            desiredSkills={form.skills_desired}
            currentDesc={form.description}
            department={departmentName}
            onGenerated={(d) => set("description", d)}
          />
        </div>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={12}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe the role, key responsibilities, and what success looks like..."
        />
      </div>
      <p className="text-xs text-gray-400">
        Tip: Enter a title first, then click <span className="font-medium text-emerald-600">Generate with AI</span> to get a starting draft.
      </p>
    </div>
  );
}

// ── Step 3: Requirements ──────────────────────────────────────────────────────
function StepRequirements({
  form, set,
}: {
  form: FormState;
  set: (k: keyof FormState, v: unknown) => void;
}) {
  const cls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <div className="space-y-4">
      {/* Skills */}
      <div className="grid grid-cols-2 gap-4">
        <SkillsInput label="Required Skills" value={form.skills_required} onChange={(v) => set("skills_required", v)} />
        <SkillsInput label="Desired Skills"  value={form.skills_desired}  onChange={(v) => set("skills_desired", v)} />
      </div>

      {/* Salary */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Salary</label>
          <input type="number" value={form.min_annual_salary}
            onChange={(e) => set("min_annual_salary", e.target.value)}
            className={cls} placeholder="50000" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Salary</label>
          <input type="number" value={form.max_annual_salary}
            onChange={(e) => set("max_annual_salary", e.target.value)}
            className={cls} placeholder="100000" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select value={form.currency_code} onChange={(e) => set("currency_code", e.target.value)} className={cls}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Experience + Deadline */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Experience (yrs)</label>
          <input type="number" min={0} value={form.experience_years_min}
            onChange={(e) => set("experience_years_min", e.target.value)}
            className={cls} placeholder="3" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Application Deadline</label>
          <input type="date" value={form.deadline}
            onChange={(e) => set("deadline", e.target.value)}
            className={cls} />
        </div>
      </div>

      {/* Cover letter */}
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pt-1">
        <input type="checkbox" checked={form.cover_letter_required}
          onChange={(e) => set("cover_letter_required", e.target.checked)}
          className="w-4 h-4 accent-blue-600" />
        Require cover letter from applicants
      </label>
    </div>
  );
}

// ── Step 4: Assignment ────────────────────────────────────────────────────────
function StepAssignment({
  form, set,
}: {
  form: FormState;
  set: (k: keyof FormState, v: unknown) => void;
}) {
  const [q, setQ] = useState("");

  const { data: recruiters = [], isFetching } = useQuery<User[]>({
    queryKey: ["recruiters"],
    queryFn:  () => api.get<User[]>("/users?role=recruiter"),
  });

  const filtered = recruiters.filter((r) =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase())
  );

  function toggle(id: string) {
    const current = form.recruiter_ids;
    set("recruiter_ids", current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Assign recruiters to this job. You can also do this later from the job detail page.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by name or email..."
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="border rounded-xl overflow-y-auto max-h-56">
        {isFetching && <p className="text-center text-sm text-gray-400 py-4">Loading recruiters...</p>}
        {!isFetching && filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-4">No recruiters found.</p>
        )}
        {filtered.map((r) => {
          const selected = form.recruiter_ids.includes(r.id);
          return (
            <label
              key={r.id}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition border-b last:border-b-0 ${
                selected ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(r.id)}
                className="w-4 h-4 accent-blue-600 flex-shrink-0"
              />
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{r.name}</p>
                <p className="text-xs text-gray-500 truncate">{r.email}</p>
              </div>
              {selected && <Check size={14} className="ml-auto text-blue-600 flex-shrink-0" />}
            </label>
          );
        })}
      </div>

      {form.recruiter_ids.length > 0 && (
        <p className="text-xs text-blue-600 font-medium">
          {form.recruiter_ids.length} recruiter{form.recruiter_ids.length > 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────
export default function CreateJobDialog({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [step,  setStep]  = useState<Step>(0);
  const [form,  setForm]  = useState<FormState>(EMPTY);
  const [error, setError] = useState("");

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn:  () => api.get<Department[]>("/departments"),
    enabled: isOpen,
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn:  () => api.get<Location[]>("/locations"),
    enabled: isOpen,
  });

  const { data: employersResult } = useQuery({
    queryKey: ["employers-select"],
    queryFn:  () => api.list<Employer>("/employers?limit=100"),
    enabled: isOpen,
  });
  const employers = employersResult?.data ?? [];

  const createJob = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<{ id: string }>("/jobs", body),
    onSuccess: async (data) => {
      // Assign recruiters if any selected
      if (form.recruiter_ids.length > 0) {
        try {
          await api.post(`/jobs/${data.id}/recruiters`, { user_ids: form.recruiter_ids });
        } catch { /* non-fatal */ }
      }
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      handleClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function set(key: keyof FormState, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleClose() {
    setStep(0);
    setForm(EMPTY);
    setError("");
    onClose();
  }

  function handleNext() {
    setError("");
    if (step === 0 && !form.title.trim()) {
      setError("Job title is required to continue.");
      return;
    }
    setStep((s) => (s + 1) as Step);
  }

  function handleBack() {
    setError("");
    setStep((s) => (s - 1) as Step);
  }

  function handleSubmit() {
    setError("");
    createJob.mutate({
      title:                 form.title.trim(),
      description:           form.description || undefined,
      department_id:         form.department_id  || undefined,
      location_id:           form.location_id    || undefined,
      job_type:              form.job_type,
      work_model:            form.work_model,
      team:                  form.team           || undefined,
      skills_required:       form.skills_required,
      skills_desired:        form.skills_desired,
      min_annual_salary:     form.min_annual_salary  ? Number(form.min_annual_salary)  : undefined,
      max_annual_salary:     form.max_annual_salary  ? Number(form.max_annual_salary)  : undefined,
      currency_code:         form.currency_code,
      experience_years_min:  form.experience_years_min ? Number(form.experience_years_min) : undefined,
      deadline:              form.deadline       || undefined,
      cover_letter_required: form.cover_letter_required,
      employer_id:           form.employer_id    || undefined,
      positions_count:       form.positions_count,
      job_board_url:         form.job_board_url  || undefined,
      vacancy_type:          form.vacancy_type   || undefined,
      staff_working_status:  form.staff_working_status,
    });
  }

  if (!isOpen) return null;

  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Create New Job</h2>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-6">
          <StepIndicator current={step} />

          {/* Error */}
          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Step content */}
          {step === 0 && <StepBasics form={form} set={set} departments={departments} locations={locations} employers={employers} />}
          {step === 1 && <StepDescription form={form} set={set} departments={departments} />}
          {step === 2 && <StepRequirements form={form} set={set} />}
          {step === 3 && <StepAssignment form={form} set={set} />}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={step === 0 ? handleClose : handleBack}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              {step > 0 && <ChevronLeft size={15} />}
              {step === 0 ? "Cancel" : "Back"}
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createJob.isPending}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                <Check size={15} />
                {createJob.isPending ? "Creating..." : "Create Job"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
              >
                Next <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

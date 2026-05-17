import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { api } from "../lib/api";
import type { Job, Department, Location } from "../types";
import SkillsInput from "../components/SkillsInput";

const JOB_TYPES   = ["full_time", "part_time", "contract", "internship"] as const;
const WORK_MODELS = ["onsite", "remote", "hybrid"] as const;
const CURRENCIES  = ["USD", "EUR", "CAD", "MXN"] as const;

export default function JobEdit() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["job", id],
    queryFn:  () => api.get<Job>(`/jobs/${id}`),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn:  () => api.get<Department[]>("/departments"),
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn:  () => api.get<Location[]>("/locations"),
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    department_id: "",
    location_id: "",
    job_type: "full_time" as string,
    work_model: "onsite" as string,
    skills_required: [] as string[],
    skills_desired: [] as string[],
    cover_letter_required: false,
    min_annual_salary: "",
    max_annual_salary: "",
    currency_code: "USD",
    experience_years_min: "",
    deadline: "",
    team: "",
  });

  // Populate form once job loads
  useEffect(() => {
    if (!job) return;
    setForm({
      title:                  job.title ?? "",
      description:            job.description ?? "",
      department_id:          job.department_id ?? "",
      location_id:            job.location_id ?? "",
      job_type:               job.job_type ?? "full_time",
      work_model:             job.work_model ?? "onsite",
      skills_required:        job.skills_required ?? [],
      skills_desired:         job.skills_desired ?? [],
      cover_letter_required:  job.cover_letter_required ?? false,
      min_annual_salary:      job.min_annual_salary?.toString() ?? "",
      max_annual_salary:      job.max_annual_salary?.toString() ?? "",
      currency_code:          job.currency_code ?? "USD",
      experience_years_min:   job.experience_years_min?.toString() ?? "",
      deadline:               job.deadline ? job.deadline.split("T")[0] : "",
      team:                   job.team ?? "",
    });
  }, [job]);

  const updateJob = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/jobs/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      navigate(`/jobs/${id}`);
    },
  });

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateJob.mutate({
      title:                  form.title,
      description:            form.description || undefined,
      department_id:          form.department_id || undefined,
      location_id:            form.location_id || undefined,
      job_type:               form.job_type,
      work_model:             form.work_model,
      skills_required:        form.skills_required,
      skills_desired:         form.skills_desired,
      cover_letter_required:  form.cover_letter_required,
      min_annual_salary:      form.min_annual_salary ? Number(form.min_annual_salary) : undefined,
      max_annual_salary:      form.max_annual_salary ? Number(form.max_annual_salary) : undefined,
      currency_code:          form.currency_code,
      experience_years_min:   form.experience_years_min ? Number(form.experience_years_min) : undefined,
      deadline:               form.deadline || undefined,
      team:                   form.team || undefined,
    });
  }

  if (isLoading) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!job)      return <p className="p-6 text-red-500">Job not found.</p>;

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to={`/jobs/${id}`} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft size={15} /> Back to Job
      </Link>

      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">Edit Job</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className={labelCls}>Job Title *</label>
          <input
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputCls}
            placeholder="e.g. Senior Software Engineer"
          />
        </div>

        {/* Type + Model */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Job Type *</label>
            <select value={form.job_type} onChange={(e) => set("job_type", e.target.value)} className={inputCls}>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Work Model *</label>
            <select value={form.work_model} onChange={(e) => set("work_model", e.target.value)} className={inputCls}>
              {WORK_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Department + Location */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Department</label>
            <select value={form.department_id} onChange={(e) => set("department_id", e.target.value)} className={inputCls}>
              <option value="">— None —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <select value={form.location_id} onChange={(e) => set("location_id", e.target.value)} className={inputCls}>
              <option value="">— None —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.is_remote ? "Remote" : `${l.city}${l.state ? `, ${l.state}` : ""}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <textarea
            rows={6}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={inputCls}
            placeholder="Describe the role, responsibilities, and what you're looking for..."
          />
        </div>

        {/* Skills */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <SkillsInput label="Required Skills" value={form.skills_required} onChange={(v) => set("skills_required", v)} />
          </div>
          <div>
            <SkillsInput label="Desired Skills" value={form.skills_desired} onChange={(v) => set("skills_desired", v)} />
          </div>
        </div>

        {/* Salary */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Min Salary</label>
            <input
              type="number"
              value={form.min_annual_salary}
              onChange={(e) => set("min_annual_salary", e.target.value)}
              className={inputCls}
              placeholder="60000"
            />
          </div>
          <div>
            <label className={labelCls}>Max Salary</label>
            <input
              type="number"
              value={form.max_annual_salary}
              onChange={(e) => set("max_annual_salary", e.target.value)}
              className={inputCls}
              placeholder="90000"
            />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select value={form.currency_code} onChange={(e) => set("currency_code", e.target.value)} className={inputCls}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Experience + Team + Deadline */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Min Experience (yrs)</label>
            <input
              type="number"
              min={0}
              value={form.experience_years_min}
              onChange={(e) => set("experience_years_min", e.target.value)}
              className={inputCls}
              placeholder="3"
            />
          </div>
          <div>
            <label className={labelCls}>Team</label>
            <input
              value={form.team}
              onChange={(e) => set("team", e.target.value)}
              className={inputCls}
              placeholder="e.g. Platform"
            />
          </div>
          <div>
            <label className={labelCls}>Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Cover letter */}
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.cover_letter_required}
            onChange={(e) => set("cover_letter_required", e.target.checked)}
            className="w-4 h-4"
          />
          Require cover letter
        </label>

        {updateJob.isError && (
          <p className="text-sm text-red-600">Failed to save. Please try again.</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={updateJob.isPending}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Save size={15} /> {updateJob.isPending ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/jobs/${id}`}
            className="px-5 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

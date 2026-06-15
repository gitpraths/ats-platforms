import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import type { Job } from "../types";
import CreateJobDialog from "../components/CreateJobDialog";

const STATUS_STYLE: Record<string, string> = {
  draft:     "border border-slate-400 text-slate-600 bg-transparent",
  published: "border border-green-500 text-green-700 bg-transparent",
  closed:    "border border-red-400 text-red-500 bg-transparent",
  archived:  "border border-amber-400 text-amber-600 bg-transparent",
};

export default function Jobs() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn:  () => api.get<Job[]>("/jobs"),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Vacancies</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 bg-[#e88e2e] hover:bg-[#d07d20] text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> Add Vacancy
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Loading...</p>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 mb-4">No vacancies yet.</p>
          <button onClick={() => setDialogOpen(true)}
            className="text-slate-600 hover:underline text-sm">
            Create your first vacancy
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`}
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition block">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900 tracking-tight">{job.title}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {job.department_name && <span>{job.department_name} · </span>}
                    {job.is_remote ? "Remote" : [job.city, job.state].filter(Boolean).join(", ")}
                    {job.job_type && <span> · {job.job_type.replace("_", " ")}</span>}
                  </p>
                  {job.min_annual_salary && (
                    <p className="text-xs text-slate-400 mt-1">
                      {job.currency_code} {Number(job.min_annual_salary).toLocaleString()}
                      {job.max_annual_salary && ` – ${Number(job.max_annual_salary).toLocaleString()}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[job.status] ?? "border border-slate-400 text-slate-600 bg-transparent"}`}>
                    {job.status}
                  </span>
                  <span className="text-sm text-slate-400">{job.application_count ?? 0} applicants</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateJobDialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

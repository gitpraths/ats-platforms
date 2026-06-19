import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Building2, MapPin, Briefcase, ChevronRight, Users } from "lucide-react";
import { api } from "../lib/api";
import type { Job } from "../types";
import CreateJobDialog from "../components/CreateJobDialog";

const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-600",
  published: "bg-green-100 text-green-700",
  closed:    "bg-red-100 text-red-600",
  archived:  "bg-amber-100 text-amber-700",
};

const STATUS_LABEL: Record<string, string> = {
  draft:     "Draft",
  published: "Open",
  closed:    "Closed",
  archived:  "Archived",
};

const WORK_TYPE_LABEL: Record<string, string> = {
  full_time:  "Full-time",
  part_time:  "Part-time",
  casual:     "Casual",
  contract:   "Contract",
  temporary:  "Temporary",
};

function ComplianceTag({ label, value }: { label: string; value?: string }) {
  if (!value || value === "") return null;
  const yes = value === "yes";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium
      ${yes
        ? "border-green-200 text-green-700 bg-green-50"
        : "border-slate-200 text-slate-400 bg-slate-50"
      }`}>
      {label} {yes ? "✓" : "✗"}
    </span>
  );
}

export default function Jobs() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn:  () => api.get<Job[]>("/jobs"),
  });

  function formatPayRate(job: Job) {
    if (!job.pay_rate) return null;
    const suffix = job.pay_rate_type === "annual" ? "/yr" : "/hr";
    return `$${Number(job.pay_rate).toLocaleString()}${suffix}`;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Vacancies</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 bg-[#e88e2e] hover:bg-[#d07d20] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add Vacancy
          </button>
          <Link
            to="/employers/new"
            className="flex items-center gap-2 bg-[#e88e2e] hover:bg-[#d07d20] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Building2 size={16} /> Add Employer
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Loading...</p>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 mb-4">No vacancies yet.</p>
          <button onClick={() => setDialogOpen(true)} className="text-slate-600 hover:underline text-sm">
            Create your first vacancy
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => {
            const payRate        = formatPayRate(job);
            const displayLoc     = job.work_location
              || (job.is_remote ? "Remote" : [job.city, job.state].filter(Boolean).join(", "));
            const displayType    = job.vacancy_type
              ? (WORK_TYPE_LABEL[job.vacancy_type] ?? job.vacancy_type)
              : null;
            const hasCompliance  = job.police_check || job.drug_alcohol_test || job.wwc
              || job.car_required || job.wage_subsidy_required;

            return (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-[#e88e2e] block group"
              >
                {/* Row 1: Title + Status */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h2 className="font-semibold text-slate-900 text-lg tracking-tight group-hover:text-[#e88e2e] transition-colors">
                    {job.title}
                  </h2>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${STATUS_STYLE[job.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABEL[job.status] ?? job.status}
                  </span>
                </div>

                {/* Row 2: Employer | Location | Work Type */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-3">
                  {job.employer_name && (
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-400" />
                      {job.employer_name}
                    </span>
                  )}
                  {displayLoc && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-400" />
                      {displayLoc}
                    </span>
                  )}
                  {displayType && (
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={13} className="text-slate-400" />
                      {displayType}
                    </span>
                  )}
                </div>

                {/* Row 3: Industry | Pay Rate | Positions | Applicants */}
                <div className="flex flex-wrap items-center gap-3">
                  {job.industry && (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-medium">
                      {job.industry}
                    </span>
                  )}
                  {payRate && (
                    <span className="text-sm font-semibold text-[#e88e2e]">{payRate}</span>
                  )}
                  {(job.positions_count ?? 0) > 0 && (
                    <span className="text-xs text-slate-500">
                      {job.positions_count} {job.positions_count === 1 ? "Position" : "Positions"}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5 text-sm text-slate-400">
                    <Users size={13} />
                    {job.application_count ?? 0} Applicants
                    <ChevronRight size={14} className="text-[#e88e2e] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </div>

                {/* Row 4: Compliance tags */}
                {hasCompliance && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                    <ComplianceTag label="Police Check"   value={job.police_check} />
                    <ComplianceTag label="WWC"            value={job.wwc} />
                    <ComplianceTag label="Car"            value={job.car_required} />
                    <ComplianceTag label="Drug Test"      value={job.drug_alcohol_test} />
                    <ComplianceTag label="Wage Subsidy"   value={job.wage_subsidy_required} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <CreateJobDialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

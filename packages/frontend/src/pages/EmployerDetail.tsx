import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit2, ExternalLink, Briefcase } from "lucide-react";
import { api } from "../lib/api";
import type { Employer, Job } from "../types";
import { useAuth } from "../contexts/AuthContext";

interface EmployerDetailData extends Employer {
  jobs: Pick<Job, "id" | "title" | "status" | "job_type" | "positions_count">[];
}

const STATUS_BADGE: Record<string, string> = {
  draft:     "border border-slate-400 text-slate-600 bg-transparent",
  open:      "border border-green-500 text-green-700 bg-transparent",
  published: "border border-green-500 text-green-700 bg-transparent",
  closed:    "border border-red-400 text-red-500 bg-transparent",
  archived:  "border border-slate-400 text-slate-600 bg-transparent",
};

export default function EmployerDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "recruiter_admin";

  const { data: employer, isLoading } = useQuery<EmployerDetailData>({
    queryKey: ["employer", id],
    queryFn: () => api.get<EmployerDetailData>(`/employers/${id}`),
  });

  if (isLoading) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!employer) return <p className="p-6 text-red-500">Employer not found.</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/employers" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Back to Employers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">{employer.name}</h1>
            {employer.website && (
              <a href={employer.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-slate-600 hover:underline">
                <ExternalLink size={13} /> Website
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {employer.industry && <span className="text-sm text-slate-500">{employer.industry}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              employer.is_active
                ? "border border-green-500 text-green-700 bg-transparent"
                : "border border-slate-400 text-slate-600 bg-transparent"
            }`}>
              {employer.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => navigate(`/employers/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-slate-50">
            <Edit2 size={14} /> Edit
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Open Jobs",       value: employer.open_jobs_count ?? 0 },
          { label: "Total Jobs",      value: employer.total_jobs_count ?? 0 },
          { label: "Total Placements",value: employer.total_placements_count ?? 0 },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-4">Details</h2>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase">Contact Name</dt>
            <dd className="mt-0.5 text-slate-900">{employer.contact_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase">Contact Email</dt>
            <dd className="mt-0.5 text-slate-900">{employer.contact_email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase">Contact Phone</dt>
            <dd className="mt-0.5 text-slate-900">{employer.contact_phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase">Address</dt>
            <dd className="mt-0.5 text-slate-900">{employer.address || "—"}</dd>
          </div>
          {employer.description && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500 uppercase">Description</dt>
              <dd className="mt-0.5 text-slate-900 whitespace-pre-wrap">{employer.description}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Jobs */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
          <Briefcase size={15} /> Jobs
        </h2>
        {!employer.jobs?.length ? (
          <p className="text-sm text-slate-400">No jobs linked to this employer.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">Title</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Positions</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employer.jobs.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/jobs/${j.id}`)}>
                  <td className="py-2 font-medium text-slate-900">{j.title}</td>
                  <td className="py-2 text-slate-500">{j.job_type?.replace("_", " ") || "—"}</td>
                  <td className="py-2 text-slate-500">{j.positions_count ?? 1}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[j.status] ?? "border border-slate-400 text-slate-600 bg-transparent"}`}>
                      {j.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit2, ExternalLink, Briefcase, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { fmtDate, formatName } from "../lib/utils";
import type { Employer, Job } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import CreateJobDialog from "../components/CreateJobDialog";
import { CandidateBadge } from "../components/CandidateBadge";

interface EmployerDetailData extends Employer {
  jobs: Pick<Job, "id" | "title" | "status" | "job_type" | "positions_count">[];
  placements?: { id: string; start_date: string; job_title: string; candidate_name: string; candidate_sr_no?: string }[];
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
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const { user } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = isAdmin || hasPermission("employers:edit");
  const canDelete = isAdmin || hasPermission("employers:delete");

  const deactivate = useMutation({
    mutationFn: () => api.delete(`/employers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employer", id] });
      queryClient.invalidateQueries({ queryKey: ["employers"] });
    },
    onError: (err: any) => alert(err?.message || err?.error || "Failed to deactivate employer"),
  });

  const activate = useMutation({
    mutationFn: () => api.post(`/employers/${id}/activate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employer", id] });
      queryClient.invalidateQueries({ queryKey: ["employers"] });
    },
    onError: (err: any) => alert(err?.message || err?.error || "Failed to activate employer"),
  });

  const deletePermanent = useMutation({
    mutationFn: () => api.delete(`/employers/${id}?permanent=true`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employers"] });
      navigate("/employers");
    },
    onError: (err: any) => alert(err?.message || err?.error || "Failed to delete employer"),
  });

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
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={() => navigate(`/employers/${id}/edit`)}
              className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-slate-50">
              <Edit2 size={14} /> Edit
            </button>
          )}
          {canDelete && !employer.is_active && (
            <button
              onClick={() => {
                if (confirm(`Activate "${employer.name}"?`)) activate.mutate();
              }}
              disabled={activate.isPending}
              className="px-3 py-2 border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-50"
            >
              Activate
            </button>
          )}
          {canDelete && employer.is_active && (
            <button
              onClick={() => {
                if (confirm(`Deactivate "${employer.name}"?`)) deactivate.mutate();
              }}
              disabled={deactivate.isPending}
              className="px-3 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm hover:bg-amber-50"
            >
              Deactivate
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => {
                if (confirm(`Permanently delete employer "${employer.name}"? This cannot be undone.`)) {
                  deletePermanent.mutate();
                }
              }}
              disabled={deletePermanent.isPending}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Open Vacancies",   value: employer.open_jobs_count ?? 0 },
          { label: "Total Vacancies",  value: employer.total_jobs_count ?? 0 },
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
            <dt className="text-xs font-medium text-slate-500 uppercase">ABN</dt>
            <dd className="mt-0.5 text-slate-900">
              {employer.abn ? (
                <div className="flex items-center gap-2">
                  <span>{employer.abn}</span>
                  <a href={`https://abr.business.gov.au/ABN/View?abn=${employer.abn.replace(/\s+/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#e88e2e] hover:underline flex items-center gap-0.5">
                    <ExternalLink size={12} /> Lookup
                  </a>
                </div>
              ) : "—"}
            </dd>
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
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase size={15} /> Vacancies
          </h2>
          {hasPermission("jobs:create") && (
            <button onClick={() => setJobDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e88e2e] text-white rounded-lg text-sm font-medium hover:bg-[#d07d20] transition">
              <Plus size={14} /> Add Vacancy
            </button>
          )}
        </div>
        {!employer.jobs?.length ? (
          <p className="text-sm text-slate-400">No vacancies linked to this employer.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">Title</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Positions</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employer.jobs.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50 cursor-pointer group"
                  onClick={() => navigate(`/jobs/${j.id}`)}>
                  <td className="py-2 font-medium text-slate-900">{j.title}</td>
                  <td className="py-2 text-slate-500">{j.job_type?.replace("_", " ") || "—"}</td>
                  <td className="py-2 text-slate-500">{j.positions_count ?? 1}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[j.status] ?? "border border-slate-400 text-slate-600 bg-transparent"}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${j.id}/edit`); }}
                      className="p-1.5 text-slate-400 hover:text-[#e88e2e] hover:bg-orange-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      title="Edit Vacancy"
                    >
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Placements */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
          Placements
        </h2>
        {!employer.placements?.length ? (
          <p className="text-sm text-slate-400">No placements linked to this employer.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">Candidate</th>
                <th className="pb-2">Vacancy</th>
                <th className="pb-2">Start Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employer.placements.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/placements/${p.id}`)}>
                  <td className="py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CandidateBadge srNo={p.candidate_sr_no} />
                      <span className="font-medium text-slate-900">{formatName(p.candidate_name)}</span>
                    </div>
                  </td>
                  <td className="py-2 text-slate-500">{p.job_title}</td>
                  <td className="py-2 text-slate-500">{fmtDate(p.start_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateJobDialog
        isOpen={jobDialogOpen}
        onClose={() => setJobDialogOpen(false)}
      />
    </div>
  );
}

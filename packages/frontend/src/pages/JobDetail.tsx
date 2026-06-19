import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, MapPin, Briefcase, Building2, Edit2, Trash2, History, X, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { Job, Application, ApplicationStage } from "../types";
import AssignTalentDialog from "../components/AssignTalentDialog";

const STAGE_BADGE: Record<ApplicationStage, string> = {
  applied:   "border border-blue-400 text-blue-600 bg-transparent",
  screening: "border border-purple-400 text-purple-600 bg-transparent",
  interview: "border border-amber-400 text-amber-600 bg-transparent",
  offer:     "border border-orange-400 text-orange-600 bg-transparent",
  hired:     "border border-green-500 text-green-700 bg-transparent",
  rejected:  "border border-red-400 text-red-500 bg-transparent",
};

const STATUS_STYLE: Record<string, string> = {
  draft:     "border border-slate-400 text-slate-600 bg-transparent",
  published: "border border-green-500 text-green-700 bg-transparent",
  archived:  "border border-amber-400 text-amber-600 bg-transparent",
};

const VALID_STATUSES = ["draft", "published", "archived"];

export default function JobDetail() {
  const { id }          = useParams<{ id: string }>();
  const navigate        = useNavigate();
  const queryClient     = useQueryClient();
  const { user }        = useAuth();
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusComment, setStatusComment] = useState("");

  const [showHistory, setShowHistory] = useState(false);

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["job", id],
    queryFn:  () => api.get<Job>(`/jobs/${id}`),
  });

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["applications", id],
    queryFn:  () => api.get<Application[]>(`/applications?job_id=${id}`),
    enabled:  !!id,
  });

  const { data: activity = [] } = useQuery<{ id: string; job_status: string; comment: string; created_at: string; user_name: string }[]>({
    queryKey: ["job-activity", id],
    queryFn:  () => api.get(`/jobs/${id}/activity`),
    enabled:  !!id && showHistory,
  });

  const changeStatus = useMutation({
    mutationFn: (job_status: string) =>
      api.patch(`/jobs/${id}/status`, { job_status, comment: statusComment }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", id] }),
  });

  const deleteJob = useMutation({
    mutationFn: () => api.delete(`/jobs/${id}`),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ["jobs"] }); navigate("/jobs"); },
  });

  const removeRecruiter = useMutation({
    mutationFn: (userId: string) => api.delete(`/jobs/${id}/recruiters`, { user_ids: [userId] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", id] }),
  });

  if (isLoading) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!job)      return <p className="p-6 text-red-500">Vacancy not found.</p>;

  const isOwner    = job.created_by === user?.id;
  const isRecruiter = (job as any).recruiters?.some((r: any) => r.id === user?.id);
  const canEdit    = isOwner || isRecruiter || user?.role === "admin" || user?.role === "recruiter_admin";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link to="/jobs" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft size={15} /> Back to Vacancies
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">{job.title}</h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[job.status]}`}>
                {job.status}
              </span>
              {job.job_number && (
                <span className="text-xs text-slate-400">#{job.job_number}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500 mt-1">
              {job.employer_name && (
                <span className="flex items-center gap-1"><Building2 size={13} />{job.employer_name}</span>
              )}
              {(job.work_location || job.city || job.is_remote) && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} />
                  {job.work_location || (job.is_remote ? "Remote" : `${job.city}${job.state ? `, ${job.state}` : ""}`)}
                </span>
              )}
              {job.vacancy_type && (
                <span className="flex items-center gap-1">
                  <Briefcase size={13} />
                  <span className="capitalize">{job.vacancy_type.replace("_", "-")}</span>
                </span>
              )}
            </div>
            {/* Industry + Pay Rate */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {job.industry && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-medium">
                  {job.industry}
                </span>
              )}
              {job.pay_rate && (
                <span className="text-sm font-semibold text-[#e88e2e]">
                  ${Number(job.pay_rate).toLocaleString()}{job.pay_rate_type === "annual" ? "/yr" : "/hr"}
                </span>
              )}
              {(job.positions_count ?? 0) > 0 && (
                <span className="text-xs text-slate-500">{job.positions_count} {job.positions_count === 1 ? "Position" : "Positions"}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={() => setAssignOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20]"
              >
                <Users size={14} /> Assign Talent
              </button>
              <button
                onClick={() => navigate(`/jobs/${id}/edit`)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-gray-50"
              >
                <Edit2 size={14} /> Edit
              </button>
              {isOwner && (
                <button
                  onClick={() => { if (confirm("Delete this vacancy?")) deleteJob.mutate(); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Compliance */}
        {(job.police_check || job.drug_alcohol_test || job.wwc || job.car_required || job.public_transport || job.wage_subsidy_required) && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">Compliance Requirements</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Police Check",        value: job.police_check },
                { label: "Drug & Alcohol Test",  value: job.drug_alcohol_test },
                { label: "WWC",                  value: job.wwc },
                { label: "Car Required",         value: job.car_required },
                { label: "Public Transport",     value: job.public_transport },
                { label: "Wage Subsidy",         value: job.wage_subsidy_required },
              ].filter(({ value }) => value).map(({ label, value }) => (
                <span key={label} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
                  value === "yes" ? "border-green-200 text-green-700 bg-green-50" :
                  value === "not_required" ? "border-slate-200 text-slate-400 bg-slate-50" :
                  "border-red-200 text-red-500 bg-red-50"
                }`}>
                  {value === "yes" ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Description */}
        <div className="lg:col-span-2 space-y-4">
          {job.description && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-900 tracking-tight mb-3">Description</h2>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{job.description}</p>
            </div>
          )}

          {/* Applications */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 tracking-tight mb-3">
              Applications <span className="text-slate-400 font-normal">({applications.length})</span>
            </h2>
            {applications.length === 0 ? (
              <p className="text-sm text-slate-400">No applications yet.</p>
            ) : (
              <div className="space-y-2">
                {applications.map((app) => (
                  <div key={app.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{app.candidate_name}</p>
                      <p className="text-xs text-slate-500">{app.candidate_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {app.score != null && app.score > 0 && (
                        <span className="text-xs text-slate-400">{app.score}/10</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE[app.stage]}`}>
                        {app.stage}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Change Status */}
          {canEdit && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-slate-900 tracking-tight mb-3">Change Status</h3>
              <div className="space-y-2">
                {VALID_STATUSES.filter((s) => s !== job.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus.mutate(s)}
                    disabled={changeStatus.isPending}
                    className="w-full text-left text-sm px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-gray-50 capitalize disabled:opacity-50"
                  >
                    Move to <strong>{s}</strong>
                  </button>
                ))}
                <textarea
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  placeholder="Optional comment..."
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-xs mt-2"
                />
              </div>
            </div>
          )}

          {/* Recruiters */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-slate-900 tracking-tight mb-3">Recruiters</h3>
            {!(job as any).recruiters?.length ? (
              <p className="text-xs text-slate-400">No recruiters assigned.</p>
            ) : (
              <div className="space-y-2">
                {(job as any).recruiters.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.email}</p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => removeRecruiter.mutate(r.id)}
                        disabled={removeRecruiter.isPending}
                        className="text-slate-300 hover:text-red-500 flex-shrink-0 disabled:opacity-50"
                        title="Remove recruiter"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vacancy Details */}
          {(job.vacancy_type || job.positions_count || job.job_board_url || job.industry || job.pay_rate || job.comments) && (
            <div className="bg-white rounded-xl shadow-sm p-5 text-xs text-slate-500 space-y-2">
              <p className="text-sm font-semibold text-slate-700 mb-2">Vacancy Details</p>
              {job.industry && (
                <div className="flex justify-between">
                  <span>Industry</span>
                  <span className="text-slate-900">{job.industry}</span>
                </div>
              )}
              {job.vacancy_type && (
                <div className="flex justify-between">
                  <span>Work Type</span>
                  <span className="text-slate-900 capitalize">{job.vacancy_type.replace("_", "-")}</span>
                </div>
              )}
              {job.pay_rate && (
                <div className="flex justify-between">
                  <span>Pay Rate</span>
                  <span className="text-[#e88e2e] font-semibold">
                    ${Number(job.pay_rate).toLocaleString()}{job.pay_rate_type === "annual" ? "/yr" : "/hr"}
                  </span>
                </div>
              )}
              {job.positions_count && (
                <div className="flex justify-between">
                  <span>Positions</span>
                  <span className="text-slate-900">{job.positions_count}</span>
                </div>
              )}
              {job.comments && (
                <div className="pt-1">
                  <p className="text-xs font-medium text-slate-600 mb-1">Comments</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{job.comments}</p>
                </div>
              )}
              {job.job_board_url && (
                <div className="pt-1">
                  <a href={job.job_board_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[#e88e2e] hover:underline font-medium">
                    <ExternalLink size={12} /> View on Job Board
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="bg-white rounded-xl shadow-sm p-5 text-xs text-slate-500 space-y-1">
            {job.created_by_name && <p>Owner: <span className="text-slate-700">{job.created_by_name}</span></p>}
            {job.created_at      && <p>Created: {format(new Date(job.created_at), "MMM d, yyyy")}</p>}
            {job.experience_years_min && <p>Experience: {job.experience_years_min}+ yrs</p>}
            {job.team   && <p>Team: {job.team}</p>}
            {job.cover_letter_required && <p className="text-orange-600">Cover letter required</p>}
          </div>

          {/* Activity History */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-900 w-full"
            >
              <History size={14} /> Status History
              <span className="ml-auto text-slate-400 text-xs">{showHistory ? "hide" : "show"}</span>
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2">
                {activity.length === 0 ? (
                  <p className="text-xs text-slate-400">No status changes yet.</p>
                ) : (
                  activity.map((a) => (
                    <div key={a.id} className="text-xs border-l-2 border-slate-200 pl-3">
                      <p className="font-medium text-slate-700 capitalize">{a.job_status}</p>
                      {a.comment && <p className="text-slate-500 italic">{a.comment}</p>}
                      <p className="text-slate-400 mt-0.5">
                        {a.user_name} · {format(new Date(a.created_at), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AssignTalentDialog jobId={id!} isOpen={assignOpen} onClose={() => setAssignOpen(false)} />
    </div>
  );
}

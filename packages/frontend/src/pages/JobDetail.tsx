import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, MapPin, Briefcase, Calendar, Edit2, Trash2, History, X } from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { Job, Application, ApplicationStage } from "../types";
import AssignTalentDialog from "../components/AssignTalentDialog";

const STAGE_BADGE: Record<ApplicationStage, string> = {
  applied:   "bg-blue-100 text-blue-700",
  screening: "bg-purple-100 text-purple-700",
  interview: "bg-yellow-100 text-yellow-700",
  offer:     "bg-orange-100 text-orange-700",
  hired:     "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-600",
};

const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  published: "bg-green-100 text-green-700",
  archived:  "bg-yellow-100 text-yellow-700",
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

  if (isLoading) return <p className="p-6 text-gray-500">Loading...</p>;
  if (!job)      return <p className="p-6 text-red-500">Job not found.</p>;

  const isOwner    = job.created_by === user?.id;
  const isRecruiter = (job as any).recruiters?.some((r: any) => r.id === user?.id);
  const canEdit    = isOwner || isRecruiter || user?.role === "admin" || user?.role === "recruiter_admin";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link to="/jobs" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={15} /> Back to Jobs
      </Link>

      {/* Header */}
      <div className="bg-white border rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[job.status]}`}>
                {job.status}
              </span>
              {job.job_number && (
                <span className="text-xs text-gray-400">#{job.job_number}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
              {job.department_name && (
                <span className="flex items-center gap-1"><Briefcase size={13} />{job.department_name}</span>
              )}
              {(job.city || job.is_remote) && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} />{job.is_remote ? "Remote" : `${job.city}${job.state ? `, ${job.state}` : ""}`}
                </span>
              )}
              {job.job_type && (
                <span className="capitalize">{job.job_type.replace("_", " ")}</span>
              )}
              {job.work_model && (
                <span className="capitalize">{job.work_model}</span>
              )}
              {job.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} />Deadline: {format(new Date(job.deadline), "MMM d, yyyy")}
                </span>
              )}
            </div>
            {(job.min_annual_salary || job.max_annual_salary) && (
              <p className="text-sm text-gray-500 mt-1">
                {job.currency_code} {Number(job.min_annual_salary).toLocaleString()}
                {job.max_annual_salary && ` – ${Number(job.max_annual_salary).toLocaleString()}`} / year
              </p>
            )}
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={() => setAssignOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Users size={14} /> Assign Talent
              </button>
              <button
                onClick={() => navigate(`/jobs/${id}/edit`)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <Edit2 size={14} /> Edit
              </button>
              {isOwner && (
                <button
                  onClick={() => { if (confirm("Delete this job?")) deleteJob.mutate(); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Salary + Skills */}
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {(job as any).skills_required?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Required Skills</p>
              <div className="flex flex-wrap gap-1">
                {(job as any).skills_required.map((s: string) => (
                  <span key={s} className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">{s}</span>
                ))}
              </div>
            </div>
          )}
          {(job as any).skills_desired?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Desired Skills</p>
              <div className="flex flex-wrap gap-1">
                {(job as any).skills_desired.map((s: string) => (
                  <span key={s} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Description */}
        <div className="lg:col-span-2 space-y-4">
          {job.description && (
            <div className="bg-white border rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{job.description}</p>
            </div>
          )}

          {/* Applications */}
          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-3">
              Applications <span className="text-gray-400 font-normal">({applications.length})</span>
            </h2>
            {applications.length === 0 ? (
              <p className="text-sm text-gray-400">No applications yet.</p>
            ) : (
              <div className="space-y-2">
                {applications.map((app) => (
                  <div key={app.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{app.candidate_name}</p>
                      <p className="text-xs text-gray-500">{app.candidate_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {app.score != null && app.score > 0 && (
                        <span className="text-xs text-gray-400">{app.score}/10</span>
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
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Change Status</h3>
              <div className="space-y-2">
                {VALID_STATUSES.filter((s) => s !== job.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus.mutate(s)}
                    disabled={changeStatus.isPending}
                    className="w-full text-left text-sm px-3 py-2 border rounded-lg hover:bg-gray-50 capitalize disabled:opacity-50"
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
          <div className="bg-white border rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Recruiters</h3>
            {!(job as any).recruiters?.length ? (
              <p className="text-xs text-gray-400">No recruiters assigned.</p>
            ) : (
              <div className="space-y-2">
                {(job as any).recruiters.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.email}</p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => removeRecruiter.mutate(r.id)}
                        disabled={removeRecruiter.isPending}
                        className="text-gray-300 hover:text-red-500 flex-shrink-0 disabled:opacity-50"
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

          {/* Meta */}
          <div className="bg-white border rounded-xl p-5 text-xs text-gray-500 space-y-1">
            {job.created_by_name && <p>Owner: <span className="text-gray-700">{job.created_by_name}</span></p>}
            {job.created_at      && <p>Created: {format(new Date(job.created_at), "MMM d, yyyy")}</p>}
            {job.experience_years_min && <p>Experience: {job.experience_years_min}+ yrs</p>}
            {job.team   && <p>Team: {job.team}</p>}
            {job.cover_letter_required && <p className="text-orange-600">Cover letter required</p>}
          </div>

          {/* Activity History */}
          <div className="bg-white border rounded-xl p-5">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-900 w-full"
            >
              <History size={14} /> Status History
              <span className="ml-auto text-gray-400 text-xs">{showHistory ? "hide" : "show"}</span>
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2">
                {activity.length === 0 ? (
                  <p className="text-xs text-gray-400">No status changes yet.</p>
                ) : (
                  activity.map((a) => (
                    <div key={a.id} className="text-xs border-l-2 border-gray-200 pl-3">
                      <p className="font-medium text-gray-700 capitalize">{a.job_status}</p>
                      {a.comment && <p className="text-gray-500 italic">{a.comment}</p>}
                      <p className="text-gray-400 mt-0.5">
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

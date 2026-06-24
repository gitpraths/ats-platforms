import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Users, MapPin, Briefcase, Building2, Edit2, Trash2,
  History, X, ExternalLink, CheckCircle2, XCircle, ChevronDown,
  ChevronUp, ChevronRight, Clock, UserCheck, FileText, Minus,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { Job, Application, ApplicationStage } from "../types";
import AssignTalentDialog from "../components/AssignTalentDialog";

// ── Stage colours ─────────────────────────────────────────────────────────────
const STAGE_BADGE: Record<ApplicationStage, string> = {
  applied:   "bg-blue-50   border border-blue-300   text-blue-700",
  screening: "bg-purple-50 border border-purple-300 text-purple-700",
  interview: "bg-amber-50  border border-amber-300  text-amber-700",
  ets:       "bg-orange-50 border border-orange-300 text-orange-700",
  hired:     "bg-green-50  border border-green-300  text-green-700",
  rejected:  "bg-red-50    border border-red-300    text-red-500",
};

// ── Status styles ─────────────────────────────────────────────────────────────
const STATUS_FILLED: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-700",
  published: "bg-green-100 text-green-700",
  archived:  "bg-amber-100 text-amber-700",
  closed:    "bg-red-100   text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", published: "Open", archived: "Archived", closed: "Closed",
};

// ── Status action button colours ──────────────────────────────────────────────
const STATUS_ACTION: Record<string, string> = {
  published: "border border-green-300 text-green-700 bg-green-50 hover:bg-green-100",
  draft:     "border border-slate-300  text-slate-700 bg-slate-50  hover:bg-slate-100",
  archived:  "border border-amber-300  text-amber-700 bg-amber-50  hover:bg-amber-100",
};

const VALID_STATUSES = ["draft", "published", "archived"];

// ── Compliance tag ─────────────────────────────────────────────────────────────
function ComplianceTag({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  const yes = value === "yes";
  const na  = value === "not_required";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
      yes ? "border-green-200 text-green-700 bg-green-50"
          : na  ? "border-slate-200 text-slate-400 bg-slate-50"
               : "border-red-200 text-red-500 bg-red-50"
    }`}>
      {yes ? <CheckCircle2 size={11} /> : na ? <Minus size={11} /> : <XCircle size={11} />}
      {label}{na ? " (N/A)" : ""}
    </span>
  );
}

// ── Avatar initials ───────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const colours = ["bg-orange-100 text-orange-700", "bg-blue-100 text-blue-700",
                   "bg-purple-100 text-purple-700", "bg-green-100 text-green-700"];
  const colour  = colours[name.charCodeAt(0) % colours.length];
  const sz      = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} ${colour} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JobDetail() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const { user }    = useAuth();

  const [assignOpen,     setAssignOpen]     = useState(false);
  const [statusComment,  setStatusComment]  = useState("");
  const [showHistory,    setShowHistory]    = useState(false);

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["job", id],
    queryFn:  () => api.get<Job>(`/jobs/${id}`),
  });

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["applications", id],
    queryFn:  () => api.get<Application[]>(`/applications?job_id=${id}`),
    enabled:  !!id,
  });

  const { data: activity = [] } = useQuery<
    { id: string; job_status: string; comment: string; created_at: string; user_name: string }[]
  >({
    queryKey: ["job-activity", id],
    queryFn:  () => api.get(`/jobs/${id}/activity`),
    enabled:  !!id && showHistory,
  });

  const changeStatus = useMutation({
    mutationFn: (job_status: string) =>
      api.patch(`/jobs/${id}/status`, { job_status, comment: statusComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      setStatusComment("");
    },
  });

  const deleteJob = useMutation({
    mutationFn: () => api.delete(`/jobs/${id}`),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ["jobs"] }); navigate("/jobs"); },
  });

  const removeRecruiter = useMutation({
    mutationFn: (userId: string) => api.delete(`/jobs/${id}/recruiters`, { user_ids: [userId] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", id] }),
  });

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading vacancy...</div>
    </div>
  );
  if (!job) return <p className="p-6 text-red-500">Vacancy not found.</p>;

  const isOwner    = job.created_by === user?.id;
  const isRecruiter = (job as any).recruiters?.some((r: any) => r.id === user?.id);
  const canEdit    = isOwner || isRecruiter || user?.role === "admin" || user?.role === "recruiter_admin";

  const payRateStr = job.pay_rate
    ? `$${Number(job.pay_rate).toLocaleString()}${job.pay_rate_type === "annual" ? "/yr" : "/hr"}`
    : null;

  const displayLoc = job.work_location || (job.is_remote ? "Remote" : [job.city, job.state].filter(Boolean).join(", "));

  const hasCompliance = job.police_check || job.drug_alcohol_test || job.wwc
    || job.car_required || job.public_transport || job.wage_subsidy_required;

  // Tally applicants by stage for quick summary
  const stageCounts = applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.stage] = (acc[a.stage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back link */}
      <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Vacancies
      </Link>

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          {/* Left: title + meta */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{job.title}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_FILLED[job.status] ?? STATUS_FILLED.draft}`}>
                {STATUS_LABEL[job.status] ?? job.status}
              </span>
              {job.job_number && (
                <span className="text-sm text-slate-400 font-medium">#{job.job_number}</span>
              )}
            </div>

            {/* Employer / Location / Type */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-3">
              {job.employer_name && (
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <Building2 size={14} className="text-slate-400" />{job.employer_name}
                </span>
              )}
              {displayLoc && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-400" />{displayLoc}
                </span>
              )}
              {job.vacancy_type && (
                <span className="flex items-center gap-1.5">
                  <Briefcase size={14} className="text-slate-400" />
                  <span className="capitalize">{job.vacancy_type.replace("_", "-")}</span>
                </span>
              )}
            </div>

            {/* Industry | Pay Rate | Positions */}
            <div className="flex flex-wrap items-center gap-3">
              {job.industry && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full font-semibold">
                  {job.industry}
                </span>
              )}
              {payRateStr && (
                <span className="text-lg font-bold text-[#e88e2e]">{payRateStr}</span>
              )}
              {(job.positions_count ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-sm text-slate-500">
                  <UserCheck size={14} className="text-slate-400" />
                  {job.positions_count} {job.positions_count === 1 ? "Position" : "Positions"}
                </span>
              )}
              {applications.length > 0 && (
                <span className="flex items-center gap-1 text-sm text-slate-500">
                  <Users size={14} className="text-slate-400" />
                  {applications.length} {applications.length === 1 ? "Applicant" : "Applicants"}
                </span>
              )}
            </div>
          </div>

          {/* Right: Action buttons */}
          {canEdit && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setAssignOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#e88e2e] hover:bg-[#d07d20] text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Users size={15} /> Assign Talent
              </button>
              <button
                onClick={() => navigate(`/jobs/${id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Edit2 size={15} /> Edit
              </button>
              {isOwner && (
                <button
                  onClick={() => { if (confirm("Permanently delete this vacancy?")) deleteJob.mutate(); }}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Compliance tags */}
        {hasCompliance && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Compliance Requirements</p>
            <div className="flex flex-wrap gap-2">
              <ComplianceTag label="Police Check"       value={job.police_check} />
              <ComplianceTag label="Drug & Alcohol Test" value={job.drug_alcohol_test} />
              <ComplianceTag label="WWC"                value={job.wwc} />
              <ComplianceTag label="Car Required"       value={job.car_required} />
              <ComplianceTag label="Public Transport"   value={job.public_transport} />
              <ComplianceTag label="Wage Subsidy"       value={job.wage_subsidy_required} />
            </div>
          </div>
        )}
      </div>

      {/* ── Body grid: 3/5 content + 2/5 sidebar ──────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-5">

        {/* ── Left: Description + Applications ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Description */}
          {job.description && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} className="text-slate-400" />
                <h2 className="font-semibold text-slate-900">Description</h2>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{job.description}</p>
            </div>
          )}

          {/* Applications */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-slate-400" />
                <h2 className="font-semibold text-slate-900">
                  Applications
                  <span className="ml-2 bg-[#e88e2e] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {applications.length}
                  </span>
                </h2>
              </div>
              {/* Stage summary chips */}
              {applications.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {Object.entries(stageCounts).map(([stage, count]) => (
                    <span key={stage} className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE[stage as ApplicationStage] ?? ""}`}>
                      {count} {stage}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No applications yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {applications.map((app) => (
                  <Link
                    key={app.id}
                    to={`/candidates/${app.candidate_id}`}
                    className="flex items-center gap-3 border border-slate-100 rounded-xl px-4 py-3 hover:border-[#e88e2e] hover:bg-orange-50/30 transition-all group"
                  >
                    <Avatar name={app.candidate_name ?? "?"} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 group-hover:text-[#e88e2e] transition-colors">
                        {app.candidate_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{app.candidate_email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {app.score != null && app.score > 0 && (
                        <span className="text-xs text-slate-400 font-medium">{app.score}/10</span>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STAGE_BADGE[app.stage]}`}>
                        {app.stage}
                      </span>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-[#e88e2e] transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Change Status */}
          {canEdit && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  job.status === "published" ? "bg-green-500"
                  : job.status === "draft"   ? "bg-slate-400"
                  : "bg-amber-400"
                }`} />
                Status: <span className="capitalize font-bold">{STATUS_LABEL[job.status] ?? job.status}</span>
              </h3>
              <div className="space-y-2">
                {VALID_STATUSES.filter((s) => s !== job.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus.mutate(s)}
                    disabled={changeStatus.isPending}
                    className={`w-full text-left text-sm px-4 py-2.5 rounded-lg font-medium capitalize transition-colors disabled:opacity-50 ${STATUS_ACTION[s]}`}
                  >
                    Move to <strong>{STATUS_LABEL[s] ?? s}</strong>
                  </button>
                ))}
                <textarea
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  placeholder="Optional comment for this status change..."
                  rows={2}
                  className="w-full mt-2 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#e88e2e] resize-none"
                />
              </div>

              {/* Status History (collapsible, inside the status card) */}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 w-full transition-colors"
                >
                  <History size={13} /> Status History
                  <span className="ml-auto">{showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
                </button>
                {showHistory && (
                  <div className="mt-3 space-y-3">
                    {activity.length === 0 ? (
                      <p className="text-xs text-slate-400">No status changes recorded.</p>
                    ) : (
                      activity.map((a) => (
                        <div key={a.id} className="border-l-2 border-[#e88e2e]/30 pl-3">
                          <p className="text-xs font-semibold text-slate-700 capitalize">{a.job_status}</p>
                          {a.comment && <p className="text-xs text-slate-500 italic mt-0.5">{a.comment}</p>}
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock size={10} />
                            {a.user_name} · {format(new Date(a.created_at), "MMM d, yyyy HH:mm")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vacancy Details + Meta — merged card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Vacancy Details</h3>
            <div className="space-y-3 text-sm">
              {job.industry && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Industry</span>
                  <span className="text-slate-900 font-medium">{job.industry}</span>
                </div>
              )}
              {job.vacancy_type && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Work Type</span>
                  <span className="text-slate-900 font-medium capitalize">{job.vacancy_type.replace("_", "-")}</span>
                </div>
              )}
              {payRateStr && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Pay Rate</span>
                  <span className="text-[#e88e2e] font-bold">{payRateStr}</span>
                </div>
              )}
              {(job.positions_count ?? 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Positions</span>
                  <span className="text-slate-900 font-medium">{job.positions_count}</span>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                {job.created_by_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Owner</span>
                    <span className="text-slate-900 font-medium">{job.created_by_name}</span>
                  </div>
                )}
                {job.created_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Created</span>
                    <span className="text-slate-900 font-medium">{format(new Date(job.created_at), "MMM d, yyyy")}</span>
                  </div>
                )}
                {job.experience_years_min && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Experience</span>
                    <span className="text-slate-900 font-medium">{job.experience_years_min}+ years</span>
                  </div>
                )}
                {job.team && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Team</span>
                    <span className="text-slate-900 font-medium">{job.team}</span>
                  </div>
                )}
                {job.cover_letter_required && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Cover Letter</span>
                    <span className="text-orange-600 font-medium text-xs bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">Required</span>
                  </div>
                )}
              </div>

              {/* Comments */}
              {job.comments && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-slate-500 text-xs mb-1 font-medium uppercase tracking-wide">Notes</p>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{job.comments}</p>
                </div>
              )}

              {/* Job Board URL */}
              {job.job_board_url && (
                <div className="border-t border-slate-100 pt-3">
                  <a
                    href={job.job_board_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#e88e2e] hover:underline font-medium text-sm"
                  >
                    <ExternalLink size={13} /> View on Job Board
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Recruiters */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Recruiters</h3>
            {!(job as any).recruiters?.length ? (
              <p className="text-sm text-slate-400 italic">No recruiters assigned.</p>
            ) : (
              <div className="space-y-3">
                {(job as any).recruiters.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <Avatar name={r.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-400 truncate">{r.email}</p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => removeRecruiter.mutate(r.id)}
                        disabled={removeRecruiter.isPending}
                        className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50 flex-shrink-0"
                        title="Remove recruiter"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AssignTalentDialog jobId={id!} isOpen={assignOpen} onClose={() => setAssignOpen(false)} />
    </div>
  );
}

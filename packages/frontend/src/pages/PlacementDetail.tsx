import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, Mail, Check } from "lucide-react";
import { format } from "date-fns";
import { fmtDate } from "../lib/utils";
import { api } from "../lib/api";
import type { Placement, WelfareCheck, WelfareCheckType } from "../types";
import { useAuth } from "../contexts/AuthContext";
import WelfareCheckDots from "../components/WelfareCheckDots";

const CHECK_LABELS: Record<WelfareCheckType, string> = {
  day_1:   "Day 1 Check",
  week_1:  "Week 1 Check",
  month_1: "1 Month Check",
  month_3: "3 Month Check",
  month_6: "6 Month Check",
};

export default function PlacementDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canAct = user?.role === "admin" || user?.role === "recruiter_admin" || user?.role === "recruiter";

  const [completeId, setCompleteId] = useState<string | null>(null);
  const [employerResponse, setEmployerResponse] = useState("");

  const { data: placement, isLoading } = useQuery<Placement>({
    queryKey: ["placement", id],
    queryFn: () => api.get<Placement>(`/placements/${id}`),
  });

  const sendConfirmation = useMutation({
    mutationFn: () => api.post(`/placements/${id}/send-confirmation`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["placement", id] }),
  });

  const markComplete = useMutation({
    mutationFn: ({ checkId, response }: { checkId: string; response: string }) =>
      api.patch(`/welfare-checks/${checkId}`, { employer_response: response }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["placement", id] });
      setCompleteId(null);
      setEmployerResponse("");
    },
  });

  const sendWelfareEmail = useMutation({
    mutationFn: (checkId: string) => api.post(`/welfare-checks/${checkId}/send-email`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["placement", id] }),
  });

  if (isLoading) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!placement) return <p className="p-6 text-red-500">Placement not found.</p>;

  const today = new Date().toISOString().split("T")[0];
  const wcs = placement.welfare_checks ?? [];

  function getCheckIcon(wc: WelfareCheck) {
    if (wc.completed_at) return <CheckCircle size={18} className="text-green-600" />;
    if (wc.due_date <= today) return <AlertTriangle size={18} className="text-yellow-500" />;
    return <Clock size={18} className="text-slate-400" />;
  }

  function getCheckStatus(wc: WelfareCheck) {
    if (wc.completed_at) return { label: "Completed", cls: "text-green-700 bg-green-50" };
    if (wc.due_date <= today) return { label: "Overdue", cls: "text-yellow-700 bg-yellow-50" };
    return { label: "Pending", cls: "text-slate-600 bg-slate-50" };
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/placements" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Back to Placements
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            {placement.candidate_name} → {placement.job_title}
          </h1>
          {placement.employer_name && (
            <p className="text-sm text-slate-500 mt-1">
              <Link to={`/employers/${placement.employer_id}`} className="hover:underline text-slate-600">
                {placement.employer_name}
              </Link>
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <WelfareCheckDots checks={wcs} />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${
              placement.confirmed_by_employer
                ? "border border-green-500 text-green-700 bg-transparent"
                : "border border-amber-400 text-amber-600 bg-transparent"
            }`}>
              {placement.confirmed_by_employer ? "Confirmed" : "Pending Confirmation"}
            </span>
          </div>
        </div>
        {canAct && !placement.confirmed_by_employer && (
          <button onClick={() => sendConfirmation.mutate()}
            disabled={sendConfirmation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#e88e2e] text-white rounded-lg text-sm hover:bg-[#d07d20] disabled:opacity-50">
            <Mail size={14} /> {sendConfirmation.isPending ? "Sending..." : "Send Confirmation Email"}
          </button>
        )}
      </div>

      {/* Info cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Candidate</p>
          <Link to={`/candidates/${placement.candidate_id}`}
            className="font-medium text-slate-600 hover:underline text-sm">{placement.candidate_name}</Link>
          {placement.candidate_work_status && (
            <p className="text-xs text-slate-500 mt-1">{placement.candidate_work_status.replace("_", " ")}</p>
          )}
          {placement.provider_name && (
            <p className="text-xs text-slate-500 mt-0.5">via {placement.provider_name}</p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Job</p>
          <Link to={`/jobs/${placement.job_id}`}
            className="font-medium text-slate-600 hover:underline text-sm">{placement.job_title}</Link>
          {placement.employer_name && (
            <p className="text-xs text-slate-500 mt-1">{placement.employer_name}</p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Placement</p>
          <p className="text-sm font-medium text-slate-900">
            Start: {fmtDate(placement.start_date)}
          </p>
          {placement.notes && <p className="text-xs text-slate-500 mt-1">{placement.notes}</p>}
        </div>
      </div>

      {/* Welfare Check Timeline */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-5">Welfare Check Timeline</h2>
        <div className="space-y-4">
          {wcs.map((wc) => {
            const status = getCheckStatus(wc);
            return (
              <div key={wc.id} className={`flex gap-4 p-4 rounded-xl border ${
                wc.due_date <= today && !wc.completed_at ? "border-yellow-200 bg-yellow-50/30" : "border-slate-100"
              }`}>
                <div className="flex-shrink-0 mt-0.5">{getCheckIcon(wc)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 text-sm">{CHECK_LABELS[wc.check_type as WelfareCheckType]}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Due: {fmtDate(wc.due_date)}</p>
                  {wc.completed_at && (
                    <p className="text-xs text-green-600 mt-0.5">
                      Completed: {fmtDate(wc.completed_at)}
                    </p>
                  )}
                  {wc.employer_response && (
                    <p className="text-sm text-slate-700 mt-2 italic">"{wc.employer_response}"</p>
                  )}
                  {wc.email_sent_at && (
                    <p className="text-xs text-slate-400 mt-1">
                      Email sent {fmtDate(wc.email_sent_at)}
                    </p>
                  )}
                </div>
                {canAct && (
                  <div className="flex-shrink-0 flex flex-col gap-2">
                    {!wc.email_sent_at && !wc.completed_at && (
                      <button onClick={() => sendWelfareEmail.mutate(wc.id)}
                        disabled={sendWelfareEmail.isPending}
                        className="flex items-center gap-1 text-xs text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50">
                        <Mail size={11} /> Send Email
                      </button>
                    )}
                    {!wc.completed_at && (
                      <button onClick={() => { setCompleteId(wc.id); setEmployerResponse(""); }}
                        className="flex items-center gap-1 text-xs text-green-700 border border-green-200 rounded px-2 py-1 hover:bg-green-50">
                        <Check size={11} /> Mark Complete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mark Complete Dialog */}
      {completeId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Mark Welfare Check Complete</h2>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Employer Response / Notes</label>
              <textarea value={employerResponse}
                onChange={(e) => setEmployerResponse(e.target.value)} rows={4}
                placeholder="Optional: record employer's response..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCompleteId(null)}
                className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => markComplete.mutate({ checkId: completeId, response: employerResponse })}
                disabled={markComplete.isPending}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {markComplete.isPending ? "Saving..." : "Confirm Complete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

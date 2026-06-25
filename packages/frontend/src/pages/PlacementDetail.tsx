import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, Mail, Check, Pencil } from "lucide-react";
import { format } from "date-fns";
import { fmtDate } from "../lib/utils";
import { api } from "../lib/api";
import type { Placement, WelfareCheck, WelfareCheckType } from "../types";
import { useAuth } from "../contexts/AuthContext";

const CHECK_LABELS: Record<WelfareCheckType, string> = {
  day_1:   "Day 1 Check",
  week_1:  "Week 1 Check",
  month_1: "1 Month Check",
  month_3: "3 Month Check",
  month_6: "6 Month Check",
};

/** Calculate full weeks elapsed since a YYYY-MM-DD date string. Returns -1 if invalid. */
function weeksOnPlacement(startDate: string): number {
  if (!startDate) return -1;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return -1;
  return Math.floor((Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

/** Small inline component for editing wagesub notes */
function WagesubNotes({ value, onSave, isPending }: { value: string; onSave: (v: string) => void; isPending: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <p className="text-xs text-slate-500 italic flex-1">{value || "No notes"}</p>
        <button onClick={() => { setDraft(value); setEditing(true); }}
          className="text-xs text-slate-400 hover:text-slate-600 underline">Edit notes</button>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
        placeholder="Add wage subsidy notes..."
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
      <div className="flex gap-2 mt-1 justify-end">
        <button onClick={() => setEditing(false)}
          className="text-xs text-slate-500 border rounded px-2 py-1 hover:bg-slate-50">Cancel</button>
        <button onClick={() => { onSave(draft); setEditing(false); }} disabled={isPending}
          className="text-xs bg-[#e88e2e] text-white rounded px-2 py-1 hover:bg-[#d07d20] disabled:opacity-50">Save</button>
      </div>
    </div>
  );
}

export default function PlacementDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canAct = user?.role === "admin" || user?.role === "recruiter_admin" || user?.role === "recruiter";

  const [completeId, setCompleteId] = useState<string | null>(null);
  const [employerResponse, setEmployerResponse] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState("");

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

  const updatePlacement = useMutation({
    mutationFn: (body: {
      employment_status?: string | null;
      end_date?: string | null;
      notes?: string;
      wagesub_status?: string | null;
      wagesub_4wk_paid_at?: string | null;
      wagesub_13wk_paid_at?: string | null;
      wagesub_26wk_paid_at?: string | null;
      wagesub_notes?: string | null;
      [key: string]: string | null | undefined;
    }) =>
      api.patch<Placement>(`/placements/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["placement", id] });
      queryClient.invalidateQueries({ queryKey: ["placements"] });
      setShowEdit(false);
    },
    onError: (err: Error) => setEditError(err.message),
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
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {(() => {
              const wks = weeksOnPlacement(placement.start_date);
              if (wks < 0) return null;
              if (wks < 26) return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                  {wks} week{wks !== 1 ? "s" : ""} on placement
                  <span className="text-xs font-normal opacity-80">· Check employment status</span>
                </span>
              );
              return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700 border border-green-200">
                  {wks} weeks on placement
                  <span className="text-xs font-normal opacity-80">· ✓ 26wk milestone reached</span>
                </span>
              );
            })()}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              placement.confirmed_by_employer
                ? "border border-green-500 text-green-700 bg-transparent"
                : "border border-amber-400 text-amber-600 bg-transparent"
            }`}>
              {placement.confirmed_by_employer ? "Confirmed" : "Pending Confirmation"}
            </span>
          </div>
        </div>
        {canAct && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditStatus(placement.employment_status ?? "");
                setEditEndDate(placement.end_date ?? "");
                setEditNotes(placement.notes ?? "");
                setEditError("");
                setShowEdit(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              <Pencil size={14} /> Edit
            </button>
            {!placement.confirmed_by_employer && (
              <button onClick={() => sendConfirmation.mutate()}
                disabled={sendConfirmation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#e88e2e] text-white rounded-lg text-sm hover:bg-[#d07d20] disabled:opacity-50">
                <Mail size={14} /> {sendConfirmation.isPending ? "Sending..." : "Send Confirmation Email"}
              </button>
            )}
          </div>
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
          <p className="text-sm font-medium text-slate-900">Start: {fmtDate(placement.start_date)}</p>
          {placement.end_date && (
            <p className="text-sm text-slate-600 mt-0.5">End: {fmtDate(placement.end_date)}</p>
          )}
          {placement.employment_status && (
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
              placement.employment_status === "active" ? "bg-green-100 text-green-700" :
              placement.employment_status === "resigned" ? "bg-orange-100 text-orange-700" :
              placement.employment_status === "terminated" ? "bg-red-100 text-red-700" :
              placement.employment_status === "completed" ? "bg-blue-100 text-blue-700" :
              "bg-slate-100 text-slate-600"
            }`}>
              {placement.employment_status.charAt(0).toUpperCase() + placement.employment_status.slice(1)}
            </span>
          )}
          {placement.notes && <p className="text-xs text-slate-500 mt-1">{placement.notes}</p>}
        </div>
      </div>

      {/* Wage Subsidy Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold text-slate-900 tracking-tight">Wage Subsidy</h2>
          {canAct && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">Status:</label>
              <select
                value={placement.wagesub_status ?? ""}
                onChange={(e) => updatePlacement.mutate({ wagesub_status: e.target.value || null })}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">— Not set —</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In Progress</option>
                <option value="claimed">Claimed</option>
                <option value="paid">Paid</option>
              </select>
              {placement.wagesub_status && (
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  placement.wagesub_status === "pending"     ? "bg-slate-100 text-slate-600 border-slate-300" :
                  placement.wagesub_status === "approved"    ? "bg-blue-100 text-blue-700 border-blue-300" :
                  placement.wagesub_status === "in_progress" ? "bg-amber-100 text-amber-700 border-amber-300" :
                  placement.wagesub_status === "claimed"     ? "bg-purple-100 text-purple-700 border-purple-300" :
                  placement.wagesub_status === "paid"        ? "bg-green-100 text-green-700 border-green-300" :
                  "bg-slate-100 text-slate-600 border-slate-300"
                }`}>
                  {placement.wagesub_status === "in_progress" ? "In Progress" :
                   placement.wagesub_status.charAt(0).toUpperCase() + placement.wagesub_status.slice(1)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 4-Week Instalment */}
        {["4wk", "13wk", "26wk"].map((key) => {
          const weeks = key === "4wk" ? 4 : key === "13wk" ? 13 : 26;
          const label = key === "4wk" ? "4-Week Instalment" : key === "13wk" ? "13-Week Instalment" : "26-Week Instalment";
          const paidAtKey = `wagesub_${key}_paid_at` as "wagesub_4wk_paid_at" | "wagesub_13wk_paid_at" | "wagesub_26wk_paid_at";
          const paidAt = placement[paidAtKey];

          const d = new Date(placement.start_date);
          d.setDate(d.getDate() + weeks * 7);
          const dueDate = d.toISOString().split("T")[0];

          const isPaid = !!paidAt;
          const isOverdue = !isPaid && dueDate <= today;

          return (
            <div key={key} className={`flex items-center justify-between gap-3 p-3 rounded-xl border mb-3 ${
              isPaid ? "border-green-200 bg-green-50/40" :
              isOverdue ? "border-amber-200 bg-amber-50/30" :
              "border-slate-100"
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  isPaid ? "bg-green-500" : isOverdue ? "bg-amber-400" : "bg-slate-300"
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500">
                    Due: {fmtDate(dueDate)}
                    {isPaid && (
                      <span className="ml-2 text-green-600 font-medium">· Paid {fmtDate(paidAt!)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isPaid ? "bg-green-100 text-green-700" :
                  isOverdue ? "bg-amber-100 text-amber-700" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {isPaid ? "✓ Paid" : isOverdue ? "Due" : "Upcoming"}
                </span>
                {canAct && !isPaid && (
                  <button
                    onClick={() => {
                      const body: Record<string, string | null> = {};
                      body[paidAtKey] = new Date().toISOString().split("T")[0];
                      updatePlacement.mutate(body);
                    }}
                    disabled={updatePlacement.isPending}
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Mark Paid
                  </button>
                )}
                {canAct && isPaid && (
                  <button
                    onClick={() => {
                      const body: Record<string, string | null> = {};
                      body[paidAtKey] = null;
                      updatePlacement.mutate(body);
                    }}
                    disabled={updatePlacement.isPending}
                    className="text-xs px-2 py-1 border border-slate-200 text-slate-500 rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Wagesub Notes */}
        {canAct && (
          <WagesubNotes
            value={placement.wagesub_notes ?? ""}
            onSave={(val) => updatePlacement.mutate({ wagesub_notes: val })}
            isPending={updatePlacement.isPending}
          />
        )}
        {!canAct && placement.wagesub_notes && (
          <p className="text-xs text-slate-500 italic mt-2">{placement.wagesub_notes}</p>
        )}
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
      {/* Edit Placement Dialog */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Edit Placement</h2>
            {editError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{editError}</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Employment Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">— Select status —</option>
                  <option value="active">Active</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                  <option value="on_leave">On Leave</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Set for resignations, terminations or placement end</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Add reason for status change, context..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button
                onClick={() => setShowEdit(false)}
                className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50"
              >Cancel</button>
              <button
                onClick={() => updatePlacement.mutate({
                  employment_status: editStatus || null,
                  end_date: editEndDate || null,
                  notes: editNotes || undefined,
                })}
                disabled={updatePlacement.isPending}
                className="px-4 py-2 text-sm bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20] disabled:opacity-50"
              >
                {updatePlacement.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

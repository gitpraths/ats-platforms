import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTrainings } from "../../hooks/useTrainings";
import { useCreateEnrolment, useUpdateEnrolment, useDeleteEnrolment } from "../../hooks/useCandidateTrainings";
import { api } from "../../lib/api";
import { formatName } from "../../lib/utils";
import SearchableSelect from "../SearchableSelect";
import type { CandidateTraining, Training, TrainingStatus } from "../../types";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUS_OPTIONS: { value: TrainingStatus; label: string }[] = [
  { value: "enrolled",    label: "Enrolled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed" },
  { value: "withdrawn",   label: "Withdrawn" },
  { value: "failed",      label: "Failed" },
];

export function EnrolmentDialog({
  candidateId: initialCandidateId,
  candidateName: initialCandidateName,
  enrolment,
  onClose,
}: {
  candidateId?: string;
  candidateName?: string;
  enrolment: CandidateTraining | null;
  onClose: () => void;
}) {
  const { data: catalogue } = useTrainings({ isActive: true, limit: 200 });
  const trainings: Training[] = catalogue?.data ?? [];

  const [selectedCandidateId, setSelectedCandidateId] = useState(initialCandidateId ?? enrolment?.candidate_id ?? "");
  const [trainingId, setTrainingId] = useState(enrolment?.training_id ?? "");
  const [status, setStatus] = useState<TrainingStatus>(enrolment?.status ?? "enrolled");
  const [startDate, setStartDate] = useState(enrolment?.start_date ? enrolment.start_date.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(enrolment?.end_date ? enrolment.end_date.slice(0, 10) : "");
  const [certificateReceived, setCertificateReceived] = useState<"yes"|"no"|"">(
    enrolment?.certificate_received === true ? "yes" : enrolment?.certificate_received === false ? "no" : ""
  );
  const [notes, setNotes] = useState(enrolment?.notes ?? "");
  const [error, setError] = useState("");

  // Candidate selection query when opened from Training page
  const { data: candidatesResult, isLoading: loadingCandidates } = useQuery({
    queryKey: ["candidates-pick-enrolment"],
    queryFn: () => api.list<{ id: string; name: string; email: string | null; sr_no?: string | null }>("/candidates?limit=200"),
    enabled: !initialCandidateId && !enrolment,
  });

  const candidateOptions = (candidatesResult?.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.sr_no ? `[${c.sr_no}] ` : ""}${formatName(c.name)}${c.email ? ` (${c.email})` : ""}`,
  }));

  const activeCandidateId = initialCandidateId || selectedCandidateId;

  const create = useCreateEnrolment();
  const update = useUpdateEnrolment();
  const remove = useDeleteEnrolment(activeCandidateId);

  function handleCourseChange(cid: string) {
    setTrainingId(cid);
    const course = trainings.find((t) => t.id === cid);
    if (course?.duration_days && startDate && !endDate) {
      setEndDate(addDays(startDate, course.duration_days));
    }
  }

  function handleStartDateChange(v: string) {
    setStartDate(v);
    const course = trainings.find((t) => t.id === trainingId);
    if (course?.duration_days && v && !endDate) {
      setEndDate(addDays(v, course.duration_days));
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!activeCandidateId) {
      setError("Please select a candidate.");
      return;
    }
    if (!trainingId) {
      setError("Please pick a course.");
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError("End date must be on or after start date.");
      return;
    }

    const payload = {
      training_id: trainingId,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      certificate_no: null,
      certificate_received: certificateReceived === "yes" ? true : certificateReceived === "no" ? false : null,
      notes: notes || null,
    };

    const promise = enrolment
      ? update.mutateAsync({ id: enrolment.id, candidate_id: activeCandidateId, body: payload })
      : create.mutateAsync({ candidate_id: activeCandidateId, ...payload });

    promise.then(onClose).catch((err: Error) => setError(err.message));
  }

  function handleDelete() {
    if (!enrolment) return;
    if (!confirm("Remove this enrolment? This cannot be undone.")) return;
    remove.mutate(enrolment.id, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {enrolment ? "Edit Enrolment" : "Enrol Candidate in Training"}
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Candidate Field */}
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Candidate *</label>
            {initialCandidateId || enrolment ? (
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800">
                {initialCandidateName || (enrolment as any)?.candidate_name || "Selected Candidate"}
              </div>
            ) : (
              <SearchableSelect
                options={candidateOptions}
                value={selectedCandidateId}
                onChange={setSelectedCandidateId}
                placeholder={loadingCandidates ? "Loading candidates..." : "Select a candidate..."}
                hideAllOption
                className="w-full"
              />
            )}
          </div>

          {/* Course Field */}
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Course *</label>
            <select
              value={trainingId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              disabled={!!enrolment}
            >
              <option value="">— Pick a course —</option>
              {trainings.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.code ? ` (${t.code})` : ""}{t.provider_name ? ` · ${t.provider_name}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Status Field */}
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TrainingStatus)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 font-medium block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 font-medium block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Certificate Received */}
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Certificate Received?</label>
            <select
              value={certificateReceived}
              onChange={(e) => setCertificateReceived(e.target.value as "yes"|"no"|"")}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              <option value="yes">Yes — certificate received</option>
              <option value="no">No — not yet received</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Notes</label>
            <textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Optional notes..."
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Modal Actions */}
          <div className="flex justify-between items-center pt-2">
            <div>
              {enrolment && (
                <button type="button" onClick={handleDelete} className="text-xs text-red-600 hover:underline">
                  Remove enrolment
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={create.isPending || update.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-[#e88e2e] text-white hover:bg-[#d07d20] disabled:opacity-50 font-medium transition"
              >
                {create.isPending || update.isPending ? "Saving..." : enrolment ? "Save Changes" : "Enrol Candidate"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

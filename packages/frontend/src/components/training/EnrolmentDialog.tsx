import { useState } from "react";
import { useTrainings } from "../../hooks/useTrainings";
import { useCreateEnrolment, useUpdateEnrolment, useDeleteEnrolment } from "../../hooks/useCandidateTrainings";
import type { CandidateTraining, Training, TrainingStatus } from "../../types";

export function EnrolmentDialog({
  candidateId,
  enrolment,
  onClose,
}: { candidateId: string; enrolment: CandidateTraining | null; onClose: () => void }) {
  const { data: catalogue } = useTrainings({ isActive: true, limit: 200 });
  const trainings: Training[] = catalogue?.data ?? [];

  const [trainingId, setTrainingId] = useState(enrolment?.training_id ?? "");
  const [status] = useState<TrainingStatus>(enrolment?.status ?? "enrolled");
  const [startDate] = useState(enrolment?.start_date ?? "");
  const [endDate] = useState(enrolment?.end_date ?? "");
  const [certificateReceived, setCertificateReceived] = useState<"yes"|"no"|"">(
    enrolment?.certificate_received === true ? "yes" : enrolment?.certificate_received === false ? "no" : ""
  );
  const [notes, setNotes] = useState(enrolment?.notes ?? "");
  const [error, setError] = useState("");

  const create = useCreateEnrolment();
  const update = useUpdateEnrolment();
  const remove = useDeleteEnrolment(candidateId);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!trainingId) { setError("Please pick a course."); return; }
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
      ? update.mutateAsync({ id: enrolment.id, candidate_id: candidateId, body: payload })
      : create.mutateAsync({ candidate_id: candidateId, ...payload });
    promise.then(onClose).catch((err: Error) => setError(err.message));
  }

  function handleDelete() {
    if (!enrolment) return;
    if (!confirm("Remove this enrolment? This cannot be undone.")) return;
    remove.mutate(enrolment.id, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {enrolment ? "Edit Enrolment" : "Enrol in Training"}
        </h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">Course *</label>
            <select
              value={trainingId}
              onChange={(e) => setTrainingId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5"
              disabled={!!enrolment}
            >
              <option value="">— Pick a course —</option>
              {trainings.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Certificate Received?</label>
            <select
              value={certificateReceived}
              onChange={(e) => setCertificateReceived(e.target.value as "yes"|"no"|"")}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5"
            >
              <option value="">— Select —</option>
              <option value="yes">Yes — certificate received</option>
              <option value="no">No — not yet received</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Notes</label>
            <textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5" placeholder="Optional notes..." />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-between items-center pt-2">
            <div>
              {enrolment && (
                <button type="button" onClick={handleDelete} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="px-4 py-2 text-sm rounded-lg bg-[#e88e2e] text-white hover:bg-[#d07d20] disabled:opacity-50">
                {enrolment ? "Save" : "Enrol"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

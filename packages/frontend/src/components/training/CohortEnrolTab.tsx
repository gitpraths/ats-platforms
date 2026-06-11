import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useTrainings } from "../../hooks/useTrainings";
import { useBulkEnrolment } from "../../hooks/useCandidateTrainings";
import { api } from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import type { Training } from "../../types";
import type { PrefilterToEnrolments } from "../../pages/Training";

interface CandidateRow { id: string; name: string; email: string | null }

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CohortEnrolTab({ onViewEnrolments }: { onViewEnrolments: (f: PrefilterToEnrolments) => void }) {
  // ─── Step 1: course ────────────────────────────────────────────
  const [trainingId, setTrainingId] = useState<string>("");
  const { data: catalogueResult } = useTrainings({ isActive: true, limit: 200 });
  const trainings: Training[] = catalogueResult?.data ?? [];
  const selectedTraining = useMemo(
    () => trainings.find((t) => t.id === trainingId) || null,
    [trainings, trainingId]
  );

  // ─── Step 2: dates ─────────────────────────────────────────────
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  function handleStartDateChange(v: string) {
    setStartDate(v);
    if (v && selectedTraining?.duration_days && !endDate) {
      setEndDate(addDays(v, selectedTraining.duration_days));
    }
  }

  // ─── Step 3: candidates ────────────────────────────────────────
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const { data: candidatesResult } = useQuery({
    queryKey: ["candidates-pick", search, page],
    queryFn:  () => api.list<CandidateRow>(
      `/candidates?limit=20&page=${page}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`
    ),
  });
  const candidates = candidatesResult?.data ?? [];
  const candidatesTotal = candidatesResult?.meta?.total ?? 0;
  const candidatesPages = Math.max(1, Math.ceil(candidatesTotal / 20));

  const [selected, setSelected] = useState<CandidateRow[]>([]);
  function toggleSelected(c: CandidateRow) {
    setSelected((cur) => cur.some((x) => x.id === c.id)
      ? cur.filter((x) => x.id !== c.id)
      : [...cur, c]
    );
  }
  function removeSelected(id: string) {
    setSelected((cur) => cur.filter((x) => x.id !== id));
  }

  // ─── Action ────────────────────────────────────────────────────
  const bulk = useBulkEnrolment();
  const [result, setResult] = useState<{
    created: number;
    skipped: { candidate_id: string; reason: string; candidate_name: string }[];
  } | null>(null);
  const [error, setError] = useState("");

  const canSubmit = !!trainingId && !!startDate && selected.length > 0 && !bulk.isPending;

  function handleSubmit() {
    setError("");
    if (!canSubmit) return;
    if (endDate && new Date(endDate) < new Date(startDate)) {
      setError("End date must be on or after start date.");
      return;
    }
    bulk.mutateAsync({
      training_id: trainingId,
      start_date: startDate,
      end_date: endDate || null,
      candidate_ids: selected.map((c) => c.id),
    }).then((res) => {
      const selectedById = new Map(selected.map((c) => [c.id, c]));
      const skippedWithNames = res.skipped.map((s) => ({
        ...s,
        candidate_name: selectedById.get(s.candidate_id)?.name ?? "(unknown)",
      }));
      setResult({ created: res.created.length, skipped: skippedWithNames });
    }).catch((err: Error) => setError(err.message));
  }

  function resetFlow() {
    setTrainingId(""); setStartDate(""); setEndDate("");
    setSelected([]); setSearch(""); setPage(1); setResult(null);
  }

  // ─── Render ───────────────────────────────────────────────────
  const step2Enabled = !!trainingId;
  const step3Enabled = step2Enabled && !!startDate;

  return (
    <div className="flex flex-col min-h-0">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 pb-4">
        <div className="space-y-4">
          {/* Step 1 */}
          <section className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">1. Pick a course</h3>
            <select
              value={trainingId}
              onChange={(e) => setTrainingId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Choose a course —</option>
              {trainings.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ""}</option>
              ))}
            </select>
            {selectedTraining && (
              <div className="mt-3 border border-slate-100 rounded-lg p-3 text-xs text-slate-600">
                <p className="text-sm text-slate-900 font-medium">{selectedTraining.name}</p>
                {selectedTraining.code && <p>{selectedTraining.code}</p>}
                {selectedTraining.provider_name && <p>{selectedTraining.provider_name}</p>}
                {selectedTraining.duration_days && <p>{selectedTraining.duration_days} days nominal</p>}
              </div>
            )}
          </section>

          {/* Step 2 */}
          <section className={`bg-white rounded-xl shadow-sm p-4 ${step2Enabled ? "" : "opacity-50 pointer-events-none"}`}>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">2. Set dates</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cohort-start-date" className="text-xs text-slate-500">Start date *</label>
                <input id="cohort-start-date" type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="cohort-end-date" className="text-xs text-slate-500">End date</label>
                <input id="cohort-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </section>

          {/* Step 3 */}
          <section className={`bg-white rounded-xl shadow-sm p-4 ${step3Enabled ? "" : "opacity-50 pointer-events-none"}`}>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">3. Choose candidates</h3>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search candidates..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {candidates.length === 0 ? (
                <p className="p-4 text-xs text-slate-400">No candidates match.</p>
              ) : (
                candidates.map((c) => {
                  const checked = selected.some((s) => s.id === c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => toggleSelected(c)} />
                      <span className="text-slate-900">{c.name}</span>
                      {c.email && <span className="text-xs text-slate-400 ml-auto">{c.email}</span>}
                    </label>
                  );
                })
              )}
            </div>
            {candidatesTotal > 20 && (
              <div className="flex items-center justify-end gap-2 text-xs text-slate-500 mt-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40">Prev</button>
                <span>Page {page} of {candidatesPages}</span>
                <button disabled={page >= candidatesPages} onClick={() => setPage((p) => Math.min(candidatesPages, p + 1))} className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40">Next</button>
              </div>
            )}
          </section>
        </div>

        {/* Right-hand selected panel */}
        <aside className="bg-white rounded-xl shadow-sm p-4 self-start sticky top-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Selected ({selected.length})</h3>
          {selected.length === 0 ? (
            <p className="text-xs text-slate-400">Pick candidates from the list to enrol them.</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {selected.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-1 py-1.5 text-sm">
                  <span className="truncate">{c.name}</span>
                  <button onClick={() => removeSelected(c.id)} className="text-slate-400 hover:text-red-500 ml-2"><X size={12} /></button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* Sticky submit footer — contained within this tab, not fixed to viewport */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between z-10 shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.04)]">
        <span className="text-xs text-slate-500 ml-4">
          {selected.length} candidate{selected.length === 1 ? "" : "s"} selected
        </span>
        <div className="flex items-center gap-2 mr-4">
          {error && <span className="text-xs text-red-600 mr-2">{error}</span>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm rounded-lg bg-[#e88e2e] text-white hover:bg-[#d07d20] disabled:opacity-40"
          >
            {bulk.isPending ? "Enrolling..." : `Enrol ${selected.length} candidate${selected.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {/* Result dialog */}
      {result && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Bulk enrolment complete</h2>
            <p className="text-sm text-slate-600 mb-4">Created {result.created} enrolment{result.created === 1 ? "" : "s"}.</p>
            {result.skipped.length > 0 && (
              <details className="mb-4 border border-amber-200 rounded-lg p-3 bg-amber-50/40">
                <summary className="text-sm text-amber-700 cursor-pointer">{result.skipped.length} skipped — see why</summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {result.skipped.map((s) => (
                    <li key={s.candidate_id}>
                      <span className="font-medium">{s.candidate_name}</span> — {s.reason.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={resetFlow} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Start another</button>
              <button
                onClick={() => {
                  onViewEnrolments({
                    training_id: trainingId,
                    date_from: startDate,
                  });
                  resetFlow();
                }}
                className="px-4 py-2 text-sm rounded-lg bg-[#e88e2e] text-white hover:bg-[#d07d20]"
              >
                View enrolments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

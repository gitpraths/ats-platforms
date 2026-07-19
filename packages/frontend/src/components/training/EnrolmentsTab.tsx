import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useCandidateTrainingsList, useTrainingStats } from "../../hooks/useCandidateTrainings";
import { useTrainings } from "../../hooks/useTrainings";
import { api } from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import type { CandidateTraining, TrainingStatus } from "../../types";
import type { PrefilterToEnrolments } from "../../pages/Training";
import { GenerateInvoiceDialog } from "./GenerateInvoiceDialog";
import { useXeroInvoicesForEnrolment } from "../../hooks/useXero";
import Pagination from "../Pagination";
import { fmtDate } from "../../lib/utils";

const ALL_STATUSES: TrainingStatus[] = ["enrolled", "in_progress", "completed", "withdrawn", "failed"];

const STATUS_BADGE: Record<TrainingStatus, string> = {
  enrolled:    "border border-slate-400 text-slate-600 bg-transparent",
  in_progress: "border border-blue-400 text-blue-600 bg-transparent",
  completed:   "border border-green-500 text-green-700 bg-transparent",
  withdrawn:   "border border-amber-400 text-amber-600 bg-transparent",
  failed:      "border border-red-400 text-red-500 bg-transparent",
};

interface ProviderOption { id: string; name: string }

export function EnrolmentsTab({
  prefilter,
  onPrefilterConsumed,
}: {
  prefilter?: PrefilterToEnrolments;
  onPrefilterConsumed: () => void;
}) {
  // ─── Filter state ─────────────────────────────────────────────
  const [statuses, setStatuses] = useState<TrainingStatus[]>([]);
  const [trainingId, setTrainingId] = useState<string>("");
  const [providerId, setProviderId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [invoicingEnrolment, setInvoicingEnrolment] = useState<(CandidateTraining & { candidate_name: string }) | null>(null);

  // Apply prefilter from Cohort enrol "View enrolments" handoff
  useEffect(() => {
    if (!prefilter) return;
    if (prefilter.training_id) setTrainingId(prefilter.training_id);
    if (prefilter.date_from)   setDateFrom(prefilter.date_from);
    if (prefilter.status)      setStatuses(prefilter.status);
    setPage(1);
    onPrefilterConsumed();
  }, [prefilter, onPrefilterConsumed]);

  // ─── Catalogue + provider options for the comboboxes ──────────
  const { data: catalogueResult } = useTrainings({ isActive: true, limit: 200 });
  const trainings = catalogueResult?.data ?? [];
  const priceByTrainingId = new Map(trainings.map((t) => [t.id, t.unit_price]));

  const { data: providersResult } = useQuery({
    queryKey: ["providers-select"],
    queryFn:  () => api.list<ProviderOption>("/providers?limit=200"),
  });
  const providers = providersResult?.data ?? [];

  // ─── Server queries ───────────────────────────────────────────
  const filters = useMemo(() => ({
    status: statuses.length ? statuses : undefined,
    training_id: trainingId || undefined,
    provider_id: providerId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    search: search.trim() || undefined,
    page,
    limit: 25,
  }), [statuses, trainingId, providerId, dateFrom, dateTo, search, page]);

  const { data: listResult, isLoading } = useCandidateTrainingsList(filters);
  const { data: stats } = useTrainingStats({
    training_id: filters.training_id,
    provider_id: filters.provider_id,
    date_from: filters.date_from,
    date_to: filters.date_to,
    search: filters.search,
  });
  const rows = listResult?.data ?? [];
  const total = listResult?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  function toggleStatus(s: TrainingStatus) {
    setPage(1);
    setStatuses((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  }

  function clearAll() {
    setStatuses([]); setTrainingId(""); setProviderId("");
    setDateFrom(""); setDateTo(""); setSearch(""); setPage(1);
  }

  const hasActiveFilters =
    statuses.length || trainingId || providerId || dateFrom || dateTo || search.trim();

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {ALL_STATUSES.map((s) => (
          <span key={s} className={`inline-block px-2 py-1 rounded ${STATUS_BADGE[s]}`}>
            {s.replace("_", " ")}: {stats?.[s] ?? 0}
          </span>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => {
            const active = statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  active ? "bg-[#e88e2e] text-white border-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select value={trainingId} onChange={(e) => { setTrainingId(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All courses</option>
            {trainings.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={providerId} onChange={(e) => { setProviderId(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All providers</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="From" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="To" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search candidate name..."
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {hasActiveFilters ? (
          <button onClick={clearAll} className="text-xs text-slate-500 hover:underline">Clear filters</button>
        ) : null}
      </div>

      {/* Top Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        perPage={25}
        onChange={setPage}
        label="enrolments"
      />

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm mt-3">
        {isLoading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-slate-400">No enrolments match these filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 sticky top-14 z-10 shadow-[0_1px_0_0_#f1f5f9]">
              <tr>
                <th className="text-left px-4 py-2.5">Candidate</th>
                <th className="text-left px-4 py-2.5">Course</th>
                <th className="text-left px-4 py-2.5">Provider</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Start</th>
                <th className="text-left px-4 py-2.5">End</th>
                <th className="text-left px-4 py-2.5">Cert #</th>
                <th className="px-4 py-2.5"></th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/candidates/${e.candidate_id}`}
                      className="text-[#e88e2e] hover:underline font-medium"
                    >
                      {e.candidate_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {e.training_name}
                    {e.training_code && <span className="text-xs text-slate-400 ml-1">({e.training_code})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.provider_name || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_BADGE[e.status]}`}>
                      {e.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(e.start_date)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(e.end_date)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.certificate_no ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <InvoiceCell enrolment={e} onGenerate={setInvoicingEnrolment} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      to={`/candidates/${e.candidate_id}`}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:underline"
                    >
                      Open <ExternalLink size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          perPage={25}
          onChange={setPage}
          label="enrolments"
        />
      </div>

      {invoicingEnrolment && (
        <GenerateInvoiceDialog
          enrolment={invoicingEnrolment}
          candidateName={invoicingEnrolment.candidate_name}
          defaultUnitPrice={priceByTrainingId.get(invoicingEnrolment.training_id) ?? null}
          onClose={() => setInvoicingEnrolment(null)}
          onSuccess={() => setInvoicingEnrolment(null)}
        />
      )}
    </div>
  );
}

function InvoiceCell<E extends CandidateTraining>({ enrolment, onGenerate }: { enrolment: E; onGenerate: (e: E) => void }) {
  const { data } = useXeroInvoicesForEnrolment(enrolment.id);
  const existing = data?.data?.[0];
  if (existing) {
    return (
      <a href={`https://invoicing.xero.com/edit/${existing.xero_invoice_id}`} target="_blank" rel="noreferrer"
         className="text-xs text-blue-600 hover:underline">
        View in Xero
      </a>
    );
  }
  return (
    <button onClick={() => onGenerate(enrolment)} className="text-xs text-slate-500 hover:underline">
      Generate invoice
    </button>
  );
}

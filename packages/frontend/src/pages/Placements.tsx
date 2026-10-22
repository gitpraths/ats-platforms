import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle, Mail, FileText, X, Lock, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { fmtDate, toYYYYMMDD, stageLabel, formatName } from "../lib/utils";
import { api } from "../lib/api";
import type { Placement, Candidate, Employer, Provider, Application } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";

import Pagination from "../components/Pagination";
import SearchableSelect from "../components/SearchableSelect";

interface PlacementsData {
  data: Placement[];
}

interface CreateForm {
  candidate_id: string;
  job_id: string;
  employer_id: string;
  start_date: string;
  notes: string;
  application_id: string;
  wagesub_status?: string;
}

/** Calculate full weeks elapsed since a YYYY-MM-DD date string. Returns -1 if invalid. */
function weeksOnPlacement(startDate: string): number {
  if (!startDate) return -1;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return -1;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((Date.now() - start.getTime()) / msPerWeek);
}

export default function Placements() {
  const { user } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const canView = hasPermission("placements:view");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = hasPermission("placements:create");

  const [filterEmployer, setFilterEmployer] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [showCreate, setShowCreate] = useState(false);
  const [invoicingPlacement, setInvoicingPlacement] = useState<Placement | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({
    candidate_id: "", job_id: "", employer_id: "", start_date: "", notes: "", application_id: "",
  });
  const [createError, setCreateError] = useState("");

  const PER_PAGE = perPage;
  const params = new URLSearchParams({
    page: String(page), limit: String(PER_PAGE),
    ...(filterEmployer && { employer_id: filterEmployer }),
    ...(filterProvider && { provider_id: filterProvider }),
    ...(from && { from }),
    ...(to && { to }),
  });

  const { data: placementsData, isLoading } = useQuery({
    queryKey: ["placements", filterEmployer, filterProvider, from, to, page],
    queryFn: () => api.list<Placement>(`/placements?${params}`),
    enabled: canView,
  });

  const { data: candidatesResult } = useQuery({
    queryKey: ["candidates-select"],
    queryFn: () => api.list<Candidate>("/candidates?limit=100"),
  });
  const candidates = candidatesResult?.data ?? [];

  const { data: employersResult } = useQuery({
    queryKey: ["employers-select"],
    queryFn: () => api.list<Employer>("/employers?limit=100"),
  });
  const employers = employersResult?.data ?? [];

  const { data: providersResult } = useQuery({
    queryKey: ["providers-select"],
    queryFn: () => api.list<Provider>("/providers?limit=200"),
  });
  const providers = providersResult?.data ?? [];

  const { data: candidateAppsResult } = useQuery({
    queryKey: ["applications-for-candidate", createForm.candidate_id],
    queryFn: () => api.list<Application>(`/applications?candidate_id=${createForm.candidate_id}`),
    enabled: !!createForm.candidate_id,
  });
  const candidateApplications = candidateAppsResult?.data ?? [];
  const selectedApp = candidateApplications.find((a) => a.id === createForm.application_id);

  const createPlacement = useMutation({
    mutationFn: (body: CreateForm) => api.post<Placement>("/placements", body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["placements"] });
      setShowCreate(false);
      navigate(`/placements/${data.id}`);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const sendConfirmation = useMutation({
    mutationFn: (id: string) => api.post(`/placements/${id}/send-confirmation`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["placements"] }),
  });

  const updateWagesubStatus = useMutation({
    mutationFn: ({ id, wagesub_status }: { id: string; wagesub_status: string }) =>
      api.patch(`/placements/${id}`, { wagesub_status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["placements"] }),
  });

  const placements      = placementsData?.data ?? [];
  const placementTotal  = placementsData?.meta?.total ?? 0;
  const placementPages  = Math.max(1, Math.ceil(placementTotal / PER_PAGE));

  type PlacementSortField =
    | "candidate_name"
    | "job_title"
    | "employer_name"
    | "provider_name"
    | "start_date"
    | "wagesub_status";

  const [sortField, setSortField] = useState<PlacementSortField>("start_date");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");

  function handleSort(field: PlacementSortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "start_date" ? "desc" : "asc");
    }
  }

  const sortedPlacements = useMemo(() => {
    return [...placements].sort((a, b) => {
      let valA: any = a[sortField as keyof Placement];
      let valB: any = b[sortField as keyof Placement];

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === "string" && typeof valB === "string") {
        const cmp = valA.localeCompare(valB, undefined, { sensitivity: "base", numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [placements, sortField, sortDir]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.candidate_id || !createForm.application_id || !createForm.start_date) {
      setCreateError("Candidate, Application, and Start Date are required.");
      return;
    }
    if (selectedApp?.applied_at) {
      const startIso = toYYYYMMDD(createForm.start_date);
      const appIso = toYYYYMMDD(selectedApp.applied_at);
      if (startIso && appIso && startIso < appIso) {
        setCreateError(
          `Placement start date (${fmtDate(createForm.start_date)}) cannot be earlier than application date (${fmtDate(selectedApp.applied_at)}).`
        );
        return;
      }
    }
    setCreateError("");
    createPlacement.mutate(createForm);
  }

  if (!canView) {
    return (
      <div className="p-8 max-w-4xl mx-auto mt-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
            You do not have permission to view placements. Please contact your system administrator if you require access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] px-4 py-4 sm:px-6 sm:py-5">
      <div className="max-w-7xl mx-auto border border-slate-200 rounded-2xl shadow-sm bg-[#F8FAFC] p-6 space-y-5">
        <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Placements</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track candidate placements and welfare checks</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20] text-sm font-medium">
            <Plus size={15} /> New Placement
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          type="date" placeholder="From"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        <input value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
          type="date" placeholder="To"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        <SearchableSelect
          options={employers.map((e) => ({ value: e.id, label: e.name }))}
          value={filterEmployer}
          onChange={(v) => { setFilterEmployer(v); setPage(1); }}
          allLabel="All Employers"
          placeholder="Search employer..."
        />
        <SearchableSelect
          options={providers.map((p) => ({ value: p.id, label: p.name }))}
          value={filterProvider}
          onChange={(v) => { setFilterProvider(v); setPage(1); }}
          allLabel="All Providers"
          placeholder="Search provider..."
        />
      </div>

      {/* ── Pagination toolbar ── */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">
          {isLoading ? "Loading…" : (
            <>
              <span className="font-semibold text-slate-700">{placementTotal}</span> placement{placementTotal !== 1 ? "s" : ""}
              {placementPages > 1 && (
                <span className="ml-1 text-slate-400">— page {page} of {placementPages}</span>
              )}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Show</label>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#e88e2e] bg-white"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top pagination */}
      <Pagination page={page} totalPages={placementPages} total={placementTotal}
        perPage={PER_PAGE} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} label="placements" />

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b select-none">
            <tr>
              <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase w-12">#</th>
              <th
                onClick={() => handleSort("candidate_name")}
                className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Candidate</span>
                  {sortField === "candidate_name" ? (
                    sortDir === "asc" ? <ArrowUp size={13} className="text-[#e88e2e]" /> : <ArrowDown size={13} className="text-[#e88e2e]" />
                  ) : (
                    <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort("job_title")}
                className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Job</span>
                  {sortField === "job_title" ? (
                    sortDir === "asc" ? <ArrowUp size={13} className="text-[#e88e2e]" /> : <ArrowDown size={13} className="text-[#e88e2e]" />
                  ) : (
                    <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort("employer_name")}
                className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Employer</span>
                  {sortField === "employer_name" ? (
                    sortDir === "asc" ? <ArrowUp size={13} className="text-[#e88e2e]" /> : <ArrowDown size={13} className="text-[#e88e2e]" />
                  ) : (
                    <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort("provider_name")}
                className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Provider</span>
                  {sortField === "provider_name" ? (
                    sortDir === "asc" ? <ArrowUp size={13} className="text-[#e88e2e]" /> : <ArrowDown size={13} className="text-[#e88e2e]" />
                  ) : (
                    <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort("start_date")}
                className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Start Date</span>
                  {sortField === "start_date" ? (
                    sortDir === "asc" ? <ArrowUp size={13} className="text-[#e88e2e]" /> : <ArrowDown size={13} className="text-[#e88e2e]" />
                  ) : (
                    <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                  )}
                </div>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Weeks</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Confirmed</th>
              <th
                onClick={() => handleSort("wagesub_status")}
                className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Wage Sub Process Status</span>
                  {sortField === "wagesub_status" ? (
                    sortDir === "asc" ? <ArrowUp size={13} className="text-[#e88e2e]" /> : <ArrowDown size={13} className="text-[#e88e2e]" />
                  ) : (
                    <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : sortedPlacements.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No placements found.</td></tr>
            ) : (
              sortedPlacements.map((p, idx) => {
                const rowNumber = (page - 1) * PER_PAGE + idx + 1;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-3 py-3 text-center font-mono text-xs text-slate-400">
                      {rowNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.candidate_sr_no && (
                            <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold text-slate-700">
                              {p.candidate_sr_no}
                            </span>
                          )}
                          <Link
                            to={`/candidates/${p.candidate_id}`}
                            className="font-semibold text-slate-900 hover:text-[#e88e2e] hover:underline"
                          >
                            {formatName(p.candidate_name)}
                          </Link>
                        </div>
                        {p.candidate_work_status && (
                          <span className="text-xs text-purple-600 block mt-0.5">{p.candidate_work_status.replace("_", " ")}</span>
                        )}
                        {(p as any).wage_subsidy && (
                          <span className="text-[10px] text-emerald-600 font-medium block">
                            Wage Sub Eligible {(p as any).wage_subsidy_amount ? `($${Number((p as any).wage_subsidy_amount).toLocaleString()})` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.job_title}</td>
                    <td className="px-4 py-3 text-slate-600">{p.employer_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{p.provider_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {fmtDate(p.start_date)}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const wks = weeksOnPlacement(p.start_date);
                        if (wks < 0) return <span className="text-slate-300 text-xs">—</span>;
                        if (wks < 26) return (
                          <span className="inline-flex flex-col gap-0.5">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                              {wks} wk{wks !== 1 ? "s" : ""}
                            </span>
                            <span className="text-[10px] text-orange-500 font-medium">Check status</span>
                          </span>
                        );
                        return (
                          <span className="inline-flex flex-col gap-0.5">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                              {wks} wks
                            </span>
                            <span className="text-[10px] text-green-600 font-medium">✓ 26wk+</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {p.confirmed_by_employer
                        ? <CheckCircle size={15} className="text-green-600" />
                        : <span className="text-xs text-slate-400">Pending</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        p.wagesub_status === "agreement_signed" || p.wagesub_status === "approved" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        p.wagesub_status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        p.wagesub_status === "claimed"     ? "bg-purple-50 text-purple-700 border-purple-200" :
                        p.wagesub_status === "paid"        ? "bg-green-50 text-green-700 border-green-200" :
                        p.wagesub_status === "not_applicable" ? "bg-slate-100 text-slate-500 border-slate-200" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {p.wagesub_status === "agreement_signed" ? "Agreement Signed" :
                         p.wagesub_status === "in_progress" ? "In Progress" :
                         p.wagesub_status === "not_applicable" ? "N/A" :
                         p.wagesub_status ? p.wagesub_status.charAt(0).toUpperCase() + p.wagesub_status.slice(1) : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Link to={`/placements/${p.id}`}
                          className="text-xs text-slate-500 border rounded px-2 py-1 hover:bg-slate-50">View</Link>
                        {isAdmin && (
                          <button
                            onClick={() => setInvoicingPlacement(p)}
                            title="Generate Invoice for Placement"
                            className="flex items-center gap-1 text-xs text-slate-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 hover:bg-amber-100 font-medium transition-colors">
                            <FileText size={11} className="text-[#e88e2e]" /> Invoice
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={placementPages} total={placementTotal}
        perPage={PER_PAGE} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} label="placements" />

      {invoicingPlacement && (
        <GeneratePlacementInvoiceModal
          placement={invoicingPlacement}
          onClose={() => setInvoicingPlacement(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["placements"] });
            setInvoicingPlacement(null);
          }}
        />
      )}

      {/* Create Placement Dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">New Placement</h2>
            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{createError}</p>
            )}
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Candidate *</label>
                <select value={createForm.candidate_id}
                  onChange={(e) => {
                    setCreateError("");
                    setCreateForm((f) => ({ ...f, candidate_id: e.target.value, application_id: "", job_id: "" }));
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">Select candidate...</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Application *</label>
                <select value={createForm.application_id}
                  disabled={!createForm.candidate_id}
                  onChange={(e) => {
                    setCreateError("");
                    const app = candidateApplications.find((a) => a.id === e.target.value);
                    setCreateForm((f) => ({ ...f, application_id: e.target.value, job_id: app?.job_id ?? f.job_id }));
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400">
                  <option value="">{createForm.candidate_id ? "Select application..." : "Select a candidate first"}</option>
                  {candidateApplications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.job_title} — {stageLabel(a.stage)} {a.applied_at ? `(Applied: ${fmtDate(a.applied_at)})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Employer</label>
                <select value={createForm.employer_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, employer_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">No employer</option>
                  {employers.filter((e) => e.is_active !== false).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">Start Date *</label>
                  {selectedApp?.applied_at && (
                    <span className="text-[11px] text-slate-500 font-normal">
                      Applied: {fmtDate(selectedApp.applied_at)}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  min={toYYYYMMDD(selectedApp?.applied_at) || undefined}
                  value={createForm.start_date}
                  onChange={(e) => {
                    setCreateError("");
                    setCreateForm((f) => ({ ...f, start_date: e.target.value }));
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                {selectedApp?.applied_at && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Must be on or after application date ({fmtDate(selectedApp.applied_at)})
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Wage Sub Process Status</label>
                <select
                  value={createForm.wagesub_status ?? "pending"}
                  onChange={(e) => setCreateForm((f) => ({ ...f, wagesub_status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]"
                >
                  <option value="pending">Pending</option>
                  <option value="agreement_signed">Agreement Signed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="claimed">Claimed</option>
                  <option value="paid">Paid</option>
                  <option value="not_applicable">N/A / Not Eligible</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea value={createForm.notes} rows={2}
                  onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={createPlacement.isPending}
                  className="px-4 py-2 text-sm bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20] disabled:opacity-50">
                  {createPlacement.isPending ? "Creating..." : "Create Placement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export function GeneratePlacementInvoiceModal({
  placement,
  onClose,
  onSuccess,
}: {
  placement: Placement;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [unitPrice, setUnitPrice] = useState<string>("500");
  const [quantity, setQuantity]   = useState<string>("1");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleGenerate() {
    if (!unitPrice) { setError("Unit price is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post("/xero/invoices", {
        placement_id: placement.id,
        unit_price: Number(unitPrice),
        quantity: Number(quantity || 1),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to generate invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-base">Generate Placement Invoice</h3>
            <p className="text-xs text-slate-400 mt-0.5">{placement.candidate_name} → {placement.job_title}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
            {error}
          </div>
        )}

        <div className="space-y-3 text-sm text-slate-600">
          <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Employer:</span> <span className="font-medium text-slate-800">{placement.employer_name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Provider:</span> <span className="font-medium text-slate-800">{placement.provider_name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Start Date:</span> <span className="font-medium text-slate-800">{fmtDate(placement.start_date)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unit Price (AUD) *</label>
              <input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="500.00"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold bg-[#e88e2e] text-white rounded-xl hover:bg-[#d07d20] disabled:opacity-50"
          >
            {saving ? "Generating..." : "Generate Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

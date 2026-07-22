import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle, Mail } from "lucide-react";
import { format } from "date-fns";
import { fmtDate } from "../lib/utils";
import { api } from "../lib/api";
import type { Placement, Candidate, Employer, Provider, Application } from "../types";
import { useAuth } from "../contexts/AuthContext";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = user?.role === "admin" || user?.role === "recruiter_admin" || user?.role === "recruiter";

  const [filterEmployer, setFilterEmployer] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [showCreate, setShowCreate] = useState(false);
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

  const placements      = placementsData?.data ?? [];
  const placementTotal  = placementsData?.meta?.total ?? 0;
  const placementPages  = Math.max(1, Math.ceil(placementTotal / PER_PAGE));

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.candidate_id || !createForm.application_id || !createForm.start_date) {
      setCreateError("Candidate, Application, and Start Date are required.");
      return;
    }
    setCreateError("");
    createPlacement.mutate(createForm);
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
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Candidate</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Job</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Employer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Provider</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Start Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Weeks</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Confirmed</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Wage Subsidy</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : placements.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No placements found.</td></tr>
            ) : (
              placements.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{p.candidate_name}</p>
                      {p.candidate_work_status && (
                        <span className="text-xs text-purple-600">{p.candidate_work_status.replace("_", " ")}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.job_title}</td>
                  <td className="px-4 py-3 text-slate-600">{p.employer_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.provider_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
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
                    {p.wagesub_status ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        p.wagesub_status === "pending"     ? "bg-slate-100 text-slate-600 border-slate-300" :
                        p.wagesub_status === "approved"    ? "bg-blue-100 text-blue-700 border-blue-300" :
                        p.wagesub_status === "in_progress" ? "bg-amber-100 text-amber-700 border-amber-300" :
                        p.wagesub_status === "claimed"     ? "bg-purple-100 text-purple-700 border-purple-300" :
                        p.wagesub_status === "paid"        ? "bg-green-100 text-green-700 border-green-300" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {p.wagesub_status === "in_progress" ? "In Progress" :
                         p.wagesub_status.charAt(0).toUpperCase() + p.wagesub_status.slice(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/placements/${p.id}`}
                        className="text-xs text-slate-500 border rounded px-2 py-1 hover:bg-slate-50">View</Link>
                      {canCreate && !p.confirmed_by_employer && (
                        <button
                          onClick={() => {
                            if (window.confirm("Are you sure you want to send the confirmation email to this employer?")) {
                              sendConfirmation.mutate(p.id);
                            }
                          }}
                          title="Send Confirmation Email"
                          className="flex items-center gap-1 text-xs text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50">
                          <Mail size={11} /> Send
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={placementPages} total={placementTotal}
        perPage={PER_PAGE} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} label="placements" />

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
                  onChange={(e) => setCreateForm((f) => ({ ...f, candidate_id: e.target.value, application_id: "", job_id: "" }))}
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
                    const app = candidateApplications.find((a) => a.id === e.target.value);
                    setCreateForm((f) => ({ ...f, application_id: e.target.value, job_id: app?.job_id ?? f.job_id }));
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400">
                  <option value="">{createForm.candidate_id ? "Select application..." : "Select a candidate first"}</option>
                  {candidateApplications.map((a) => (
                    <option key={a.id} value={a.id}>{a.job_title} — {a.stage}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Employer</label>
                <select value={createForm.employer_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, employer_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">No employer</option>
                  {employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                <input type="date" value={createForm.start_date}
                  onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
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

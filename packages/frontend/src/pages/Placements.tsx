import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle, Mail } from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import type { Placement, Candidate, Job, Employer } from "../types";
import { useAuth } from "../contexts/AuthContext";
import WelfareCheckDots from "../components/WelfareCheckDots";

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

export default function Placements() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = user?.role === "admin" || user?.role === "recruiter_admin" || user?.role === "recruiter";

  const [filterEmployer, setFilterEmployer] = useState("");
  const [filterProvider, _setFilterProvider] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    candidate_id: "", job_id: "", employer_id: "", start_date: "", notes: "", application_id: "",
  });
  const [createError, setCreateError] = useState("");

  const params = new URLSearchParams({
    page: String(page), limit: "20",
    ...(filterEmployer && { employer_id: filterEmployer }),
    ...(filterProvider && { provider_id: filterProvider }),
    ...(from && { from }),
    ...(to && { to }),
  });

  const { data: placementsData, isLoading } = useQuery<{ data: Placement[] }>({
    queryKey: ["placements", filterEmployer, filterProvider, from, to, page],
    queryFn: () => api.list<Placement>(`/placements?${params}`),
  });

  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["candidates-select"],
    queryFn: () => api.get<Candidate[]>("/candidates?limit=100"),
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["jobs-select"],
    queryFn: () => api.get<Job[]>("/jobs?limit=100"),
  });

  const { data: employers = [] } = useQuery<Employer[]>({
    queryKey: ["employers-select"],
    queryFn: () => api.get<Employer[]>("/employers?limit=100"),
  });

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

  const placements = placementsData?.data ?? [];

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.candidate_id || !createForm.job_id || !createForm.start_date || !createForm.application_id) {
      setCreateError("Candidate, Job, Application ID, and Start Date are required.");
      return;
    }
    setCreateError("");
    createPlacement.mutate(createForm);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Placements</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track candidate placements and welfare checks</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-medium">
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
        <select value={filterEmployer} onChange={(e) => { setFilterEmployer(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          <option value="">All Employers</option>
          {employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

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
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Welfare</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Confirmed</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : placements.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No placements found.</td></tr>
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
                    {format(new Date(p.start_date), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <WelfareCheckDots checks={p.welfare_checks ?? []} />
                  </td>
                  <td className="px-4 py-3">
                    {p.confirmed_by_employer
                      ? <CheckCircle size={15} className="text-green-600" />
                      : <span className="text-xs text-slate-400">Pending</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/placements/${p.id}`}
                        className="text-xs text-slate-500 border rounded px-2 py-1 hover:bg-slate-50">View</Link>
                      {canCreate && !p.confirmed_by_employer && (
                        <button
                          onClick={() => sendConfirmation.mutate(p.id)}
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
                  onChange={(e) => setCreateForm((f) => ({ ...f, candidate_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">Select candidate...</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
                <select value={createForm.job_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, job_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">Select job...</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Application ID *</label>
                <input value={createForm.application_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, application_id: e.target.value }))}
                  placeholder="UUID of the application record"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
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
                  className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50">
                  {createPlacement.isPending ? "Creating..." : "Create Placement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Eye, Edit2, Briefcase, Lock } from "lucide-react";
import { api } from "../lib/api";
import type { Employer } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import Pagination from "../components/Pagination";

export default function Employers() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canView = hasPermission("employers:view");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["employers", search, industry, page],
    queryFn: () =>
      api.list<Employer>(
        `/employers?page=${page}&limit=20&search=${encodeURIComponent(search)}&industry=${encodeURIComponent(industry)}`
      ),
    enabled: canView,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/employers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employers"] }),
    onError: (err: any) => alert(err?.message || err?.error || "Failed to deactivate employer"),
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/employers/${id}/activate`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employers"] }),
    onError: (err: any) => alert(err?.message || err?.error || "Failed to activate employer"),
  });

  const deletePermanent = useMutation({
    mutationFn: (id: string) => api.delete(`/employers/${id}?permanent=true`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employers"] }),
    onError: (err: any) => alert(err?.message || err?.error || "Failed to delete employer"),
  });

  const employers = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  if (!canView) {
    return (
      <div className="p-8 max-w-4xl mx-auto mt-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
            You do not have permission to view the employer directory. Please contact your system administrator if you require access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] px-4 py-4 sm:px-6 sm:py-5">
      <div className="max-w-7xl xl:max-w-[1400px] mx-auto border border-slate-200 rounded-2xl shadow-sm bg-[#F8FAFC] p-6 space-y-5">
        <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Employers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Companies that post vacancies</p>
        </div>
        {hasPermission("employers:create") && (
          <button
            onClick={() => navigate("/employers/new")}
            className="flex items-center gap-2 px-4 py-2 bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20] text-sm font-medium"
          >
            <Plus size={15} /> Add Employer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search employers..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <input
          value={industry}
          onChange={(e) => { setIndustry(e.target.value); setPage(1); }}
          placeholder="Filter by industry..."
          className="w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {/* Top Pagination */}
      <Pagination page={page} totalPages={Math.ceil((total || 1) / 20)}
        total={total} perPage={20} onChange={setPage} label="employers" />

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto mt-3">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[70px] min-w-[70px] whitespace-nowrap">SR #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Company</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Industry</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Contact</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Open Vacancies</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Total Vacancies</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : employers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No employers found.</td></tr>
            ) : (
              employers.map((e, idx) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 w-[70px] min-w-[70px] whitespace-nowrap">
                    <span className="inline-flex items-center bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-xs font-mono font-semibold text-slate-700 select-none">
                      {(page - 1) * 20 + idx + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{e.name}</td>
                  <td className="px-4 py-3 text-slate-600">{e.industry || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.contact_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-slate-700">
                      <Briefcase size={13} />{e.open_jobs_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.total_jobs_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      e.is_active
                        ? "border border-green-500 text-green-700 bg-transparent"
                        : "border border-slate-400 text-slate-600 bg-transparent"
                    }`}>
                      {e.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 justify-end whitespace-nowrap">
                      <Link to={`/employers/${e.id}`}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 border rounded px-2 py-1 hover:bg-slate-50 whitespace-nowrap">
                        <Eye size={12} /> View
                      </Link>
                      {hasPermission("employers:edit") && (
                        <Link to={`/employers/${e.id}/edit`}
                          className="inline-flex items-center gap-1 text-xs text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 whitespace-nowrap">
                          <Edit2 size={12} /> Edit
                        </Link>
                      )}
                      {hasPermission("employers:edit") && !e.is_active && (
                        <button
                          onClick={() => {
                            if (confirm(`Activate "${e.name}"?`)) activate.mutate(e.id);
                          }}
                          className="inline-flex items-center text-xs text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-50 whitespace-nowrap"
                        >
                          Activate
                        </button>
                      )}
                      {hasPermission("employers:delete") && e.is_active && (
                        <button
                          onClick={() => {
                            if (confirm(`Deactivate "${e.name}"?`)) deactivate.mutate(e.id);
                          }}
                          className="inline-flex items-center text-xs text-amber-700 border border-amber-300 rounded px-2 py-1 hover:bg-amber-50 whitespace-nowrap"
                        >
                          Deactivate
                        </button>
                      )}
                      {hasPermission("employers:delete") && (
                        <button
                          onClick={() => {
                            if (confirm(`Permanently delete employer "${e.name}"? This cannot be undone.`)) {
                              deletePermanent.mutate(e.id);
                            }
                          }}
                          className="inline-flex items-center text-xs text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50 whitespace-nowrap"
                        >
                          Delete
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

      <Pagination page={page} totalPages={Math.ceil((total || 1) / 20)}
        total={total} perPage={20} onChange={setPage} label="employers" />
      </div>
    </div>
  );
}

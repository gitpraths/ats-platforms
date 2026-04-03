import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Eye, Edit2, Briefcase } from "lucide-react";
import { api } from "../lib/api";
import type { Employer } from "../types";
import { useAuth } from "../contexts/AuthContext";

interface EmployersResponse {
  data: Employer[];
  meta: { total: number; page: number; limit: number };
}

export default function Employers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.role === "recruiter_admin";

  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<EmployersResponse>({
    queryKey: ["employers", search, industry, page],
    queryFn: () =>
      api.get<EmployersResponse>(
        `/employers?page=${page}&limit=20&search=${encodeURIComponent(search)}&industry=${encodeURIComponent(industry)}`
      ),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/employers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employers"] }),
  });

  const employers = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Companies that post vacancies</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => navigate("/employers/new")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={15} /> Add Employer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search employers..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <input
          value={industry}
          onChange={(e) => { setIndustry(e.target.value); setPage(1); }}
          placeholder="Filter by industry..."
          className="w-48 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Industry</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contact</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Open Jobs</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Jobs</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : employers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No employers found.</td></tr>
            ) : (
              employers.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                  <td className="px-4 py-3 text-gray-600">{e.industry || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{e.contact_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-gray-700">
                      <Briefcase size={13} />{e.open_jobs_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.total_jobs_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      e.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {e.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/employers/${e.id}`}
                        className="flex items-center gap-1 text-xs text-gray-500 border rounded px-2 py-1 hover:bg-gray-50">
                        <Eye size={12} /> View
                      </Link>
                      {isAdmin && (
                        <Link to={`/employers/${e.id}/edit`}
                          className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50">
                          <Edit2 size={12} /> Edit
                        </Link>
                      )}
                      {user?.role === "admin" && e.is_active && (
                        <button
                          onClick={() => {
                            if (confirm(`Deactivate "${e.name}"?`)) deactivate.mutate(e.id);
                          }}
                          className="text-xs text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50"
                        >
                          Deactivate
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

      {total > 20 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

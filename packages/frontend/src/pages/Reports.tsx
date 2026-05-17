import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { api } from "../lib/api";
import type { Employer, Provider, WelfareCheckType } from "../types";
import WelfareCheckDots from "../components/WelfareCheckDots";

type Tab = "providers" | "placements" | "staff";

interface ProviderReport {
  provider_id: string;
  provider_name: string;
  total_candidates: number;
  active_candidates: number;
  placed_candidates: number;
  job_seeking_candidates: number;
  inactive_candidates: number;
  placement_rate: string;
}

interface PlacementReport {
  placement_id: string;
  candidate_name: string;
  job_title: string;
  employer_name: string;
  provider_name: string;
  start_date: string;
  confirmed_by_employer: boolean;
  welfare_checks: Record<WelfareCheckType, { due_date: string; completed: boolean }>;
}

interface StaffReport {
  user_id: string;
  user_name: string;
  role: string;
  jobs_assigned: number;
  active_jobs: number;
  total_applications: number;
  total_placements: number;
}

function jsonToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = r[h];
        const s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
        return `"${s.replace(/"/g, '""')}"`;
      }).join(",")
    ),
  ];
  return lines.join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [tab, setTab] = useState<Tab>("providers");
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo]   = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterEmployer, setFilterEmployer] = useState("");
  const [filterProvider, setFilterProvider] = useState("");

  const dateParams = `from=${from}&to=${to}`;

  const { data: providerReport = [], isLoading: loadingProviders } = useQuery<ProviderReport[]>({
    queryKey: ["report-providers", from, to],
    queryFn: () => api.get<{ data: ProviderReport[] }>(`/reports/providers?${dateParams}&limit=1000`)
      .then((r) => (r as unknown as { data: ProviderReport[] }).data ?? r),
    enabled: tab === "providers",
  });

  const { data: placementReport = [], isLoading: loadingPlacements } = useQuery<PlacementReport[]>({
    queryKey: ["report-placements", from, to, filterEmployer, filterProvider],
    queryFn: () => {
      const p = new URLSearchParams({ from, to, limit: "1000" });
      if (filterEmployer) p.set("employer_id", filterEmployer);
      if (filterProvider) p.set("provider_id", filterProvider);
      return api.get<{ data: PlacementReport[] }>(`/reports/placements?${p}`)
        .then((r) => (r as unknown as { data: PlacementReport[] }).data ?? r);
    },
    enabled: tab === "placements",
  });

  const { data: staffReport = [], isLoading: loadingStaff } = useQuery<StaffReport[]>({
    queryKey: ["report-staff", from, to],
    queryFn: () => api.get<{ data: StaffReport[] }>(`/reports/staff?${dateParams}&limit=1000`)
      .then((r) => (r as unknown as { data: StaffReport[] }).data ?? r),
    enabled: tab === "staff",
  });

  const { data: employers = [] } = useQuery<Employer[]>({
    queryKey: ["employers-select"],
    queryFn: () => api.get<{ data: Employer[] }>("/employers?limit=100").then((r) => (r as unknown as { data: Employer[] }).data ?? r),
  });

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["providers-select"],
    queryFn: () => api.get<{ data: Provider[] }>("/providers?limit=100").then((r) => (r as unknown as { data: Provider[] }).data ?? r),
  });

  const today = new Date().toISOString().split("T")[0];

  const tabs: { key: Tab; label: string }[] = [
    { key: "providers",  label: "Provider Report" },
    { key: "placements", label: "Placement Tracking" },
    { key: "staff",      label: "Staff Report" },
  ];

  function handleExport() {
    const dateStr = format(new Date(), "yyyy-MM-dd");
    if (tab === "providers") {
      downloadCsv(jsonToCsv(providerReport as unknown as Record<string, unknown>[]), `report-providers-${dateStr}.csv`);
    } else if (tab === "placements") {
      downloadCsv(jsonToCsv(placementReport.map((r) => ({ ...r, welfare_checks: JSON.stringify(r.welfare_checks) })) as unknown as Record<string, unknown>[]), `report-placements-${dateStr}.csv`);
    } else {
      downloadCsv(jsonToCsv(staffReport as unknown as Record<string, unknown>[]), `report-staff-${dateStr}.csv`);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Provider, placement, and staff analytics</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
        {tab === "placements" && (
          <>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Employer</label>
              <select value={filterEmployer} onChange={(e) => setFilterEmployer(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">All Employers</option>
                {employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Provider</label>
              <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">All Providers</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Provider Report */}
      {tab === "providers" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {["Provider", "Total", "Active", "Placed", "Job Seeking", "Inactive", "Placement Rate"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingProviders ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : providerReport.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No data for this period.</td></tr>
              ) : providerReport.map((r) => (
                <tr key={r.provider_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/providers/${r.provider_id}`} className="text-slate-600 hover:underline font-medium">
                      {r.provider_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.total_candidates}</td>
                  <td className="px-4 py-3 text-slate-700">{r.active_candidates}</td>
                  <td className="px-4 py-3 text-purple-700 font-medium">{r.placed_candidates}</td>
                  <td className="px-4 py-3 text-blue-700">{r.job_seeking_candidates}</td>
                  <td className="px-4 py-3 text-slate-400">{r.inactive_candidates}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5 w-20">
                        <div className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: r.placement_rate }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700">{r.placement_rate}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Placement Tracking */}
      {tab === "placements" && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {["Candidate", "Job", "Employer", "Provider", "Start Date", "Confirmed", "D1","W1","M1","M3","M6"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingPlacements ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : placementReport.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">No data for this period.</td></tr>
              ) : placementReport.map((r) => {
                const wcs = Object.entries(r.welfare_checks ?? {}).map(([check_type, v]) => ({
                  id: check_type,
                  placement_id: r.placement_id,
                  check_type: check_type as WelfareCheckType,
                  due_date: v.due_date,
                  completed_at: v.completed ? today : null,
                  created_at: today,
                }));
                return (
                  <tr key={r.placement_id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => window.location.href = `/placements/${r.placement_id}`}>
                    <td className="px-3 py-3 font-medium text-slate-600">{r.candidate_name}</td>
                    <td className="px-3 py-3 text-slate-700">{r.job_title}</td>
                    <td className="px-3 py-3 text-slate-600">{r.employer_name || "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{r.provider_name || "—"}</td>
                    <td className="px-3 py-3 text-slate-700">{format(new Date(r.start_date), "MMM d, yyyy")}</td>
                    <td className="px-3 py-3">
                      {r.confirmed_by_employer
                        ? <span className="text-green-600 text-xs font-medium">Yes</span>
                        : <span className="text-slate-400 text-xs">No</span>}
                    </td>
                    <td className="px-3 py-3" colSpan={5}>
                      <WelfareCheckDots checks={wcs} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Staff Report */}
      {tab === "staff" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {["Staff Member", "Role", "Jobs Assigned", "Active Jobs", "Applications", "Placements"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingStaff ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : staffReport.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No data for this period.</td></tr>
              ) : staffReport.map((r) => (
                <tr key={r.user_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.user_name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 border border-blue-400 text-blue-600 bg-transparent rounded-full capitalize">
                      {r.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.jobs_assigned}</td>
                  <td className="px-4 py-3 text-slate-700">{r.active_jobs}</td>
                  <td className="px-4 py-3 text-slate-700">{r.total_applications}</td>
                  <td className="px-4 py-3 text-purple-700 font-medium">{r.total_placements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

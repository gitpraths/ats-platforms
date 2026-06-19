import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, BarChart2, Users, Briefcase, TrendingUp, Building2, MapPin, ChevronUp, ChevronDown } from "lucide-react";
import { format, startOfMonth, parseISO } from "date-fns";
import { api } from "../lib/api";
import type { Employer, Provider, WelfareCheckType } from "../types";
import WelfareCheckDots from "../components/WelfareCheckDots";
import SearchableSelect from "../components/SearchableSelect";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "provider" | "staff" | "placement_monthly" | "vacancy";

interface ProviderReport {
  provider_id: string; provider_name: string;
  total_candidates: number; active_candidates: number;
  placed_candidates: number; job_seeking_candidates: number;
  inactive_candidates: number; placement_rate: string;
}

interface PlacementReport {
  placement_id: string; candidate_name: string;
  job_title: string; employer_name: string; provider_name: string;
  start_date: string; confirmed_by_employer: boolean;
  welfare_checks: Record<WelfareCheckType, { due_date: string; completed: boolean }>;
}

interface StaffReport {
  user_id: string; user_name: string; role: string;
  jobs_assigned: number; active_jobs: number;
  total_applications: number; total_placements: number;
}

interface VacancyReport {
  id: string; title: string; status: string; vacancy_type: string;
  positions_count: number; pay_rate: number; pay_rate_type: string;
  work_location: string; city: string; state: string;
  created_at: string; employer_name: string; application_count: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function jsonToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = r[h];
        const s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
        return `"${s.replace(/"/g, '""')}"`;
      }).join(",")
    ),
  ].join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-600",
  published: "bg-green-100 text-green-700",
  closed:    "bg-red-100   text-red-600",
  archived:  "bg-amber-100 text-amber-700",
};

function SortTh({ label, col, sort, onSort }: {
  label: string; col: string;
  sort: { col: string; dir: "asc" | "desc" };
  onSort: (col: string) => void;
}) {
  const active = sort.col === col;
  return (
    <th
      onClick={() => onSort(col)}
      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-800 whitespace-nowrap"
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronDown size={12} className="opacity-20" />}
      </span>
    </th>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const [tab, setTab] = useState<Tab>("provider");

  const defaultFrom = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const defaultTo   = format(new Date(), "yyyy-MM-dd");

  const [from,           setFrom]           = useState(defaultFrom);
  const [to,             setTo]             = useState(defaultTo);
  const [filterEmployer, setFilterEmployer] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [providerView,   setProviderView]   = useState<"site" | "monthly">("site");

  const [applied, setApplied] = useState({
    from: defaultFrom, to: defaultTo,
    employer: "", provider: "", status: "",
  });

  function applyFilters() {
    setApplied({ from, to, employer: filterEmployer, provider: filterProvider, status: filterStatus });
  }

  // ── Sort state ──────────────────────────────────────────────────────────────
  const [provSort,    setProvSort]    = useState({ col: "provider_name",  dir: "asc"  as "asc" | "desc" });
  const [staffSort,   setStaffSort]   = useState({ col: "total_placements", dir: "desc" as "asc" | "desc" });
  const [vacSort,     setVacSort]     = useState({ col: "created_at",     dir: "desc" as "asc" | "desc" });

  function toggleSort(
    sort: { col: string; dir: "asc" | "desc" },
    set: (s: { col: string; dir: "asc" | "desc" }) => void,
    col: string
  ) {
    set(sort.col === col ? { col, dir: sort.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" });
  }

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: providerReport = [], isLoading: loadingProviders } = useQuery<ProviderReport[]>({
    queryKey: ["report-providers", applied.from, applied.to],
    queryFn:  () => api.get<ProviderReport[]>(`/reports/providers?from=${applied.from}&to=${applied.to}&limit=1000`),
    enabled:  tab === "provider",
  });

  const { data: placementReport = [], isLoading: loadingPlacements } = useQuery<PlacementReport[]>({
    queryKey: ["report-placements", applied.from, applied.to, applied.employer, applied.provider],
    queryFn:  () => {
      const p = new URLSearchParams({ from: applied.from, to: applied.to, limit: "1000" });
      if (applied.employer) p.set("employer_id", applied.employer);
      if (applied.provider) p.set("provider_id", applied.provider);
      return api.get<PlacementReport[]>(`/reports/placements?${p}`);
    },
    enabled: tab === "placement_monthly" || tab === "provider",
  });

  const { data: staffReport = [], isLoading: loadingStaff } = useQuery<StaffReport[]>({
    queryKey: ["report-staff", applied.from, applied.to],
    queryFn:  () => api.get<StaffReport[]>(`/reports/staff?from=${applied.from}&to=${applied.to}&limit=1000`),
    enabled:  tab === "staff",
  });

  const { data: vacancyReportResult, isLoading: loadingVacancies } = useQuery({
    queryKey: ["report-vacancies", applied.from, applied.to, applied.employer, applied.status],
    queryFn:  () => {
      const p = new URLSearchParams({ from: applied.from, to: applied.to, limit: "1000" });
      if (applied.employer) p.set("employer_id", applied.employer);
      if (applied.status)   p.set("status", applied.status);
      return api.get<VacancyReport[]>(`/reports/vacancies?${p}`);
    },
    enabled: tab === "vacancy",
  });
  const vacancyReport: VacancyReport[] = Array.isArray(vacancyReportResult)
    ? vacancyReportResult
    : (vacancyReportResult as any)?.data ?? [];

  const { data: employersResult } = useQuery({
    queryKey: ["employers-select"],
    queryFn:  () => api.list<Employer>("/employers?limit=100"),
  });
  const employers = employersResult?.data ?? [];

  const { data: providersResult } = useQuery({
    queryKey: ["providers-select"],
    queryFn:  () => api.list<Provider>("/providers?limit=100"),
  });
  const providers = providersResult?.data ?? [];

  const today = new Date().toISOString().split("T")[0];

  // ── Provider monthly grouping ────────────────────────────────────────────────
  const placementsByMonth = useMemo(() => {
    const map: Record<string, { month: string; total: number; confirmed: number }> = {};
    for (const p of placementReport) {
      const m = format(parseISO(p.start_date), "MMM yyyy");
      if (!map[m]) map[m] = { month: m, total: 0, confirmed: 0 };
      map[m].total++;
      if (p.confirmed_by_employer) map[m].confirmed++;
    }
    return Object.values(map).sort((a, b) => new Date(`01 ${b.month}`).getTime() - new Date(`01 ${a.month}`).getTime());
  }, [placementReport]);

  // ── Sorting helpers ──────────────────────────────────────────────────────────
  function sortedData<T>(data: T[], sort: { col: string; dir: "asc" | "desc" }): T[] {
    return [...data].sort((a: any, b: any) => {
      const av = a[sort.col] ?? "";
      const bv = b[sort.col] ?? "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }

  const sortedProviders  = useMemo(() => sortedData(providerReport, provSort),  [providerReport, provSort]);
  const sortedStaff      = useMemo(() => sortedData(staffReport, staffSort),     [staffReport, staffSort]);
  const sortedVacancies  = useMemo(() => sortedData(vacancyReport, vacSort),     [vacancyReport, vacSort]);

  // ── Export ───────────────────────────────────────────────────────────────────
  function handleExport() {
    const d = format(new Date(), "yyyy-MM-dd");
    if (tab === "provider") {
      if (providerView === "monthly") {
        downloadCsv(jsonToCsv(placementsByMonth as any), `provider-monthly-${d}.csv`);
      } else {
        downloadCsv(jsonToCsv(providerReport as any), `provider-sitewise-${d}.csv`);
      }
    } else if (tab === "staff") {
      downloadCsv(jsonToCsv(staffReport as any), `staff-kpi-${d}.csv`);
    } else if (tab === "placement_monthly") {
      downloadCsv(jsonToCsv(
        placementReport.map((r) => ({ ...r, welfare_checks: JSON.stringify(r.welfare_checks) })) as any
      ), `placement-monthly-${d}.csv`);
    } else {
      downloadCsv(jsonToCsv(vacancyReport as any), `vacancy-report-${d}.csv`);
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "provider",          label: "Provider Report",              icon: <Users size={14} /> },
    { key: "staff",             label: "Staff (KPI) Placement Report", icon: <BarChart2 size={14} /> },
    { key: "placement_monthly", label: "Placement Report Month Wise",  icon: <TrendingUp size={14} /> },
    { key: "vacancy",           label: "Vacancy Report",               icon: <Briefcase size={14} /> },
  ];

  const thCls = "text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase";
  const tdCls = "px-4 py-3 text-sm";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Provider, placement, staff and vacancy analytics</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#e88e2e] text-white rounded-lg text-sm font-medium hover:bg-[#d07d20] transition-colors">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]" />
          </div>
          {(tab === "placement_monthly" || tab === "provider") && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Employer</label>
                <SearchableSelect
                  options={employers.map((e) => ({ value: e.id, label: e.name }))}
                  value={filterEmployer}
                  onChange={setFilterEmployer}
                  allLabel="All Employers"
                  placeholder="Search employer..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Provider</label>
                <SearchableSelect
                  options={providers.map((p) => ({ value: p.id, label: p.name }))}
                  value={filterProvider}
                  onChange={setFilterProvider}
                  allLabel="All Providers"
                  placeholder="Search provider..."
                />
              </div>
            </>
          )}
          {tab === "vacancy" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Employer</label>
                <SearchableSelect
                  options={employers.map((e) => ({ value: e.id, label: e.name }))}
                  value={filterEmployer}
                  onChange={setFilterEmployer}
                  allLabel="All Employers"
                  placeholder="Search employer..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <SearchableSelect
                  options={[
                    { value: "draft",     label: "Draft" },
                    { value: "published", label: "Open" },
                    { value: "closed",    label: "Closed" },
                    { value: "archived",  label: "Archived" },
                  ]}
                  value={filterStatus}
                  onChange={setFilterStatus}
                  allLabel="All Statuses"
                  placeholder="Search status..."
                />
              </div>
            </>
          )}
          <button onClick={applyFilters}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#e88e2e] text-white rounded-lg text-sm font-medium hover:bg-[#d07d20]">
            <Search size={14} /> Search
          </button>
        </div>
      </div>

      {/* ── Tab 1: Provider Report Site Wise / Monthly ── */}
      {tab === "provider" && (
        <div>
          {/* View toggle */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-slate-500 font-medium">View:</span>
            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
              {(["site", "monthly"] as const).map((v) => (
                <button key={v} onClick={() => setProviderView(v)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                    providerView === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}>
                  {v === "site" ? "Site Wise" : "Monthly"}
                </button>
              ))}
            </div>
          </div>

          {providerView === "site" ? (
            /* Site Wise table */
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <SortTh label="Provider"       col="provider_name"          sort={provSort} onSort={(c) => toggleSort(provSort, setProvSort, c)} />
                    <SortTh label="Total"          col="total_candidates"       sort={provSort} onSort={(c) => toggleSort(provSort, setProvSort, c)} />
                    <SortTh label="Active"         col="active_candidates"      sort={provSort} onSort={(c) => toggleSort(provSort, setProvSort, c)} />
                    <SortTh label="Placed"         col="placed_candidates"      sort={provSort} onSort={(c) => toggleSort(provSort, setProvSort, c)} />
                    <SortTh label="Job Seeking"    col="job_seeking_candidates" sort={provSort} onSort={(c) => toggleSort(provSort, setProvSort, c)} />
                    <SortTh label="Inactive"       col="inactive_candidates"    sort={provSort} onSort={(c) => toggleSort(provSort, setProvSort, c)} />
                    <th className={thCls}>Placement Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loadingProviders ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
                  ) : sortedProviders.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No data for this period.</td></tr>
                  ) : sortedProviders.map((r) => (
                    <tr key={r.provider_id} className="hover:bg-slate-50">
                      <td className={tdCls}>
                        <Link to={`/providers/${r.provider_id}`} className="text-[#e88e2e] hover:underline font-medium">{r.provider_name}</Link>
                      </td>
                      <td className={`${tdCls} font-semibold text-slate-800`}>{r.total_candidates}</td>
                      <td className={`${tdCls} text-green-700`}>{r.active_candidates}</td>
                      <td className={`${tdCls} text-purple-700 font-semibold`}>{r.placed_candidates}</td>
                      <td className={`${tdCls} text-blue-700`}>{r.job_seeking_candidates}</td>
                      <td className={`${tdCls} text-slate-400`}>{r.inactive_candidates}</td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2 w-24">
                            <div className="bg-[#e88e2e] h-2 rounded-full" style={{ width: r.placement_rate }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 w-10">{r.placement_rate}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Monthly table */
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className={thCls}>Month</th>
                    <th className={thCls}>Total Placements</th>
                    <th className={thCls}>Confirmed by Employer</th>
                    <th className={thCls}>Pending Confirmation</th>
                    <th className={thCls}>Confirmation Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loadingPlacements ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
                  ) : placementsByMonth.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No data for this period.</td></tr>
                  ) : placementsByMonth.map((r) => {
                    const rate = r.total > 0 ? Math.round((r.confirmed / r.total) * 100) : 0;
                    return (
                      <tr key={r.month} className="hover:bg-slate-50">
                        <td className={`${tdCls} font-semibold text-slate-900`}>{r.month}</td>
                        <td className={`${tdCls} text-slate-800 font-semibold`}>{r.total}</td>
                        <td className={`${tdCls} text-green-700 font-medium`}>{r.confirmed}</td>
                        <td className={`${tdCls} text-amber-600`}>{r.total - r.confirmed}</td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-2 w-24">
                              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 w-10">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Staff (KPI) Placement Report ── */}
      {tab === "staff" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <SortTh label="Staff Member"    col="user_name"          sort={staffSort} onSort={(c) => toggleSort(staffSort, setStaffSort, c)} />
                <th className={thCls}>Role</th>
                <SortTh label="Jobs Assigned"   col="jobs_assigned"      sort={staffSort} onSort={(c) => toggleSort(staffSort, setStaffSort, c)} />
                <SortTh label="Active Jobs"     col="active_jobs"        sort={staffSort} onSort={(c) => toggleSort(staffSort, setStaffSort, c)} />
                <SortTh label="Applications"    col="total_applications" sort={staffSort} onSort={(c) => toggleSort(staffSort, setStaffSort, c)} />
                <SortTh label="Placements"      col="total_placements"   sort={staffSort} onSort={(c) => toggleSort(staffSort, setStaffSort, c)} />
                <th className={thCls}>Conversion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingStaff ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
              ) : sortedStaff.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No data for this period.</td></tr>
              ) : sortedStaff.map((r) => {
                const rate = r.total_applications > 0
                  ? Math.round((r.total_placements / r.total_applications) * 100)
                  : 0;
                return (
                  <tr key={r.user_id} className="hover:bg-slate-50">
                    <td className={`${tdCls} font-semibold text-slate-900`}>{r.user_name}</td>
                    <td className={tdCls}>
                      <span className="text-xs px-2 py-0.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-full capitalize">
                        {r.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className={`${tdCls} text-slate-700`}>{r.jobs_assigned}</td>
                    <td className={`${tdCls} text-slate-700`}>{r.active_jobs}</td>
                    <td className={`${tdCls} text-slate-700`}>{r.total_applications}</td>
                    <td className={tdCls}>
                      <span className={`font-bold text-base ${r.total_placements > 0 ? "text-[#e88e2e]" : "text-slate-400"}`}>
                        {r.total_placements}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 w-20">
                          <div className={`h-2 rounded-full ${rate >= 50 ? "bg-green-500" : rate >= 20 ? "bg-[#e88e2e]" : "bg-red-400"}`}
                            style={{ width: `${rate}%` }} />
                        </div>
                        <span className={`text-xs font-bold w-10 ${rate >= 50 ? "text-green-700" : rate >= 20 ? "text-[#e88e2e]" : "text-red-500"}`}>
                          {rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab 3: Placement Report Month Wise ── */}
      {tab === "placement_monthly" && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {["Candidate", "Job", "Employer", "Provider", "Start Date", "Month", "Confirmed", "D1", "W1", "M1", "M3", "M6"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingPlacements ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
              ) : placementReport.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">No data for this period.</td></tr>
              ) : (() => {
                // Group rows — add month label to first row of each month
                const sorted = [...placementReport].sort(
                  (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
                );
                let lastMonth = "";
                return sorted.map((r) => {
                  const month = format(parseISO(r.start_date), "MMM yyyy");
                  const isNewMonth = month !== lastMonth;
                  lastMonth = month;
                  const wcs = Object.entries(r.welfare_checks ?? {}).map(([check_type, v]) => ({
                    id: check_type, placement_id: r.placement_id,
                    check_type: check_type as WelfareCheckType,
                    due_date: v.due_date,
                    completed_at: v.completed ? today : null,
                    created_at: today,
                  }));
                  return (
                    <>
                      {isNewMonth && (
                        <tr key={`month-${month}`} className="bg-orange-50/60">
                          <td colSpan={12} className="px-4 py-2 text-xs font-bold text-[#e88e2e] uppercase tracking-wider border-t-2 border-orange-200">
                            {month}
                          </td>
                        </tr>
                      )}
                      <tr key={r.placement_id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => window.location.href = `/placements/${r.placement_id}`}>
                        <td className="px-3 py-3 font-medium text-slate-900">{r.candidate_name}</td>
                        <td className="px-3 py-3 text-slate-700">{r.job_title}</td>
                        <td className="px-3 py-3 text-slate-600">{r.employer_name || "—"}</td>
                        <td className="px-3 py-3 text-slate-600">{r.provider_name || "—"}</td>
                        <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{format(parseISO(r.start_date), "d MMM yyyy")}</td>
                        <td className="px-3 py-3 text-slate-500 text-xs font-medium">{month}</td>
                        <td className="px-3 py-3">
                          {r.confirmed_by_employer
                            ? <span className="text-green-600 text-xs font-semibold">✓ Yes</span>
                            : <span className="text-slate-400 text-xs">Pending</span>}
                        </td>
                        <td className="px-3 py-3" colSpan={5}><WelfareCheckDots checks={wcs} /></td>
                      </tr>
                    </>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab 4: Vacancy Report ── */}
      {tab === "vacancy" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <SortTh label="Job Title"   col="title"             sort={vacSort} onSort={(c) => toggleSort(vacSort, setVacSort, c)} />
                <SortTh label="Employer"    col="employer_name"     sort={vacSort} onSort={(c) => toggleSort(vacSort, setVacSort, c)} />
                <th className={thCls}>Status</th>
                <th className={thCls}>Work Type</th>
                <th className={thCls}>Location</th>
                <SortTh label="Positions"   col="positions_count"   sort={vacSort} onSort={(c) => toggleSort(vacSort, setVacSort, c)} />
                <SortTh label="Applicants"  col="application_count" sort={vacSort} onSort={(c) => toggleSort(vacSort, setVacSort, c)} />
                <th className={thCls}>Pay Rate</th>
                <SortTh label="Created"     col="created_at"        sort={vacSort} onSort={(c) => toggleSort(vacSort, setVacSort, c)} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingVacancies ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
              ) : sortedVacancies.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No vacancies for this period.</td></tr>
              ) : sortedVacancies.map((r) => {
                const loc = r.work_location || [r.city, r.state].filter(Boolean).join(", ") || "—";
                const pay = r.pay_rate
                  ? `$${Number(r.pay_rate).toLocaleString()}${r.pay_rate_type === "annual" ? "/yr" : "/hr"}`
                  : "—";
                return (
                  <tr key={r.id} className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => window.location.href = `/jobs/${r.id}`}>
                    <td className={`${tdCls} font-semibold text-slate-900 hover:text-[#e88e2e]`}>{r.title}</td>
                    <td className={`${tdCls} text-slate-600`}>
                      {r.employer_name
                        ? <span className="flex items-center gap-1"><Building2 size={12} className="text-slate-400" />{r.employer_name}</span>
                        : "—"}
                    </td>
                    <td className={tdCls}>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[r.status] ?? STATUS_BADGE.draft}`}>
                        {r.status === "published" ? "Open" : r.status}
                      </span>
                    </td>
                    <td className={`${tdCls} text-slate-600 capitalize`}>{r.vacancy_type?.replace("_", "-") || "—"}</td>
                    <td className={`${tdCls} text-slate-600`}>
                      {loc !== "—"
                        ? <span className="flex items-center gap-1"><MapPin size={12} className="text-slate-400" />{loc}</span>
                        : "—"}
                    </td>
                    <td className={`${tdCls} text-slate-700 text-center`}>{r.positions_count || "—"}</td>
                    <td className={tdCls}>
                      <span className={`font-semibold ${r.application_count > 0 ? "text-[#e88e2e]" : "text-slate-400"}`}>
                        {r.application_count}
                      </span>
                    </td>
                    <td className={`${tdCls} font-semibold text-[#e88e2e]`}>{pay}</td>
                    <td className={`${tdCls} text-slate-500 whitespace-nowrap`}>
                      {format(parseISO(r.created_at), "d MMM yyyy")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

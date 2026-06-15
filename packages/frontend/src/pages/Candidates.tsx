import { Fragment, useState, useEffect } from "react";
import { displayEmail } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { List, Grid, Search, Calendar, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { useCandidatePool } from "../hooks/useCandidatePool";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { useToast } from "../components/ui/use-toast";
import type { CandidatePoolRow, CandidateWorkStatus, WelfareCheck, WelfareCheckType } from "../types";

type Tab        = "all" | "in_progress" | "placed" | "not_successful" | "inactive";
type View       = "list" | "card";
type DateFilter = "all" | "this_week" | "this_month";

const TABS: { id: Tab; label: string }[] = [
  { id: "all",            label: "All"            },
  { id: "in_progress",    label: "In Progress"    },
  { id: "placed",         label: "Placed"         },
  { id: "not_successful", label: "Not Successful" },
  { id: "inactive",       label: "Inactive"       },
];

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "all",        label: "All Time"   },
  { id: "this_week",  label: "This Week"  },
  { id: "this_month", label: "This Month" },
];

const STATUS_BADGE: Record<string, string> = {
  placed:      "bg-green-100 text-green-700",
  job_seeking: "bg-amber-100 text-amber-700",
  employed:    "bg-blue-100 text-blue-700",
  inactive:    "bg-slate-100 text-slate-500",
};

const WELFARE_ORDER: WelfareCheckType[] = ["day_1", "week_1", "month_1", "month_3", "month_6"];
const WELFARE_LABELS: Record<WelfareCheckType, string> = {
  day_1:   "Day 1",
  week_1:  "Week 1",
  month_1: "1 Month",
  month_3: "3 Months",
  month_6: "6 Months",
};

function welfareBandClass(check: WelfareCheck | undefined, today: string): string {
  if (!check) return "bg-gray-100 text-gray-400";
  if (check.completed_at) return "bg-green-100 text-green-700";
  const overdue = check.due_date <= today;
  const soon    = !overdue && new Date(check.due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (overdue) return "bg-red-100 text-red-700";
  if (soon)    return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function welfareBandStatus(check: WelfareCheck | undefined, today: string): string {
  if (!check) return "—";
  if (check.completed_at) return "Done";
  if (check.due_date <= today) return "Overdue";
  return `Due ${format(new Date(check.due_date), "d MMM")}`;
}

interface CandidateRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  provider_name?: string;
  provider_contact_name?: string;
  provider_contact_email?: string;
  consultant_name?: string;
  status: string;
}

function WelfareSubRow({ checks, colSpan }: { checks: WelfareCheck[]; colSpan: number }) {
  const today   = new Date().toISOString().split("T")[0];
  const checkMap = Object.fromEntries(checks.map((c) => [c.check_type, c])) as Record<string, WelfareCheck>;
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-1.5 bg-slate-50 border-b">
        <div className="flex gap-1">
          {WELFARE_ORDER.map((type) => {
            const check = checkMap[type];
            return (
              <div key={type}
                className={`flex-1 text-center text-xs rounded-lg px-2 py-1 font-medium ${welfareBandClass(check, today)}`}>
                <div>{WELFARE_LABELS[type]}</div>
                <div className="font-normal opacity-75">{welfareBandStatus(check, today)}</div>
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

function getStatusLabel(row: CandidatePoolRow): string {
  if (row.work_status === "placed")   return "Placed";
  if (row.work_status === "inactive") return "Inactive";
  if (row.work_status === "employed") return "Employed";
  if (row.latest_stage && ["applied","screening","interview","offer"].includes(row.latest_stage)) return "In Progress";
  return "Job Seeking";
}

// Date range helper
function getDateFrom(filter: DateFilter): string | undefined {
  if (filter === "this_week")  return startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split("T")[0];
  if (filter === "this_month") return startOfMonth(new Date()).toISOString().split("T")[0];
  return undefined;
}

export default function Candidates() {
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const [view, setView] = useState<View>(
    () => (localStorage.getItem("candidatesView") as View) || "list"
  );
  const [tab,        setTab]        = useState<Tab>("all");
  const [q,          setQ]          = useState("");
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const canCreate = ["admin", "recruiter_admin", "recruiter"].includes(user?.role ?? "");

  // ── Live search with 350ms debounce ──────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useCandidatePool({
    tab,
    page,
    q: search,
    date_from: getDateFrom(dateFilter),
  });

  const rows       = data?.data ?? [];
  const meta       = data?.meta;
  const tabCounts  = meta?.tab_counts ?? { all: 0, in_progress: 0, placed: 0, not_successful: 0, inactive: 0 };
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1;

  const sendConfirmation = useMutation({
    mutationFn: (placementId: string) =>
      api.post(`/placements/${placementId}/send-confirmation`, {}),
    onSuccess: () => {
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: ["candidate-pool"] });
    },
    onError: () => {
      setConfirmingId(null);
      toast({ title: "Error", description: "Failed to send confirmation email.", variant: "destructive" });
    },
  });

  function handleTabChange(newTab: Tab) {
    setTab(newTab);
    setPage(1);
  }

  function handleViewChange(v: View) {
    setView(v);
    localStorage.setItem("candidatesView", v);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Candidates
            {meta && (
              <span className="ml-2 text-lg text-slate-400 font-normal">({tabCounts.all})</span>
            )}
          </h1>
          {search && (
            <p className="text-sm text-slate-400 mt-0.5">
              Showing results for "<span className="text-slate-600 font-medium">{search}</span>"
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-slate-200 rounded-xl overflow-hidden">
            <button onClick={() => handleViewChange("list")}
              className={`px-3 py-2 transition ${view === "list" ? "bg-[#e88e2e] text-white" : "text-slate-500 hover:bg-slate-50"}`}
              title="List view">
              <List size={15} />
            </button>
            <button onClick={() => handleViewChange("card")}
              className={`px-3 py-2 transition ${view === "card" ? "bg-[#e88e2e] text-white" : "text-slate-500 hover:bg-slate-50"}`}
              title="Card view">
              <Grid size={15} />
            </button>
          </div>
          {canCreate && (
            <button onClick={() => navigate("/candidates/new")}
              className="bg-[#e88e2e] hover:bg-[#d07d20] text-white px-4 py-2 rounded-xl text-sm font-medium transition">
              + Add Candidate
            </button>
          )}
        </div>
      </div>

      {/* ── Search + Date filter row ─────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Search input — live */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone, provider…"
            className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e] focus:border-transparent bg-white"
          />
          {q && (
            <button onClick={() => { setQ(""); setSearch(""); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date filter pills */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
          <Calendar size={13} className="text-slate-400 ml-1.5" />
          {DATE_FILTERS.map((df) => (
            <button key={df.id} onClick={() => { setDateFilter(df.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                dateFilter === df.id
                  ? "bg-[#e88e2e] text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}>
              {df.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Status Tabs ─────────────────────────────────────────── */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        {TABS.map(({ id, label }) => {
          const count    = tabCounts[id] ?? 0;
          const isActive = tab === id;
          return (
            <button key={id} onClick={() => handleTabChange(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-[#e88e2e] text-[#e88e2e]"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}>
              {label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                isActive ? "bg-[#e88e2e] text-white" : "bg-slate-100 text-slate-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#e88e2e] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <Search size={36} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">
            {search ? `No candidates found for "${search}"` : "No candidates found."}
          </p>
          {search && (
            <button onClick={() => { setQ(""); setSearch(""); }}
              className="mt-2 text-sm text-[#e88e2e] hover:underline">
              Clear search
            </button>
          )}
        </div>
      ) : view === "list" ? (
        /* ── List View ── */
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {["Name","Date Referred","Mobile","Email","Provider","Consultant","Status","Comment","Training Dates","Job Start","Employer","Job Role",""].map((h) => (
                  <th key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr onClick={() => navigate(`/candidates/${row.id}`)}
                    className="hover:bg-orange-50/40 cursor-pointer border-b transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#e88e2e] to-[#f5a623] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 whitespace-nowrap">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {row.date_referred
                        ? format(new Date(row.date_referred), "d MMM yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{displayEmail(row.email)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.provider_name || "—"}</td>
                    <td className="px-4 py-3">
                      {row.consultant_name
                        ? <span className="text-slate-700 whitespace-nowrap">{row.consultant_name}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium whitespace-nowrap ${
                        STATUS_BADGE[row.work_status as CandidateWorkStatus] ?? "bg-slate-100 text-slate-600"
                      }`}>
                        {getStatusLabel(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate" title={row.notes ?? ""}>
                      {row.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.training_start_date
                        ? `${format(new Date(row.training_start_date), "d MMM yyyy")}${row.training_end_date ? ` – ${format(new Date(row.training_end_date), "d MMM yyyy")}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.job_start_date ? format(new Date(row.job_start_date), "d MMM yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.employer_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.job_title || "—"}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {row.placement_id && !row.confirmed_by_employer && canCreate && (
                        <button
                          onClick={() => { setConfirmingId(row.placement_id!); sendConfirmation.mutate(row.placement_id!); }}
                          disabled={confirmingId === row.placement_id}
                          className="text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50 whitespace-nowrap disabled:opacity-50 transition">
                          {confirmingId === row.placement_id ? "Sending…" : "Email to Confirm"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {row.placement_id && (row.welfare_checks?.length ?? 0) > 0 && (
                    <WelfareSubRow checks={row.welfare_checks!} colSpan={13} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Card View ── */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((row) => (
            <button key={row.id} onClick={() => navigate(`/candidates/${row.id}`)}
              className="bg-white rounded-2xl shadow-sm p-4 text-left hover:shadow-md hover:border-orange-200 border border-transparent transition">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e88e2e] to-[#f5a623] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {row.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{row.name}</p>
                  <p className="text-xs text-slate-500 truncate">{displayEmail(row.email)}</p>
                </div>
              </div>
              {row.phone && (
                <p className="text-xs text-slate-400 mb-1">{row.phone}</p>
              )}
              {(row.city || row.state) && (
                <p className="text-xs text-slate-400 mb-2">
                  {[row.city, row.state].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${
                  STATUS_BADGE[row.work_status as CandidateWorkStatus] ?? "bg-slate-100 text-slate-600"
                }`}>
                  {getStatusLabel(row)}
                </span>
                {row.provider_name && (
                  <span className="text-xs text-slate-400 truncate ml-2">{row.provider_name}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 transition">
            ← Previous
          </button>
          <span className="text-sm text-slate-500 px-3">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 transition">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

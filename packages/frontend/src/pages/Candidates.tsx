import { Fragment, useState } from "react";
import { displayEmail } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { List, Grid, Search } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCandidatePool } from "../hooks/useCandidatePool";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { useToast } from "../components/ui/use-toast";
import type { CandidatePoolRow, CandidateWorkStatus, WelfareCheck, WelfareCheckType } from "../types";

type Tab = "all" | "in_progress" | "placed" | "not_successful" | "inactive";
type View = "list" | "card";

const TABS: { id: Tab; label: string }[] = [
  { id: "all",            label: "All" },
  { id: "in_progress",    label: "In Progress" },
  { id: "placed",         label: "Placed" },
  { id: "not_successful", label: "Not Successful" },
  { id: "inactive",       label: "Inactive" },
];

const STATUS_BADGE: Record<string, string> = {
  placed:      "border border-green-500 text-green-700",
  job_seeking: "border border-amber-400 text-amber-600",
  employed:    "border border-blue-400 text-blue-600",
  inactive:    "border border-gray-300 text-gray-500",
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
  const soon = !overdue && new Date(check.due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (overdue) return "bg-red-100 text-red-700";
  if (soon) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function welfareBandStatus(check: WelfareCheck | undefined, today: string): string {
  if (!check) return "—";
  if (check.completed_at) return "Done";
  if (check.due_date <= today) return "Overdue";
  return `Due ${format(new Date(check.due_date), "d MMM")}`;
}

function WelfareSubRow({ checks, colSpan }: { checks: WelfareCheck[]; colSpan: number }) {
  const today = new Date().toISOString().split("T")[0];
  const checkMap = Object.fromEntries(checks.map((c) => [c.check_type, c])) as Record<string, WelfareCheck>;
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-1.5 bg-slate-50 border-b">
        <div className="flex gap-1">
          {WELFARE_ORDER.map((type) => {
            const check = checkMap[type];
            return (
              <div
                key={type}
                className={`flex-1 text-center text-xs rounded px-2 py-1 font-medium ${welfareBandClass(check, today)}`}
              >
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
  if (row.work_status === "placed") return "Placed";
  if (row.work_status === "inactive") return "Inactive";
  if (row.work_status === "employed") return "Employed";
  if (
    row.latest_stage &&
    ["applied", "screening", "interview", "offer"].includes(row.latest_stage)
  ) return "In Progress";
  return "Job Seeking";
}

export default function Candidates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [view, setView] = useState<View>(
    () => (localStorage.getItem("candidatesView") as View) || "list"
  );
  const [tab, setTab]       = useState<Tab>("all");
  const [q, setQ]           = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const canCreate = ["admin", "recruiter_admin", "recruiter"].includes(user?.role ?? "");

  const { data, isLoading } = useCandidatePool({ tab, page, q: search });
  const rows      = data?.data ?? [];
  const meta      = data?.meta;
  const tabCounts = meta?.tab_counts ?? { all: 0, in_progress: 0, placed: 0, not_successful: 0, inactive: 0 };
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
      toast({
        title: "Error",
        description: "Failed to send confirmation email. Please try again.",
        variant: "destructive",
      });
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(q);
    setPage(1);
  }

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
          Candidates
          {meta && (
            <span className="ml-2 text-lg text-slate-400 font-normal">
              ({tabCounts.all})
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => handleViewChange("list")}
              className={`px-3 py-2 ${view === "list" ? "bg-[#e88e2e] text-white" : "text-slate-500 hover:bg-slate-50"}`}
              title="List view"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => handleViewChange("card")}
              className={`px-3 py-2 ${view === "card" ? "bg-[#e88e2e] text-white" : "text-slate-500 hover:bg-slate-50"}`}
              title="Card view"
            >
              <Grid size={15} />
            </button>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate("/candidates/new")}
              className="bg-[#e88e2e] hover:bg-[#d07d20] text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              + Add Candidate
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
        >
          Search
        </button>
      </form>

      {/* Tabs */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        {TABS.map(({ id, label }) => {
          const count = tabCounts[id] ?? 0;
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-slate-800 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-[#e88e2e] text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-slate-500 py-8">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400">No candidates found.</p>
        </div>
      ) : view === "list" ? (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {[
                  "Name", "Mobile", "Email", "Provider", "Consultant",
                  "Status", "Comment", "Training Dates", "Job Start",
                  "Employer", "Job Role", "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    onClick={() => navigate(`/candidates/${row.id}`)}
                    className="hover:bg-slate-50 cursor-pointer border-b"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full border border-blue-400 text-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 whitespace-nowrap">
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{displayEmail(row.email)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.provider_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.provider_contact_name ? (
                        <div>
                          <p className="text-slate-700 whitespace-nowrap">
                            {row.provider_contact_name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {row.provider_contact_email}
                          </p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs border rounded-full px-2 py-0.5 whitespace-nowrap ${
                          STATUS_BADGE[row.work_status as CandidateWorkStatus] ??
                          "border-slate-300 text-slate-600"
                        }`}
                      >
                        {getStatusLabel(row)}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-slate-500 max-w-[140px] truncate"
                      title={row.notes ?? ""}
                    >
                      {row.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.training_start_date
                        ? `${format(new Date(row.training_start_date), "d MMM yyyy")}${
                            row.training_end_date
                              ? ` – ${format(new Date(row.training_end_date), "d MMM yyyy")}`
                              : ""
                          }`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.job_start_date
                        ? format(new Date(row.job_start_date), "d MMM yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.employer_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {row.job_title || "—"}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.placement_id && !row.confirmed_by_employer && canCreate && (
                        <button
                          onClick={() => {
                            setConfirmingId(row.placement_id!);
                            sendConfirmation.mutate(row.placement_id!);
                          }}
                          disabled={confirmingId === row.placement_id}
                          className="text-xs text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
                        >
                          {confirmingId === row.placement_id ? "Sending..." : "Email to Confirm"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {row.placement_id && (row.welfare_checks?.length ?? 0) > 0 && (
                    <WelfareSubRow checks={row.welfare_checks!} colSpan={12} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card view — preserved layout */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => navigate(`/candidates/${row.id}`)}
              className="bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full border border-blue-400 text-blue-600 bg-transparent flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {row.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{row.name}</p>
                  <p className="text-xs text-slate-500 truncate">{displayEmail(row.email)}</p>
                </div>
              </div>
              {(row.city || row.state) && (
                <p className="text-xs text-slate-400 mb-2">
                  {[row.city, row.state].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs border rounded-full px-2 py-0.5 ${
                    STATUS_BADGE[row.work_status as CandidateWorkStatus] ??
                    "border-slate-300 text-slate-600"
                  }`}
                >
                  {getStatusLabel(row)}
                </span>
                {row.provider_name && (
                  <span className="text-xs text-slate-400">{row.provider_name}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

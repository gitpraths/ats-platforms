import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { displayEmail, fmtDate } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { List, Grid, Calendar, X, Pencil, Info, FilterX } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { useCandidatePool } from "../hooks/useCandidatePool";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { useToast } from "../components/ui/use-toast";
import type { CandidatePoolRow as BaseCandidatePoolRow, CandidateWorkStatus, WelfareCheck, WelfareCheckType } from "../types";
import Pagination from "../components/Pagination";

// Extend base type with extra fields returned by API but not yet in the type definition
type CandidatePoolRow = BaseCandidatePoolRow & {
  sr_no?: string | null;
  comments?: string | null;
  car?: string | null;
  police_check?: string | null;
  wwc?: string | null;
};

type ColFilters = {
  name: string; email: string; phone: string; provider: string; comments: string;
  referral_date: string; training_date: string; interview_date: string;
  ets_date: string; placement_date: string;
};
const EMPTY_FILTERS: ColFilters = {
  name: "", email: "", phone: "", provider: "", comments: "",
  referral_date: "", training_date: "", interview_date: "", ets_date: "", placement_date: "",
};

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
  return `Due ${fmtDate(check.due_date)}`;
}

// Pipeline stage derived from candidate's date progression
function getPipelineStage(row: CandidatePoolRow): { label: string; color: string; bg: string } {
  if (row.latest_placement_date) return { label: "Placed",     color: "text-green-700", bg: "bg-green-500" };
  if (row.latest_ets_date)        return { label: "ETS",        color: "text-amber-700", bg: "bg-amber-500" };
  if (row.latest_interview_date)  return { label: "Interview",  color: "text-blue-700",  bg: "bg-blue-500"  };
  return                                 { label: "Referred",   color: "text-slate-500", bg: "bg-slate-300" };
}

// Tooltip showing extra candidate info on hover
// ── CellTooltip — appears on hover over any table cell ───────────────────────
function CellTooltip({
  children,
  title,
  items,
}: {
  children: React.ReactNode;
  title: string;
  items: { key: string; value: React.ReactNode }[];
}) {
  const [show, setShow] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const visibleItems = items.filter((i) => {
    if (i.value === null || i.value === undefined || i.value === "") return false;
    if (typeof i.value === "string" && i.value.trim() === "") return false;
    return true;
  });

  function handleEnter() {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setShow(true);
  }

  if (visibleItems.length === 0) return <>{children}</>;

  const above = rect ? rect.bottom > window.innerHeight - 180 : false;

  return (
    <div ref={ref} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && rect && (
        <div
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl text-xs pointer-events-none"
          style={
            above
              ? { left: Math.min(rect.left, window.innerWidth - 224), bottom: window.innerHeight - rect.top + 6 }
              : { left: Math.min(rect.left, window.innerWidth - 224), top: rect.bottom + 6 }
          }
        >
          {/* Arrow */}
          <div
            className={`absolute left-4 w-0 h-0 border-x-[6px] border-x-transparent ${
              above
                ? "bottom-[-6px] border-t-[6px] border-t-white"
                : "top-[-6px] border-b-[6px] border-b-white"
            }`}
            style={above ? { filter: "drop-shadow(0 1px 0 #e2e8f0)" } : { filter: "drop-shadow(0 -1px 0 #e2e8f0)" }}
          />
          <div className="p-3 w-52">
            <p className="font-semibold text-slate-700 border-b border-slate-100 pb-1.5 mb-2 text-[11px] uppercase tracking-wide">
              {title}
            </p>
            <div className="space-y-1.5">
              {visibleItems.map((i) => (
                <div key={i.key} className="flex justify-between gap-3">
                  <span className="text-slate-400 flex-shrink-0">{i.key}</span>
                  <span className="font-medium text-slate-700 text-right">{i.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTooltip({ row }: { row: CandidatePoolRow }) {

  const [show, setShow]   = useState(false);
  const [pos,  setPos]    = useState({ x: 0, y: 0 });
  const btnRef            = useRef<HTMLButtonElement>(null);

  function handleEnter() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ x: r.right + 10, y: r.top - 8 });
    }
    setShow(true);
  }

  const yesNo = (v?: string | null) =>
    v === "yes" ? <span className="text-green-600 font-semibold">Yes</span>
               : v === "no"  ? <span className="text-red-500 font-semibold">No</span>
               : <span className="text-slate-400">—</span>;

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => e.stopPropagation()}
        className="ml-1.5 text-slate-300 hover:text-[#e88e2e] transition-colors"
      >
        <Info size={12} />
      </button>
      {show && (
        <div
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-64 text-xs"
          style={{ left: pos.x, top: pos.y }}
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        >
          <p className="font-semibold text-slate-700 mb-2 border-b pb-1.5">Extra Details</p>
          <div className="space-y-1.5">
            {(row.suburb || row.state) && (
              <div className="flex justify-between">
                <span className="text-slate-400">Location</span>
                <span className="font-medium text-slate-700">{[row.suburb || row.city, row.state].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {row.consultant_name && (
              <div className="flex justify-between">
                <span className="text-slate-400">Consultant</span>
                <span className="font-medium text-slate-700">{row.consultant_name}</span>
              </div>
            )}
            {row.benchmark_hours && (
              <div className="flex justify-between">
                <span className="text-slate-400">Benchmark</span>
                <span className="font-medium text-slate-700">{row.benchmark_hours}h / week</span>
              </div>
            )}
            {(row.industry_preference ?? []).length > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 flex-shrink-0">Industry</span>
                <span className="font-medium text-slate-700 text-right">{row.industry_preference!.join(", ")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Car</span>
              {yesNo(row.car)}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Police Check</span>
              {yesNo(row.police_check)}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">WWC</span>
              {yesNo(row.wwc)}
            </div>
            {row.wage_subsidy && (
              <div className="flex justify-between">
                <span className="text-slate-400">Wage Subsidy</span>
                <span className="font-semibold text-green-600">Yes</span>
              </div>
            )}
            {row.employer_name && (
              <div className="flex justify-between">
                <span className="text-slate-400">Employer</span>
                <span className="font-medium text-slate-700">{row.employer_name}</span>
              </div>
            )}
            {row.job_title && (
              <div className="flex justify-between">
                <span className="text-slate-400">Job Role</span>
                <span className="font-medium text-slate-700">{row.job_title}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WelfareSubRow({ checks, colSpan }: { checks: WelfareCheck[]; colSpan: number }) {  // colSpan updated to 12 for new focused table
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

// ── Inline Date Cell ──────────────────────────────────────────────────────────
function InlineDateCell({
  appId,
  field,
  value,
  onSaved,
  validate,
  allowClear,
}: {
  appId: string | null | undefined;
  field: "interview_date" | "ets_date" | "placement_date";
  value: string | null | undefined;
  onSaved: () => void;
  validate?: (newDate: string | null) => string | null;
  allowClear?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  if (!appId) {
    return <span className="text-slate-200 text-xs">—</span>;
  }

  async function clearValue() {
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/applications/${appId}`, { [field]: null });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally { setSaving(false); }
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value || null;
    setError(null);
    if (validate) {
      const err = validate(newVal);
      if (err) { setError(err); return; }
    }
    setSaving(true);
    try {
      await api.patch(`/applications/${appId}`, { [field]: newVal });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Save failed");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type="date"
          autoFocus
          defaultValue={value ?? ""}
          onBlur={() => { setEditing(false); setError(null); }}
          onChange={handleChange}
          className="border border-[#e88e2e] rounded-lg px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#e88e2e]/40 w-32"
        />
        {error && <span className="text-[10px] text-red-500 leading-tight max-w-[130px]">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          disabled={saving}
          className="group flex items-center gap-1 text-xs text-left transition-colors hover:text-[#e88e2e]"
        >
          {saving ? (
            <span className="text-slate-400">Saving…</span>
          ) : value ? (
            <><span className="font-medium text-slate-700 group-hover:text-[#e88e2e]">{fmtDate(value)}</span><Pencil size={9} className="text-slate-300 group-hover:text-[#e88e2e] ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" /></>
          ) : (
            <span className="text-slate-300 group-hover:text-[#e88e2e]/60 italic">+ set</span>
          )}
        </button>
        {allowClear && value && !saving && (
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm("Remove this placement date?")) clearValue(); }}
            className="text-slate-300 hover:text-red-500 transition-colors ml-0.5"
            title="Clear placement date"
          >
            <X size={10} />
          </button>
        )}
      </div>
      {error && <span className="text-[10px] text-red-500 leading-tight max-w-[160px]">{error}</span>}
    </div>
  );
}

function getStatusLabel(row: CandidatePoolRow): string {
  if (row.work_status === "placed")   return "Placed";
  if (row.work_status === "inactive") return "Inactive";
  if (row.work_status === "employed") return "Employed";
  if (row.latest_stage && ["applied","screening","interview","ets"].includes(row.latest_stage)) return "In Progress";
  return "Job Seeking";
}

// Date range helper
function getDateFrom(filter: DateFilter): string | undefined {
  if (filter === "this_week")  return startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split("T")[0];
  if (filter === "this_month") return startOfMonth(new Date()).toISOString().split("T")[0];
  return undefined;
}

// ── Column filter subcomponents ───────────────────────────────────────────────
function ColInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-2 pr-6 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#e88e2e] focus:border-[#e88e2e] bg-white placeholder-slate-300 font-normal"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
          <X size={10} />
        </button>
      )}
    </div>
  );
}
function ColDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-2 pr-6 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#e88e2e] focus:border-[#e88e2e] bg-white text-slate-600 font-normal"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
          <X size={10} />
        </button>
      )}
    </div>
  );
}

export default function Candidates() {

  const navigate    = useNavigate();
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const [view, setView] = useState<View>(
    () => (localStorage.getItem("candidatesView") as View) || "list"
  );
  const [tab,          setTab]          = useState<Tab>("all");
  const [page,         setPage]         = useState(1);
  const [dateFilter,   setDateFilter]   = useState<DateFilter>("all");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Per-column filter state
  const [colFilters, setColFilters]         = useState<ColFilters>(EMPTY_FILTERS);
  const [debounced,  setDebounced]          = useState<ColFilters>(EMPTY_FILTERS);

  // Debounce text filters (350ms), apply date filters immediately
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced((prev) => ({
        ...prev,
        name:     colFilters.name,
        email:    colFilters.email,
        phone:    colFilters.phone,
        provider: colFilters.provider,
        comments: colFilters.comments,
      }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [colFilters.name, colFilters.email, colFilters.phone, colFilters.provider, colFilters.comments]);

  // Date filters apply immediately
  useEffect(() => {
    setDebounced((prev) => ({
      ...prev,
      referral_date:  colFilters.referral_date,
      training_date:  colFilters.training_date,
      interview_date: colFilters.interview_date,
      ets_date:       colFilters.ets_date,
      placement_date: colFilters.placement_date,
    }));
    setPage(1);
  }, [colFilters.referral_date, colFilters.training_date, colFilters.interview_date, colFilters.ets_date, colFilters.placement_date]);

  function setCol(key: keyof ColFilters, val: string) {
    setColFilters((prev) => ({ ...prev, [key]: val }));
  }
  function clearAll() { setColFilters(EMPTY_FILTERS); setDebounced(EMPTY_FILTERS); setPage(1); }

  const hasFilters = Object.values(colFilters).some(Boolean);

  const canCreate = ["admin", "recruiter_admin", "recruiter"].includes(user?.role ?? "");



  const { data, isLoading } = useCandidatePool({
    tab, page,
    date_from:      getDateFrom(dateFilter),
    name_q:         debounced.name,
    email_q:        debounced.email,
    phone_q:        debounced.phone,
    provider_q:     debounced.provider,
    comments_q:     debounced.comments,
    referral_date:  debounced.referral_date,
    training_date:  debounced.training_date,
    interview_date: debounced.interview_date,
    ets_date:       debounced.ets_date,
    placement_date: debounced.placement_date,
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

      {/* ── Top bar: date pills + clear all ──────────────────── */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Referral date filter pills */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
          <Calendar size={13} className="text-slate-400 ml-1.5" />
          <span className="text-xs text-slate-400 mr-1">Referred:</span>
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

        {/* Clear all column filters */}
        {hasFilters && (
          <button onClick={clearAll}
            className="flex items-center gap-1.5 text-xs font-medium text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl px-3 py-2 transition">
            <FilterX size={13} /> Clear All Filters
          </button>
        )}
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
          <Info size={36} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">
            {hasFilters ? "No candidates match the current filters." : "No candidates found."}
          </p>
          {hasFilters && (
            <button onClick={clearAll} className="mt-2 text-sm text-[#e88e2e] hover:underline">
              Clear all filters
            </button>
          )}
        </div>
      ) : view === "list" ? (
        /* ── List View — focused table with per-column search ── */
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              {/* Row 1: Column labels */}
              <tr>
                {["SR #","Candidate","Email","Mobile","Provider","Referral Date","Training Date","Interview Date","ETS Date","Placement Date","Comments",""].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
              {/* Row 2: Per-column search inputs */}
              <tr className="border-t border-slate-100">
                {/* SR # — no search */}
                <th className="px-3 pb-2 pt-1" />
                {/* Candidate */}
                <th className="px-3 pb-2 pt-1">
                  <ColInput value={colFilters.name}     onChange={(v) => setCol("name", v)}     placeholder="Name…" />
                </th>
                {/* Email */}
                <th className="px-3 pb-2 pt-1">
                  <ColInput value={colFilters.email}    onChange={(v) => setCol("email", v)}    placeholder="Email…" />
                </th>
                {/* Mobile */}
                <th className="px-3 pb-2 pt-1">
                  <ColInput value={colFilters.phone}    onChange={(v) => setCol("phone", v)}    placeholder="Mobile…" />
                </th>
                {/* Provider */}
                <th className="px-3 pb-2 pt-1">
                  <ColInput value={colFilters.provider} onChange={(v) => setCol("provider", v)} placeholder="Provider…" />
                </th>
                {/* Referral Date */}
                <th className="px-3 pb-2 pt-1">
                  <ColDate value={colFilters.referral_date}  onChange={(v) => setCol("referral_date", v)} />
                </th>
                {/* Training Date */}
                <th className="px-3 pb-2 pt-1">
                  <ColDate value={colFilters.training_date}  onChange={(v) => setCol("training_date", v)} />
                </th>
                {/* Interview Date */}
                <th className="px-3 pb-2 pt-1">
                  <ColDate value={colFilters.interview_date} onChange={(v) => setCol("interview_date", v)} />
                </th>
                {/* ETS Date */}
                <th className="px-3 pb-2 pt-1">
                  <ColDate value={colFilters.ets_date}       onChange={(v) => setCol("ets_date", v)} />
                </th>
                {/* Placement Date */}
                <th className="px-3 pb-2 pt-1">
                  <ColDate value={colFilters.placement_date} onChange={(v) => setCol("placement_date", v)} />
                </th>
                {/* Comments */}
                <th className="px-3 pb-2 pt-1">
                  <ColInput value={colFilters.comments} onChange={(v) => setCol("comments", v)} placeholder="Comments…" />
                </th>
                {/* Actions — no search */}
                <th className="px-3 pb-2 pt-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const stage = getPipelineStage(row);
                return (
                  <Fragment key={row.id}>
                    <tr onClick={() => navigate(`/candidates/${row.id}`)}
                      className={`cursor-pointer border-b transition group ${
                        (row as any).intention_to_work === "not_suitable"
                          ? "bg-red-50/60 hover:bg-red-50"
                          : "hover:bg-orange-50/40"
                      }`}>

                      {/* SR # */}
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                        {(row as any).sr_no || "—"}
                      </td>

                      {/* Candidate name + pipeline dot + info icon */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#e88e2e] to-[#f5a623] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-medium whitespace-nowrap ${
                                (row as any).intention_to_work === "not_suitable" ? "text-red-700" : "text-slate-900"
                              }`}>{row.name}</span>
                              {(row as any).intention_to_work === "not_suitable" && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">Not Suitable</span>
                              )}
                              <InfoTooltip row={row} />
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${stage.bg}`} />
                              <span className={`text-[10px] font-medium ${stage.color}`}>{stage.label}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {row.email ? displayEmail(row.email) : "—"}
                      </td>

                      {/* Mobile */}
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{row.phone || "—"}</td>

                      {/* Provider */}
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                        <CellTooltip
                          title="Provider"
                          items={[
                            { key: "Consultant", value: row.consultant_name },
                            { key: "Contact",    value: (row as any).provider_contact_name },
                            { key: "Email",      value: (row as any).provider_contact_email },
                          ]}
                        >
                          {row.provider_name
                            ? <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">{row.provider_name}</span>
                            : <span className="text-slate-300">—</span>}
                        </CellTooltip>
                      </td>

                      {/* Referral Date */}
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        <CellTooltip
                          title="Referral Details"
                          items={[
                            { key: "Benchmark",  value: row.benchmark_hours ? `${row.benchmark_hours}h / week` : null },
                            { key: "Industry",   value: (row.industry_preference ?? []).join(", ") || null },
                            { key: "Wage Sub.",  value: row.wage_subsidy ? "Yes" : null },
                          ]}
                        >
                          {row.date_referred ? fmtDate(row.date_referred) : "—"}
                        </CellTooltip>
                      </td>

                      {/* Training Date */}
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {row.training_start_date
                          ? <span>{fmtDate(row.training_start_date)}{row.training_end_date ? <span className="text-slate-300"> – {fmtDate(row.training_end_date)}</span> : ""}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Interview Date — inline editable + tooltip */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <CellTooltip
                          title="Pipeline Dates"
                          items={[
                            { key: "Employer",  value: row.employer_name },
                            { key: "Job Title", value: row.job_title },
                            { key: "ETS Date",  value: row.latest_ets_date       ? fmtDate(row.latest_ets_date)       : null },
                            { key: "Placed",    value: row.latest_placement_date ? fmtDate(row.latest_placement_date) : null },
                          ]}
                        >
                          <InlineDateCell
                            appId={row.latest_application_id}
                            field="interview_date"
                            value={row.latest_interview_date}
                            onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate-pool"] })}
                          />
                        </CellTooltip>
                      </td>

                      {/* ETS Date — inline editable */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <InlineDateCell
                            appId={row.latest_application_id}
                            field="ets_date"
                            value={row.latest_ets_date}
                            onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate-pool"] })}
                            validate={(d) => {
                              if (!row.latest_interview_date) return "Set Interview Date first";
                              if (d && row.latest_interview_date && d < row.latest_interview_date) return "ETS must be after Interview Date";
                              return null;
                            }}
                          />
                      </td>

                      {/* Placement Date — inline editable + tooltip */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <CellTooltip
                          title="Placed At"
                          items={[
                            { key: "Company",   value: row.employer_name },
                            { key: "Job Title", value: row.job_title },
                          ]}
                        >
                          <InlineDateCell
                            appId={row.latest_application_id}
                            field="placement_date"
                            value={row.latest_placement_date}
                            onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate-pool"] })}
                            allowClear
                            validate={(d) => {
                              if (!row.latest_interview_date) return "Set Interview Date first";
                              if (!row.latest_ets_date) return "Set ETS Date first";
                              if (d && row.latest_ets_date && d < row.latest_ets_date) return "Placement must be after ETS Date";
                              return null;
                            }}
                          />
                        </CellTooltip>
                      </td>

                      {/* Comments */}
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[160px]">
                        {(row as any).comments
                          ? <span className="truncate block" title={(row as any).comments}>{(row as any).comments}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Actions */}
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
                      <WelfareSubRow checks={row.welfare_checks!} colSpan={12} />
                    )}
                  </Fragment>
                );
              })}
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
      <Pagination
        page={page}
        totalPages={totalPages}
        total={meta?.total ?? 0}
        perPage={meta?.limit ?? 20}
        onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        label="candidates"
      />
    </div>
  );
}

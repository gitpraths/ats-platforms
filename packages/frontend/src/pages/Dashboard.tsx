import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import {
  Briefcase, Users, ClipboardList, CheckCircle, MapPin, Building2,
  AlertTriangle, UserCheck, UserPlus, PlusSquare, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  useDashboardStats,
  useTrainingByType,
  useCandidatesByProvider,
  usePlacementsByProvider,
  usePlacementsByStaff,
  type ChartMonth,
} from "../hooks/useDashboardStats";
import { useAuth } from "../contexts/AuthContext";
import { stageLabel } from "../lib/utils";
import type { Application } from "../types";
import CreateJobDialog from "../components/CreateJobDialog";

// ── Colour palette for grouped bar charts ─────────────────────────────────────
const BAR_COLOURS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#0ea5e9", // sky
  "#f97316", // orange
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#ef4444", // red
];

const STAGE_ORDER = ["applied", "interview", "ets", "hired", "rejected"] as const;

const STAGE_CHIP: Record<string, string> = {
  applied:   "bg-blue-50 text-blue-700 border border-blue-200",
  interview: "bg-amber-50 text-amber-700 border border-amber-200",
  ets:       "bg-orange-50 text-orange-700 border border-orange-200",
  hired:     "bg-green-50 text-green-700 border border-green-200",
  rejected:  "bg-red-50 text-red-700 border border-red-200",
};

const STAGE_BADGE: Record<string, string> = {
  applied:   "border border-blue-400 text-blue-600",
  screening: "border border-purple-400 text-purple-600",
  interview: "border border-amber-400 text-amber-600",
  ets:       "border border-orange-400 text-orange-600",
  hired:     "border border-green-500 text-green-700",
  rejected:  "border border-red-400 text-red-500",
};

const STAGE_DOT: Record<string, string> = {
  applied:   "bg-blue-500",
  screening: "bg-purple-500",
  interview: "bg-amber-500",
  ets:       "bg-orange-500",
  hired:     "bg-green-500",
  rejected:  "bg-red-500",
};

// ── Grouped Bar Chart card ────────────────────────────────────────────────────
function GroupedBarCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: ChartMonth[] | undefined;
}) {
  const groups =
    data && data.length > 0
      ? Object.keys(data.reduce((acc, row) => ({ ...acc, ...row }), {})).filter(
          (k) => k !== "month"
        )
      : [];

  const isEmpty = !data || data.length === 0 || groups.length === 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-slate-900 tracking-tight text-sm">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {isEmpty ? (
        <div className="flex items-center justify-center h-[220px]">
          <p className="text-sm text-slate-400">No data for the last 6 months</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barGap={2} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                fontSize: "12px",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", paddingTop: "12px", color: "#64748B" }}
            />
            {groups.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                name={key}
                fill={BAR_COLOURS[i % BAR_COLOURS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate               = useNavigate();
  const { user }               = useAuth();
  const { data: stats }        = useDashboardStats();
  const { data: trainingData }    = useTrainingByType();
  const { data: candidatesData }  = useCandidatesByProvider();
  const { data: placProvData }    = usePlacementsByProvider();
  const { data: placStaffData }   = usePlacementsByStaff();

  const [jobDialogOpen, setJobDialogOpen] = useState(false);

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["applications-recent"],
    queryFn:  () => api.get<Application[]>("/applications"),
  });

  const hour         = new Date().getHours();
  const timeGreeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const todayLabel   = new Date().toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const openJobs            = stats?.jobs.published              ?? 0;
  const activeApps          = stats?.applications.active         ?? 0;
  const hiredThisMonth      = stats?.applications.hired_this_month ?? 0;
  const totalCandidates     = stats?.candidates.total            ?? 0;
  const totalPlacements     = stats?.placements?.total           ?? 0;
  const confirmedPlacements = stats?.placements?.confirmed       ?? 0;
  const placementsThisMonth = stats?.placements?.this_month      ?? 0;
  const overdueWelfare      = stats?.placements?.overdue_welfare ?? 0;
  const activeProviders     = stats?.providers?.active           ?? 0;
  const activeEmployers     = stats?.employers?.active           ?? 0;

  const pipelineCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: stats?.applications.by_stage[stage] ?? 0,
  }));

  const recent = [...applications]
    .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
    .slice(0, 10);

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-7xl mx-auto border border-slate-200 rounded-2xl shadow-sm bg-[#F8FAFC] p-6 space-y-5">

      {/* ── Hero Welcome Card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-6 flex items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Good {timeGreeting}, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            {todayLabel} · Here's your recruiting overview
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            id="quick-add-candidate"
            onClick={() => navigate("/candidates/new")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white font-medium text-sm shadow-sm transition-all duration-150 whitespace-nowrap"
          >
            <UserPlus size={15} />+ Add Candidate
          </button>
          <button
            id="quick-add-employer"
            onClick={() => navigate("/employers/new")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 active:scale-[0.97] text-white font-medium text-sm shadow-sm transition-all duration-150 whitespace-nowrap"
          >
            <Building2 size={15} />+ Add Employer
          </button>
          <button
            id="quick-add-vacancy"
            onClick={() => setJobDialogOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white font-medium text-sm shadow-sm transition-all duration-150 whitespace-nowrap"
          >
            <PlusSquare size={15} />+ Add Vacancy
          </button>
        </div>
      </div>

      {/* Create Job Dialog */}
      <CreateJobDialog isOpen={jobDialogOpen} onClose={() => setJobDialogOpen(false)} />

      {/* ── Row 1: Core stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Vacancies",      value: openJobs,        icon: Briefcase,    iconBg: "bg-blue-50",   iconCls: "text-blue-600",   topBorder: "border-t-blue-500",   link: "/jobs" },
          { label: "Active Applications", value: activeApps,      icon: ClipboardList,iconBg: "bg-purple-50", iconCls: "text-purple-600", topBorder: "border-t-purple-500", link: "/hiring-board" },
          { label: "Hired This Month",    value: hiredThisMonth,  icon: CheckCircle,  iconBg: "bg-green-50",  iconCls: "text-green-600",  topBorder: "border-t-emerald-500",link: "/hiring-board" },
          { label: "Total Candidates",    value: totalCandidates, icon: Users,        iconBg: "bg-slate-100", iconCls: "text-slate-500",  topBorder: "border-t-slate-400",  link: "/candidates" },
        ].map(({ label, value, icon: Icon, iconBg, iconCls, topBorder, link }) => (
          <Link
            key={label}
            to={link}
            className={`bg-white rounded-xl border border-slate-200 border-t-4 ${topBorder} shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition group`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg} group-hover:scale-105 transition-transform duration-200`}>
              <Icon size={20} className={iconCls} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Row 2: Placement & provider stats ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Placements",      value: totalPlacements,     icon: UserCheck,  iconBg: "bg-indigo-50", iconCls: "text-indigo-600", topBorder: "border-t-indigo-500", link: "/placements" },
          { label: "Placements This Month", value: placementsThisMonth, icon: CheckCircle,iconBg: "bg-teal-50",   iconCls: "text-teal-600",   topBorder: "border-t-teal-500",  link: "/placements" },
          { label: "Active Providers",      value: activeProviders,     icon: MapPin,     iconBg: "bg-orange-50", iconCls: "text-orange-600", topBorder: "border-t-orange-500",link: "/providers" },
          { label: "Active Employers",      value: activeEmployers,     icon: Building2,  iconBg: "bg-cyan-50",   iconCls: "text-cyan-600",   topBorder: "border-t-cyan-500",  link: "/employers" },
        ].map(({ label, value, icon: Icon, iconBg, iconCls, topBorder, link }) => (
          <Link
            key={label}
            to={link}
            className={`bg-white rounded-xl border border-slate-200 border-t-4 ${topBorder} shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition group`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg} group-hover:scale-105 transition-transform duration-200`}>
              <Icon size={20} className={iconCls} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Overdue welfare alert */}
      {overdueWelfare > 0 && (
        <Link
          to="/placements"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition"
        >
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {overdueWelfare} welfare check{overdueWelfare > 1 ? "s" : ""} overdue or due today — action required.
          </p>
        </Link>
      )}

      {/* ── Hiring Pipeline ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="mb-5">
          <h2 className="font-semibold text-slate-900 tracking-tight">Hiring Pipeline</h2>
          <p className="text-xs text-slate-400 mt-0.5">Current stage distribution</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {pipelineCounts
            .filter(({ stage }) => stage !== "rejected")
            .map(({ stage, count }, i, arr) => (
              <div key={stage} className="flex items-center gap-2 flex-1 min-w-[110px]">
                <div
                  className={`flex-1 flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium ${
                    STAGE_CHIP[stage] ?? "bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
                >
                  <span>{stageLabel(stage)}</span>
                  <span className="text-lg font-bold ml-2">{count}</span>
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                )}
              </div>
            ))}
          <div className="flex items-center gap-2">
            <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
            <div
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium min-w-[110px] ${STAGE_CHIP["rejected"]}`}
            >
              <span>Rejected</span>
              <span className="text-lg font-bold ml-2">
                {pipelineCounts.find(({ stage }) => stage === "rejected")?.count ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Placement Summary ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-slate-900 tracking-tight">Placement Summary</h2>
            <p className="text-xs text-slate-400 mt-0.5">All-time overview</p>
          </div>
          <Link to="/placements" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <div className="text-center px-6">
            <p className="text-4xl font-bold text-slate-900">{totalPlacements}</p>
            <p className="text-sm text-slate-500 mt-1.5">Total Placements</p>
          </div>
          <div className="text-center px-6">
            <div className="flex items-center justify-center gap-2">
              <p className="text-4xl font-bold text-emerald-600">{confirmedPlacements}</p>
              <CheckCircle size={20} className="text-emerald-500 mb-0.5" />
            </div>
            <p className="text-sm text-slate-500 mt-1.5">Confirmed</p>
          </div>
          <div className="text-center px-6">
            <div className="flex items-center justify-center gap-2">
              <p className={`text-4xl font-bold ${overdueWelfare > 0 ? "text-amber-500" : "text-slate-900"}`}>
                {overdueWelfare}
              </p>
              {overdueWelfare > 0 && (
                <AlertTriangle size={18} className="text-amber-500 mb-0.5" />
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1.5">Overdue Checks</p>
          </div>
        </div>
      </div>

      {/* ── Four Grouped Bar Charts ───────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">
        <GroupedBarCard
          title="① Training Completed — Month Wise"
          subtitle="Last 6 months · Completed status"
          data={trainingData}
        />
        <GroupedBarCard
          title="② Candidates Referred — Provider Wise"
          subtitle="Last 6 months · By provider"
          data={candidatesData}
        />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <GroupedBarCard
          title="③ Placements — Provider Wise"
          subtitle="Last 6 months · By provider"
          data={placProvData}
        />
        <GroupedBarCard
          title="④ Placement by Staff — KPI / Month Wise"
          subtitle="Last 6 months · Recruiter performance"
          data={placStaffData}
        />
      </div>

      {/* ── Recent Activity ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 tracking-tight">Recent Activity</h2>
            <p className="text-xs text-slate-400 mt-0.5">Latest application updates</p>
          </div>
          <Link to="/hiring-board" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition">
            View board →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No applications yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((app) => (
              <div key={app.id} className="flex items-center gap-3 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT[app.stage] ?? "bg-slate-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{app.candidate_name}</p>
                  <p className="text-xs text-slate-500 truncate">{app.job_title}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium bg-transparent ${STAGE_BADGE[app.stage]}`}>
                    {stageLabel(app.stage)}
                  </span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>
    </div>
  );
}

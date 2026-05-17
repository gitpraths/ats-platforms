import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Briefcase, Users, ClipboardList, CheckCircle, MapPin, Building2, AlertTriangle, UserCheck, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useAuth } from "../contexts/AuthContext";
import type { Application } from "../types";

const STAGE_ORDER = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

const STAGE_BADGE: Record<string, string> = {
  applied:   "border border-blue-400 text-blue-600 bg-transparent",
  screening: "border border-purple-400 text-purple-600 bg-transparent",
  interview: "border border-amber-400 text-amber-600 bg-transparent",
  offer:     "border border-orange-400 text-orange-600 bg-transparent",
  hired:     "border border-green-500 text-green-700 bg-transparent",
  rejected:  "border border-red-400 text-red-500 bg-transparent",
};

const STAGE_STEP: Record<string, string> = {
  applied:   "border-blue-200 text-blue-700 bg-blue-50",
  screening: "border-purple-200 text-purple-700 bg-purple-50",
  interview: "border-amber-200 text-amber-700 bg-amber-50",
  offer:     "border-orange-200 text-orange-700 bg-orange-50",
  hired:     "border-green-200 text-green-700 bg-green-50",
};

const STAGE_DOT: Record<string, string> = {
  applied:   "bg-blue-500",
  screening: "bg-purple-500",
  interview: "bg-amber-500",
  offer:     "bg-orange-500",
  hired:     "bg-green-500",
  rejected:  "bg-red-500",
};

export default function Dashboard() {
  const { user }        = useAuth();
  const { data: stats } = useDashboardStats();

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["applications-recent"],
    queryFn:  () => api.get<Application[]>("/applications"),
  });

  const openJobs       = stats?.jobs.published        ?? 0;
  const activeApps     = stats?.applications.active   ?? 0;
  const hiredThisMonth = stats?.applications.hired_this_month ?? 0;
  const totalCandidates = stats?.candidates.total     ?? 0;
  const totalPlacements = stats?.placements?.total    ?? 0;
  const confirmedPlacements = stats?.placements?.confirmed ?? 0;
  const placementsThisMonth = stats?.placements?.this_month ?? 0;
  const overdueWelfare  = stats?.placements?.overdue_welfare ?? 0;
  const activeProviders = stats?.providers?.active    ?? 0;
  const activeEmployers = stats?.employers?.active    ?? 0;

  const statusCounts = ["draft", "published", "archived"].map((s) => ({
    status: s.charAt(0).toUpperCase() + s.slice(1),
    count:  stats?.jobs[s as "draft" | "published" | "archived"] ?? 0,
  }));

  const pipelineCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: stats?.applications.by_stage[stage] ?? 0,
  }));

  const recent = [...applications]
    .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
    .slice(0, 10);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Here's your recruiting overview</p>
      </div>

      {/* Row 1: Core stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Jobs",           value: openJobs,        icon: Briefcase,    border: "border-l-4 border-blue-500",   iconCls: "text-blue-600",   link: "/jobs" },
          { label: "Active Applications", value: activeApps,      icon: ClipboardList,border: "border-l-4 border-purple-500", iconCls: "text-purple-600", link: "/hiring-board" },
          { label: "Hired This Month",    value: hiredThisMonth,  icon: CheckCircle,  border: "border-l-4 border-green-500",  iconCls: "text-green-600",  link: "/hiring-board" },
          { label: "Total Candidates",    value: totalCandidates, icon: Users,        border: "border-l-4 border-slate-400",  iconCls: "text-slate-500",  link: "/candidates" },
        ].map(({ label, value, icon: Icon, border, iconCls, link }) => (
          <Link key={label} to={link} className={`bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition ${border}`}>
            <Icon size={22} className={iconCls} />
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Row 2: Placements & Provider stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Placements",     value: totalPlacements,     icon: UserCheck,  border: "border-l-4 border-indigo-500", iconCls: "text-indigo-600", link: "/placements" },
          { label: "Placements This Month",value: placementsThisMonth, icon: CheckCircle,border: "border-l-4 border-teal-500",   iconCls: "text-teal-600",   link: "/placements" },
          { label: "Active Providers",     value: activeProviders,     icon: MapPin,     border: "border-l-4 border-orange-500", iconCls: "text-orange-600", link: "/providers" },
          { label: "Active Employers",     value: activeEmployers,     icon: Building2,  border: "border-l-4 border-cyan-500",   iconCls: "text-cyan-600",   link: "/employers" },
        ].map(({ label, value, icon: Icon, border, iconCls, link }) => (
          <Link key={label} to={link} className={`bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition ${border}`}>
            <Icon size={22} className={iconCls} />
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Overdue welfare alert */}
      {overdueWelfare > 0 && (
        <Link to="/placements"
          className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 hover:bg-yellow-100 transition">
          <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800 font-medium">
            {overdueWelfare} welfare check{overdueWelfare > 1 ? "s" : ""} overdue or due today — action required.
          </p>
        </Link>
      )}

      {/* Hiring Pipeline — step flow */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-4">Hiring Pipeline</h2>
        <div className="flex items-center overflow-x-auto pb-1 gap-1">
          {pipelineCounts.filter(({ stage }) => stage !== "rejected").map(({ stage, count }, i, arr) => (
            <div key={stage} className="flex items-center gap-1 flex-1 min-w-[80px]">
              <div className={`flex-1 text-center px-3 py-3 rounded-lg border ${STAGE_STEP[stage] ?? "border-slate-200 text-slate-600 bg-slate-50"}`}>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs capitalize mt-0.5 opacity-80">{stage}</p>
              </div>
              {i < arr.length - 1 && <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />}
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
          <span className="text-xs text-slate-400">Rejected:</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-red-400 text-red-500">
            {pipelineCounts.find(({ stage }) => stage === "rejected")?.count ?? 0}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Jobs by Status Chart */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 tracking-tight mb-4">Jobs by Status</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusCounts} barSize={40}>
              <XAxis dataKey="status" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#334155" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Placement Summary */}
        <div className="bg-slate-700 rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold tracking-tight">Placement Summary</h2>
            <Link to="/placements" className="text-xs text-slate-400 hover:text-white transition">View all</Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{totalPlacements}</p>
              <p className="text-xs text-slate-400 mt-1">Total</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-400">{confirmedPlacements}</p>
              <p className="text-xs text-slate-400 mt-1">Confirmed</p>
            </div>
            <div>
              <p className={`text-3xl font-bold ${overdueWelfare > 0 ? "text-yellow-400" : "text-white"}`}>
                {overdueWelfare}
              </p>
              <p className="text-xs text-slate-400 mt-1">Overdue Checks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-900 tracking-tight">Recent Activity</h2>
          <Link to="/hiring-board" className="text-xs text-slate-500 hover:text-slate-900 transition">View board</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No applications yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((app) => (
              <div key={app.id} className="flex items-center gap-3 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT[app.stage] ?? "bg-slate-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{app.candidate_name}</p>
                  <p className="text-xs text-slate-500 truncate">{app.job_title}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE[app.stage]}`}>
                    {app.stage}
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
  );
}

import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Briefcase, Users, ClipboardList, CheckCircle, MapPin, Building2, AlertTriangle, UserCheck } from "lucide-react";
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
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Welcome back, {user?.name}</p>
      </div>

      {/* Row 1: Core stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Jobs",           value: openJobs,        icon: Briefcase,    color: "text-blue-600 bg-slate-100",   link: "/jobs" },
          { label: "Active Applications", value: activeApps,      icon: ClipboardList,color: "text-purple-600 bg-slate-100", link: "/hiring-board" },
          { label: "Hired This Month",    value: hiredThisMonth,  icon: CheckCircle,  color: "text-green-600 bg-slate-100", link: "/hiring-board" },
          { label: "Total Candidates",    value: totalCandidates, icon: Users,        color: "text-gray-600 bg-slate-100",  link: "/candidates" },
        ].map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 hover:shadow-sm transition">
            <div className={`p-3 rounded-xl ${color}`}><Icon size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Row 2: Placements & Provider stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Placements",    value: totalPlacements,    icon: UserCheck,       color: "text-indigo-600 bg-slate-100",  link: "/placements" },
          { label: "Placements This Month",value: placementsThisMonth,icon: CheckCircle,    color: "text-teal-600 bg-slate-100",     link: "/placements" },
          { label: "Active Providers",    value: activeProviders,    icon: MapPin,          color: "text-orange-600 bg-slate-100", link: "/providers" },
          { label: "Active Employers",    value: activeEmployers,    icon: Building2,       color: "text-cyan-600 bg-slate-100",     link: "/employers" },
        ].map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 hover:shadow-sm transition">
            <div className={`p-3 rounded-xl ${color}`}><Icon size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
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

        {/* Pipeline Funnel */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 tracking-tight mb-4">Application Pipeline</h2>
          <div className="space-y-2">
            {pipelineCounts.map(({ stage, count }) => {
              const max = Math.max(...pipelineCounts.map((p) => p.count), 1);
              const pct = Math.round((count / max) * 100);
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-20 capitalize">{stage}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 relative">
                    <div className="bg-slate-700 h-5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Placement Summary row */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 tracking-tight">Placement Summary</h2>
          <Link to="/placements" className="text-xs text-slate-600 hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-3xl font-bold text-gray-900">{totalPlacements}</p>
            <p className="text-xs text-slate-500 mt-1">Total Placements</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-600">{confirmedPlacements}</p>
            <p className="text-xs text-slate-500 mt-1">Confirmed by Employer</p>
          </div>
          <div>
            <p className={`text-3xl font-bold ${overdueWelfare > 0 ? "text-yellow-500" : "text-gray-900"}`}>
              {overdueWelfare}
            </p>
            <p className="text-xs text-slate-500 mt-1">Overdue Welfare Checks</p>
          </div>
        </div>
      </div>

      {/* Recent Applications */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 tracking-tight">Recent Applications</h2>
          <Link to="/hiring-board" className="text-xs text-slate-600 hover:underline">View board</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400">No applications yet.</p>
        ) : (
          <div className="space-y-3">
            {recent.map((app) => (
              <div key={app.id} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{app.candidate_name}</p>
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

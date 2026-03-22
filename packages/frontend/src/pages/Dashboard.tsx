import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Briefcase, Users, ClipboardList, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "../lib/api";
import { useDashboardStats } from "../hooks/useDashboardStats";
import type { Application } from "../types";

const STAGE_ORDER = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

export default function Dashboard() {
  const { data: stats } = useDashboardStats();

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["applications-recent"],
    queryFn:  () => api.get<Application[]>("/applications"),
  });

  // Summary cards from stats API
  const openJobs       = stats?.jobs.published       ?? 0;
  const activeApps     = stats?.applications.active  ?? 0;
  const hiredThisMonth = stats?.applications.hired_this_month ?? 0;
  const totalJobs      = stats?.jobs.total            ?? 0;

  // Jobs by status chart data from stats
  const statusCounts = ["draft", "published", "archived"].map((s) => ({
    status: s,
    count:  stats?.jobs[s as "draft" | "published" | "archived"] ?? 0,
  }));

  // Pipeline funnel from stats
  const pipelineCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: stats?.applications.by_stage[stage] ?? 0,
  }));

  // Recent applications (last 10)
  const recent = [...applications]
    .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
    .slice(0, 10);

  const STAGE_BADGE: Record<string, string> = {
    applied:   "bg-blue-100 text-blue-700",
    screening: "bg-purple-100 text-purple-700",
    interview: "bg-yellow-100 text-yellow-700",
    offer:     "bg-orange-100 text-orange-700",
    hired:     "bg-green-100 text-green-700",
    rejected:  "bg-red-100 text-red-600",
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Jobs",          value: openJobs,       icon: Briefcase,    color: "text-blue-600 bg-blue-50" },
          { label: "Active Applications",value: activeApps,     icon: ClipboardList, color: "text-purple-600 bg-purple-50" },
          { label: "Hired This Month",   value: hiredThisMonth, icon: CheckCircle,  color: "text-green-600 bg-green-50" },
          { label: "Total Jobs",         value: totalJobs,      icon: Users,        color: "text-gray-600 bg-gray-100" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border rounded-xl p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${color}`}><Icon size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Jobs by Status Chart */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Jobs by Status</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusCounts} barSize={40}>
              <XAxis dataKey="status" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline Funnel */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Pipeline Funnel</h2>
          <div className="space-y-2">
            {pipelineCounts.map(({ stage, count }) => {
              const max = Math.max(...pipelineCounts.map((p) => p.count), 1);
              const pct = Math.round((count / max) * 100);
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 capitalize">{stage}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                    <div
                      className="bg-blue-500 h-5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Recent Applications</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400">No applications yet.</p>
        ) : (
          <div className="space-y-3">
            {recent.map((app) => (
              <div key={app.id} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{app.candidate_name}</p>
                  <p className="text-xs text-gray-500 truncate">{app.job_title}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE[app.stage]}`}>
                    {app.stage}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
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

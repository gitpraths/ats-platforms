import { useState, useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LayoutDashboard, Briefcase, Columns, Users, User, ChevronDown, Settings, Building2, UserCheck, BarChart2, MapPin as MapPinIcon, Plus, Table2, KeyRound, FileText } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { usePermissions } from "./hooks/usePermissions";
import SessionExpiringDialog from "./components/SessionExpiringDialog";
import { Toaster } from "./components/ui/toaster";
import CreateJobDialog from "./components/CreateJobDialog";
import ChangePasswordModal from "./components/ChangePasswordModal";
import Login            from "./pages/Login";
import Dashboard        from "./pages/Dashboard";
import Jobs             from "./pages/Jobs";
import JobDetail        from "./pages/JobDetail";
import JobEdit          from "./pages/JobEdit";
import HiringBoard      from "./pages/HiringBoard";
import Candidates       from "./pages/Candidates";
import CandidateDetail  from "./pages/CandidateDetail";
import CandidateNew     from "./pages/CandidateNew";
import Profile          from "./pages/Profile";
import AdminUsers       from "./pages/AdminUsers";
import AdminDepartments from "./pages/AdminDepartments";
import AdminLocations   from "./pages/AdminLocations";
import AdminTrainings   from "./pages/AdminTrainings";
import AdminXero        from "./pages/AdminXero";
import AdminReleaseNotes from "./pages/AdminReleaseNotes";
import Training         from "./pages/Training";
import NotFound         from "./pages/NotFound";
import Providers        from "./pages/Providers";
import ProviderDetail   from "./pages/ProviderDetail";
import ProviderCreate   from "./pages/ProviderCreate";
import Employers        from "./pages/Employers";
import EmployerDetail   from "./pages/EmployerDetail";
import EmployerCreate   from "./pages/EmployerCreate";
import Placements       from "./pages/Placements";
import PlacementDetail  from "./pages/PlacementDetail";
import Reports          from "./pages/Reports";
import MasterIndustries from "./pages/MasterIndustries";
import MasterWorkTypes  from "./pages/MasterWorkTypes";
import MasterWorkStatus from "./pages/MasterWorkStatus";

const queryClient = new QueryClient();

const BASE_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

// ── New Menu Dropdown ─────────────────────────────────────────────────────────
// ── Admin Dropdown ────────────────────────────────────────────────────────────
function AdminMenu() {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const navigate        = useNavigate();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function go(path: string) { setOpen(false); navigate(path); }

  const item = "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <Settings size={15} /> Admin <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-xl z-30 w-52 py-1.5 overflow-hidden">
          <p className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Management</p>
          <button onClick={() => go("/admin/users")}       className={item}><Users     size={14} className="text-slate-400" /> Users</button>
          <button onClick={() => go("/admin/departments")} className={item}><Building2 size={14} className="text-slate-400" /> Departments</button>

          <button onClick={() => go("/admin/trainings")}   className={item}><Table2    size={14} className="text-slate-400" /> Trainings</button>
          <button onClick={() => go("/admin/xero")}        className={item}><Settings  size={14} className="text-slate-400" /> Xero</button>
          <div className="border-t border-slate-100 my-1" />
          <p className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">System</p>
          <button onClick={() => go("/admin/release-notes")} className={item}><FileText  size={14} className="text-orange-500" /> Release Notes</button>
          <div className="border-t border-slate-100 my-1" />
          <p className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Master Tables</p>
          <button onClick={() => go("/admin/master/industries")}  className={item}><Table2 size={14} className="text-orange-400" /> Industries</button>
          <button onClick={() => go("/admin/master/work-types")}  className={item}><Table2 size={14} className="text-orange-400" /> Work Types</button>
          <button onClick={() => go("/admin/master/work-status")} className={item}><Table2 size={14} className="text-orange-400" /> Work Status</button>
        </div>
      )}
    </div>
  );
}

// ── Profile Dropdown ──────────────────────────────────────────────────────────
function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen]  = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const ref              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const avatarSrc = user?.avatar_url ? `${BASE_URL}${user.avatar_url}` : null;
  const initials  = user?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 hover:bg-slate-100 rounded-lg px-2 py-1.5 transition"
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
        )}
        <span className="text-sm text-slate-700 hidden sm:block">{user?.name}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 bg-white border rounded-xl shadow-lg z-30 w-48 py-1">
          <div className="px-4 py-2 border-b">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full capitalize">
              {user?.role?.replace("_", " ")}
            </span>
          </div>
          <NavLink to="/profile" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <User size={14} /> Profile
          </NavLink>
          <button
            onClick={() => { setOpen(false); setShowChangePassword(true); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
          >
            <KeyRound size={14} /> Change Password
          </button>
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            Sign out
          </button>
        </div>
      )}

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 text-sm font-medium transition border-b-2 ${
      isActive
        ? "border-orange-500 text-slate-900 font-semibold"
        : "border-transparent text-slate-500 hover:text-slate-900"
    }`;

  const canViewJobs             = hasPermission("jobs:view");
  const canViewImportantUpdates = isAdmin || hasPermission("important_updates:view");
  const canViewCandidates       = hasPermission("candidates:view");
  const canViewTraining         = hasPermission("training:view");
  const canViewPlacements       = hasPermission("placements:view");
  const canViewEmployers        = hasPermission("employers:view");
  const canViewReports          = isAdmin || hasPermission("reports:view");

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <nav className="bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between fixed top-0 inset-x-0 z-50 shadow-sm">
        <div className="flex items-stretch h-full gap-0">
          <a href="/dashboard" className="flex items-center mr-4 pr-4 border-r border-slate-200 select-none">
            <div className="flex flex-col leading-none">
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
                <span style={{ color: "#0F172A" }}>Work</span><span style={{ color: "#e88e2e" }}>Vision</span>
              </span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "0.6rem", color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "1px" }}>Australia</span>
            </div>
          </a>
          <NavLink to="/dashboard" className={navClass}><LayoutDashboard size={15} />Dashboard</NavLink>
          {canViewCandidates && (
            <NavLink to="/candidates" className={navClass}><Users size={15} />Candidates</NavLink>
          )}
          {canViewPlacements && (
            <NavLink to="/placements" className={navClass}><UserCheck size={15} />Placements</NavLink>
          )}
          {canViewImportantUpdates && (
            <NavLink to="/hiring-board" className={navClass}><Columns size={15} />Important Updates</NavLink>
          )}
          {canViewJobs && (
            <NavLink to="/jobs" className={navClass}><Briefcase size={15} />Vacancies</NavLink>
          )}
          {canViewEmployers && (
            <NavLink to="/employers" className={navClass}><Building2 size={15} />Employers</NavLink>
          )}
          {canViewEmployers && (
            <NavLink to="/providers" className={navClass}><MapPinIcon size={15} />Providers</NavLink>
          )}
          {canViewTraining && (
            <NavLink to="/training" className={navClass}><Table2 size={15} />Training Program</NavLink>
          )}
          {canViewReports && (
            <NavLink to="/reports" className={navClass}><BarChart2 size={15} />Reports</NavLink>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <AdminMenu />}
          <ProfileMenu />
        </div>
      </nav>
      <main className="pt-14">{children}</main>
    </div>
  );
}

// ── Protected Route ───────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <SessionExpiringDialog />
      <Layout>{children}</Layout>
    </>
  );
}

// ── Staff Route ───────────────────────────────────────────────────────────────
function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <SessionExpiringDialog />
      <Layout>{children}</Layout>
    </>
  );
}

// ── Admin Route ───────────────────────────────────────────────────────────────
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "super_admin" && user.role !== "admin")
    return <Navigate to="/dashboard" replace />;
  return (
    <>
      <SessionExpiringDialog />
      <Layout>{children}</Layout>
    </>
  );
}

// ── Permission Route ──────────────────────────────────────────────────────────
function PermissionRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  const allowed = isAdmin || hasPermission(permission);

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <SessionExpiringDialog />
      <Layout>{children}</Layout>
    </>
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth();
  const defaultHome = "/dashboard";

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? defaultHome : "/login"} replace />} />
      <Route path="/login" element={user ? <Navigate to={defaultHome} replace /> : <Login />} />

      <Route path="/dashboard"        element={<StaffRoute><Dashboard       /></StaffRoute>} />
      <Route path="/jobs"             element={<PermissionRoute permission="jobs:view"><Jobs /></PermissionRoute>} />
      <Route path="/jobs/:id"         element={<PermissionRoute permission="jobs:view"><JobDetail /></PermissionRoute>} />
      <Route path="/jobs/:id/edit"    element={<PermissionRoute permission="jobs:edit"><JobEdit /></PermissionRoute>} />
      <Route path="/hiring-board"     element={<PermissionRoute permission="important_updates:view"><HiringBoard /></PermissionRoute>} />
      <Route path="/candidates"        element={<PermissionRoute permission="candidates:view"><Candidates /></PermissionRoute>} />
      <Route path="/candidates/new"   element={<PermissionRoute permission="candidates:create"><CandidateNew /></PermissionRoute>} />
      <Route path="/candidates/:id"   element={<PermissionRoute permission="candidates:view"><CandidateDetail /></PermissionRoute>} />
      <Route path="/training"         element={<PermissionRoute permission="training:view"><Training /></PermissionRoute>} />
      <Route path="/profile"          element={<ProtectedRoute><Profile          /></ProtectedRoute>} />

      <Route path="/providers"          element={<PermissionRoute permission="employers:view"><Providers       /></PermissionRoute>} />
      <Route path="/providers/new"      element={<PermissionRoute permission="employers:create"><ProviderCreate     /></PermissionRoute>} />
      <Route path="/providers/:id"      element={<PermissionRoute permission="employers:view"><ProviderDetail  /></PermissionRoute>} />
      <Route path="/providers/:id/edit" element={<PermissionRoute permission="employers:edit"><ProviderCreate      /></PermissionRoute>} />

      <Route path="/employers"          element={<PermissionRoute permission="employers:view"><Employers /></PermissionRoute>} />
      <Route path="/employers/new"      element={<PermissionRoute permission="employers:create"><EmployerCreate /></PermissionRoute>} />
      <Route path="/employers/:id"      element={<PermissionRoute permission="employers:view"><EmployerDetail /></PermissionRoute>} />
      <Route path="/employers/:id/edit" element={<PermissionRoute permission="employers:edit"><EmployerCreate /></PermissionRoute>} />

      <Route path="/placements"         element={<PermissionRoute permission="placements:view"><Placements /></PermissionRoute>} />
      <Route path="/placements/:id"     element={<PermissionRoute permission="placements:view"><PlacementDetail /></PermissionRoute>} />

      <Route path="/reports"            element={<PermissionRoute permission="reports:view"><Reports /></PermissionRoute>} />

      <Route path="/admin/master/industries"  element={<PermissionRoute permission="admin:master_data"><MasterIndustries /></PermissionRoute>} />
      <Route path="/admin/master/work-types"  element={<PermissionRoute permission="admin:master_data"><MasterWorkTypes  /></PermissionRoute>} />
      <Route path="/admin/master/work-status" element={<PermissionRoute permission="admin:master_data"><MasterWorkStatus /></PermissionRoute>} />

      <Route path="/admin/users"       element={<AdminRoute><AdminUsers       /></AdminRoute>} />
      <Route path="/admin/departments" element={<PermissionRoute permission="employers:edit"><AdminDepartments /></PermissionRoute>} />
      <Route path="/admin/locations"   element={<PermissionRoute permission="employers:edit"><AdminLocations   /></PermissionRoute>} />
      <Route path="/admin/trainings"   element={<PermissionRoute permission="training:manage"><AdminTrainings   /></PermissionRoute>} />
      <Route path="/admin/xero"        element={<PermissionRoute permission="reports:financials"><AdminXero        /></PermissionRoute>} />
      <Route path="/admin/release-notes" element={<AdminRoute><AdminReleaseNotes /></AdminRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

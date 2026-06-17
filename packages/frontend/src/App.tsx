import { useState, useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LayoutDashboard, Briefcase, Columns, Users, User, ChevronDown, Settings, Building2, UserCheck, BarChart2, MapPin as MapPinIcon, Plus, Table2 } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import SessionExpiringDialog from "./components/SessionExpiringDialog";
import { Toaster } from "./components/ui/toaster";
import CreateJobDialog from "./components/CreateJobDialog";
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition text-slate-300 hover:bg-slate-800 hover:text-white"
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
        className="flex items-center gap-2 hover:bg-slate-800 rounded-lg px-2 py-1.5 transition"
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-600 text-white flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
        )}
        <span className="text-sm text-slate-300 hidden sm:block">{user?.name}</span>
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
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "recruiter_admin";
  const isAdminOrRecruiter = user?.role === "admin"
                          || user?.role === "recruiter_admin"
                          || user?.role === "recruiter";

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between sticky top-0 z-20 shadow-none">
        <div className="flex items-center gap-1">
          <a href="/dashboard" className="flex items-center mr-2">
            <div className="bg-white rounded-lg px-2 py-1">
              <img src="/WV-Logo-v2.png" alt="WorkVision Australia" className="h-7 w-auto" />
            </div>
          </a>
          <NavLink to="/dashboard"    className={navClass}><LayoutDashboard size={15} />Dashboard</NavLink>
          <NavLink to="/jobs"         className={navClass}><Briefcase size={15} />Vacancies</NavLink>
          <NavLink to="/hiring-board" className={navClass}><Columns size={15} />Important Updates</NavLink>
          <NavLink to="/candidates"   className={navClass}><Users size={15} />Candidates</NavLink>
          {isAdminOrRecruiter && (
            <NavLink to="/training" className={navClass}>Training</NavLink>
          )}
          <NavLink to="/placements"   className={navClass}><UserCheck size={15} />Placements</NavLink>
          <NavLink to="/providers"    className={navClass}><MapPinIcon size={15} />Providers</NavLink>
          <NavLink to="/employers"    className={navClass}><Building2 size={15} />Employers</NavLink>
          {isAdmin && (
            <NavLink to="/reports" className={navClass}><BarChart2 size={15} />Reports</NavLink>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <AdminMenu />}
          <ProfileMenu />
        </div>
      </nav>
      <main>{children}</main>
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

// ── Admin Route ───────────────────────────────────────────────────────────────
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin" && user.role !== "recruiter_admin")
    return <Navigate to="/dashboard" replace />;
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
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      <Route path="/dashboard"        element={<ProtectedRoute><Dashboard       /></ProtectedRoute>} />
      <Route path="/jobs"             element={<ProtectedRoute><Jobs             /></ProtectedRoute>} />
      <Route path="/jobs/:id"         element={<ProtectedRoute><JobDetail        /></ProtectedRoute>} />
      <Route path="/jobs/:id/edit"    element={<ProtectedRoute><JobEdit          /></ProtectedRoute>} />
      <Route path="/hiring-board"     element={<ProtectedRoute><HiringBoard      /></ProtectedRoute>} />
      <Route path="/candidates"        element={<ProtectedRoute><Candidates       /></ProtectedRoute>} />
      <Route path="/candidates/new"   element={<ProtectedRoute><CandidateNew     /></ProtectedRoute>} />
      <Route path="/candidates/:id"   element={<ProtectedRoute><CandidateDetail  /></ProtectedRoute>} />
      <Route path="/training"         element={<ProtectedRoute><Training         /></ProtectedRoute>} />
      <Route path="/profile"          element={<ProtectedRoute><Profile          /></ProtectedRoute>} />

      <Route path="/providers"          element={<ProtectedRoute><Providers       /></ProtectedRoute>} />
      <Route path="/providers/new"      element={<AdminRoute><ProviderCreate     /></AdminRoute>} />
      <Route path="/providers/:id"      element={<ProtectedRoute><ProviderDetail  /></ProtectedRoute>} />
      <Route path="/providers/:id/edit" element={<AdminRoute><ProviderCreate      /></AdminRoute>} />

      <Route path="/employers"          element={<ProtectedRoute><Employers       /></ProtectedRoute>} />
      <Route path="/employers/new"      element={<AdminRoute><EmployerCreate      /></AdminRoute>} />
      <Route path="/employers/:id"      element={<ProtectedRoute><EmployerDetail  /></ProtectedRoute>} />
      <Route path="/employers/:id/edit" element={<AdminRoute><EmployerCreate      /></AdminRoute>} />

      <Route path="/placements"         element={<ProtectedRoute><Placements      /></ProtectedRoute>} />
      <Route path="/placements/:id"     element={<ProtectedRoute><PlacementDetail /></ProtectedRoute>} />

      <Route path="/reports"            element={<AdminRoute><Reports             /></AdminRoute>} />

      <Route path="/admin/master/industries"  element={<AdminRoute><MasterIndustries /></AdminRoute>} />
      <Route path="/admin/master/work-types"  element={<AdminRoute><MasterWorkTypes  /></AdminRoute>} />
      <Route path="/admin/master/work-status" element={<AdminRoute><MasterWorkStatus /></AdminRoute>} />


      <Route path="/admin/users"       element={<AdminRoute><AdminUsers       /></AdminRoute>} />
      <Route path="/admin/departments" element={<AdminRoute><AdminDepartments /></AdminRoute>} />
      <Route path="/admin/locations"   element={<AdminRoute><AdminLocations   /></AdminRoute>} />
      <Route path="/admin/trainings"   element={<AdminRoute><AdminTrainings   /></AdminRoute>} />
      <Route path="/admin/xero"        element={<AdminRoute><AdminXero        /></AdminRoute>} />

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

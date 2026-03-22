import { useState, useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LayoutDashboard, Briefcase, Columns, Users, User, ChevronDown, Settings } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import SessionExpiringDialog from "./components/SessionExpiringDialog";
import { Toaster } from "./components/ui/toaster";
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
import NotFound         from "./pages/NotFound";

const queryClient = new QueryClient();

const BASE_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

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
        className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition"
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
        )}
        <span className="text-sm text-gray-700 hidden sm:block">{user?.name}</span>
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

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-2 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="font-bold text-blue-600 mr-3 text-lg">MyATS</span>
          <NavLink to="/dashboard"    className={navClass}><LayoutDashboard size={15} />Dashboard</NavLink>
          <NavLink to="/jobs"         className={navClass}><Briefcase size={15} />Jobs</NavLink>
          <NavLink to="/hiring-board" className={navClass}><Columns size={15} />Hiring Board</NavLink>
          <NavLink to="/candidates"   className={navClass}><Users size={15} />Candidates</NavLink>
          {isAdmin && (
            <>
              <span className="mx-1 text-gray-200 select-none">|</span>
              <NavLink to="/admin/users"       className={navClass}><Settings size={15} />Users</NavLink>
              <NavLink to="/admin/departments" className={navClass}>Departments</NavLink>
              <NavLink to="/admin/locations"   className={navClass}>Locations</NavLink>
            </>
          )}
        </div>
        <ProfileMenu />
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
      <Route path="/profile"          element={<ProtectedRoute><Profile          /></ProtectedRoute>} />

      <Route path="/admin/users"       element={<AdminRoute><AdminUsers       /></AdminRoute>} />
      <Route path="/admin/departments" element={<AdminRoute><AdminDepartments /></AdminRoute>} />
      <Route path="/admin/locations"   element={<AdminRoute><AdminLocations   /></AdminRoute>} />

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

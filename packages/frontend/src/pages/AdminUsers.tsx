import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, Trash2, Check, X, Search, KeyRound, ShieldCheck, Lock } from "lucide-react";
import { format } from "date-fns";
import { fmtDate } from "../lib/utils";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { User, UserRole } from "../types";
import CreateUserDialog from "../components/CreateUserDialog";
import ResetPasswordModal from "../components/ResetPasswordModal";
import ManagePermissionsModal from "../components/ManagePermissionsModal";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../components/ui/tooltip";

function ActionIconBtn({
  tooltip,
  onClick,
  disabled,
  className,
  children,
}: {
  tooltip: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={className}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs py-1 px-2.5 font-medium shadow-md">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function ActionIconSpan({
  tooltip,
  className,
  children,
}: {
  tooltip: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <span className={className}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs py-1 px-2.5 font-medium shadow-md">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

const SUPER_ADMIN_EMAILS = [
  "kavil@workvision.com.au",
  "dhaval@workvision.com.au"
];

function isSuperAdminUser(u: User) {
  return u.role === "super_admin" || SUPER_ADMIN_EMAILS.includes((u.email || "").toLowerCase().trim());
}

const ROLES: { value: UserRole; label: string; badge: string }[] = [
  { value: "super_admin",     label: "Super Admin",     badge: "border border-purple-500 text-purple-700 bg-purple-50" },
  { value: "admin",           label: "Admin",           badge: "border border-red-400 text-red-500 bg-transparent" },
  { value: "staff",           label: "Staff",           badge: "border border-blue-400 text-blue-600 bg-transparent" },
  { value: "hr",              label: "HR",              badge: "border border-emerald-500 text-emerald-700 bg-emerald-50" },
  { value: "marketing",       label: "Marketing",       badge: "border border-amber-500 text-amber-700 bg-amber-50" },
  { value: "training_admin",  label: "Training Admin",  badge: "border border-orange-400 text-orange-600 bg-transparent" },
  { value: "recruiter_admin", label: "Recruiter Admin", badge: "border border-purple-400 text-purple-600 bg-transparent" },
  { value: "recruiter",       label: "Recruiter",       badge: "border border-slate-400 text-slate-600 bg-transparent" },
  { value: "hiring_manager",  label: "Hiring Manager",  badge: "border border-green-500 text-green-700 bg-transparent" },
];

function roleBadge(role: UserRole) {
  const r = ROLES.find((x) => x.value === role);
  return r ? { label: r.label, badge: r.badge } : { label: role, badge: "border border-slate-400 text-slate-600 bg-transparent" };
}

interface EditState {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export default function AdminUsers() {
  const queryClient    = useQueryClient();
  const { user: me }   = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [managingPermissionsUser, setManagingPermissionsUser] = useState<User | null>(null);
  const [editing, setEditing]       = useState<EditState | null>(null);
  const [editError, setEditError]   = useState("");
  const [q, setQ]                   = useState("");
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search)     params.set("q", search);
      if (roleFilter) params.set("role", roleFilter);
      return api.get<User[]>(`/users?${params.toString()}`);
    },
  });

  const updateUser = useMutation({
    mutationFn: (u: EditState) => api.put<User>(`/users/${u.id}`, { name: u.name, email: u.email, role: u.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditing(null);
      setEditError("");
    },
    onError: (err: Error) => setEditError(err.message),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  function startEdit(u: User) {
    setEditing({ id: u.id, name: u.name, email: u.email, role: u.role });
    setEditError("");
  }

  function saveEdit() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.email.trim()) {
      setEditError("Name and email are required.");
      return;
    }
    updateUser.mutate(editing);
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">User Management</h1>
            <p className="text-sm text-slate-500 mt-0.5">Create and manage platform users</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#e88e2e] text-white text-sm font-medium rounded-lg hover:bg-[#d07d20]"
          >
            <UserPlus size={15} /> Add User
          </button>
        </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(q); }}
          className="flex gap-2 flex-1 max-w-sm"
        >
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm">Search</button>
        </form>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-center text-slate-400">No users found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr className="text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Permissions</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  {editing?.id === u.id ? (
                    <>
                      <td className="px-4 py-2" colSpan={3}>
                        <div className="flex flex-wrap gap-2 items-start">
                          {editError && (
                            <p className="w-full text-xs text-red-600 mb-1">{editError}</p>
                          )}
                          <input
                            value={editing.name}
                            onChange={(e) => setEditing((s) => s && ({ ...s, name: e.target.value }))}
                            placeholder="Name"
                            className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 w-40"
                          />
                          <input
                            type="email"
                            value={editing.email}
                            onChange={(e) => setEditing((s) => s && ({ ...s, email: e.target.value }))}
                            placeholder="Email"
                            className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 w-48"
                          />
                          <select
                            value={editing.role}
                            onChange={(e) => setEditing((s) => s && ({ ...s, role: e.target.value as UserRole }))}
                            className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                          >
                            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-slate-400 text-xs">
                        {u.created_at ? fmtDate(u.created_at) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 justify-end">
                          <ActionIconBtn
                            tooltip="Save Changes"
                            onClick={saveEdit}
                            disabled={updateUser.isPending}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50 transition-colors"
                          >
                            <Check size={14} />
                          </ActionIconBtn>
                          <ActionIconBtn
                            tooltip="Cancel Edit"
                            onClick={() => setEditing(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                          >
                            <X size={14} />
                          </ActionIconBtn>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full border border-blue-400 text-blue-600 bg-transparent text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {u.name}
                              {u.id === me?.id && (
                                <span className="ml-1.5 text-xs text-slate-400">(you)</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(u.role).badge}`}>
                          {roleBadge(u.role).label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.role === "super_admin" || u.role === "admin" ? (
                          <Tooltip delayDuration={120}>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-xs text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded border border-purple-200 cursor-default">
                                <ShieldCheck size={12} /> Full Access (26/26)
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs py-1 px-2.5 font-medium shadow-md">
                              Administrator has unrestricted access (26/26)
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip delayDuration={120}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setManagingPermissionsUser(u)}
                                className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-blue-600 font-medium bg-slate-100 hover:bg-blue-50 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                              >
                                <ShieldCheck size={12} className="text-slate-400" />
                                {Array.isArray(u.permissions) ? u.permissions.length : 0} / 26 granted
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs py-1 px-2.5 font-medium shadow-md">
                              Click to configure permissions for {u.name}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {u.created_at ? fmtDate(u.created_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <ActionIconBtn
                            tooltip="Manage Permissions"
                            onClick={() => setManagingPermissionsUser(u)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <ShieldCheck size={14} />
                          </ActionIconBtn>
                          <ActionIconBtn
                            tooltip="Edit User Details"
                            onClick={() => startEdit(u)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors"
                          >
                            <Pencil size={14} />
                          </ActionIconBtn>
                          <ActionIconBtn
                            tooltip="Change Password"
                            onClick={() => setResettingUser(u)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          >
                            <KeyRound size={14} />
                          </ActionIconBtn>
                          {isSuperAdminUser(u) ? (
                            <ActionIconSpan
                              tooltip="Protected Super Admin (cannot be deleted)"
                              className="p-1.5 text-slate-300 cursor-not-allowed inline-flex items-center"
                            >
                              <Lock size={14} />
                            </ActionIconSpan>
                          ) : (
                            u.id !== me?.id && (
                              <ActionIconBtn
                                tooltip="Delete User"
                                onClick={() => { if (confirm(`Delete user "${u.name}"?`)) deleteUser.mutate(u.id); }}
                                disabled={deleteUser.isPending}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50 transition-colors"
                              >
                                <Trash2 size={14} />
                              </ActionIconBtn>
                            )
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateUserDialog onClose={() => setShowCreate(false)} />}
      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })}
        />
      )}
      {managingPermissionsUser && (
        <ManagePermissionsModal
          user={managingPermissionsUser}
          onClose={() => setManagingPermissionsUser(null)}
        />
      )}
      </div>
    </TooltipProvider>
  );
}

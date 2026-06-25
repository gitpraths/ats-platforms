import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, Trash2, Check, X, Search } from "lucide-react";
import { format } from "date-fns";
import { fmtDate } from "../lib/utils";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { User, UserRole } from "../types";
import CreateUserDialog from "../components/CreateUserDialog";

const ROLES: { value: UserRole; label: string; badge: string }[] = [
  { value: "admin",           label: "Admin",           badge: "border border-red-400 text-red-500 bg-transparent" },
  { value: "recruiter_admin", label: "Recruiter Admin", badge: "border border-purple-400 text-purple-600 bg-transparent" },
  { value: "recruiter",       label: "Recruiter",       badge: "border border-blue-400 text-blue-600 bg-transparent" },
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
                <th className="text-left px-4 py-3">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  {editing?.id === u.id ? (
                    <>
                      <td className="px-4 py-2" colSpan={2}>
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
                          <button
                            onClick={saveEdit}
                            disabled={updateUser.isPending}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
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
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {u.created_at ? fmtDate(u.created_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(u)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          {u.id !== me?.id && (
                            <button
                              onClick={() => { if (confirm(`Delete user "${u.name}"?`)) deleteUser.mutate(u.id); }}
                              disabled={deleteUser.isPending}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
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
    </div>
  );
}

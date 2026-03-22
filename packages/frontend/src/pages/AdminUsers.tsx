import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, Trash2, Check, X, Search } from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { User, UserRole } from "../types";
import CreateUserDialog from "../components/CreateUserDialog";

const ROLES: { value: UserRole; label: string; badge: string }[] = [
  { value: "admin",           label: "Admin",           badge: "bg-red-100 text-red-700" },
  { value: "recruiter_admin", label: "Recruiter Admin", badge: "bg-purple-100 text-purple-700" },
  { value: "recruiter",       label: "Recruiter",       badge: "bg-blue-100 text-blue-700" },
  { value: "hiring_manager",  label: "Hiring Manager",  badge: "bg-green-100 text-green-700" },
];

function roleBadge(role: UserRole) {
  const r = ROLES.find((x) => x.value === role);
  return r ? { label: r.label, badge: r.badge } : { label: role, badge: "bg-gray-100 text-gray-600" };
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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage platform users</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
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
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email..."
              className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">Search</button>
        </form>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-500">Loading...</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-center text-gray-400">No users found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr className="text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
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
                            className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                          />
                          <input
                            type="email"
                            value={editing.email}
                            onChange={(e) => setEditing((s) => s && ({ ...s, email: e.target.value }))}
                            placeholder="Email"
                            className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                          />
                          <select
                            value={editing.role}
                            onChange={(e) => setEditing((s) => s && ({ ...s, role: e.target.value as UserRole }))}
                            className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs">
                        {u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}
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
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
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
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {u.name}
                              {u.id === me?.id && (
                                <span className="ml-1.5 text-xs text-gray-400">(you)</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(u.role).badge}`}>
                          {roleBadge(u.role).label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(u)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          {u.id !== me?.id && (
                            <button
                              onClick={() => { if (confirm(`Delete user "${u.name}"?`)) deleteUser.mutate(u.id); }}
                              disabled={deleteUser.isPending}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
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

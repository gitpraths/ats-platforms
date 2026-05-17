import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { api } from "../lib/api";
import type { Department } from "../types";

export default function AdminDepartments() {
  const queryClient = useQueryClient();
  const [newName, setNewName]       = useState("");
  const [createError, setCreateError] = useState("");
  const [editId, setEditId]         = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [editError, setEditError]   = useState("");

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ["admin-departments"],
    queryFn: () => api.get<Department[]>("/departments"),
  });

  const createDept = useMutation({
    mutationFn: () => api.post<Department>("/departments", { name: newName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      setNewName("");
      setCreateError("");
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const updateDept = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put<Department>(`/departments/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      setEditId(null);
      setEditError("");
    },
    onError: (err: Error) => setEditError(err.message),
  });

  const deleteDept = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-departments"] }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!newName.trim()) { setCreateError("Name is required."); return; }
    createDept.mutate();
  }

  function startEdit(d: Department) {
    setEditId(d.id);
    setEditName(d.name);
    setEditError("");
  }

  function saveEdit() {
    if (!editId) return;
    if (!editName.trim()) { setEditError("Name is required."); return; }
    updateDept.mutate({ id: editId, name: editName.trim() });
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Departments</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage company departments</p>
      </div>

      {/* Create form */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 tracking-tight mb-3">Add Department</h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Department name"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <button
            type="submit"
            disabled={createDept.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900 disabled:opacity-50"
          >
            <Plus size={14} /> Add
          </button>
        </form>
        {createError && <p className="mt-2 text-xs text-red-600">{createError}</p>}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : departments.length === 0 ? (
          <p className="p-6 text-center text-slate-400">No departments yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {departments.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                {editId === d.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      autoFocus
                    />
                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                    <button
                      onClick={saveEdit}
                      disabled={updateDept.isPending}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                      title="Save"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-900">{d.name}</span>
                    <button
                      onClick={() => startEdit(d)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${d.name}"?`)) deleteDept.mutate(d.id); }}
                      disabled={deleteDept.isPending}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

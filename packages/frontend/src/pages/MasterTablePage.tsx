import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, Table2 } from "lucide-react";
import { api } from "../lib/api";

interface MasterItem { id: string; name: string; sort_order: number; }

interface Props {
  title: string;
  description: string;
  apiPath: string;
  queryKey: string;
  placeholder: string;
}

export default function MasterTablePage({ title, description, apiPath, queryKey, placeholder }: Props) {
  const queryClient = useQueryClient();
  const [newName, setNewName]         = useState("");
  const [createError, setCreateError] = useState("");
  const [editId, setEditId]           = useState<string | null>(null);
  const [editName, setEditName]       = useState("");
  const [editError, setEditError]     = useState("");

  const { data: items = [], isLoading } = useQuery<MasterItem[]>({
    queryKey: [queryKey],
    queryFn: () => api.get<MasterItem[]>(apiPath),
  });

  const create = useMutation({
    mutationFn: () => api.post<MasterItem>(apiPath, { name: newName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setNewName(""); setCreateError("");
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const update = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put<MasterItem>(`${apiPath}/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setEditId(null); setEditError("");
    },
    onError: (err: Error) => setEditError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${apiPath}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!newName.trim()) { setCreateError("Name is required."); return; }
    create.mutate();
  }

  function startEdit(item: MasterItem) {
    setEditId(item.id); setEditName(item.name); setEditError("");
  }

  function saveEdit() {
    if (!editId) return;
    if (!editName.trim()) { setEditError("Name is required."); return; }
    update.mutate({ id: editId, name: editName.trim() });
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Table2 size={20} className="text-[#e88e2e]" />
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        </div>
        <p className="text-sm text-slate-500">{description}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-3 py-1">
          <Table2 size={11} /> Master Table · {items.length} {items.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Add New Entry</h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={placeholder}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]"
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#e88e2e] text-white text-sm rounded-lg hover:bg-[#d07d20] disabled:opacity-50"
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
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Table2 size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No entries yet. Add your first one above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition">
                <span className="w-6 text-xs text-slate-400 font-mono text-center">{idx + 1}</span>
                {editId === item.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]"
                      autoFocus
                    />
                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                    <button onClick={saveEdit} disabled={update.isPending}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50" title="Save">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded" title="Cancel">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-900 font-medium">{item.name}</span>
                    <button onClick={() => startEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${item.name}"?`)) remove.mutate(item.id); }}
                      disabled={remove.isPending}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50" title="Delete">
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

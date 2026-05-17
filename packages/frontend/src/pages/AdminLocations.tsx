import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, MapPin } from "lucide-react";
import { api } from "../lib/api";
import type { Location } from "../types";

interface LocationForm {
  city: string;
  state: string;
  country: string;
  is_remote: boolean;
}

const EMPTY_FORM: LocationForm = { city: "", state: "", country: "", is_remote: false };

export default function AdminLocations() {
  const queryClient = useQueryClient();
  const [form, setForm]             = useState<LocationForm>(EMPTY_FORM);
  const [createError, setCreateError] = useState("");
  const [editId, setEditId]         = useState<string | null>(null);
  const [editForm, setEditForm]     = useState<LocationForm>(EMPTY_FORM);
  const [editError, setEditError]   = useState("");

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["admin-locations"],
    queryFn: () => api.get<Location[]>("/locations"),
  });

  const createLocation = useMutation({
    mutationFn: () => api.post<Location>("/locations", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-locations"] });
      setForm(EMPTY_FORM);
      setCreateError("");
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const updateLocation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LocationForm }) =>
      api.put<Location>(`/locations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-locations"] });
      setEditId(null);
      setEditError("");
    },
    onError: (err: Error) => setEditError(err.message),
  });

  const deleteLocation = useMutation({
    mutationFn: (id: string) => api.delete(`/locations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-locations"] }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!form.city.trim())    { setCreateError("City is required."); return; }
    if (!form.country.trim()) { setCreateError("Country is required."); return; }
    createLocation.mutate();
  }

  function startEdit(loc: Location) {
    setEditId(loc.id);
    setEditForm({
      city: loc.city,
      state: loc.state ?? "",
      country: loc.country,
      is_remote: loc.is_remote,
    });
    setEditError("");
  }

  function saveEdit() {
    if (!editId) return;
    if (!editForm.city.trim())    { setEditError("City is required."); return; }
    if (!editForm.country.trim()) { setEditError("Country is required."); return; }
    updateLocation.mutate({ id: editId, data: editForm });
  }

  function locationLabel(loc: Location) {
    if (loc.is_remote) return "Remote";
    return [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Locations</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage office and remote locations</p>
      </div>

      {/* Create form */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 tracking-tight mb-3">Add Location</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City *</label>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="San Francisco"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State / Region</label>
              <input
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                placeholder="CA"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Country *</label>
            <input
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              placeholder="United States"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_remote}
              onChange={(e) => setForm((f) => ({ ...f, is_remote: e.target.checked }))}
              className="rounded"
            />
            Remote location
          </label>
          {createError && <p className="text-xs text-red-600">{createError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createLocation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900 disabled:opacity-50"
            >
              <Plus size={14} /> Add Location
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : locations.length === 0 ? (
          <p className="p-6 text-center text-slate-400">No locations yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {locations.map((loc) => (
              <li key={loc.id} className="px-5 py-3">
                {editId === loc.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">City *</label>
                        <input
                          value={editForm.city}
                          onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">State</label>
                        <input
                          value={editForm.state}
                          onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Country *</label>
                      <input
                        value={editForm.country}
                        onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.is_remote}
                        onChange={(e) => setEditForm((f) => ({ ...f, is_remote: e.target.checked }))}
                        className="rounded"
                      />
                      Remote location
                    </label>
                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={saveEdit}
                        disabled={updateLocation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50"
                      >
                        <Check size={13} /> Save
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-50"
                      >
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">{locationLabel(loc)}</p>
                      {loc.is_remote && (
                        <span className="text-xs text-slate-600">Remote</span>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(loc)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${locationLabel(loc)}"?`)) deleteLocation.mutate(loc.id); }}
                      disabled={deleteLocation.isPending}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

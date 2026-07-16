import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { api } from "../lib/api";
import type { Provider } from "../types";

export default function ProviderCreate() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "", contact_name: "", email: "", phone: "", address: "", is_active: true,
  });
  const [error, setError] = useState("");

  // Load existing data in edit mode
  const { data: existing } = useQuery<Provider>({
    queryKey: ["provider", id],
    queryFn: () => api.get<Provider>(`/providers/${id}`),
    enabled: isEdit,
  });

  // Pre-fill form when existing data loads
  useEffect(() => {
    if (existing) {
      setForm({
        name:         existing.name         ?? "",
        contact_name: existing.contact_name ?? "",
        email:        existing.email        ?? "",
        phone:        existing.phone        ?? "",
        address:      existing.address      ?? "",
        is_active:    existing.is_active    ?? true,
      });
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: (body: typeof form) =>
      isEdit
        ? api.put<Provider>(`/providers/${id}`, body)
        : api.post<Provider>("/providers", body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      navigate(`/providers/${data.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  function set(field: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setError("");
    save.mutate(form);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to={isEdit ? `/providers/${id}` : "/providers"}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> {isEdit ? "Back to Provider" : "Back to Providers"}
      </Link>

      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">
        {isEdit ? "Edit Provider" : "Add Provider"}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
            <input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
          <textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>

        {isEdit && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Active</label>
            <button type="button" onClick={() => set("is_active", !form.is_active)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.is_active ? "bg-[#e88e2e]" : "bg-slate-200"
              }`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                form.is_active ? "translate-x-5" : "translate-x-1"
              }`} />
            </button>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Link to={isEdit ? `/providers/${id}` : "/providers"}
            className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50">
            Cancel
          </Link>
          <button type="submit" disabled={save.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20] disabled:opacity-50">
            <Save size={14} /> {save.isPending ? "Saving..." : "Save Provider"}
          </button>
        </div>
      </form>
    </div>
  );
}

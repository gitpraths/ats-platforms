import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { api } from "../lib/api";
import type { Employer } from "../types";

export default function EmployerCreate() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "", industry: "", website: "", description: "",
    contact_name: "", contact_email: "", contact_phone: "", address: "", is_active: true,
  });
  const [error, setError] = useState("");

  useQuery<Employer>({
    queryKey: ["employer", id],
    queryFn: () => api.get<Employer>(`/employers/${id}`),
    enabled: isEdit,
    // @ts-expect-error react-query onSuccess
    onSuccess: (data: Employer) => {
      setForm({
        name:          data.name,
        industry:      data.industry ?? "",
        website:       data.website ?? "",
        description:   data.description ?? "",
        contact_name:  data.contact_name ?? "",
        contact_email: data.contact_email ?? "",
        contact_phone: data.contact_phone ?? "",
        address:       data.address ?? "",
        is_active:     data.is_active,
      });
    },
  });

  const save = useMutation({
    mutationFn: (body: typeof form) =>
      isEdit
        ? api.put<Employer>(`/employers/${id}`, body)
        : api.post<Employer>("/employers", body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["employers"] });
      navigate(`/employers/${data.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  function set(field: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Company name is required."); return; }
    setError("");
    save.mutate(form);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to={isEdit ? `/employers/${id}` : "/employers"}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> {isEdit ? "Back to Employer" : "Back to Employers"}
      </Link>

      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">
        {isEdit ? "Edit Employer" : "Add Employer"}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Company Name *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Industry</label>
            <input value={form.industry} onChange={(e) => set("industry", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
            <input type="url" value={form.website} onChange={(e) => set("website", e.target.value)}
              placeholder="https://"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>

        <div className="border-t pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Contact Details</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
              <input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
              <input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
          <textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>

        {isEdit && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Active</label>
            <button type="button" onClick={() => set("is_active", !form.is_active)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.is_active ? "bg-slate-800" : "bg-slate-200"
              }`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                form.is_active ? "translate-x-5" : "translate-x-1"
              }`} />
            </button>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Link to={isEdit ? `/employers/${id}` : "/employers"}
            className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50">
            Cancel
          </Link>
          <button type="submit" disabled={save.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50">
            <Save size={14} /> {save.isPending ? "Saving..." : "Save Employer"}
          </button>
        </div>
      </form>
    </div>
  );
}

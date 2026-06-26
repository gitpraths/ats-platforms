import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Employer } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM = {
  name: "", industry: "", website: "", description: "",
  contact_name: "", contact_email: "", contact_phone: "", address: "", is_active: true,
};

export default function AddEmployerDialog({ isOpen, onClose }: Props) {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm]   = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  // Reset form whenever dialog opens
  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setError("");
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const save = useMutation({
    mutationFn: (body: typeof form) => api.post<Employer>("/employers", body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["employers"] });
      onClose();
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

  if (!isOpen) return null;

  const inputCls =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition";
  const labelCls = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl mx-4 my-8 bg-white rounded-2xl shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Employer</h2>
            <p className="text-xs text-slate-400 mt-0.5">Register a new employer / company</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Company Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Industry</label>
                <input
                  value={form.industry}
                  onChange={(e) => set("industry", e.target.value)}
                  placeholder="e.g. Healthcare"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Contact Details
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Contact Name</label>
                  <input
                    value={form.contact_name}
                    onChange={(e) => set("contact_name", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Contact Email</label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => set("contact_email", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Contact Phone</label>
                  <input
                    value={form.contact_phone}
                    onChange={(e) => set("contact_phone", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Address</label>
              <textarea
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </div>

            {/* Footer actions */}
            <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white rounded-lg disabled:opacity-50 transition font-medium"
              >
                <Save size={14} />
                {save.isPending ? "Saving…" : "Save Employer"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

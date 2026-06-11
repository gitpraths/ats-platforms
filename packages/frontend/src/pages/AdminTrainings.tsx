import { useState } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { useTrainings, useCreateTraining, useUpdateTraining, useDeleteTraining } from "../hooks/useTrainings";
import { useAuth } from "../contexts/AuthContext";
import type { Training } from "../types";
import { api } from "../lib/api";
import { useQuery } from "@tanstack/react-query";

interface ProviderOption { id: string; name: string }

const STATUS_BADGE = (active: boolean) =>
  active
    ? "border border-green-500 text-green-700 bg-transparent"
    : "border border-slate-400 text-slate-500 bg-transparent";

export default function AdminTrainings() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "recruiter_admin";

  const [search, setSearch] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [editing, setEditing] = useState<Training | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: result, isLoading } = useTrainings({
    search: search.trim() || undefined,
    isActive: showActiveOnly ? true : undefined,
    limit: 100,
  });
  const trainings = result?.data ?? [];

  const { data: providersResult } = useQuery({
    queryKey: ["providers-select"],
    queryFn:  () => api.list<ProviderOption>("/providers?limit=200"),
  });
  const providers = providersResult?.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Trainings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage the catalogue of training courses</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#e88e2e] text-white text-sm rounded-lg hover:bg-[#d07d20]"
          >
            <Plus size={14} /> New Training
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code..."
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
          />
          Active only
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : trainings.length === 0 ? (
          <p className="p-6 text-center text-slate-400">No trainings yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Code</th>
                <th className="text-left px-5 py-3">Provider</th>
                <th className="text-left px-5 py-3">Duration</th>
                <th className="text-left px-5 py-3">Active</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trainings.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3 text-slate-900">{t.name}</td>
                  <td className="px-5 py-3 text-slate-500">{t.code || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{t.provider_name || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{t.duration_days ? `${t.duration_days} days` : "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_BADGE(t.is_active)}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canEdit && (
                      <button
                        onClick={() => setEditing(t)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && (
        <TrainingFormDialog
          training={editing}
          providers={providers}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

interface DialogProps {
  training: Training | null;
  providers: ProviderOption[];
  onClose: () => void;
}

function TrainingFormDialog({ training, providers, onClose }: DialogProps) {
  const [name, setName] = useState(training?.name ?? "");
  const [code, setCode] = useState(training?.code ?? "");
  const [description, setDescription] = useState(training?.description ?? "");
  const [durationDays, setDurationDays] = useState<string>(training?.duration_days?.toString() ?? "");
  const [providerId, setProviderId] = useState<string>(training?.provider_id ?? "");
  const [isActive, setIsActive] = useState<boolean>(training?.is_active ?? true);
  const [unitPrice, setUnitPrice] = useState<string>(training?.unit_price?.toString() ?? "");
  const [error, setError] = useState("");

  const create = useCreateTraining();
  const update = useUpdateTraining();
  const softDelete = useDeleteTraining();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Name is required."); return; }
    const body = {
      name: name.trim(),
      code: code.trim() || null,
      description: description.trim() || null,
      duration_days: durationDays ? Number(durationDays) : null,
      provider_id: providerId || null,
      is_active: isActive,
      unit_price: unitPrice ? Number(unitPrice) : null,
    };
    const promise = training
      ? update.mutateAsync({ id: training.id, body })
      : create.mutateAsync(body);
    promise.then(onClose).catch((err: Error) => setError(err.message));
  }

  function handleDeactivate() {
    if (!training) return;
    if (!confirm(`Mark "${training.name}" as inactive?`)) return;
    softDelete.mutate(training.id, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {training ? "Edit Training" : "New Training"}
        </h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Duration (days)</label>
              <input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Unit price (AUD)</label>
            <input
              type="number" step="0.01" value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="e.g. 150.00"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Provider</label>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— None —</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-between items-center pt-2">
            <div>
              {training && (
                <button type="button" onClick={handleDeactivate} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                  <Power size={12} /> Mark inactive
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="px-4 py-2 text-sm rounded-lg bg-[#e88e2e] text-white hover:bg-[#d07d20] disabled:opacity-50">
                {training ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

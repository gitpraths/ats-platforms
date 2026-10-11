import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Check, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import type { User } from "../types";

interface Props {
  user: User;
  onClose: () => void;
}

interface PermissionItem {
  id: string;
  label: string;
  description: string;
}

interface PermissionModule {
  module: string;
  name: string;
  description: string;
  permissions: PermissionItem[];
}

interface PermissionsData {
  user: User & { permissions: string[] };
  catalog: PermissionModule[];
  role_defaults: Record<string, string[]>;
  all_permissions: string[];
}

export default function ManagePermissionsModal({ user, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState("");

  const { data, isLoading } = useQuery<{ success: boolean; data: PermissionsData }>({
    queryKey: ["user-permissions", user.id],
    queryFn: () => api.get<{ success: boolean; data: PermissionsData }>(`/users/${user.id}/permissions`),
  });

  const payload = data?.data;
  const catalog = payload?.catalog ?? [];
  const roleDefaults = payload?.role_defaults ?? {};
  const allIds = payload?.all_permissions ?? [];

  useEffect(() => {
    if (payload?.user?.permissions) {
      setSelected(new Set(payload.user.permissions));
    } else if (Array.isArray(user.permissions)) {
      setSelected(new Set(user.permissions));
    }
  }, [payload, user.permissions]);

  const saveMutation = useMutation({
    mutationFn: (perms: string[]) =>
      api.put(`/users/${user.id}/permissions`, { permissions: perms }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions", user.id] });
      onClose();
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  function togglePermission(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyPreset(presetName: string) {
    const preset = roleDefaults[presetName] ?? [];
    setSelected(new Set(preset));
  }

  function selectAll(check: boolean) {
    if (check) setSelected(new Set(allIds));
    else setSelected(new Set());
  }

  function toggleCategory(permIds: string[]) {
    const allChecked = permIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      permIds.forEach((id) => {
        if (allChecked) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  function handleSave() {
    setSaveError("");
    saveMutation.mutate(Array.from(selected));
  }

  const roleLabel = user.role.replace(/_/g, " ").toUpperCase();
  const totalCount = allIds.length || 26;
  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-orange-100 text-[#e88e2e] font-bold flex items-center justify-center text-sm ring-2 ring-orange-200">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 text-lg tracking-tight">{user.name}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-200 text-blue-700 bg-blue-50">
                  {roleLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-[#e88e2e] border border-orange-200 shadow-xs">
              {selectedCount} / {totalCount} Permissions Granted
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition" title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Role Presets Bar */}
        <div className="px-6 py-3 bg-amber-50/50 border-b border-amber-100/80 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Sparkles size={13} className="text-amber-500" /> Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset("super_admin")}
              className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-xs font-medium transition"
            >
              Super Admin
            </button>
            <button
              type="button"
              onClick={() => applyPreset("admin")}
              className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-md text-xs font-medium transition"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => applyPreset("staff")}
              className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-medium transition"
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => applyPreset("hr")}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-medium transition"
            >
              HR
            </button>
            <button
              type="button"
              onClick={() => applyPreset("marketing")}
              className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-medium transition"
            >
              Marketing
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button type="button" onClick={() => selectAll(true)} className="text-[#e88e2e] hover:underline font-semibold">
              Select All ({totalCount})
            </button>
            <span className="text-slate-300">|</span>
            <button type="button" onClick={() => selectAll(false)} className="text-slate-500 hover:underline">
              Clear All
            </button>
          </div>
        </div>

        {/* Modal Body / Categorized Checkboxes */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Loading permissions catalog...
            </div>
          ) : (
            catalog.map((mod) => {
              const modPermIds = mod.permissions.map((p) => p.id);
              const allChecked = modPermIds.every((id) => selected.has(id));

              return (
                <div key={mod.module} className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs hover:border-slate-300 transition">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{mod.name}</span>
                      <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">{mod.description}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCategory(modPermIds)}
                      className="text-[11px] font-medium text-slate-400 hover:text-[#e88e2e] transition"
                    >
                      {allChecked ? "Deselect Module" : "Select Module"}
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    {mod.permissions.map((perm) => {
                      const isChecked = selected.has(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer border transition ${
                            isChecked
                              ? "bg-orange-50/40 border-orange-200/80"
                              : "hover:bg-slate-50 border-transparent hover:border-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(perm.id)}
                            className="mt-0.5 rounded text-[#e88e2e] focus:ring-[#e88e2e] w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <div className={`font-semibold ${isChecked ? "text-slate-900" : "text-slate-700"}`}>
                              {perm.label}
                            </div>
                            <div className="text-slate-400 text-[11px] leading-snug">{perm.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Error Alert */}
        {saveError && (
          <div className="px-6 py-2.5 bg-red-50 border-t border-red-100 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            <span>Failed to save permissions: {saveError}</span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Changes take effect immediately on next navigation or action.
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saveMutation.isPending}
              className="px-4 py-2 border border-slate-200 hover:bg-white text-slate-700 text-sm font-medium rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-5 py-2 bg-[#e88e2e] hover:bg-[#d07d20] text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {saveMutation.isPending ? "Saving..." : <><Check size={15} /> Save Permissions</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

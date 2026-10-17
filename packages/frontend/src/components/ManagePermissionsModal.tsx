import { useState, useEffect, useRef } from "react";
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

const DEFAULT_CATALOG: PermissionModule[] = [
  {
    module: "employers",
    name: "Employers",
    description: "Employer directory, company profiles, and account management",
    permissions: [
      { id: "employers:view",   label: "View Employers",   description: "Browse employer list and view company profiles" },
      { id: "employers:create", label: "Create Employers", description: "Add new employer companies and contacts" },
      { id: "employers:edit",   label: "Edit Employers",   description: "Update company details, contacts, and preferences" },
      { id: "employers:delete", label: "Delete Employers", description: "Deactivate or permanently remove employers" },
    ],
  },
  {
    module: "providers",
    name: "Providers & Consultants",
    description: "Referral organizations, apprenticeship networks, and consultant profiles",
    permissions: [
      { id: "providers:view",   label: "View Providers",   description: "Browse provider directory, view profiles and consultant rosters" },
      { id: "providers:create", label: "Create Providers", description: "Add new referral providers and organisations" },
      { id: "providers:edit",   label: "Edit Providers",   description: "Update provider information, contacts, and manage consultants" },
      { id: "providers:delete", label: "Delete Providers", description: "Deactivate or remove referral providers" },
    ],
  },
  {
    module: "jobs",
    name: "Vacancies",
    description: "Job postings, requirements, compliance, and public listings",
    permissions: [
      { id: "jobs:view",    label: "View Vacancies",    description: "Browse vacancy listings and view job specifications" },
      { id: "jobs:create",  label: "Create Vacancies",  description: "Post new job vacancies and configure requirements" },
      { id: "jobs:edit",    label: "Edit Vacancies",    description: "Edit vacancy descriptions, pay rates, and locations" },
      { id: "jobs:publish", label: "Publish / Status",  description: "Change status between draft, open, closed, and archived" },
      { id: "jobs:delete",  label: "Delete Vacancies",  description: "Permanently delete or archive job vacancies" },
    ],
  },
  {
    module: "important_updates",
    name: "Important Updates",
    description: "Application tracking board and stage transitions",
    permissions: [
      { id: "important_updates:view", label: "View Important Updates", description: "Access and view the Important Updates hiring board" },
    ],
  },
  {
    module: "candidates",
    name: "Candidates & Talent",
    description: "Candidate database, resumes, skills, and talent matching",
    permissions: [
      { id: "candidates:view",   label: "View Candidates",   description: "Search and browse candidate profiles and resumes" },
      { id: "candidates:create", label: "Create Candidates", description: "Add new candidates manually or via import" },
      { id: "candidates:edit",   label: "Edit Candidates",   description: "Update candidate profiles, notes, and attachments" },
      { id: "candidates:delete", label: "Delete Candidates", description: "Remove candidate records from the database" },
    ],
  },
  {
    module: "placements",
    name: "Placements & Welfare",
    description: "Candidate placements, job matching, and ongoing welfare checks",
    permissions: [
      { id: "placements:view",    label: "View Placements",    description: "Browse candidate placements and placement status" },
      { id: "placements:create",  label: "Create Placements",  description: "Assign talent and confirm job placements" },
      { id: "placements:welfare", label: "Log Welfare Checks", description: "Record post-placement contact and welfare notes" },
      { id: "placements:confirm", label: "Confirm Agreements", description: "Confirm employer placement agreements" },
    ],
  },
  {
    module: "training",
    name: "Training Programs",
    description: "Accredited training, courses, cohorts, and candidate enrolments",
    permissions: [
      { id: "training:view",   label: "View Training",   description: "Browse courses, enrolments, and completion status" },
      { id: "training:enroll", label: "Enroll Talent",   description: "Enroll candidates into training courses" },
      { id: "training:manage", label: "Manage Courses",  description: "Create and configure courses, modules, and providers" },
    ],
  },
  {
    module: "reports",
    name: "Reports & Financials",
    description: "Analytics dashboards, placement metrics, and financial reporting",
    permissions: [
      { id: "reports:view",       label: "View Reports",       description: "Access general operational reports and dashboards" },
      { id: "reports:financials", label: "View Financials",    description: "View wage subsidies, invoices, and financial KPIs" },
      { id: "reports:export",     label: "Export Data (Excel)", description: "Export candidates, vacancies, and report data to CSV/Excel" },
    ],
  },
  {
    module: "admin",
    name: "System Administration",
    description: "User management, access control, and platform master lookups",
    permissions: [
      { id: "admin:users",       label: "Manage Users",        description: "Create, edit, and deactivate user accounts" },
      { id: "admin:permissions", label: "Manage Permissions",  description: "Assign and customize user permission tick boxes" },
      { id: "admin:master_data", label: "Manage Master Data",  description: "Configure industries, work types, and lookups" },
    ],
  },
];

const DEFAULT_ALL_IDS = DEFAULT_CATALOG.flatMap((m) => m.permissions.map((p) => p.id));

const DEFAULT_ROLE_PRESETS: Record<string, string[]> = {
  super_admin: [...DEFAULT_ALL_IDS],
  admin: [...DEFAULT_ALL_IDS],
  staff: [
    "employers:view", "employers:create",
    "providers:view", "providers:create", "providers:edit",
    "jobs:view", "jobs:create", "jobs:publish",
    "important_updates:view",
    "candidates:view", "candidates:create", "candidates:edit",
    "placements:view", "placements:create", "placements:welfare",
    "training:view", "training:enroll",
    "reports:view",
  ],
  hr: [
    "candidates:view", "candidates:create", "candidates:edit",
    "important_updates:view",
    "placements:view", "placements:welfare",
    "training:view", "training:enroll", "training:manage",
    "employers:view", "providers:view",
    "reports:view",
  ],
  marketing: [
    "jobs:view",
    "reports:view", "reports:export",
  ],
};

export default function ManagePermissionsModal({ user, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
      return new Set(user.permissions);
    }
    if (user.role === "super_admin" || user.role === "admin") {
      return new Set(DEFAULT_ALL_IDS);
    }
    return new Set(DEFAULT_ROLE_PRESETS[user.role] ?? []);
  });
  const [saveError, setSaveError] = useState("");

  const { data: rawData, isLoading } = useQuery<any>({
    queryKey: ["user-permissions", user.id],
    queryFn: () => api.get<any>(`/users/${user.id}/permissions`),
  });

  const payload: PermissionsData | undefined = rawData?.data ?? rawData;
  const catalog = (payload?.catalog && payload.catalog.length > 0) ? payload.catalog : DEFAULT_CATALOG;
  const roleDefaults = (payload?.role_defaults && Object.keys(payload.role_defaults).length > 0) ? payload.role_defaults : DEFAULT_ROLE_PRESETS;
  const allIds = (payload?.all_permissions && payload.all_permissions.length > 0) ? payload.all_permissions : DEFAULT_ALL_IDS;

  const hasUserEdited = useRef(false);

  useEffect(() => {
    if (hasUserEdited.current) return;
    if (payload?.user?.permissions && Array.isArray(payload.user.permissions)) {
      setSelected(new Set(payload.user.permissions));
    } else if (Array.isArray(user.permissions) && user.permissions.length > 0) {
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
    hasUserEdited.current = true;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyPreset(presetName: string) {
    hasUserEdited.current = true;
    const preset = roleDefaults[presetName] ?? [];
    setSelected(new Set(preset));
  }

  function selectAll(check: boolean) {
    hasUserEdited.current = true;
    if (check) setSelected(new Set(allIds));
    else setSelected(new Set());
  }

  function toggleCategory(permIds: string[]) {
    hasUserEdited.current = true;
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
          {catalog.map((mod) => {
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
            })}
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

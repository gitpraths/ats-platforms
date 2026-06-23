import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, AlertCircle, Plus, X, Check, Upload, FileText } from "lucide-react";
import { api } from "../lib/api";
import type { Provider } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────────
interface MasterIndustry { id: string; name: string; sort_order: number; }
interface Training       { id: string; name: string; code: string | null; }
export interface Consultant { id: string; name: string; email?: string; provider_id: string; }

export interface CandidateFormData {
  date_referred:       string;
  first_name:          string;
  last_name:           string;
  phone:               string;
  email:               string;
  postcode:            string;
  suburb:              string;
  state:               string;
  provider_id:         string;
  consultant_id:       string;
  training_ids:        string[];
  benchmark_hours:     string;
  industry_preference: string[];
  car:                 "yes" | "no" | "";
  police_check:        "yes" | "no" | "";
  wwc:                 "yes" | "no" | "";
  wage_subsidy:        boolean;
  wage_subsidy_amount: string;
  comments:            string;
  work_status:         string;
  intention_to_work:   string;
}

export const EMPTY_FORM: CandidateFormData = {
  date_referred: "", first_name: "", last_name: "", phone: "", email: "",
  postcode: "", suburb: "", state: "", provider_id: "", consultant_id: "",
  training_ids: [], benchmark_hours: "", industry_preference: [],
  car: "", police_check: "", wwc: "",
  wage_subsidy: false, wage_subsidy_amount: "",
  comments: "", work_status: "job_seeking", intention_to_work: "suitable",
};

// ── Shared Styles ──────────────────────────────────────────────────────────────
const CLS = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e] focus:border-transparent bg-white";
const sectionCls = "bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4";
const sectionTitle = "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3";

// ── Sub-components ─────────────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function YesNoToggle({ value, onChange, required }: {
  value: "yes" | "no" | "";
  onChange: (v: "yes" | "no") => void;
  required?: boolean;
}) {
  return (
    <div className="flex border border-slate-200 rounded-xl overflow-hidden">
      {(["yes", "no"] as const).map((v) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`flex-1 py-2 text-sm font-medium transition ${
            value === v
              ? v === "yes" ? "bg-green-500 text-white" : "bg-red-400 text-white"
              : "bg-white text-slate-500 hover:bg-slate-50"
          } ${required && !value ? "ring-1 ring-red-300" : ""}`}>
          {v === "yes" ? "✓ Yes" : "✗ No"}
        </button>
      ))}
    </div>
  );
}

function AddConsultantPopup({ providerId, onSave, onClose }: {
  providerId: string;
  onSave: (c: Consultant) => void;
  onClose: () => void;
}) {
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const result = await api.post<Consultant>("/consultants", {
        provider_id: providerId, name: name.trim(), email: email.trim() || undefined,
      });
      onSave(result);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Add Consultant</h3>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label required>Name</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={CLS} placeholder="e.g. Sarah Jones" />
          </div>
          <div>
            <Label>Email</Label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CLS} placeholder="sarah@provider.com" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm bg-[#e88e2e] text-white rounded-xl hover:bg-[#d07d20] disabled:opacity-50 flex items-center gap-1">
            <Check size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main exported form panel ───────────────────────────────────────────────────
interface Props {
  form:        CandidateFormData;
  setForm:     React.Dispatch<React.SetStateAction<CandidateFormData>>;
  mode:        "create" | "edit";
  error?:      string;
  isSubmitting?: boolean;
  onSubmit:    () => void;
  onCancel:    () => void;
  submitLabel?: string;
  /** Only shown in create mode – upload happens after save */
  showResumeUpload?: boolean;
}

export function CandidateFormPanel({
  form, setForm, mode, error, isSubmitting,
  onSubmit, onCancel, submitLabel, showResumeUpload = true,
}: Props) {
  const [dupPhone, setDupPhone]   = useState<{ name: string; email: string } | null>(null);
  const [dupName,  setDupName]    = useState<{ name: string; email: string } | null>(null);
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [suburbOptions,   setSuburbOptions]   = useState<{ suburb: string; state: string }[]>([]);
  const [showAddConsultant, setShowAddConsultant] = useState(false);
  const [extraConsultants, setExtraConsultants]   = useState<Consultant[]>([]);
  const [resumeFile, setResumeFile]     = useState<File | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof CandidateFormData>(key: K, value: CandidateFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Queries
  const { data: providersData } = useQuery({
    queryKey: ["providers-select"],
    queryFn: () => api.list<Provider>("/providers?limit=200"),
  });
  const providers = providersData?.data ?? [];

  const { data: industriesData, isLoading: industriesLoading, isError: industriesError } =
    useQuery<MasterIndustry[]>({
      queryKey: ["master-industries"],
      queryFn: () => api.get<MasterIndustry[]>("/master/industries"),
      staleTime: 5 * 60 * 1000,
    });
  const industries = industriesData ?? [];


  const { data: consultantsData, refetch: refetchConsultants } = useQuery({
    queryKey: ["consultants", form.provider_id],
    queryFn: () => api.get<Consultant[]>(`/consultants?provider_id=${form.provider_id}`),
    enabled: !!form.provider_id,
  });
  const consultants = [
    ...(consultantsData ?? []),
    ...extraConsultants.filter((ec) => !(consultantsData ?? []).some((c) => c.id === ec.id)),
  ];

  // Postcode auto-fill
  const lookupPostcode = useCallback(async (postcode: string) => {
    if (postcode.length !== 4) return;
    setPostcodeLoading(true);
    try {
      const res = await api.get<{ suburb: string; state: string }[]>(`/postcodes/${postcode}`);
      if (res && res.length === 1) {
        // Single match — auto-fill
        setForm((f) => ({ ...f, suburb: res[0].suburb, state: res[0].state }));
        setSuburbOptions([]);
      } else if (res && res.length > 1) {
        // Multiple matches — show dropdown, pre-fill state from first result
        setSuburbOptions(res);
        setForm((f) => ({ ...f, suburb: "", state: res[0].state }));
      }
    } catch { /* silent */ } finally { setPostcodeLoading(false); }
  }, [setForm]);

  // Duplicate checks
  async function checkDuplicatePhone(phone: string) {
    if (!phone || phone.length < 8) return;
    try {
      const res = await api.get<{ phone?: { name: string; email: string } }>(
        `/candidates/check-duplicate?phone=${encodeURIComponent(phone)}`
      );
      setDupPhone(res.phone || null);
    } catch { /* silent */ }
  }

  async function checkDuplicateName(firstName: string, lastName: string) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    if (!fullName.trim()) return;
    try {
      const res = await api.get<{ name?: { name: string; email: string } }>(
        `/candidates/check-duplicate?name=${encodeURIComponent(fullName)}`
      );
      setDupName(res.name || null);
    } catch { /* silent */ }
  }

  function toggleIndustry(name: string) {
    set("industry_preference",
      form.industry_preference.includes(name)
        ? form.industry_preference.filter((i) => i !== name)
        : [...form.industry_preference, name]
    );
  }


  // Expose resume file upward via a custom event so parent can access it
  // (simpler than prop-drilling; parent reads from a ref or callback)
  function handleResumeChange(file: File | null) {
    setResumeFile(file);
    // Dispatch custom event so CandidateNew can pick it up
    window.dispatchEvent(new CustomEvent("candidateFormResumeChange", { detail: file }));
  }

  return (
    <div className="space-y-5">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" /> {error}
        </div>
      )}

      {/* Duplicate warnings */}
      {dupPhone && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0" />
          ⚠️ Phone already linked to <strong className="mx-1">{dupPhone.name}</strong> ({dupPhone.email})
        </div>
      )}
      {dupName && (
        <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
          <AlertTriangle size={16} className="flex-shrink-0" />
          ⚠️ Name already exists: <strong className="mx-1">{dupName.name}</strong> — please verify.
        </div>
      )}

      {/* ── Section 1: Reference ── */}
      <div className={sectionCls}>
        <p className={sectionTitle}>Reference</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>SR No</Label>
            <input readOnly value={mode === "create" ? "Auto-generated" : "—"}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
          </div>
          <div>
            <Label>Date Referred</Label>
            <input type="date" value={form.date_referred}
              onChange={(e) => set("date_referred", e.target.value)} className={CLS} />
            <p className="text-xs text-slate-400 mt-1">From Provider referral or Excel sync</p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Personal Details ── */}
      <div className={sectionCls}>
        <p className={sectionTitle}>Personal Details</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label required>First Name</Label>
            <input value={form.first_name}
              onChange={(e) => set("first_name", e.target.value.replace(/[^a-zA-Z\s'\-]/g, ""))}
              onBlur={() => checkDuplicateName(form.first_name, form.last_name)}
              className={CLS} placeholder="Jane" />
          </div>
          <div>
            <Label>Last Name</Label>
            <input value={form.last_name}
              onChange={(e) => set("last_name", e.target.value.replace(/[^a-zA-Z\s'\-]/g, ""))}
              onBlur={() => checkDuplicateName(form.first_name, form.last_name)}
              className={CLS} placeholder="Smith" />
          </div>
          <div>
            <Label required>Phone (10 digits)</Label>
            <input type="tel" value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              onBlur={() => checkDuplicatePhone(form.phone)}
              className={`${CLS} ${dupPhone ? "border-amber-400" : ""}`}
              placeholder="0412 345 678" maxLength={10} />
            {form.phone && form.phone.length > 0 && form.phone.length !== 10 && (
              <p className="text-xs text-red-500 mt-1">Must be exactly 10 digits</p>
            )}
          </div>
          <div>
            <Label>Email</Label>
            <input type="email" value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={CLS} placeholder="jane@example.com" />
          </div>
        </div>

        {/* Address row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Post Code</Label>
            <input value={form.postcode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                set("postcode", v);
                if (v.length === 4) lookupPostcode(v);
              }}
              className={CLS} placeholder="3000" maxLength={4} />
            {postcodeLoading && <p className="text-xs text-slate-400 mt-1">Looking up...</p>}
          </div>
          <div>
            <Label>Suburb</Label>
            {suburbOptions.length > 1 ? (
              <select
                value={form.suburb}
                onChange={(e) => {
                  const picked = suburbOptions.find((o) => o.suburb === e.target.value);
                  if (picked) { set("suburb", picked.suburb); set("state", picked.state); }
                  setSuburbOptions([]);
                }}
                className={CLS}
              >
                <option value="">— Select suburb —</option>
                {suburbOptions.map((o) => (
                  <option key={o.suburb} value={o.suburb}>{o.suburb}</option>
                ))}
              </select>
            ) : (
              <input value={form.suburb} onChange={(e) => set("suburb", e.target.value)}
                className={CLS} placeholder="Auto-filled" />
            )}
          </div>
          <div>
            <Label>State</Label>
            <input value={form.state} onChange={(e) => set("state", e.target.value)}
              className={CLS} placeholder="VIC" />
          </div>
        </div>

        {/* Job Seeker Intention to Work + Work Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Job Seeker Intention to Work</Label>
            <select value={form.intention_to_work} onChange={(e) => set("intention_to_work", e.target.value)} className={CLS}>
              <option value="suitable">Suitable</option>
              <option value="not_suitable">Not Suitable</option>
            </select>
          </div>
          <div>
            <Label>Work Status</Label>
            <select value={form.work_status} onChange={(e) => set("work_status", e.target.value)} className={CLS}>
              <option value="job_seeking">Job Seeking</option>
              <option value="employed">Employed</option>
              <option value="placed">Placed</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 3: Provider & Consultant ── */}
      <div className={sectionCls}>
        <p className={sectionTitle}>Provider Details</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label required>Provider</Label>
            <select value={form.provider_id}
              onChange={(e) => { set("provider_id", e.target.value); set("consultant_id", ""); }}
              className={CLS}>
              <option value="">— Select Provider —</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Consultant <span className="text-slate-400 font-normal">(Optional)</span></Label>
            <div className="flex gap-2">
              <select value={form.consultant_id}
                onChange={(e) => set("consultant_id", e.target.value)}
                disabled={!form.provider_id}
                className={`${CLS} flex-1 ${!form.provider_id ? "opacity-50" : ""}`}>
                <option value="">— Select Consultant —</option>
                {consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {form.provider_id && (
                <button type="button" onClick={() => setShowAddConsultant(true)}
                  className="px-2.5 py-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 flex-shrink-0" title="Add new consultant">
                  <Plus size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Work Preferences ── */}
      <div className={sectionCls}>
        <p className={sectionTitle}>Work Preferences</p>

        {/* Benchmark Hours */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label required>Benchmark Hours / Week</Label>
            <input type="number" min={1} max={168} value={form.benchmark_hours}
              onChange={(e) => set("benchmark_hours", e.target.value)}
              className={CLS} placeholder="38" />
          </div>
          <div>
            <Label>Wage Subsidy</Label>
            <select value={form.wage_subsidy ? "yes" : "no"}
              onChange={(e) => set("wage_subsidy", e.target.value === "yes")}
              className={CLS}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {form.wage_subsidy && (
            <div>
              <Label>Subsidy Amount ($)</Label>
              <input type="number" min={0} step="0.01" value={form.wage_subsidy_amount}
                onChange={(e) => set("wage_subsidy_amount", e.target.value)}
                className={CLS} placeholder="e.g. 5000" />
            </div>
          )}
        </div>

        {/* Industry Preference */}
        <div>
          <Label>Industry Preference</Label>
          <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-xl min-h-[48px]">
            {industriesLoading ? (
              <p className="text-sm text-slate-400 animate-pulse">Loading industries...</p>
            ) : industriesError ? (
              <p className="text-sm text-red-400">⚠ Failed to load industries.</p>
            ) : industries.length === 0 ? (
              <p className="text-sm text-slate-400">No industries found. Add them in Master Tables.</p>
            ) : (
              industries.map((ind) => {
                const selected = form.industry_preference.includes(ind.name);
                return (
                  <button key={ind.id} type="button" onClick={() => toggleIndustry(ind.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      selected
                        ? "bg-[#e88e2e] text-white border-[#e88e2e]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-[#e88e2e] hover:text-[#e88e2e]"
                    }`}>
                    {selected && <span className="mr-1">✓</span>}
                    {ind.name}
                  </button>
                );
              })
            )}
          </div>
          {form.industry_preference.length > 0 && (
            <p className="text-xs text-[#e88e2e] mt-1">
              {form.industry_preference.length} selected: {form.industry_preference.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* ── Section 5: Compliance ── */}
      <div className={sectionCls}>
        <p className={sectionTitle}>Compliance & Requirements</p>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <Label required>Car Available</Label>
            <YesNoToggle value={form.car} onChange={(v) => set("car", v)} required />
          </div>
          <div>
            <Label>Police Check</Label>
            <YesNoToggle value={form.police_check} onChange={(v) => set("police_check", v)} />
          </div>
          <div>
            <Label>WWC (Working With Children)</Label>
            <YesNoToggle value={form.wwc} onChange={(v) => set("wwc", v)} />
          </div>
        </div>
      </div>

      {/* ── Section 6: Documents & Notes ── */}
      <div className={sectionCls}>
        <p className={sectionTitle}>Documents & Notes</p>

        {showResumeUpload && (
          <div>
            <Label>Upload Resume</Label>
            <div
              onClick={() => resumeInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl px-4 py-5 text-center cursor-pointer transition ${
                resumeFile ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-[#e88e2e] hover:bg-orange-50"
              }`}>
              <input ref={resumeInputRef} type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
                onChange={(e) => handleResumeChange(e.target.files?.[0] ?? null)} />
              {resumeFile ? (
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <FileText size={18} />
                  <span className="text-sm font-medium">{resumeFile.name}</span>
                  <button type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResumeChange(null);
                      if (resumeInputRef.current) resumeInputRef.current.value = "";
                    }}
                    className="ml-1 text-slate-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <Upload size={20} />
                  <p className="text-sm">Click to select resume</p>
                  <p className="text-xs">PDF, Word, or Image (max 10 MB)</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <Label>Comments <span className="text-slate-400 font-normal">(Xero Notes)</span></Label>
          <textarea value={form.comments} onChange={(e) => set("comments", e.target.value)}
            rows={4} className={CLS}
            placeholder="Additional notes or comments about this candidate..." />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-end pb-4">
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
          Cancel
        </button>
        <button type="button" onClick={onSubmit} disabled={isSubmitting}
          className="px-6 py-2.5 text-sm bg-[#e88e2e] text-white rounded-xl hover:bg-[#d07d20] disabled:opacity-50 font-medium transition">
          {isSubmitting ? "Saving..." : (submitLabel ?? "Save Candidate")}
        </button>
      </div>

      {/* Add Consultant popup */}
      {showAddConsultant && form.provider_id && (
        <AddConsultantPopup
          providerId={form.provider_id}
          onSave={(c) => {
            setExtraConsultants((prev) => [...prev, c]);
            set("consultant_id", c.id);
            setShowAddConsultant(false);
            refetchConsultants();
          }}
          onClose={() => setShowAddConsultant(false)}
        />
      )}
    </div>
  );
}

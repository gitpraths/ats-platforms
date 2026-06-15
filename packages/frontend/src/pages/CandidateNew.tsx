import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, AlertCircle, Plus, X, Check } from "lucide-react";
import { api } from "../lib/api";
import type { Provider } from "../types";

interface MasterIndustry { id: string; name: string; sort_order: number; }
interface Training { id: string; name: string; code: string | null; }
interface Consultant { id: string; name: string; email?: string; provider_id: string; }

interface CandidateForm {
  date_referred: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  postcode: string;
  suburb: string;
  state: string;
  provider_id: string;
  consultant_id: string;
  training_ids: string[];
  benchmark_hours: string;
  industry_preference: string[];
  car: "yes" | "no" | "";
  police_check: "yes" | "no" | "";
  wwc: "yes" | "no" | "";
  comments: string;
}

const EMPTY: CandidateForm = {
  date_referred: "", first_name: "", last_name: "", phone: "", email: "",
  postcode: "", suburb: "", state: "", provider_id: "", consultant_id: "",
  training_ids: [], benchmark_hours: "", industry_preference: [],
  car: "", police_check: "", wwc: "", comments: "",
};

const CLS = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e] focus:border-transparent bg-white";

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
    <div className="flex border border-slate-200 rounded-lg overflow-hidden">
      {(["yes", "no"] as const).map((v) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`flex-1 py-2 text-sm font-medium transition ${
            value === v
              ? v === "yes" ? "bg-green-500 text-white" : "bg-red-400 text-white"
              : "bg-white text-slate-500 hover:bg-slate-50"
          } ${required && !value ? "ring-1 ring-red-300" : ""}`}
        >
          {v === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

// ── Add Consultant inline popup ───────────────────────────────────────────────
function AddConsultantPopup({ providerId, onSave, onClose }: {
  providerId: string;
  onSave: (c: Consultant) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const result = await api.post<Consultant>("/consultants", { provider_id: providerId, name: name.trim(), email: email.trim() || undefined });
      onSave(result);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80">
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
          <button onClick={onClose} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20] disabled:opacity-50 flex items-center gap-1">
            <Check size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
export default function CandidateNew() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm]       = useState<CandidateForm>(EMPTY);
  const [error, setError]     = useState("");
  const [dupPhone, setDupPhone] = useState<{ name: string; email: string } | null>(null);
  const [dupName, setDupName]   = useState<{ name: string; email: string } | null>(null);
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [showAddConsultant, setShowAddConsultant] = useState(false);
  const [extraConsultants, setExtraConsultants] = useState<Consultant[]>([]);

  // Data queries
  const { data: providersData } = useQuery({
    queryKey: ["providers-select"],
    queryFn: () => api.list<Provider>("/providers?limit=200"),
  });
  const providers = providersData?.data ?? [];

  const {
    data: industriesData,
    isLoading: industriesLoading,
    isError: industriesError,
  } = useQuery<MasterIndustry[]>({
    queryKey: ["master-industries"],
    queryFn: () => api.get<MasterIndustry[]>("/master/industries"),
    staleTime: 5 * 60 * 1000,
  });
  const industries = industriesData ?? [];

  const { data: trainingsData } = useQuery({
    queryKey: ["trainings-select"],
    queryFn: () => api.get<Training[]>("/trainings"),
  });
  const trainings = trainingsData ?? [];

  const { data: consultantsData, refetch: refetchConsultants } = useQuery({
    queryKey: ["consultants", form.provider_id],
    queryFn: () => api.get<Consultant[]>(`/consultants?provider_id=${form.provider_id}`),
    enabled: !!form.provider_id,
  });
  const consultants = [...(consultantsData ?? []), ...extraConsultants.filter(
    (ec) => !(consultantsData ?? []).some((c) => c.id === ec.id)
  )];

  // Field setter
  function set<K extends keyof CandidateForm>(key: K, value: CandidateForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Postcode auto-fill via backend proxy (avoids CORS)
  const lookupPostcode = useCallback(async (postcode: string) => {
    if (postcode.length !== 4) return;
    setPostcodeLoading(true);
    try {
      const res = await api.get<{ suburb: string; state: string }[]>(`/postcodes/${postcode}`);
      if (res && res.length > 0) {
        setForm((f) => ({ ...f, suburb: res[0].suburb, state: res[0].state }));
      }
    } catch { /* silent */ } finally { setPostcodeLoading(false); }
  }, []);

  // Duplicate check on blur
  async function checkDuplicatePhone(phone: string) {
    if (!phone || phone.length < 8) return;
    try {
      const res = await api.get<{ phone?: { name: string; email: string } }>(`/candidates/check-duplicate?phone=${encodeURIComponent(phone)}`);
      setDupPhone(res.phone || null);
    } catch { /* silent */ }
  }

  async function checkDuplicateName(firstName: string, lastName: string) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    if (!fullName.trim()) return;
    try {
      const res = await api.get<{ name?: { name: string; email: string } }>(`/candidates/check-duplicate?name=${encodeURIComponent(fullName)}`);
      setDupName(res.name || null);
    } catch { /* silent */ }
  }

  // Submit
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>("/candidates", {
      ...form,
      name: [form.first_name, form.last_name].filter(Boolean).join(" "),
      benchmark_hours: form.benchmark_hours ? Number(form.benchmark_hours) : undefined,
    }),
    onSuccess: (candidate: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      // Enrol selected trainings
      if (form.training_ids.length > 0) {
        Promise.all(
          form.training_ids.map((tid) =>
            api.post(`/candidates/${candidate.id}/trainings`, {
              training_id: tid, status: "enrolled",
            }).catch(() => {})
          )
        );
      }
      navigate(`/candidates/${candidate.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const fullName = [form.first_name, form.last_name].filter(Boolean).join(" ");
    if (!fullName.trim())      { setError("First name is required."); return; }
    if (!form.phone)           { setError("Phone is required."); return; }
    if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ""))) { setError("Phone must be 10 digits."); return; }
    if (!form.provider_id)     { setError("Provider is required."); return; }
    if (!form.benchmark_hours) { setError("Benchmark hours is required."); return; }
    if (!form.car)             { setError("Car preference is required."); return; }
    create.mutate();
  }

  function toggleIndustry(name: string) {
    set("industry_preference",
      form.industry_preference.includes(name)
        ? form.industry_preference.filter((i) => i !== name)
        : [...form.industry_preference, name]
    );
  }

  function toggleTraining(id: string) {
    set("training_ids",
      form.training_ids.includes(id)
        ? form.training_ids.filter((t) => t !== id)
        : [...form.training_ids, id]
    );
  }

  const sectionCls = "bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4";
  const sectionTitle = "text-xs font-bold text-slate-400 uppercase tracking-widest mb-3";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Back button */}
        <Link to="/candidates"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 shadow-sm transition mb-5">
          <ArrowLeft size={14} /> Back to Candidates
        </Link>

        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">Add Candidate</h1>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0" /> {error}
          </div>
        )}

        {/* Duplicate warnings */}
        {dupPhone && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span>⚠️ Phone number already exists for <strong>{dupPhone.name}</strong> ({dupPhone.email})</span>
          </div>
        )}
        {dupName && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span>⚠️ A candidate with this name already exists: <strong>{dupName.name}</strong>. Please verify.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Section 1: Reference Info ── */}
          <div className={sectionCls}>
            <p className={sectionTitle}>Reference</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SR No</Label>
                <input readOnly value="Auto-generated"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <Label>Date Referred</Label>
                <input type="date" value={form.date_referred} onChange={(e) => set("date_referred", e.target.value)} className={CLS} />
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
                  onChange={(e) => set("first_name", e.target.value)}
                  onBlur={() => checkDuplicateName(form.first_name, form.last_name)}
                  className={CLS} placeholder="Jane" />
              </div>
              <div>
                <Label>Last Name</Label>
                <input value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                  onBlur={() => checkDuplicateName(form.first_name, form.last_name)}
                  className={CLS} placeholder="Smith" />
              </div>
              <div>
                <Label required>Phone (10 digits)</Label>
                <input
                  type="tel" value={form.phone}
                  onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onBlur={() => checkDuplicatePhone(form.phone)}
                  className={`${CLS} ${dupPhone ? "border-amber-400" : ""}`}
                  placeholder="0412 345 678" maxLength={10}
                />
                {form.phone && form.phone.length > 0 && form.phone.length !== 10 && (
                  <p className="text-xs text-red-500 mt-1">Must be exactly 10 digits</p>
                )}
              </div>
              <div>
                <Label>Email</Label>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={CLS} placeholder="jane@example.com" />
              </div>
            </div>

            {/* Address row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Post Code</Label>
                <input
                  value={form.postcode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    set("postcode", v);
                    if (v.length === 4) lookupPostcode(v);
                  }}
                  className={CLS} placeholder="3000" maxLength={4}
                />
                {postcodeLoading && <p className="text-xs text-slate-400 mt-1">Looking up...</p>}
              </div>
              <div>
                <Label>Suburb</Label>
                <input value={form.suburb} onChange={(e) => set("suburb", e.target.value)} className={CLS} placeholder="Auto-filled from postcode" />
              </div>
              <div>
                <Label>State</Label>
                <input value={form.state} onChange={(e) => set("state", e.target.value)} className={CLS} placeholder="VIC" />
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
                <Label>Consultant Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                <div className="flex gap-2">
                  <select value={form.consultant_id}
                    onChange={(e) => set("consultant_id", e.target.value)}
                    disabled={!form.provider_id}
                    className={`${CLS} flex-1`}>
                    <option value="">— Select Consultant —</option>
                    {consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {form.provider_id && (
                    <button type="button" onClick={() => setShowAddConsultant(true)}
                      className="px-2.5 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 flex-shrink-0" title="Add new consultant">
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 4: Training & Work Preferences ── */}
          <div className={sectionCls}>
            <p className={sectionTitle}>Training & Preferences</p>

            {/* Training courses — multi select */}
            <div>
              <Label>Training Course</Label>
              <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                {trainings.length === 0 ? (
                  <p className="text-sm text-slate-400">No training courses available.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {trainings.map((t) => {
                      const selected = form.training_ids.includes(t.id);
                      return (
                        <label key={t.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition ${selected ? "bg-orange-50 text-[#e88e2e]" : "hover:bg-slate-50 text-slate-700"}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleTraining(t.id)}
                            className="accent-[#e88e2e]" />
                          {t.name}{t.code ? ` (${t.code})` : ""}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {form.training_ids.length > 0 && (
                <p className="text-xs text-[#e88e2e] mt-1">{form.training_ids.length} course{form.training_ids.length > 1 ? "s" : ""} selected</p>
              )}
            </div>

            {/* Benchmark Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Benchmark Hours / Week</Label>
                <input type="number" min={1} max={168} value={form.benchmark_hours}
                  onChange={(e) => set("benchmark_hours", e.target.value)}
                  className={CLS} placeholder="38" />
              </div>
            </div>

            {/* Industry Preference — multi select chips */}
            <div>
              <Label>Industry Preference</Label>
              <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-lg min-h-[48px]">
                {industriesLoading ? (
                  <p className="text-sm text-slate-400 animate-pulse">Loading industries...</p>
                ) : industriesError ? (
                  <p className="text-sm text-red-400">⚠ Failed to load industries. Please refresh.</p>
                ) : industries.length === 0 ? (
                  <p className="text-sm text-slate-400">No industries found. Add them in Master Tables → Industries.</p>
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
                <p className="text-xs text-[#e88e2e] mt-1">{form.industry_preference.length} selected: {form.industry_preference.join(", ")}</p>
              )}
            </div>
          </div>

          {/* ── Section 5: Compliance ── */}
          <div className={sectionCls}>
            <p className={sectionTitle}>Compliance & Requirements</p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <Label required>Car</Label>
                <YesNoToggle value={form.car} onChange={(v) => set("car", v)} required />
              </div>
              <div>
                <Label>Clear Police Check</Label>
                <YesNoToggle value={form.police_check} onChange={(v) => set("police_check", v)} />
              </div>
              <div>
                <Label>WWC (Working With Children)</Label>
                <YesNoToggle value={form.wwc} onChange={(v) => set("wwc", v)} />
              </div>
            </div>
          </div>

          {/* ── Section 6: Resume & Comments ── */}
          <div className={sectionCls}>
            <p className={sectionTitle}>Documents & Notes</p>
            <div>
              <Label>Upload Resume</Label>
              <p className="text-xs text-slate-400 mb-2">You can upload resume after saving the candidate from their profile page.</p>
              <div className="border-2 border-dashed border-slate-200 rounded-lg px-4 py-6 text-center text-sm text-slate-400">
                Resume upload available after saving
              </div>
            </div>
            <div>
              <Label>Comments <span className="text-slate-400 font-normal">(Xero Notes)</span></Label>
              <textarea value={form.comments} onChange={(e) => set("comments", e.target.value)}
                rows={4} className={CLS}
                placeholder="Additional notes or comments about this candidate..." />
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 justify-end pb-8">
            <Link to="/candidates"
              className="px-5 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </Link>
            <button type="submit" disabled={create.isPending}
              className="px-6 py-2.5 text-sm bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20] disabled:opacity-50 font-medium">
              {create.isPending ? "Saving..." : "Save Candidate"}
            </button>
          </div>
        </form>
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

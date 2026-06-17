import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ChevronRight, ChevronLeft, Check, Hash, MapPin } from "lucide-react";
import { api } from "../lib/api";
import type { Employer, Candidate } from "../types";

// ── Australian Address Autocomplete (Nominatim / OpenStreetMap — free) ─────────
const AU_STATE: Record<string, string> = {
  "New South Wales": "NSW", "Victoria": "VIC", "Queensland": "QLD",
  "South Australia": "SA",  "Western Australia": "WA", "Tasmania": "TAS",
  "Australian Capital Territory": "ACT", "Northern Territory": "NT",
};

function fmtResult(item: Record<string, any>): string {
  const a = item.address ?? {};
  const suburb = a.suburb ?? a.town ?? a.city_district ?? a.city ?? a.county ?? "";
  const state  = AU_STATE[a.state] ?? a.state ?? "";
  const post   = a.postcode ?? "";
  if (!suburb && !state) return String(item.display_name ?? "").split(",")[0];
  return [suburb, state, post].filter(Boolean).join(", ");
}

function AuAddressAutocomplete({
  value, onChange, className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [query,   setQuery]   = useState(value);
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    onChange(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=au&format=json&limit=8&addressdetails=1`,
          { headers: { "Accept-Language": "en-AU" } }
        );
        const data = await res.json() as Record<string, any>[];
        setResults(data);
        setOpen(data.length > 0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
  }

  function select(item: Record<string, any>) {
    const label = fmtResult(item);
    setQuery(label);
    onChange(label);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={wrap} className="relative">
      <input
        value={query}
        onChange={handleInput}
        onFocus={() => results.length > 0 && setOpen(true)}
        className={className}
        placeholder="e.g. Parramatta, NSW"
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-3 h-3 border-2 border-[#e88e2e] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto text-sm">
          {results.map((item, i) => (
            <li
              key={i}
              onMouseDown={() => select(item)}
              className="px-3 py-2 cursor-pointer hover:bg-orange-50 hover:text-[#e88e2e] flex items-center gap-2 transition-colors"
            >
              <MapPin size={12} className="text-slate-300 shrink-0" />
              {fmtResult(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props { isOpen: boolean; onClose: () => void; }

const WORKVISION_BOARD_URL = "https://workvision.com.au/current-vacancies/";
const STEPS = ["Vacancy Details", "Description & Compliance", "Candidate Assignment"] as const;
type Step = 0 | 1 | 2;

const YES_NO     = ["yes", "no"] as const;
const YES_NO_NR  = ["yes", "no", "not_required"] as const;
const WORK_TYPES = ["Full-time", "Part-time", "Casual", "Contract", "Temporary"] as const;

interface FormState {
  // Step 1
  title:          string;
  employer_id:    string;
  industry:       string;
  pay_rate:       string;
  pay_rate_type:  "per_hour" | "annual";
  positions_count: number;
  work_type:      string;
  work_location:  string;
  job_board_url:  string;
  // Step 2
  description:         string;
  police_check:        string;
  drug_alcohol_test:   string;
  wwc:                 string;
  car_required:        string;
  public_transport:    string;
  wage_subsidy_required: string;
  comments:            string;
  // Step 3
  candidate_id:    string;
  candidate_name:  string;
  interview_date:  string;
  ets_date:        string;
  placement_date:  string;
}

const EMPTY: FormState = {
  title: "", employer_id: "", industry: "", pay_rate: "", pay_rate_type: "per_hour",
  positions_count: 1, work_type: "Full-time", work_location: "", job_board_url: WORKVISION_BOARD_URL,
  description: "", police_check: "not_required", drug_alcohol_test: "no", wwc: "no",
  car_required: "no", public_transport: "no", wage_subsidy_required: "no", comments: "",
  candidate_id: "", candidate_name: "", interview_date: "", ets_date: "", placement_date: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const cls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e] focus:border-transparent";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function YesNoSelect({ value, onChange, options = YES_NO }: {
  value: string;
  onChange: (v: string) => void;
  options?: readonly string[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o === "not_required" ? "Not Required" : o.charAt(0).toUpperCase() + o.slice(1)}
        </option>
      ))}
    </select>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        const last   = i === STEPS.length - 1;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                done   ? "bg-[#e88e2e] border-[#e88e2e] text-white" :
                active ? "border-[#e88e2e] text-[#e88e2e] bg-white"  :
                         "border-slate-200 text-slate-400 bg-white"
              }`}>
                {done ? <Check size={12} /> : i + 1}
              </div>
              <span className={`text-xs mt-1 font-medium ${active ? "text-[#e88e2e]" : done ? "text-slate-600" : "text-slate-400"}`}>
                {label}
              </span>
            </div>
            {!last && <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < current ? "bg-[#e88e2e]" : "bg-slate-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Vacancy Details ───────────────────────────────────────────────────
function StepVacancyDetails({ form, set, employers }: {
  form: FormState;
  set: (k: keyof FormState, v: unknown) => void;
  employers: Employer[];
}) {
  return (
    <div className="space-y-4">
      {/* Vacancy ID — auto generated */}
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <Hash size={14} className="text-slate-400" />
        <span className="text-xs text-slate-500 font-medium">Vacancy ID:</span>
        <span className="text-xs text-slate-400 italic">Auto-generated on save</span>
      </div>

      {/* Job Title */}
      <div>
        <Label required>Job Title</Label>
        <input value={form.title} onChange={(e) => set("title", e.target.value)}
          className={cls} placeholder="e.g. Warehouse Packer" autoFocus />
      </div>

      {/* Employer */}
      <div>
        <Label>Employer</Label>
        <select value={form.employer_id} onChange={(e) => set("employer_id", e.target.value)} className={cls}>
          <option value="">— Select Employer —</option>
          {employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <p className="text-xs text-slate-400 mt-1">
          Not listed? <a href="/employers/new" target="_blank" className="text-[#e88e2e] hover:underline">+ Add Employer</a>
        </p>
      </div>

      {/* Industry + Work Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Industry</Label>
          <input value={form.industry} onChange={(e) => set("industry", e.target.value)}
            className={cls} placeholder="e.g. Warehouse, Security" />
        </div>
        <div>
          <Label>Work Type</Label>
          <select value={form.work_type} onChange={(e) => set("work_type", e.target.value)} className={cls}>
            {WORK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Pay Rate */}
      <div>
        <Label>Pay Rate</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number" min={0} step="0.01"
              value={form.pay_rate}
              onChange={(e) => set("pay_rate", e.target.value)}
              className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]"
              placeholder="0.00"
            />
          </div>
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => set("pay_rate_type", "per_hour")}
              className={`px-3 py-2 text-xs font-medium transition ${form.pay_rate_type === "per_hour" ? "bg-[#e88e2e] text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >Per Hour</button>
            <button
              type="button"
              onClick={() => set("pay_rate_type", "annual")}
              className={`px-3 py-2 text-xs font-medium transition ${form.pay_rate_type === "annual" ? "bg-[#e88e2e] text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >Annual</button>
          </div>
        </div>
      </div>

      {/* No. of Positions + Work Location */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>No. of Positions</Label>
          <input type="number" min={1} value={form.positions_count}
            onChange={(e) => set("positions_count", Number(e.target.value))}
            className={cls} />
        </div>
        <div>
          <Label>Work Location</Label>
          <AuAddressAutocomplete
            value={form.work_location}
            onChange={(v) => set("work_location", v)}
            className={cls}
          />
          <p className="text-xs text-slate-400 mt-1">Start typing a suburb or city — Australian suggestions will appear</p>
        </div>
      </div>

      {/* Job Board URL */}
      <div>
        <Label>Job Board URL</Label>
        <input type="url" value={form.job_board_url}
          onChange={(e) => set("job_board_url", e.target.value)}
          className={cls} />
        <p className="text-xs text-slate-400 mt-1">Pre-filled with WorkVision job board URL</p>
      </div>
    </div>
  );
}

// ── Step 2: Description & Compliance ─────────────────────────────────────────
function StepDescriptionCompliance({ form, set }: {
  form: FormState;
  set: (k: keyof FormState, v: unknown) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Job Description */}
      <div>
        <Label>Job Description</Label>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
          rows={8} className={cls}
          placeholder="Describe the role, key responsibilities..." />
      </div>

      {/* Compliance grid */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Compliance & Requirements</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Police Check</Label>
            <YesNoSelect value={form.police_check} onChange={(v) => set("police_check", v)} options={YES_NO_NR} />
          </div>
          <div>
            <Label>Drug & Alcohol Test <span className="text-slate-400 font-normal">(Optional)</span></Label>
            <YesNoSelect value={form.drug_alcohol_test} onChange={(v) => set("drug_alcohol_test", v)} />
          </div>
          <div>
            <Label>WWC (Working With Children)</Label>
            <YesNoSelect value={form.wwc} onChange={(v) => set("wwc", v)} />
          </div>
          <div>
            <Label>Car Required</Label>
            <YesNoSelect value={form.car_required} onChange={(v) => set("car_required", v)} />
          </div>
          <div>
            <Label>Public Transport Accessible</Label>
            <YesNoSelect value={form.public_transport} onChange={(v) => set("public_transport", v)} />
          </div>
          <div>
            <Label>Wage Subsidy</Label>
            <YesNoSelect value={form.wage_subsidy_required} onChange={(v) => set("wage_subsidy_required", v)} />
          </div>
        </div>
      </div>

      {/* Comments */}
      <div>
        <Label>Comments</Label>
        <textarea value={form.comments} onChange={(e) => set("comments", e.target.value)}
          rows={3} className={cls} placeholder="Additional notes or comments..." />
      </div>
    </div>
  );
}

// ── Step 3: Candidate Assignment ──────────────────────────────────────────────
function StepCandidateAssignment({ form, set }: {
  form: FormState;
  set: (k: keyof FormState, v: unknown) => void;
}) {
  const [q, setQ] = useState("");

  const { data: candidatesResult } = useQuery({
    queryKey: ["candidates-search", q],
    queryFn: () => api.list<Candidate>(`/candidates?limit=20&search=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });
  const candidates = candidatesResult?.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Optionally assign a candidate to this vacancy and set key dates. You can also do this later.
      </p>

      {/* Candidate search */}
      <div>
        <Label>Candidate</Label>
        {form.candidate_id ? (
          <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
            <div>
              <p className="text-sm font-medium text-slate-900">{form.candidate_name}</p>
              <p className="text-xs text-slate-500">Candidate selected</p>
            </div>
            <button type="button" onClick={() => { set("candidate_id", ""); set("candidate_name", ""); }}
              className="text-xs text-red-500 hover:underline">Remove</button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              className={cls} placeholder="Search by name or email (min 2 chars)..."
            />
            {candidates.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 mt-1 max-h-48 overflow-y-auto">
                {candidates.map((c) => (
                  <button key={c.id} type="button"
                    onClick={() => { set("candidate_id", c.id); set("candidate_name", c.name); setQ(""); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-orange-50 flex items-center gap-3 border-b last:border-0"
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-100 text-[#e88e2e] text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1">
              Not listed? <a href="/candidates/new" target="_blank" className="text-[#e88e2e] hover:underline">+ Add Candidate</a>
            </p>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Interview Date</Label>
          <input type="date" value={form.interview_date}
            onChange={(e) => set("interview_date", e.target.value)} className={cls} />
        </div>
        <div>
          <Label>ETS Date</Label>
          <input type="date" value={form.ets_date}
            onChange={(e) => set("ets_date", e.target.value)} className={cls} />
        </div>
        <div>
          <Label>Placement Date</Label>
          <input type="date" value={form.placement_date}
            onChange={(e) => set("placement_date", e.target.value)} className={cls} />
        </div>
      </div>
      <p className="text-xs text-slate-400">ETS = Expected To Start</p>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────
export default function CreateJobDialog({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [step,  setStep]  = useState<Step>(0);
  const [form,  setForm]  = useState<FormState>(EMPTY);
  const [error, setError] = useState("");

  const { data: employersResult } = useQuery({
    queryKey: ["employers-select"],
    queryFn:  () => api.list<Employer>("/employers?limit=200"),
    enabled: isOpen,
  });
  const employers = employersResult?.data ?? [];

  const createJob = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<{ id: string }>("/jobs", body),
    onSuccess: async (data) => {
      // If candidate assigned, create application with dates
      if (form.candidate_id) {
        try {
          await api.post("/applications", {
            job_id:         data.id,
            candidate_id:   form.candidate_id,
            stage:          form.interview_date ? "interview" : "applied",
            interview_date: form.interview_date || undefined,
            ets_date:       form.ets_date       || undefined,
            placement_date: form.placement_date || undefined,
          });
        } catch { /* non-fatal */ }
      }
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      handleClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function set(key: keyof FormState, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleClose() { setStep(0); setForm(EMPTY); setError(""); onClose(); }

  function handleNext() {
    setError("");
    if (step === 0 && !form.title.trim()) { setError("Job title is required."); return; }
    setStep((s) => (s + 1) as Step);
  }

  function handleBack() { setError(""); setStep((s) => (s - 1) as Step); }

  function handleSubmit() {
    setError("");
    createJob.mutate({
      title:                 form.title.trim(),
      employer_id:           form.employer_id        || undefined,
      industry:              form.industry            || undefined,
      pay_rate:              form.pay_rate            ? Number(form.pay_rate) : undefined,
      pay_rate_type:         form.pay_rate_type,
      positions_count:       form.positions_count,
      vacancy_type:          form.work_type,
      work_location:         form.work_location       || undefined,
      job_board_url:         form.job_board_url       || undefined,
      description:           form.description         || undefined,
      police_check:          form.police_check,
      drug_alcohol_test:     form.drug_alcohol_test,
      wwc:                   form.wwc,
      car_required:          form.car_required,
      public_transport:      form.public_transport,
      wage_subsidy_required: form.wage_subsidy_required,
      comments:              form.comments            || undefined,
      status:                "draft",
    });
  }

  if (!isOpen) return null;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Add Vacancy</h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <StepIndicator current={step} />

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {step === 0 && <StepVacancyDetails form={form} set={set} employers={employers} />}
          {step === 1 && <StepDescriptionCompliance form={form} set={set} />}
          {step === 2 && <StepCandidateAssignment form={form} set={set} />}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
            <button type="button" onClick={step === 0 ? handleClose : handleBack}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              {step > 0 && <ChevronLeft size={15} />}
              {step === 0 ? "Cancel" : "Back"}
            </button>

            {isLast ? (
              <button type="button" onClick={handleSubmit} disabled={createJob.isPending}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-[#e88e2e] hover:bg-[#d07d20] text-white font-medium rounded-lg disabled:opacity-50">
                <Check size={15} />
                {createJob.isPending ? "Saving..." : "Save Vacancy"}
              </button>
            ) : (
              <button type="button" onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-[#e88e2e] hover:bg-[#d07d20] text-white font-medium rounded-lg">
                Next <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

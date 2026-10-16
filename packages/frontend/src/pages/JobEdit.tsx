import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, ExternalLink, MapPin } from "lucide-react";
import { api } from "../lib/api";
import type { Job, Employer } from "../types";

// ── Australian Address Autocomplete ──────────────────────────────────────────
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

function AuAddressAutocomplete({ value, onChange, className }: {
  value: string; onChange: (v: string) => void; className?: string;
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

  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q); onChange(q);
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
        setResults(data); setOpen(data.length > 0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
  }

  function select(item: Record<string, any>) {
    const label = fmtResult(item);
    setQuery(label); onChange(label); setResults([]); setOpen(false);
  }

  return (
    <div ref={wrap} className="relative">
      <input value={query} onChange={handleInput} onFocus={() => results.length > 0 && setOpen(true)}
        className={className} placeholder="e.g. Parramatta, NSW" autoComplete="off" />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-3 h-3 border-2 border-[#e88e2e] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto text-sm">
          {results.map((item, i) => (
            <li key={i} onMouseDown={() => select(item)}
              className="px-3 py-2 cursor-pointer hover:bg-orange-50 hover:text-[#e88e2e] flex items-center gap-2 transition-colors">
              <MapPin size={12} className="text-slate-300 shrink-0" />
              {fmtResult(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Job Board URL clickable link ──────────────────────────────────────────────
function JobBoardUrlField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const displayUrl = value || "https://workvision.com.au/current-vacancies/";

  if (editing) {
    return (
      <div className="flex gap-2 items-center">
        <input type="url" value={value} onChange={(e) => onChange(e.target.value)} autoFocus
          className="flex-1 border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]" />
        <button type="button" onClick={() => setEditing(false)}
          className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 border border-slate-200 rounded-lg">Done</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
      <ExternalLink size={16} className="text-[#e88e2e] shrink-0" />
      <a href={displayUrl} target="_blank" rel="noopener noreferrer"
        className="flex-1 text-sm text-[#e88e2e] font-medium hover:underline truncate">{displayUrl}</a>
      <button type="button" onClick={() => setEditing(true)}
        className="text-xs text-slate-400 hover:text-slate-600 shrink-0">Change</button>
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 mb-1">{children}</label>;
}

function YesNoSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options?: { value: string; label: string }[];
}) {
  const opts = options ?? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]">
      <option value="">Select</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const WORK_TYPES = [
  { value: "full_time",  label: "Full-time"  },
  { value: "part_time",  label: "Part-time"  },
  { value: "casual",     label: "Casual"     },
  { value: "contract",   label: "Contract"   },
  { value: "temporary",  label: "Temporary"  },
];

function normalizeVacancyType(v?: string | null): string {
  if (!v) return "";
  const s = v.toLowerCase().replace(/[\s-]/g, "_");
  if (["full_time", "part_time", "casual", "contract", "temporary"].includes(s)) {
    return s;
  }
  return v;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function JobEdit() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["job", id],
    queryFn:  () => api.get<Job>(`/jobs/${id}`),
  });

  const { data: employersResult } = useQuery({
    queryKey: ["employers-select"],
    queryFn:  () => api.list<Employer>("/employers?limit=100"),
  });
  const employers = employersResult?.data ?? [];

  const [form, setForm] = useState({
    title:                "",
    employer_id:          "",
    industry:             "",
    vacancy_type:         "",
    pay_rate:             "",
    pay_rate_type:        "per_hour",
    positions_count:      1,
    work_location:        "",
    job_board_url:        "",
    description:          "",
    police_check:         "not_required",
    drug_alcohol_test:    "no",
    wwc:                  "no",
    car_required:         "no",
    public_transport:     "no",
    wage_subsidy_required: "no",
    comments:             "",
  });

  useEffect(() => {
    if (!job) return;
    setForm({
      title:                job.title ?? "",
      employer_id:          job.employer_id ?? "",
      industry:             job.industry ?? "",
      vacancy_type:         normalizeVacancyType(job.vacancy_type),
      pay_rate:             job.pay_rate != null ? String(job.pay_rate) : "",
      pay_rate_type:        job.pay_rate_type ?? "per_hour",
      positions_count:      job.positions_count ?? 1,
      work_location:        job.work_location ?? "",
      job_board_url:        job.job_board_url ?? "",
      description:          job.description ?? "",
      police_check:         job.police_check ?? "not_required",
      drug_alcohol_test:    job.drug_alcohol_test ?? "no",
      wwc:                  job.wwc ?? "no",
      car_required:         job.car_required ?? "no",
      public_transport:     job.public_transport ?? "no",
      wage_subsidy_required: job.wage_subsidy_required ?? "no",
      comments:             job.comments ?? "",
    });
  }, [job]);

  const updateJob = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/jobs/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      navigate(`/jobs/${id}`);
    },
  });

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateJob.mutate({
      title:                 form.title.trim(),
      employer_id:           form.employer_id || null,
      industry:              form.industry.trim() || null,
      vacancy_type:          form.vacancy_type || null,
      pay_rate:              form.pay_rate && form.pay_rate.trim() !== "" ? form.pay_rate.trim() : null,
      pay_rate_type:         form.pay_rate_type || "per_hour",
      positions_count:       form.positions_count,
      work_location:         form.work_location.trim() || null,
      job_board_url:         form.job_board_url.trim() || null,
      description:           form.description.trim() || null,
      police_check:          form.police_check || "not_required",
      drug_alcohol_test:     form.drug_alcohol_test || "no",
      wwc:                   form.wwc || "no",
      car_required:          form.car_required || "no",
      public_transport:      form.public_transport || "no",
      wage_subsidy_required: form.wage_subsidy_required || "no",
      comments:              form.comments.trim() || null,
    });
  }

  if (isLoading) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!job)      return <p className="p-6 text-red-500">Vacancy not found.</p>;

  const cls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to={`/jobs/${id}`} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft size={15} /> Back to Vacancy
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Edit Vacancy</h1>
        <button
          type="submit"
          form="edit-vacancy-form"
          disabled={updateJob.isPending}
          className="flex items-center gap-2 bg-[#e88e2e] hover:bg-[#d07d20] text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <Save size={15} /> {updateJob.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <form id="edit-vacancy-form" onSubmit={handleSubmit} className="space-y-6">

        {/* ── Section 1: Vacancy Details ── */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">Vacancy Details</p>

          <div>
            <Label>Job Title *</Label>
            <input required value={form.title} onChange={(e) => set("title", e.target.value)}
              className={cls} placeholder="e.g. Warehouse Storeperson" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Employer</Label>
              <select value={form.employer_id} onChange={(e) => set("employer_id", e.target.value)} className={cls}>
                <option value="">No Employer</option>
                {employers.filter((e) => e.is_active !== false).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Industry</Label>
              <input value={form.industry} onChange={(e) => set("industry", e.target.value)}
                className={cls} placeholder="e.g. Healthcare, Logistics" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Work Type</Label>
              <select value={form.vacancy_type} onChange={(e) => set("vacancy_type", e.target.value)} className={cls}>
                <option value="">Select type</option>
                {WORK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>No. of Positions</Label>
              <input type="number" min={1} value={form.positions_count}
                onChange={(e) => set("positions_count", Number(e.target.value))} className={cls} />
            </div>
          </div>

          <div>
            <Label>Pay Rate</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                {form.pay_rate_type !== "award_wage" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                )}
                <input
                  type="text"
                  value={form.pay_rate}
                  onChange={(e) => set("pay_rate", e.target.value)}
                  className={`${cls} ${form.pay_rate_type === "award_wage" ? "pl-3" : "pl-7"}`}
                  placeholder={form.pay_rate_type === "award_wage" ? "e.g. Award Wage or Clerks Level 2" : "e.g. 33.50, 33-35"}
                />
              </div>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
                {(["per_hour", "annual", "award_wage"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => {
                    set("pay_rate_type", t);
                    if (t === "award_wage") {
                      if (!form.pay_rate.trim() || !isNaN(Number(form.pay_rate.trim()))) {
                        set("pay_rate", "Award Wage");
                      }
                    } else {
                      if (form.pay_rate.trim().toLowerCase().includes("award")) {
                        set("pay_rate", "");
                      }
                    }
                  }}
                    className={`px-3 py-2 font-medium transition-colors ${
                      form.pay_rate_type === t
                        ? "bg-[#e88e2e] text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}>
                    {t === "per_hour" ? "Per Hour" : t === "annual" ? "Annual" : "Award Wage"}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {form.pay_rate_type === "award_wage"
                ? "Specify modern award name, classification level, or leave as Award Wage"
                : "Accepts numeric amounts or ranges (e.g. 33.50 or 33-35)"}
            </p>
          </div>

          <div>
            <Label>Work Location</Label>
            <AuAddressAutocomplete value={form.work_location} onChange={(v) => set("work_location", v)} className={cls} />
            <p className="text-xs text-slate-400 mt-1">Start typing a suburb or city — Australian suggestions will appear</p>
          </div>

          <div>
            <Label>Job Board URL</Label>
            <JobBoardUrlField value={form.job_board_url} onChange={(v) => set("job_board_url", v)} />
          </div>
        </div>

        {/* ── Section 2: Description & Compliance ── */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">Description & Compliance</p>

          <div>
            <Label>Job Description</Label>
            <textarea rows={6} value={form.description} onChange={(e) => set("description", e.target.value)}
              className={cls} placeholder="Describe the role, responsibilities and requirements..." />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Police Check</Label>
              <YesNoSelect value={form.police_check} onChange={(v) => set("police_check", v)}
                options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not_required", label: "Not Required" }]} />
            </div>
            <div>
              <Label>Drug & Alcohol Test</Label>
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

          <div>
            <Label>Comments</Label>
            <textarea rows={3} value={form.comments} onChange={(e) => set("comments", e.target.value)}
              className={cls} placeholder="Any additional notes..." />
          </div>
        </div>

        {updateJob.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            Failed to save changes: {(updateJob.error as Error)?.message || "Please check your inputs and try again."}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to={`/jobs/${id}`}
            className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={updateJob.isPending}
            className="flex items-center gap-2 bg-[#e88e2e] hover:bg-[#d07d20] text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <Save size={15} /> {updateJob.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>

      </form>
    </div>
  );
}

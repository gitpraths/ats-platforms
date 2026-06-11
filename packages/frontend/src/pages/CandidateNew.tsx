import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import type { Candidate, Provider } from "../types";

interface CandidateForm {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  notes: string;
  provider_id: string;
  benchmark_hours: string;
  interested_job: string;
  wage_subsidy: boolean;
  wage_subsidy_amount: string;
}

const EMPTY: CandidateForm = {
  name: "", email: "", phone: "", city: "", state: "",
  notes: "", provider_id: "", benchmark_hours: "",
  interested_job: "", wage_subsidy: false, wage_subsidy_amount: "",
};

export default function CandidateNew() {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const [form, setForm] = useState<CandidateForm>(EMPTY);
  const [error, setError] = useState("");

  const { data: providersData } = useQuery({
    queryKey: ["providers-select"],
    queryFn: () => api.list<Provider>("/providers?limit=100"),
  });
  const providers = providersData?.data ?? [];

  const create = useMutation({
    mutationFn: () =>
      api.post<Candidate>("/candidates", {
        ...form,
        benchmark_hours:     form.benchmark_hours ? Number(form.benchmark_hours) : undefined,
        provider_id:         form.provider_id || undefined,
        wage_subsidy:        form.wage_subsidy,
        wage_subsidy_amount: form.wage_subsidy && form.wage_subsidy_amount ? Number(form.wage_subsidy_amount) : undefined,
      }),
    onSuccess: (candidate) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      navigate(`/candidates/${candidate.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    create.mutate();
  }

  function field(key: keyof CandidateForm) {
    return {
      value: form[key] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        to="/candidates"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition mb-4"
      >
        <ArrowLeft size={14} /> Back to Candidates
      </Link>

      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">Add Candidate</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Name + Email */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              {...field("name")}
              placeholder="Jane Smith"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              {...field("email")}
              placeholder="jane@example.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input
            {...field("phone")}
            placeholder="+1 555 000 0000"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* City + State */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input
              {...field("city")}
              placeholder="San Francisco"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State / Region</label>
            <input
              {...field("state")}
              placeholder="CA"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>



        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            {...field("notes")}
            rows={4}
            placeholder="Any relevant notes about this candidate..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Provider */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
          <select
            value={form.provider_id}
            onChange={(e) => setForm((f) => ({ ...f, provider_id: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No Provider</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Benchmark Hours + Interested Job */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Benchmark Hours / Week</label>
            <input
              type="number"
              min={1}
              max={168}
              value={form.benchmark_hours}
              onChange={(e) => setForm((f) => ({ ...f, benchmark_hours: e.target.value }))}
              placeholder="38"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Interested Job</label>
            <input
              value={form.interested_job}
              onChange={(e) => setForm((f) => ({ ...f, interested_job: e.target.value }))}
              placeholder="e.g. Warehouse Packer, Forklift Operator"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Wage Subsidy */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Wage Subsidy</label>
            <select
              value={form.wage_subsidy ? "yes" : "no"}
              onChange={(e) => setForm((f) => ({ ...f, wage_subsidy: e.target.value === "yes", wage_subsidy_amount: e.target.value === "no" ? "" : f.wage_subsidy_amount }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {form.wage_subsidy && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Wage Subsidy Amount ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.wage_subsidy_amount}
                onChange={(e) => setForm((f) => ({ ...f, wage_subsidy_amount: e.target.value }))}
                placeholder="e.g. 5000"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>



        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <Link
            to="/candidates"
            className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={create.isPending}
            className="px-5 py-2 text-sm bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20] disabled:opacity-50"
          >
            {create.isPending ? "Saving..." : "Add Candidate"}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Send, X, Users, CheckSquare, Square,
  Loader2, CheckCircle2, AlertTriangle, Edit3, Eye, RotateCcw, Search, Briefcase
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Job } from "../types";

interface Provider {
  id: string;
  name: string;
  contact_name?: string;
  email?: string;
  candidate_count?: number;
  is_active: boolean;
}

interface Props {
  jobs: Job[];
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BroadcastMultiModal({ jobs, onClose, onSuccess }: Props) {
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set());
  const [sent, setSent]                               = useState<{ count: number } | null>(null);
  const [errorMsg, setErrorMsg]                       = useState<string | null>(null);
  const [loading, setLoading]                         = useState(false);

  // Tabs: "customize" (draft multi-vacancy email) vs "select" (providers checklist)
  const [activeTab, setActiveTab]                     = useState<"customize" | "select">("customize");

  const initialSubject = `Multiple New Vacancies Alert (${jobs.length} Roles Available) — WorkVision`;
  const initialIntro   = `We are pleased to share ${jobs.length} new open vacancies currently available across our network. Please review the roles below and submit any suitable, job-ready candidates directly through the referral links or your WorkVision ATS portal.`;

  const [customSubject, setCustomSubject] = useState(initialSubject);
  const [customIntro, setCustomIntro]     = useState(initialIntro);
  const [customNote, setCustomNote]       = useState("");

  const resetToDraft = () => {
    setCustomSubject(initialSubject);
    setCustomIntro(initialIntro);
    setCustomNote("");
  };

  // Provider search filter
  const [providerSearch, setProviderSearch] = useState("");

  // Fetch all active providers
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["providers-for-multi-broadcast"],
    queryFn:  () => api.list<Provider>("/providers?limit=200"),
  });

  const providers = (data?.data ?? []).filter((p) => p.is_active && p.email);
  const noEmail   = (data?.data ?? []).filter((p) => p.is_active && !p.email);

  const filteredProviders = providers.filter((p) => {
    if (!providerSearch.trim()) return true;
    const query = providerSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(query) ||
      p.email?.toLowerCase().includes(query) ||
      p.contact_name?.toLowerCase().includes(query)
    );
  });

  const allFilteredSelected = filteredProviders.length > 0 && filteredProviders.every((p) => selectedProviderIds.has(p.id));
  const someFilteredSelected = filteredProviders.some((p) => selectedProviderIds.has(p.id));

  const toggleAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedProviderIds((prev) => {
        const next = new Set(prev);
        filteredProviders.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedProviderIds((prev) => {
        const next = new Set(prev);
        filteredProviders.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }, [allFilteredSelected, filteredProviders]);

  const toggleOne = useCallback((id: string) => {
    setSelectedProviderIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSend = async () => {
    setErrorMsg(null);
    const pIds = Array.from(selectedProviderIds);
    if (pIds.length === 0) return;

    try {
      await api.post<{ sent: number; jobs_count: number; queued?: boolean; message?: string }>(
        "/jobs/broadcast-multi",
        {
          job_ids:        jobs.map((j) => j.id),
          provider_ids:   pIds,
          custom_subject: customSubject.trim(),
          custom_intro:   customIntro.trim(),
          custom_message: customNote.trim(),
        }
      );
      setSent({ count: pIds.length });
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.";
      setErrorMsg(msg);
    }
  };

  const handleClick = async () => {
    setLoading(true);
    await handleSend();
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && !sent && !loading && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#0f172a]/10 rounded-lg flex items-center justify-center">
              <Send size={18} className="text-[#0f172a]" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">Broadcast Selected Vacancies</p>
              <p className="text-xs text-slate-500 font-medium">
                {jobs.length} Vacanc{jobs.length !== 1 ? "ies" : "y"} selected for this email digest
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* ── SUCCESS SCREEN ── */}
        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-5">
            <div className="w-20 h-20 bg-green-50 border-4 border-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={40} className="text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 mb-2">Digest Broadcast Sent! ✅</p>
              <p className="text-base text-slate-600">
                A single consolidated email with <strong className="text-slate-900">{jobs.length} vacancies</strong> has been sent to{" "}
                <span className="font-bold text-[#0f172a]">{sent.count}</span>{" "}
                provider{sent.count !== 1 ? "s" : ""}.
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Providers will receive the multi-vacancy alert shortly.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-3 bg-[#0f172a] text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* ── ERROR BANNER ── */}
            {errorMsg && (
              <div className="mx-6 mt-4 flex items-start gap-3 p-4 bg-red-50 border-2 border-red-300 rounded-xl">
                <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-700 mb-0.5">Failed to send broadcast</p>
                  <p className="text-xs text-red-600">{errorMsg}</p>
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* ── Load error ── */}
            {loadError && (
              <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                ⚠️ Could not load providers. Check your connection and try again.
              </div>
            )}

            {/* Tab navigation */}
            <div className="flex border-b border-slate-200 px-6 pt-3 gap-6 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setActiveTab("customize")}
                className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === "customize"
                    ? "border-[#0f172a] text-[#0f172a]"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                <Edit3 size={14} /> 1. Review & Customize Email
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("select")}
                className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === "select"
                    ? "border-[#0f172a] text-[#0f172a]"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                <Users size={14} /> 2. Select Providers ({selectedProviderIds.size})
              </button>
            </div>

            {/* Tab Content 1: Draft Email Content */}
            {activeTab === "customize" && (
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-[340px]">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Consolidated Email Digest</p>
                    <p className="text-[11px] text-slate-400">All {jobs.length} selected vacancies will be sent together in one clean email</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetToDraft}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-slate-100 transition"
                  >
                    <RotateCcw size={12} /> Reset to Default
                  </button>
                </div>

                {/* Selected Vacancies Pills */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Selected Vacancies ({jobs.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {jobs.map((j, i) => (
                      <span key={j.id} className="text-xs bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5">
                        <span className="w-4 h-4 bg-slate-800 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                          {i + 1}
                        </span>
                        {j.title}
                        {j.work_location || j.city ? <span className="text-slate-400">({j.work_location || j.city})</span> : null}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Subject Line */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Enter email subject line..."
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                  />
                </div>

                {/* Recruiter Note */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Recruiter Note / Urgent Message <span className="font-normal text-slate-400 lowercase">(optional)</span>
                    </label>
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Highlighted Banner
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Urgent immediate starts across multiple roles! Please review and submit top profiles by end of week."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition resize-y"
                  />
                </div>

                {/* Email Intro Message */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Introductory Message (Email Greeting)
                  </label>
                  <textarea
                    rows={3}
                    value={customIntro}
                    onChange={(e) => setCustomIntro(e.target.value)}
                    placeholder="Provide introduction message to training providers..."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition resize-y text-xs"
                  />
                </div>

                {/* Preview Summary */}
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 pb-1.5 border-b border-slate-200">
                    <Eye size={13} className="text-slate-500" /> Digest Email Preview Summary
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-slate-700">
                    <p className="font-semibold text-slate-900">
                      Subject: <span className="font-normal text-slate-600">{customSubject}</span>
                    </p>
                    {customNote.trim() && (
                      <div className="bg-amber-50 border-l-4 border-amber-400 p-2.5 rounded text-amber-900 text-xs">
                        <strong className="block text-[11px] uppercase tracking-wider text-amber-800">💬 Note from Recruiter:</strong>
                        <span className="whitespace-pre-wrap">{customNote.trim()}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 divide-y divide-slate-100 pt-1">
                      {jobs.map((j, i) => (
                        <div key={j.id} className="py-1 flex items-center justify-between">
                          <span className="font-medium text-slate-800">#{i + 1} {j.title}</span>
                          <span className="text-[#e88e2e] font-semibold">{j.pay_rate ? `$${j.pay_rate}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content 2: Providers List */}
            {activeTab === "select" && (
              <div className="flex-1 overflow-y-auto px-6 py-3 min-h-[340px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                    <Loader2 size={24} className="animate-spin text-slate-400" />
                    <span className="text-sm">Loading provider list...</span>
                  </div>
                ) : (
                  <>
                    {/* Search Input for Providers */}
                    <div className="relative mb-3">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        placeholder="Search providers by name, contact, or email..."
                        className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                      />
                      {providerSearch && (
                        <button
                          type="button"
                          onClick={() => setProviderSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          title="Clear search"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Select All row */}
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs text-slate-600 mb-1">
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="flex items-center gap-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                      >
                        {allFilteredSelected
                          ? <CheckSquare size={16} className="text-[#e88e2e]" />
                          : someFilteredSelected
                            ? <CheckSquare size={16} className="text-slate-300" />
                            : <Square size={16} className="text-slate-300" />
                        }
                        {allFilteredSelected ? "Deselect All" : "Select All"}
                      </button>
                      <span className="text-[11px] text-slate-400">
                        Showing {filteredProviders.length} of {providers.length}
                      </span>
                    </div>

                    {filteredProviders.length === 0 && (
                      <div className="text-center py-10 text-slate-400">
                        <Search size={22} className="mx-auto mb-1.5 opacity-30" />
                        <p className="text-xs">No providers matching "{providerSearch}"</p>
                        <button
                          type="button"
                          onClick={() => setProviderSearch("")}
                          className="text-xs text-blue-600 hover:underline mt-1 font-medium"
                        >
                          Clear search
                        </button>
                      </div>
                    )}

                    <div className="divide-y divide-slate-50">
                      {filteredProviders.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleOne(p.id)}
                          className="w-full flex items-center gap-3 py-2.5 hover:bg-slate-50 rounded-lg transition-colors text-left px-2"
                        >
                          {selectedProviderIds.has(p.id)
                            ? <CheckSquare size={16} className="text-[#e88e2e] flex-shrink-0" />
                            : <Square size={16} className="text-slate-300 flex-shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                            <p className="text-xs text-slate-400 truncate">
                              {p.contact_name ? `${p.contact_name} · ` : ""}{p.email}
                            </p>
                          </div>
                          {(p.candidate_count ?? 0) > 0 && (
                            <span className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              <Users size={11} /> {p.candidate_count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {noEmail.length > 0 && !providerSearch && (
                      <p className="text-xs text-slate-400 mt-4 px-1 italic">
                        {noEmail.length} provider{noEmail.length !== 1 ? "s" : ""} hidden — missing email addresses.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-800">{selectedProviderIds.size}</span> of {providers.length} providers selected
                {activeTab === "customize" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("select")}
                    className="ml-2 text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    Select recipients ({selectedProviderIds.size}) &rarr;
                  </button>
                )}
                {activeTab === "select" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("customize")}
                    className="ml-2 text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    &larr; Back to email draft
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedProviderIds.size === 0 || loading}
                  onClick={handleClick}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0f172a] hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-colors min-w-[180px] justify-center"
                >
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" /> Broadcasting...</>
                    : <><Send size={14} /> Broadcast {jobs.length} Roles to {selectedProviderIds.size || ""} Provider{selectedProviderIds.size !== 1 ? "s" : ""}</>
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

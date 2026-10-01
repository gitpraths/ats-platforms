import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Send, X, Users, CheckSquare, Square,
  Loader2, CheckCircle2, AlertTriangle, Edit3, Eye, FileText
} from "lucide-react";
import { api, ApiError } from "../lib/api";

interface Provider {
  id: string;
  name: string;
  contact_name?: string;
  email?: string;
  candidate_count?: number;
  is_active: boolean;
}

interface BroadcastResult {
  provider_id: string;
  name: string;
  email: string;
  status: "sent" | "failed";
  error?: string;
}

interface Props {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
}

export default function BroadcastToProvidersModal({ jobId, jobTitle, onClose }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sent, setSent]               = useState<{ count: number } | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  // Tabs: "select" (providers list) vs "customize" (custom subject & note/body)
  const [activeTab, setActiveTab]     = useState<"select" | "customize">("select");

  // Editable email content fields
  const [customSubject, setCustomSubject] = useState(`New Vacancy Alert: ${jobTitle}`);
  const [customNote, setCustomNote]       = useState("");

  // Fetch all active providers
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["providers-for-broadcast"],
    queryFn:  () => api.list<Provider>("/providers?limit=200"),
  });

  const providers = (data?.data ?? []).filter((p) => p.is_active && p.email);
  const noEmail   = (data?.data ?? []).filter((p) => p.is_active && !p.email);

  const allSelected  = providers.length > 0 && providers.every((p) => selectedIds.has(p.id));
  const someSelected = providers.some((p) => selectedIds.has(p.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(providers.map((p) => p.id)));
    }
  }, [allSelected, providers]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSend = async () => {
    setErrorMsg(null);
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      await api.post<{ sent: number; failed: number; queued?: boolean; results?: BroadcastResult[] }>(
        `/jobs/${jobId}/broadcast`,
        {
          provider_ids: ids,
          custom_subject: customSubject.trim(),
          custom_message: customNote.trim(),
        }
      );
      setSent({ count: ids.length });
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#0f172a]/10 rounded-lg flex items-center justify-center">
              <Send size={18} className="text-[#0f172a]" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">Broadcast Vacancy to Providers</p>
              <p className="text-xs text-slate-400 truncate max-w-[320px]">{jobTitle}</p>
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
              <p className="text-2xl font-bold text-slate-900 mb-2">Broadcast Sent! ✅</p>
              <p className="text-base text-slate-600">
                Emails have been queued for{" "}
                <span className="font-bold text-[#0f172a]">{sent.count}</span>{" "}
                provider{sent.count !== 1 ? "s" : ""}.
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Providers will receive your customized alert in their inbox shortly.
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
                onClick={() => setActiveTab("select")}
                className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === "select"
                    ? "border-[#0f172a] text-[#0f172a]"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                <Users size={14} /> 1. Select Providers ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("customize")}
                className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === "customize"
                    ? "border-[#0f172a] text-[#0f172a]"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                <Edit3 size={14} /> 2. Customize Content {customNote.trim() && "•"}
              </button>
            </div>

            {/* Tab Content 1: Providers list */}
            {activeTab === "select" && (
              <div className="flex-1 overflow-y-auto px-6 py-3 min-h-[300px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                    <Loader2 size={24} className="animate-spin text-slate-400" />
                    <span className="text-sm">Loading provider list...</span>
                  </div>
                ) : (
                  <>
                    {/* Select All row */}
                    <button
                      onClick={toggleAll}
                      className="w-full flex items-center gap-3 py-2.5 border-b border-slate-100 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors mb-1"
                    >
                      {allSelected
                        ? <CheckSquare size={16} className="text-[#e88e2e]" />
                        : someSelected
                          ? <CheckSquare size={16} className="text-slate-300" />
                          : <Square size={16} className="text-slate-300" />
                      }
                      {allSelected ? "Deselect All" : "Select All"} ({providers.length} active providers)
                    </button>

                    {providers.length === 0 && !isLoading && (
                      <p className="text-center text-sm text-slate-400 py-12">
                        No active providers with email addresses configured.
                      </p>
                    )}

                    <div className="divide-y divide-slate-50">
                      {providers.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => toggleOne(p.id)}
                          className="w-full flex items-center gap-3 py-3 hover:bg-slate-50 rounded-lg transition-colors text-left px-2"
                        >
                          {selectedIds.has(p.id)
                            ? <CheckSquare size={16} className="text-[#e88e2e] flex-shrink-0" />
                            : <Square size={16} className="text-slate-300 flex-shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                            <p className="text-xs text-slate-400 truncate">{p.email}</p>
                          </div>
                          {(p.candidate_count ?? 0) > 0 && (
                            <span className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              <Users size={11} /> {p.candidate_count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {noEmail.length > 0 && (
                      <p className="text-xs text-slate-400 mt-4 px-1 italic">
                        {noEmail.length} provider{noEmail.length !== 1 ? "s" : ""} hidden — missing email addresses.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tab Content 2: Customize Email */}
            {activeTab === "customize" && (
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-[300px]">
                {/* Subject Line */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Enter email subject line..."
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition"
                  />
                </div>

                {/* Custom Note/Message */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Message / Special Note for Providers <span className="font-normal text-slate-400 lowercase">(optional)</span>
                    </label>
                    <span className="text-[11px] text-slate-400">Highlighted in email</span>
                  </div>
                  <textarea
                    rows={4}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Urgent requirement for immediate start! Please send resumes by Friday 5 PM. Forklift tickets essential..."
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition resize-y"
                  />
                </div>

                {/* Email Body Preview Card */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 text-xs space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 pb-2 border-b border-slate-200">
                    <Eye size={13} className="text-slate-500" /> Live Preview of Email Structure
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-slate-600">
                    <p className="font-semibold text-slate-800">
                      Subject: <span className="font-normal text-slate-600">{customSubject || `New Vacancy Alert: ${jobTitle}`}</span>
                    </p>
                    {customNote.trim() && (
                      <div className="bg-amber-50 border-l-4 border-amber-400 p-2.5 rounded text-amber-900 text-xs">
                        <strong className="block text-[11px] uppercase tracking-wider text-amber-800">💬 Note from Recruiter:</strong>
                        <span className="whitespace-pre-wrap">{customNote.trim()}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                      <p>✓ Job Details (Title, Employer, Pay, Location, Industry)</p>
                      <p>✓ Compliance badges (Police Check, WWC, etc.)</p>
                      <p>✓ Complete Job Description</p>
                      <p className="text-orange-600 font-medium">✓ [ Refer a Candidate for this Role → ] button</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-800">{selectedIds.size}</span> of {providers.length} providers selected
                {activeTab === "select" && selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("customize")}
                    className="ml-2 text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    Edit email content &rarr;
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
                  disabled={selectedIds.size === 0 || loading}
                  onClick={handleClick}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0f172a] hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-colors min-w-[160px] justify-center"
                >
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" /> Sending...</>
                    : <><Send size={14} /> Send to {selectedIds.size || ""} Provider{selectedIds.size !== 1 ? "s" : ""}</>
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

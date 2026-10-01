import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Send, X, Users, CheckSquare, Square,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertTriangle,
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
  const [showPreview, setShowPreview] = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

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
        { provider_ids: ids }
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

  const [loading, setLoading] = useState(false);

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#0f172a]/10 rounded-lg flex items-center justify-center">
              <Send size={18} className="text-[#0f172a]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Broadcast to Providers</p>
              <p className="text-xs text-slate-400 truncate max-w-[280px]">{jobTitle}</p>
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
                Providers will receive the vacancy alert in their inbox shortly.
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
            {/* ── ERROR BANNER (very visible) ── */}
            {errorMsg && (
              <div className="mx-4 mt-4 flex items-start gap-3 p-4 bg-red-50 border-2 border-red-300 rounded-xl">
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
              <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                ⚠️ Could not load providers. Check your connection and try again.
              </div>
            )}

            {/* Email Preview Toggle */}
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="mx-6 mt-4 mb-1 flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <span>📧 Email Preview</span>
              {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showPreview && (
              <div className="mx-6 mb-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1.5">
                <p><span className="font-bold text-slate-800">Subject:</span> New Vacancy Alert: {jobTitle}</p>
                <p><span className="font-bold text-slate-800">Email includes:</span></p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-slate-500">
                  <li>Job title, employer, location, pay rate</li>
                  <li>Compliance tags (Police Check, WWC, Wage Subsidy…)</li>
                  <li>Role description</li>
                  <li>Orange <strong>"Refer a Candidate"</strong> button</li>
                </ul>
              </div>
            )}

            {/* Provider list */}
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                  <span className="ml-2 text-sm text-slate-400">Loading providers...</span>
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
                    {allSelected ? "Deselect All" : "Select All"} ({providers.length} providers)
                  </button>

                  {providers.length === 0 && !isLoading && (
                    <p className="text-center text-sm text-slate-400 py-8">
                      No active providers with email addresses found.
                    </p>
                  )}

                  <div className="divide-y divide-slate-50">
                    {providers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => toggleOne(p.id)}
                        className="w-full flex items-center gap-3 py-3 hover:bg-slate-50 rounded-lg transition-colors text-left px-1"
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
                          <span className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-400">
                            <Users size={11} /> {p.candidate_count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {noEmail.length > 0 && (
                    <p className="text-xs text-slate-400 mt-3 px-1">
                      {noEmail.length} provider{noEmail.length !== 1 ? "s" : ""} hidden — no email configured.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                {selectedIds.size} of {providers.length} selected
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
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

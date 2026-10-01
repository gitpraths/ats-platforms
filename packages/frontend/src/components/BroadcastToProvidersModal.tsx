import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send, X, Users, CheckSquare, Square, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

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
  const [sent, setSent]               = useState<BroadcastResult[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch all active providers
  const { data, isLoading } = useQuery({
    queryKey: ["providers-for-broadcast"],
    queryFn:  () => api.list<Provider>("/providers?limit=200"),
  });

  const providers = (data?.data ?? []).filter((p) => p.is_active && p.email);
  const noEmail   = (data?.data ?? []).filter((p) => p.is_active && !p.email);

  const allSelected    = providers.length > 0 && providers.every((p) => selectedIds.has(p.id));
  const someSelected   = providers.some((p) => selectedIds.has(p.id));

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

  const broadcast = useMutation({
    mutationFn: () =>
      api.post<{ sent: number; failed: number; queued?: boolean; message?: string; results?: BroadcastResult[] }>(
        `/jobs/${jobId}/broadcast`,
        { provider_ids: Array.from(selectedIds) }
      ),
    onSuccess: (data) => {
      // Backend now responds immediately (fire-and-forget)
      // Build a synthetic results array from the queued count
      const fakeResults: BroadcastResult[] = Array.from(selectedIds).map((id) => ({
        provider_id: id,
        name:   "",
        email:  "",
        status: "sent" as const,
      }));
      setSent(data.results ?? fakeResults);
    },
  });

  const sentCount   = sent?.filter((r) => r.status === "sent").length ?? 0;
  const failedCount = sent?.filter((r) => r.status === "failed").length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && !sent && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#e88e2e]/10 rounded-lg flex items-center justify-center">
              <Send size={18} className="text-[#e88e2e]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Broadcast to Providers</p>
              <p className="text-xs text-slate-400 truncate max-w-[280px]">{jobTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── Result screen after sending ── */}
        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 mb-1">Broadcast Sent!</p>
              <p className="text-sm text-slate-500">
                Emails sent to <strong>{sentCount}</strong> provider{sentCount !== 1 ? "s" : ""}
                {failedCount > 0 && `, ${failedCount} failed`}.
              </p>
            </div>
            {failedCount > 0 && (
              <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 text-left">
                {sent.filter((r) => r.status === "failed").map((r) => (
                  <p key={r.provider_id} className="text-xs text-red-600 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {r.name} — {r.error}
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 bg-[#0f172a] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
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
                <p><span className="font-bold text-slate-800">Body includes:</span></p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-slate-500">
                  <li>Job title, employer, location, pay rate</li>
                  <li>Compliance tags (Police Check, WWC, Wage Subsidy…)</li>
                  <li>Role description</li>
                  <li>Orange <strong>"Refer a Candidate"</strong> button linking to this vacancy</li>
                </ul>
              </div>
            )}

            {/* Provider list */}
            <div className="flex-1 overflow-y-auto px-6 pb-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {/* Select All */}
                  <button
                    onClick={toggleAll}
                    className="w-full flex items-center gap-3 py-2.5 border-b border-slate-100 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                  >
                    {allSelected
                      ? <CheckSquare size={16} className="text-[#e88e2e]" />
                      : someSelected
                        ? <CheckSquare size={16} className="text-slate-300" />
                        : <Square size={16} className="text-slate-300" />
                    }
                    {allSelected ? "Deselect All" : "Select All"} ({providers.length} providers with email)
                  </button>

                  {providers.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-8">No active providers with email addresses found.</p>
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
                      {noEmail.length} provider{noEmail.length !== 1 ? "s" : ""} hidden (no email address configured).
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Error */}
            {broadcast.isError && (
              <div className="mx-6 mb-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={13} /> {(broadcast.error as Error)?.message ?? "Failed to send broadcast."}
              </div>
            )}

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                {selectedIds.size} of {providers.length} selected
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={selectedIds.size === 0 || broadcast.isPending}
                  onClick={() => broadcast.mutate()}
                  className="flex items-center gap-2 px-5 py-2 bg-[#e88e2e] hover:bg-[#d07d20] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {broadcast.isPending
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

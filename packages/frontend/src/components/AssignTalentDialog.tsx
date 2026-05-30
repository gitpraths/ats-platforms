import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Search } from "lucide-react";
import { api } from "../lib/api";
import { displayEmail } from "../lib/utils";
import type { Candidate } from "../types";

interface Props {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignTalentDialog({ jobId, isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [q, setQ]                         = useState("");
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [error, setError]                 = useState("");

  const { data: candidates = [], isFetching } = useQuery<Candidate[]>({
    queryKey: ["candidates-search", q],
    queryFn:  () => api.get<Candidate[]>(`/candidates?q=${encodeURIComponent(q)}&limit=20`),
    enabled:  isOpen,
  });

  const assign = useMutation({
    mutationFn: () =>
      api.post("/applications", { job_id: jobId, candidate_id: selectedId, source: "manual_assignment" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      handleClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleClose() {
    setQ(""); setSelectedId(null); setError("");
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Assign Talent</h2>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Search */}
        <div className="p-4 border-b flex-shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSelectedId(null); }}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Candidate List */}
        <div className="overflow-y-auto flex-1 p-2">
          {isFetching && <p className="text-center text-sm text-gray-400 py-4">Searching...</p>}
          {!isFetching && candidates.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-4">No candidates found.</p>
          )}
          {candidates.map((c) => (
            <label
              key={c.id}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${
                selectedId === c.id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <input
                type="radio"
                name="candidate"
                value={c.id}
                checked={selectedId === c.id}
                onChange={() => setSelectedId(c.id)}
                className="accent-blue-600"
              />
              {/* Avatar initials */}
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500 truncate">{displayEmail(c.email)}</p>
                {(c.city || c.state) && (
                  <p className="text-xs text-gray-400">{[c.city, c.state].filter(Boolean).join(", ")}</p>
                )}
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        {error && <p className="px-5 pb-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 p-5 border-t flex-shrink-0">
          <button onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            disabled={!selectedId || assign.isPending}
            onClick={() => assign.mutate()}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {assign.isPending ? "Assigning..." : "Assign Candidate"}
          </button>
        </div>
      </div>
    </div>
  );
}

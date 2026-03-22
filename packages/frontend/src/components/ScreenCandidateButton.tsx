import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BrainCircuit, X } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  candidateNotes: string;
  jobTitle: string;
  jobDescription?: string;
}

interface ScreenResult {
  summary: string;
  score: number | null;
}

export default function ScreenCandidateButton({ candidateNotes, jobTitle, jobDescription }: Props) {
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [open, setOpen]     = useState(false);

  const screen = useMutation({
    mutationFn: () =>
      api.post<ScreenResult>("/ai/screen-candidate", {
        candidate_notes: candidateNotes || "No notes available.",
        job_title:       jobTitle       || "Unspecified Role",
        job_description: jobDescription || "",
      }),
    onSuccess: (data) => { setResult(data); setOpen(true); },
  });

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={screen.isPending}
        onClick={() => screen.mutate()}
        className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 border border-violet-200 rounded-lg px-2.5 py-1.5 hover:bg-violet-50 disabled:opacity-40 transition"
        title="AI screen this candidate"
      >
        <BrainCircuit size={13} />
        {screen.isPending ? "Screening..." : "AI Screen"}
      </button>

      {screen.isError && (
        <p className="absolute right-0 top-9 z-30 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 whitespace-nowrap">
          {(screen.error as Error).message}
        </p>
      )}

      {open && result && (
        <div className="absolute right-0 top-9 z-30 bg-white border rounded-xl shadow-xl w-72 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-violet-700 flex items-center gap-1">
              <BrainCircuit size={12} /> AI Screening Result
            </p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>

          {result.score != null && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-gray-900">Fit Score:</span>
              <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                result.score >= 7 ? "bg-green-100 text-green-700" :
                result.score >= 4 ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-600"
              }`}>
                {result.score}/10
              </span>
            </div>
          )}

          <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
        </div>
      )}
    </div>
  );
}

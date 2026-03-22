import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  currentTitle: string;
  skills: string[];
  description: string;
  onSelect: (title: string) => void;
}

export default function AISuggestTitles({ currentTitle, skills, description, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  const suggest = useMutation({
    mutationFn: () =>
      api.post<{ titles: string[] }>("/ai/job-titles", {
        job_title:       currentTitle.trim(),
        skills_required: skills,
        job_desc:        description,
      }),
    onSuccess: () => setOpen(true),
  });

  const titles: string[] = suggest.data?.titles ?? [];
  const disabled = !currentTitle.trim() || suggest.isPending;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => suggest.mutate()}
        className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 border border-purple-200 rounded-lg px-2.5 py-1.5 hover:bg-purple-50 disabled:opacity-40 transition"
      >
        <Sparkles size={12} />
        {suggest.isPending ? "Thinking..." : "Suggest Titles"}
      </button>

      {suggest.isError && (
        <p className="absolute left-0 top-9 z-20 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 whitespace-nowrap">
          {(suggest.error as Error).message}
        </p>
      )}

      {open && titles.length > 0 && (
        <div className="absolute left-0 top-9 z-20 bg-white border rounded-xl shadow-lg w-64 py-1">
          <div className="flex items-center justify-between px-3 py-1.5 border-b">
            <p className="text-xs text-gray-500 font-medium">AI Suggestions</p>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          </div>
          {titles.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { onSelect(t); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 hover:text-purple-700"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

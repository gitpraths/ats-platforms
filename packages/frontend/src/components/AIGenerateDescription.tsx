import { useMutation } from "@tanstack/react-query";
import { Wand2 } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  jobTitle: string;
  requiredSkills: string[];
  desiredSkills: string[];
  currentDesc: string;
  department?: string;
  onGenerated: (desc: string) => void;
}

export default function AIGenerateDescription({
  jobTitle, requiredSkills, desiredSkills, currentDesc, department, onGenerated,
}: Props) {
  const generate = useMutation({
    mutationFn: () =>
      api.post<{ description: string }>("/ai/job-description", {
        title:           jobTitle.trim(),
        department:      department || "General",
        required_skills: requiredSkills,
        desired_skills:  desiredSkills,
        job_desc:        currentDesc,
      }),
    onSuccess: (data) => onGenerated(data.description),
  });

  const disabled = !jobTitle.trim() || generate.isPending;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => generate.mutate()}
        className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 disabled:opacity-40 transition"
        title={!jobTitle.trim() ? "Enter a job title first" : "Generate description with AI"}
      >
        <Wand2 size={12} />
        {generate.isPending ? "Generating..." : "Generate with AI"}
      </button>

      {generate.isError && (
        <p className="absolute right-0 top-9 z-20 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 whitespace-nowrap">
          {(generate.error as Error).message}
        </p>
      )}
    </div>
  );
}

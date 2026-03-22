import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

interface SuggestTitlesParams {
  job_title: string;
  skills_required?: string[];
  job_desc?: string;
}

export function useJobTitleSuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: (params: SuggestTitlesParams) =>
      api.post<{ titles: string[] }>("/ai/job-titles", params),
    onSuccess: (data) => setSuggestions(data.titles ?? []),
  });

  function reset() {
    setSuggestions([]);
  }

  return {
    suggestions,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
    suggest: mutation.mutate,
    reset,
  };
}

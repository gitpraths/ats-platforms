import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

interface GenerateDescParams {
  title: string;
  department?: string;
  required_skills?: string[];
  desired_skills?: string[];
  job_desc?: string;
}

export function useJobDescriptionSuggestion() {
  const [description, setDescription] = useState<string>("");

  const mutation = useMutation({
    mutationFn: (params: GenerateDescParams) =>
      api.post<{ description: string }>("/ai/job-description", params),
    onSuccess: (data) => setDescription(data.description ?? ""),
  });

  function reset() {
    setDescription("");
  }

  return {
    description,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
    generate: mutation.mutate,
    reset,
  };
}

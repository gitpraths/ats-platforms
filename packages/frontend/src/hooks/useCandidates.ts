import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Candidate } from "../types";

interface UseCandidatesOptions {
  q?: string;
  page?: number;
  limit?: number;
}

export function useCandidates(options: UseCandidatesOptions = {}) {
  const { q = "", page = 1, limit = 20 } = options;

  return useQuery<Candidate[]>({
    queryKey: ["candidates", { q, page, limit }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("page", String(page));
      params.set("limit", String(limit));
      return api.get<Candidate[]>(`/candidates?${params.toString()}`);
    },
  });
}

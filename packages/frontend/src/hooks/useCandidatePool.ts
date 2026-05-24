import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CandidatePoolRow, CandidatePoolMeta } from "../types";

interface UseCandidatePoolOptions {
  tab?: string;
  page?: number;
  limit?: number;
  q?: string;
}

export function useCandidatePool(options: UseCandidatePoolOptions = {}) {
  const { tab = "all", page = 1, limit = 20, q = "" } = options;

  return useQuery<{ data: CandidatePoolRow[]; meta: CandidatePoolMeta }>({
    queryKey: ["candidate-pool", { tab, page, q }],
    queryFn: async () => {
      const params = new URLSearchParams({
        tab,
        page: String(page),
        limit: String(limit),
      });
      if (q) params.set("q", q);
      const result = await api.list<CandidatePoolRow>(`/candidate-pool?${params}`);
      return result as { data: CandidatePoolRow[]; meta: CandidatePoolMeta };
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CandidatePoolRow, CandidatePoolMeta } from "../types";

interface UseCandidatePoolOptions {
  tab?:             string;
  page?:            number;
  limit?:           number;
  q?:               string;
  date_from?:       string;
  interview_from?:  string;
  interview_to?:    string;
}

export function useCandidatePool(options: UseCandidatePoolOptions = {}) {
  const { tab = "all", page = 1, limit = 20, q = "", date_from, interview_from, interview_to } = options;

  return useQuery<{ data: CandidatePoolRow[]; meta: CandidatePoolMeta }>({
    queryKey: ["candidate-pool", { tab, page, q, date_from, interview_from, interview_to }],
    queryFn: async () => {
      const params = new URLSearchParams({
        tab,
        page:  String(page),
        limit: String(limit),
      });
      if (q)              params.set("q",              q);
      if (date_from)      params.set("date_from",      date_from);
      if (interview_from) params.set("interview_from", interview_from);
      if (interview_to)   params.set("interview_to",   interview_to);
      const result = await api.list<CandidatePoolRow>(`/candidate-pool?${params}`);
      return result as { data: CandidatePoolRow[]; meta: CandidatePoolMeta };
    },
  });
}

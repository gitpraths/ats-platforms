import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CandidatePoolRow, CandidatePoolMeta } from "../types";

export interface UseCandidatePoolOptions {
  tab?:             string;
  page?:            number;
  limit?:           number;
  q?:               string;
  date_from?:       string;
  // Per-column text filters
  name_q?:          string;
  email_q?:         string;
  phone_q?:         string;
  provider_q?:      string;
  comments_q?:      string;
  // Per-column date filters
  referral_date?:   string;
  training_date?:   string;
  interview_date?:  string;
  ets_date?:        string;
  placement_date?:  string;
}

export function useCandidatePool(options: UseCandidatePoolOptions = {}) {
  const {
    tab = "all", page = 1, limit = 20,
    q = "", date_from = "",
    name_q = "", email_q = "", phone_q = "", provider_q = "", comments_q = "",
    referral_date = "", training_date = "",
    interview_date = "", ets_date = "", placement_date = "",
  } = options;

  return useQuery<{ data: CandidatePoolRow[]; meta: CandidatePoolMeta }>({
    queryKey: ["candidate-pool", {
      tab, page, q, date_from,
      name_q, email_q, phone_q, provider_q, comments_q,
      referral_date, training_date, interview_date, ets_date, placement_date,
    }],
    queryFn: async () => {
      const params = new URLSearchParams({ tab, page: String(page), limit: String(limit) });
      if (q)              params.set("q",              q);
      if (date_from)      params.set("date_from",      date_from);
      if (name_q)         params.set("name_q",         name_q);
      if (email_q)        params.set("email_q",        email_q);
      if (phone_q)        params.set("phone_q",        phone_q);
      if (provider_q)     params.set("provider_q",     provider_q);
      if (comments_q)     params.set("comments_q",     comments_q);
      if (referral_date)  params.set("referral_date",  referral_date);
      if (training_date)  params.set("training_date",  training_date);
      if (interview_date) params.set("interview_date", interview_date);
      if (ets_date)       params.set("ets_date",       ets_date);
      if (placement_date) params.set("placement_date", placement_date);
      const result = await api.list<CandidatePoolRow>(`/candidate-pool?${params}`);
      return result as { data: CandidatePoolRow[]; meta: CandidatePoolMeta };
    },
  });
}

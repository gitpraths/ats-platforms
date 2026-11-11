import { useQuery, keepPreviousData } from "@tanstack/react-query";
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
  industry_q?:      string;
  comments_q?:      string;
  staff_id?:        string;
  consultant_id?:   string;
  intention_to_work?: string;
  // Per-column date range filters (inclusive): "<x>" = from, "<x>_to" = to
  referral_date?:      string;
  training_date?:      string;
  interview_date?:     string;
  ets_date?:           string;
  placement_date?:     string;
  referral_date_to?:   string;
  training_date_to?:   string;
  interview_date_to?:  string;
  ets_date_to?:        string;
  placement_date_to?:  string;
  enabled?:         boolean;
}

const DATE_KEYS = [
  "referral_date", "training_date", "interview_date", "ets_date", "placement_date",
  "referral_date_to", "training_date_to", "interview_date_to", "ets_date_to", "placement_date_to",
] as const;

export function useCandidatePool(options: UseCandidatePoolOptions = {}) {
  const {
    tab = "all", page = 1, limit = 20,
    q = "", date_from = "",
    name_q = "", email_q = "", phone_q = "", provider_q = "", industry_q = "", comments_q = "",
    staff_id = "", consultant_id = "", intention_to_work = "",
    enabled = true,
  } = options;

  const dates = Object.fromEntries(DATE_KEYS.map((k) => [k, options[k] ?? ""])) as Record<typeof DATE_KEYS[number], string>;

  return useQuery<{ data: CandidatePoolRow[]; meta: CandidatePoolMeta }>({
    enabled,
    // Keep the previous result visible while refetching so the table (and the
    // filter inputs/date pickers in its header) is not unmounted on every change.
    placeholderData: keepPreviousData,
    queryKey: ["candidate-pool", {
      tab, page, q, date_from,
      name_q, email_q, phone_q, provider_q, industry_q, comments_q,
      staff_id, consultant_id, intention_to_work,
      ...dates,
    }],
    queryFn: async () => {
      const params = new URLSearchParams({ tab, page: String(page), limit: String(limit) });
      if (q)                 params.set("q",                 q);
      if (date_from)         params.set("date_from",         date_from);
      if (name_q)            params.set("name_q",            name_q);
      if (email_q)           params.set("email_q",           email_q);
      if (phone_q)           params.set("phone_q",           phone_q);
      if (provider_q)        params.set("provider_q",        provider_q);
      if (industry_q)        params.set("industry_q",        industry_q);
      if (comments_q)        params.set("comments_q",        comments_q);
      if (staff_id)          params.set("staff_id",          staff_id);
      if (consultant_id)     params.set("consultant_id",     consultant_id);
      if (intention_to_work) params.set("intention_to_work", intention_to_work);
      for (const k of DATE_KEYS) {
        if (dates[k]) params.set(k, dates[k]);
      }
      const result = await api.list<CandidatePoolRow>(`/candidate-pool?${params}`);
      return result as { data: CandidatePoolRow[]; meta: CandidatePoolMeta };
    },
  });
}

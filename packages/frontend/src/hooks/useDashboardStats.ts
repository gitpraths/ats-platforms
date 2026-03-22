import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface DashboardStats {
  jobs: {
    total: number;
    draft: number;
    published: number;
    archived: number;
  };
  applications: {
    total: number;
    active: number;
    hired_this_month: number;
    by_stage: {
      applied: number;
      screening: number;
      interview: number;
      offer: number;
      hired: number;
      rejected: number;
    };
  };
  candidates: {
    total: number;
  };
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn:  () => api.get<DashboardStats>("/stats"),
    staleTime: 30_000, // refresh every 30s
  });
}

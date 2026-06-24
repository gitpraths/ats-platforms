import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface DashboardStats {
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
      ets: number;
      hired: number;
      rejected: number;
    };
  };
  candidates: {
    total: number;
  };
  placements: {
    total: number;
    confirmed: number;
    this_month: number;
    overdue_welfare: number;
  };
  providers: {
    total: number;
    active: number;
  };
  employers: {
    total: number;
    active: number;
  };
  placements_by_staff?: {
    user_id: string;
    name: string;
    total_placements: number;
    placements_this_month: number;
  }[];
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn:  () => api.get<DashboardStats>("/stats"),
    staleTime: 30_000,
  });
}

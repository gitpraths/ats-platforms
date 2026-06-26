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

// Recharts pivot row: { month: 'Jan 2026', 'Provider A': 3, ... }
export type ChartMonth = Record<string, string | number>;

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn:  () => api.get<DashboardStats>("/stats"),
    staleTime: 30_000,
  });
}

export function useTrainingByType() {
  return useQuery<ChartMonth[]>({
    queryKey: ["dashboard-training-by-type"],
    queryFn:  () => api.get<ChartMonth[]>("/stats/training-by-type"),
    staleTime: 60_000,
  });
}

export function useCandidatesByProvider() {
  return useQuery<ChartMonth[]>({
    queryKey: ["dashboard-candidates-by-provider"],
    queryFn:  () => api.get<ChartMonth[]>("/stats/candidates-by-provider"),
    staleTime: 60_000,
  });
}

export function usePlacementsByProvider() {
  return useQuery<ChartMonth[]>({
    queryKey: ["dashboard-placements-by-provider"],
    queryFn:  () => api.get<ChartMonth[]>("/stats/placements-by-provider"),
    staleTime: 60_000,
  });
}

export function usePlacementsByStaff() {
  return useQuery<ChartMonth[]>({
    queryKey: ["dashboard-placements-by-staff"],
    queryFn:  () => api.get<ChartMonth[]>("/stats/placements-by-staff"),
    staleTime: 60_000,
  });
}


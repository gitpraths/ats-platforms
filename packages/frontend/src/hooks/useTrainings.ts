import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Training } from "../types";

export interface TrainingFilters {
  search?: string;
  providerId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

function buildQuery(filters: TrainingFilters): string {
  const params = new URLSearchParams();
  if (filters.search)    params.set("search", filters.search);
  if (filters.providerId) params.set("provider_id", filters.providerId);
  if (filters.isActive !== undefined) params.set("is_active", String(filters.isActive));
  if (filters.page)  params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useTrainings(filters: TrainingFilters = {}) {
  return useQuery({
    queryKey: ["trainings", filters],
    queryFn:  () => api.list<Training>(`/trainings${buildQuery(filters)}`),
  });
}

export function useTraining(id: string | undefined) {
  return useQuery({
    queryKey: ["training", id],
    queryFn:  () => api.get<Training>(`/trainings/${id}`),
    enabled:  !!id,
  });
}

export interface TrainingPayload {
  name: string;
  code?: string | null;
  description?: string | null;
  duration_days?: number | null;
  provider_id?: string | null;
  is_active?: boolean;
}

export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TrainingPayload) => api.post<Training>("/trainings", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trainings"] }),
  });
}

export function useUpdateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<TrainingPayload> }) =>
      api.patch<Training>(`/trainings/${id}`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["trainings"] });
      qc.invalidateQueries({ queryKey: ["training", vars.id] });
    },
  });
}

export function useDeleteTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/trainings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trainings"] }),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CandidateTraining, TrainingStatus } from "../types";

export function useCandidateTrainings(candidateId: string | undefined) {
  return useQuery({
    queryKey: ["candidate-trainings", candidateId],
    queryFn:  () => api.get<CandidateTraining[]>(`/candidates/${candidateId}/trainings`),
    enabled:  !!candidateId,
  });
}

export interface EnrolmentPayload {
  candidate_id: string;
  training_id: string;
  status?: TrainingStatus;
  start_date?: string | null;
  end_date?: string | null;
  certificate_no?: string | null;
  notes?: string | null;
}

export function useCreateEnrolment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EnrolmentPayload) => api.post<CandidateTraining>("/candidate-trainings", body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["candidate-trainings", vars.candidate_id] });
      qc.invalidateQueries({ queryKey: ["candidate", vars.candidate_id] });
    },
  });
}

export interface EnrolmentUpdate {
  id: string;
  candidate_id: string;
  body: Partial<Omit<EnrolmentPayload, "candidate_id" | "training_id">>;
}

export function useUpdateEnrolment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: EnrolmentUpdate) =>
      api.patch<CandidateTraining>(`/candidate-trainings/${id}`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["candidate-trainings", vars.candidate_id] });
      qc.invalidateQueries({ queryKey: ["candidate", vars.candidate_id] });
    },
  });
}

export function useDeleteEnrolment(candidateId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/candidate-trainings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate-trainings", candidateId] });
      qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
    },
  });
}

export interface EnrolmentListFilters {
  status?: import("../types").TrainingStatus[];
  training_id?: string;
  provider_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

function buildListQuery(f: EnrolmentListFilters): string {
  const p = new URLSearchParams();
  if (f.status && f.status.length) p.set("status", f.status.join(","));
  if (f.training_id) p.set("training_id", f.training_id);
  if (f.provider_id) p.set("provider_id", f.provider_id);
  if (f.date_from)   p.set("date_from", f.date_from);
  if (f.date_to)     p.set("date_to", f.date_to);
  if (f.search)      p.set("search", f.search);
  if (f.page)        p.set("page", String(f.page));
  if (f.limit)       p.set("limit", String(f.limit));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function useCandidateTrainingsList(filters: EnrolmentListFilters) {
  return useQuery({
    queryKey: ["candidate-trainings-list", filters],
    queryFn:  () => api.list<CandidateTraining & { candidate_name: string }>(
      `/candidate-trainings${buildListQuery(filters)}`
    ),
    placeholderData: (prev) => prev, // smooth pagination
  });
}

export interface TrainingStats {
  enrolled: number;
  in_progress: number;
  completed: number;
  withdrawn: number;
  failed: number;
}

export function useTrainingStats(filters: Omit<EnrolmentListFilters, "status" | "page" | "limit">) {
  return useQuery({
    queryKey: ["training-stats", filters],
    queryFn:  () => api.get<TrainingStats>(`/candidate-trainings/stats${buildListQuery(filters)}`),
  });
}

export interface BulkEnrolPayload {
  training_id: string;
  start_date: string;
  end_date?: string | null;
  candidate_ids: string[];
}

export interface BulkEnrolResult {
  created: (CandidateTraining & { candidate_name: string })[];
  skipped: { candidate_id: string; reason: string }[];
}

export function useBulkEnrolment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkEnrolPayload) =>
      api.post<BulkEnrolResult>("/candidate-trainings/bulk", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate-trainings-list"] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      // affected candidates' per-candidate lists are invalidated wholesale:
      qc.invalidateQueries({ queryKey: ["candidate-trainings"] });
    },
  });
}

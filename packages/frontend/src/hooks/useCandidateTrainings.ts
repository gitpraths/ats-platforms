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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { XeroConnection, XeroContact, XeroInvoiceRow } from "../types";

export function useXeroConnection() {
  return useQuery({
    queryKey: ["xero-connection"],
    queryFn:  () => api.get<XeroConnection | null>("/xero/connection"),
  });
}

export function useXeroAuthUrl() {
  return useMutation({
    mutationFn: () => api.get<{ url: string }>("/xero/auth-url"),
  });
}

export function useDisconnectXero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/xero/connection"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["xero-connection"] }),
  });
}

export function useXeroContactSearch(search: string) {
  return useQuery({
    queryKey: ["xero-contacts", search],
    queryFn:  () => api.list<XeroContact>(`/xero/contacts?search=${encodeURIComponent(search)}`),
    enabled:  search.trim().length > 0,
  });
}

export function useCreateXeroContact() {
  return useMutation({
    mutationFn: (body: { name: string; email?: string | null }) =>
      api.post<XeroContact>("/xero/contacts", body),
  });
}

export function useLinkProviderToXero() {
  const qc = useQueryClient();
  return useMutation({
    // Providers uses PUT /:id (with COALESCE for partial updates), not PATCH.
    mutationFn: ({ providerId, xero_contact_id }: { providerId: string; xero_contact_id: string | null }) =>
      api.put(`/providers/${providerId}`, { xero_contact_id }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["provider", vars.providerId] });
    },
  });
}

export interface GenerateInvoicePayload {
  candidate_training_id: string;
  unit_price: number;
  quantity?: number;
  xero_contact_id?: string;
}

export interface AmbiguousContactResponse {
  candidates: XeroContact[];
}

export function useGenerateXeroInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateInvoicePayload) =>
      api.post<XeroInvoiceRow>("/xero/invoices", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xero-invoices"] });
      qc.invalidateQueries({ queryKey: ["candidate-trainings"] });
      qc.invalidateQueries({ queryKey: ["candidate-trainings-list"] });
    },
  });
}

export function useXeroInvoicesForEnrolment(candidateTrainingId: string | undefined) {
  return useQuery({
    queryKey: ["xero-invoices", candidateTrainingId],
    queryFn:  () => api.list<XeroInvoiceRow>(`/xero/invoices?candidate_training_id=${candidateTrainingId}`),
    enabled:  !!candidateTrainingId,
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { SyncLog, SyncResult } from "../types";

export function useSyncLogs(providerId: string) {
  return useQuery<SyncLog[]>({
    queryKey: ["sync-logs", providerId],
    queryFn: () => api.get<SyncLog[]>(`/providers/${providerId}/sync-logs`),
    enabled: !!providerId,
  });
}

export function useMsAuthUrl(providerId: string) {
  return useMutation<{ url: string }, Error>({
    mutationFn: () => api.get<{ url: string }>(`/providers/${providerId}/ms-auth/url`),
  });
}

export function useDisconnect(providerId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: () => api.delete(`/providers/${providerId}/ms-auth`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider", providerId] });
      queryClient.invalidateQueries({ queryKey: ["sync-logs", providerId] });
    },
  });
}

export function useSaveSpreadsheet(providerId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { onedrive_url: string; onedrive_sheet_name: string }>({
    mutationFn: (body) => api.patch(`/providers/${providerId}/spreadsheet`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider", providerId] });
    },
  });
}

export function useTriggerSync(providerId: string) {
  const queryClient = useQueryClient();
  return useMutation<SyncResult, Error>({
    mutationFn: () => api.post<SyncResult>(`/providers/${providerId}/sync`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-logs", providerId] });
      queryClient.invalidateQueries({ queryKey: ["provider", providerId] });
    },
  });
}

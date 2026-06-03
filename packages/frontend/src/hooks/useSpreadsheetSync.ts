import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { SyncLog, SyncResult } from "../types";

export interface OneDriveFile {
  id: string;
  name: string;
  last_modified: string | null;
}

export interface OneDriveSheet {
  id: string;
  name: string;
}

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
  return useMutation<void, Error, { onedrive_file_id?: string; onedrive_url?: string; onedrive_sheet_name: string }>({
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

export function useSearchOneDriveFiles(providerId: string, query: string, enabled: boolean) {
  return useQuery<OneDriveFile[]>({
    queryKey: ["onedrive-files", providerId, query],
    queryFn: () => api.get<OneDriveFile[]>(`/providers/${providerId}/onedrive/files?q=${encodeURIComponent(query)}`),
    enabled: !!providerId && enabled,
    staleTime: 30_000,
  });
}

export function useOneDriveSheets(providerId: string, fileId: string | null) {
  return useQuery<OneDriveSheet[]>({
    queryKey: ["onedrive-sheets", providerId, fileId],
    queryFn: () => api.get<OneDriveSheet[]>(`/providers/${providerId}/onedrive/files/${fileId}/sheets`),
    enabled: !!providerId && !!fileId,
  });
}

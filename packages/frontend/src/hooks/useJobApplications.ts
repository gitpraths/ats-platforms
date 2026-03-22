import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Application } from "../types";

export function useJobApplications(jobId: string | undefined) {
  return useQuery<Application[]>({
    queryKey: ["applications", { jobId }],
    queryFn: () => api.get<Application[]>(`/applications?job_id=${jobId}`),
    enabled: !!jobId,
  });
}

export function useAllApplications() {
  return useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: () => api.get<Application[]>("/applications"),
  });
}

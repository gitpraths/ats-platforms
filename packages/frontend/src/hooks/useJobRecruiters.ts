import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Job } from "../types";

export function useJobRecruiters(jobId: string | undefined) {
  return useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ["job-recruiters", jobId],
    queryFn: async () => {
      const job = await api.get<Job>(`/jobs/${jobId}`);
      return job.recruiters ?? [];
    },
    enabled: !!jobId,
  });
}

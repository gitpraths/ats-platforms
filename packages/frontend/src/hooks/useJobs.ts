import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Job, JobStatus } from "../types";

interface UseJobsOptions {
  status?: JobStatus;
  department?: string;
  location?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export function useJobs(options: UseJobsOptions = {}) {
  const { status, department, location, q, page = 1, limit = 20 } = options;

  return useQuery<Job[]>({
    queryKey: ["jobs", { status, department, location, q, page, limit }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status)     params.set("status", status);
      if (department) params.set("department", department);
      if (location)   params.set("location", location);
      if (q)          params.set("q", q);
      params.set("page", String(page));
      params.set("limit", String(limit));
      return api.get<Job[]>(`/jobs?${params.toString()}`);
    },
  });
}

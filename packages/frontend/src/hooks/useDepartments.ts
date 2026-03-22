import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Department } from "../types";

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => api.get<Department[]>("/departments"),
    staleTime: 5 * 60 * 1000, // 5 min — departments rarely change
  });
}

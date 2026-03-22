import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Location } from "../types";

export function useLocations(q?: string) {
  return useQuery<Location[]>({
    queryKey: ["locations", q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      return api.get<Location[]>(`/locations?${params.toString()}`);
    },
    staleTime: 5 * 60 * 1000,
  });
}

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { User } from "../types";

export function useRecruiters() {
  return useQuery<User[]>({
    queryKey: ["recruiters"],
    queryFn:  () => api.get<User[]>("/users?role=recruiter"),
    staleTime: 60_000,
  });
}

export function useRecruiterAdmins() {
  return useQuery<User[]>({
    queryKey: ["recruiter-admins"],
    queryFn:  () => api.get<User[]>("/users?role=recruiter_admin"),
    staleTime: 60_000,
  });
}

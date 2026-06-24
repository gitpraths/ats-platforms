import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function displayEmail(email: string | null | undefined): string {
  if (!email || email.endsWith("@sync.local")) return "—";
  return email;
}

const STAGE_LABELS: Record<string, string> = {
  applied:   "Refer",
  interview: "Interview",
  ets:       "ETS",
  hired:     "Placed",
  rejected:  "Rejected",
  screening: "Screening",
};

export function stageLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return STAGE_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
}

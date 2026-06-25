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

/**
 * Format a date string or Date object as DD/MM/YYYY (Australian standard).
 * Returns "—" for null / undefined / empty values.
 */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  const day   = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year  = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a datetime string as DD/MM/YYYY h:mm am/pm (Australian standard).
 * Returns "—" for null / undefined / empty values.
 */
export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  let   hours = d.getHours();
  const mins  = String(d.getMinutes()).padStart(2, "0");
  const ampm  = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${hours}:${mins} ${ampm}`;
}

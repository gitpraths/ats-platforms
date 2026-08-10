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

/**
 * Normalizes a date value (YYYY-MM-DD, ISO string, or DD/MM/YYYY) into a YYYY-MM-DD string in UTC.
 */
export function toYYYYMMDD(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
      const parts = trimmed.split("/");
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Validates that targetDate is on or after (>=) referenceAppliedDate.
 * Same-day dates (targetDate === referenceAppliedDate) are fully supported.
 * Returns error string if targetDate < referenceAppliedDate, or null if valid.
 */
export function validateNotBeforeApplied(
  targetDate: string | null | undefined,
  referenceAppliedDate: string | null | undefined
): string | null {
  if (!targetDate || !referenceAppliedDate) return null;
  const targetIso = toYYYYMMDD(targetDate);
  const refIso = toYYYYMMDD(referenceAppliedDate);
  if (targetIso && refIso && targetIso < refIso) {
    return "Date cannot be before Applied Date";
  }
  return null;
}

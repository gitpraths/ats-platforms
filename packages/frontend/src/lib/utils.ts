import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function displayEmail(email: string | null | undefined): string {
  if (!email || email.endsWith("@sync.local")) return "—";
  return email;
}

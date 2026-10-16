const ROMAN_NUMERALS = new Set(["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);

/**
 * Formats a string to Title Case (first letter capitalized for each word).
 * Handles names with apostrophes (e.g., O'Connor, D'Arcy), hyphens (e.g., Smith-Jones),
 * Scottish prefixes (McDonald), and common Roman numerals (e.g., Certificate III).
 *
 * Example:
 *   toTitleCase("GAKU MORIMOTO") => "Gaku Morimoto"
 *   toTitleCase("o'connor") => "O'Connor"
 */
export function toTitleCase(str) {
  if (!str || typeof str !== "string") return str || "";
  return str.replace(/[a-zA-ZÀ-ÿ]+/g, (word) => {
    const upper = word.toUpperCase();
    if (ROMAN_NUMERALS.has(upper)) {
      return upper;
    }
    const lower = word.toLowerCase();
    if (lower.startsWith("mc") && word.length > 2) {
      return "Mc" + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

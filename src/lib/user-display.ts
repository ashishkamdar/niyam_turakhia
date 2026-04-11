/**
 * Tiny formatting helpers for rendering the "who is logged in" card
 * in the sidebar and mobile more-menu. Pure functions, shared so
 * both places produce identical initials + role pills.
 */

export type DisplayRole = "super_admin" | "admin" | "staff";

/**
 * Derive 1-2 letter initials from a PIN label.
 *
 *   "Niyam"            → "N"
 *   "Niyam Turakhia"   → "NT"
 *   "Ashish Kamdar"    → "AK"
 *   "Mumbai Staff"     → "MS"
 *   ""                 → "?"
 *
 * Strips empty tokens, uppercases, and caps at 2 characters so the
 * avatar circle stays a consistent visual weight.
 */
export function initialsFromLabel(label: string | null | undefined): string {
  if (!label) return "?";
  const tokens = label
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].charAt(0).toUpperCase();
  return (tokens[0].charAt(0) + tokens[1].charAt(0)).toUpperCase();
}

/**
 * Human-readable role label. The DB stores snake_case ("super_admin")
 * because that's easier to pattern-match on the server; the UI needs
 * title case with a space for display.
 */
export function roleLabel(role: DisplayRole | string | null | undefined): string {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return "Staff";
}

/**
 * Accent color per role — used for the small avatar circle in the
 * sidebar / more-menu user card. Violet matches the "Super Admin"
 * pill on /users for consistency.
 */
export function roleAccentClass(role: DisplayRole | string | null | undefined): string {
  if (role === "super_admin") return "bg-violet-500/20 text-violet-200 ring-violet-400/40";
  if (role === "admin") return "bg-amber-500/20 text-amber-200 ring-amber-400/40";
  return "bg-gray-500/20 text-gray-200 ring-gray-400/40";
}

// design/IMPLEMENTATION_BRIEF.md: "Money: format with one helper,
// formatALL(amount) -> 'ALL 12,200', tabular numbers." Amounts are stored in
// Convex as whole-number ALL (Lek has no minor unit in everyday use), so no
// cents division is needed.
export function formatALL(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
  return `${sign}ALL ${formatted}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic avatar colour from a stable id/name, matching the 5 avatar
// tints in design/png/15 (pink/blue/amber/violet/teal). Tailwind classes
// reference literal colours (not the brand/status tokens), since these are
// purely cosmetic per-person tints, not semantic states.
const AVATAR_TINTS = [
  "bg-[#F8D7DA] text-[#7A2230]", // pink
  "bg-[#DCE6FD] text-[#1E3A8A]", // blue
  "bg-[#FBEBC5] text-[#7A4E07]", // amber
  "bg-[#EBDDFD] text-[#4C1D95]", // violet
  "bg-[#CFF1F4] text-[#0B5563]", // teal
] as const;

export function avatarTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

export function ageFromDob(dob: number | undefined, now = Date.now()): number | null {
  if (dob === undefined) return null;
  const dobDate = new Date(dob);
  const nowDate = new Date(now);
  let age = nowDate.getFullYear() - dobDate.getFullYear();
  const monthDiff = nowDate.getMonth() - dobDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && nowDate.getDate() < dobDate.getDate())) {
    age -= 1;
  }
  return age;
}

export function sexLetter(gender: "male" | "female" | "other" | undefined): string {
  if (gender === "male") return "M";
  if (gender === "female") return "F";
  if (gender === "other") return "O";
  return "—";
}

export function formatDate(ts: number | undefined, locale: string): string {
  if (ts === undefined) return "—";
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}

export function formatDateTime(ts: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

// Albanian-aware search normalization (spec Sec12): "the reason to do i18n
// properly on day one isn't the seven languages -- it's that retrofitting it
// means touching every string in the app." The search index itself only
// stores what this file produces, so a user typing "elz" (no diacritic)
// must still find "Elzë".

const ALBANIAN_MAP: Record<string, string> = {
  ë: "e",
  Ë: "e",
  ç: "c",
  Ç: "c",
};

export function normalizeAlbanian(input: string): string {
  const withAlbanianMapped = input
    .split("")
    .map((ch) => ALBANIAN_MAP[ch] ?? ch)
    .join("");
  return withAlbanianMapped
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip remaining combining diacritics
    .toLowerCase()
    .trim();
}

export function buildSearchBlob(patient: {
  firstName: string;
  lastName: string;
  phone: string;
  nid?: string;
}): string {
  return [
    normalizeAlbanian(patient.firstName),
    normalizeAlbanian(patient.lastName),
    patient.phone,
    patient.nid ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

import { defineRouting } from "next-intl/routing";

// design/IMPLEMENTATION_BRIEF.md's route table (/login, /calendar, ...) is
// the same pages one segment deeper, per the confirmed decision: /calendar
// becomes app/[locale]/calendar. Default locale is `sq` -- clinics are in
// Albania -- and the prefix is always shown ("routed /[locale]/" per
// CLAUDE.md Sec12, read literally).
export const routing = defineRouting({
  locales: ["sq", "en"],
  defaultLocale: "sq",
  localePrefix: "always",
});
